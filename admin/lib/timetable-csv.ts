import "server-only";

import type { PoolClient } from "pg";
import { writeAuditLog } from "@/lib/audit";
import { ValidationError } from "@/lib/errors";
import { pickAdminTimetableInput, type AdminTimetableInput } from "@/lib/timetable-admin";

/**
 * 時間割 CSV 一括取り込み。
 *
 * 対応フォーマット (1行目はヘッダー):
 *   university_id,academic_year,term_number,department_label,class_title,day_of_week,period,room,instructor,note,source_url,sort_order
 *
 * - ヘッダー名は英語スネークケースのほか、日本語 (大学ID, 年度, 学期, 学科, 科目名, 曜日, 時限, 教室, 担当教員, 備考, 引用元URL, 表示順) も可。
 * - university_id の代わりに university_name (大学名) でも可。未登録の大学名は自動登録する。
 * - UTF-8 (BOM 付き可) / カンマ区切り。Excel から保存した CSV を想定。
 * - 同じ大学・年度・学期・学科・科目・曜限の既存行はスキップする (重複登録しない)。
 */

export const MAX_CSV_BYTES = 2 * 1024 * 1024;
export const MAX_CSV_ROWS = 1000;

const HEADER_ALIASES: Record<string, keyof CsvRowValues> = {
  university_id: "universityId",
  universityid: "universityId",
  "大学id": "universityId",
  university_name: "universityName",
  universityname: "universityName",
  "大学名": "universityName",
  academic_year: "academicYear",
  academicyear: "academicYear",
  "年度": "academicYear",
  term_number: "termNumber",
  termnumber: "termNumber",
  "学期": "termNumber",
  department_label: "departmentLabel",
  departmentlabel: "departmentLabel",
  department: "departmentLabel",
  "学科": "departmentLabel",
  "学科・課程": "departmentLabel",
  class_title: "classTitle",
  classtitle: "classTitle",
  title: "classTitle",
  "科目名": "classTitle",
  "科目": "classTitle",
  day_of_week: "dayOfWeek",
  dayofweek: "dayOfWeek",
  day: "dayOfWeek",
  "曜日": "dayOfWeek",
  period: "period",
  "時限": "period",
  room: "room",
  "教室": "room",
  instructor: "instructor",
  teacher: "instructor",
  "担当教員": "instructor",
  "担当": "instructor",
  note: "note",
  "備考": "note",
  source_url: "sourceUrl",
  sourceurl: "sourceUrl",
  "引用元url": "sourceUrl",
  sort_order: "sortOrder",
  sortorder: "sortOrder",
  "表示順": "sortOrder",
};

type CsvRowValues = {
  universityId: string;
  universityName: string;
  academicYear: string;
  termNumber: string;
  departmentLabel: string;
  classTitle: string;
  dayOfWeek: string;
  period: string;
  room: string;
  instructor: string;
  note: string;
  sourceUrl: string;
  sortOrder: string;
};

export type TimetableCsvImportResult = {
  inserted: number;
  skippedDuplicates: number;
  errors: Array<{ row: number; message: string }>;
};

/** RFC 4180 ベースのシンプルな CSV パーサ (ダブルクォート・改行含むセル対応)。 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  // BOM 除去
  if (text.charCodeAt(0) === 0xfeff) i = 1;
  for (; i < text.length; i += 1) {
    const char = text[i];
    if (inQuotes) {
      if (char === "\"") {
        if (text[i + 1] === "\"") {
          field += "\"";
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      current.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      current.push(field);
      field = "";
      // 完全に空の行は捨てる
      if (current.some((cell) => cell.trim() !== "")) rows.push(current);
      current = [];
    } else {
      field += char;
    }
  }
  if (field !== "" || current.length > 0) {
    current.push(field);
    if (current.some((cell) => cell.trim() !== "")) rows.push(current);
  }
  return rows;
}

function normalizeHeaderCell(value: string): string {
  return value.trim().toLowerCase().replace(/^\uFEFF/, "");
}

function mapHeaders(headerRow: string[]): Array<keyof CsvRowValues | null> {
  return headerRow.map((cell) => HEADER_ALIASES[normalizeHeaderCell(cell)] ?? null);
}

const DAY_INPUT_MAP: Record<string, string> = {
  月: "月", 火: "火", 水: "水", 木: "木", 金: "金", 土: "土",
  月曜: "月", 火曜: "火", 水曜: "水", 木曜: "木", 金曜: "金", 土曜: "土",
  月曜日: "月", 火曜日: "火", 水曜日: "水", 木曜日: "木", 金曜日: "金", 土曜日: "土",
  mon: "月", tue: "火", wed: "水", thu: "木", fri: "金", sat: "土",
};

function normalizeDayOfWeek(raw: string): string {
  const text = raw.trim();
  return DAY_INPUT_MAP[text] ?? DAY_INPUT_MAP[text.toLowerCase()] ?? text;
}

async function findOrCreateUniversityId(
  client: PoolClient,
  values: CsvRowValues,
  rowNumber: number,
): Promise<string> {
  if (values.universityId.trim()) return values.universityId.trim();
  const name = values.universityName.trim();
  if (!name) {
    throw new ValidationError(`${rowNumber}行目: university_id か university_name (大学名) のどちらかが必要です`, "missing_university");
  }
  const found = await client.query<{ id: string }>(
    "select id::text from universities where name = $1 limit 1",
    [name],
  );
  if (found.rows[0]) return found.rows[0].id;
  const created = await client.query<{ id: string }>(
    "insert into universities (name, is_active) values ($1, true) returning id::text",
    [name],
  );
  return created.rows[0].id;
}

/**
 * CSV テキストを解析して admin_university_timetable_entries に一括登録する。
 * 既存行との重複はスキップし、行単位のエラーは結果に集約する (途中で中断しない)。
 */
export async function importTimetableCsv(
  client: PoolClient,
  csvText: string,
  actorAdminId: string,
): Promise<TimetableCsvImportResult> {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new ValidationError("CSVにデータ行がありません (1行目はヘッダー行にしてください)", "csv_empty");
  }
  if (rows.length - 1 > MAX_CSV_ROWS) {
    throw new ValidationError(`CSVは最大 ${MAX_CSV_ROWS} 行までです`, "csv_too_many_rows");
  }

  const headerMap = mapHeaders(rows[0]);
  if (!headerMap.some((key) => key === "universityId" || key === "universityName")) {
    throw new ValidationError("ヘッダーに university_id か university_name (大学名) が必要です", "csv_header_missing");
  }
  for (const required of ["academicYear", "termNumber", "departmentLabel", "classTitle", "dayOfWeek", "period"] as const) {
    if (!headerMap.includes(required)) {
      throw new ValidationError(`ヘッダーに ${required} 列が必要です`, "csv_header_missing");
    }
  }

  const result: TimetableCsvImportResult = { inserted: 0, skippedDuplicates: 0, errors: [] };

  for (let index = 1; index < rows.length; index += 1) {
    const rowNumber = index + 1; // ヘッダー込みの行番号 (1始まり)
    const cells = rows[index];
    const values = {} as CsvRowValues;
    headerMap.forEach((key, cellIndex) => {
      if (!key) return;
      values[key] = (cells[cellIndex] ?? "").trim();
    });

    try {
      const universityId = await findOrCreateUniversityId(client, values, rowNumber);
      const input: AdminTimetableInput = pickAdminTimetableInput({
        universityId,
        academicYear: Number(values.academicYear),
        termNumber: Number(values.termNumber),
        departmentLabel: values.departmentLabel,
        classTitle: values.classTitle,
        dayOfWeek: normalizeDayOfWeek(values.dayOfWeek),
        period: Number(values.period),
        room: values.room || null,
        instructor: values.instructor || null,
        note: values.note || null,
        sourceUrl: values.sourceUrl || null,
        sortOrder: values.sortOrder ? Number(values.sortOrder) : 0,
        isActive: true,
      });

      // 重複チェック: 同じ大学・年度・学期・学科・科目・曜限の有効な行はスキップ
      const duplicate = await client.query<{ id: string }>(
        `select id::text from admin_university_timetable_entries
          where university_id = $1::uuid and academic_year = $2 and term_number = $3
            and department_label = $4 and class_title = $5 and day_of_week = $6 and period = $7
            and is_active = true
          limit 1`,
        [
          input.universityId,
          input.academicYear,
          input.termNumber,
          input.departmentLabel,
          input.classTitle,
          input.dayOfWeek,
          input.period,
        ],
      );
      if (duplicate.rows[0]) {
        result.skippedDuplicates += 1;
        continue;
      }

      const inserted = await client.query<{ id: string }>(
        `insert into admin_university_timetable_entries (
           university_id, academic_year, term_number, department_label, class_title,
           day_of_week, period, room, instructor, note, source_url, sort_order, is_active,
           created_by_admin_id, updated_by_admin_id
         ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, $13, $13)
         returning id::text`,
        [
          input.universityId,
          input.academicYear,
          input.termNumber,
          input.departmentLabel,
          input.classTitle,
          input.dayOfWeek,
          input.period,
          input.room,
          input.instructor,
          input.note,
          input.sourceUrl,
          input.sortOrder ?? 0,
          actorAdminId,
        ],
      );
      await writeAuditLog(client, {
        actorAdminId,
        action: "timetable.csv_import",
        resourceType: "admin_university_timetable_entries",
        resourceId: inserted.rows[0].id,
        afterSnapshot: { ...input, csvRow: rowNumber },
      });
      result.inserted += 1;
    } catch (error) {
      result.errors.push({
        row: rowNumber,
        message: error instanceof Error ? error.message : "不明なエラー",
      });
    }
  }

  return result;
}
