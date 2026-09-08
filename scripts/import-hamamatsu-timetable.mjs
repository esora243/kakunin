#!/usr/bin/env node
// 【P030】 浜松医科大学の時間割CSV取り込み
// 使い方:
//   node scripts/import-hamamatsu-timetable.mjs \
//     --csv cloudsql/seeds/hamamatsu/2026.csv \
//     --university "浜松医科大学" --academic-year 2026 --term-number 1
import { parse } from "csv-parse/sync";
import { readFile } from "node:fs/promises";
import { argv, exit } from "node:process";
import { Pool } from "pg";

function arg(name, def) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : def;
}

const csvPath = arg("csv", "cloudsql/seeds/hamamatsu/2026.csv");
const university = arg("university", "浜松医科大学");
const academicYear = Number(arg("academic-year", "2026"));
const termNumber = Number(arg("term-number", "1"));
const department = arg("department", "医学部");

const rows = parse(await readFile(csvPath, "utf8"), {
  columns: true,
  skip_empty_lines: true,
});

console.log(`importing ${rows.length} rows from ${csvPath}`);
console.log(
  `university=${university} term=${termNumber} academic_year=${academicYear} department=${department}`,
);

const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
});

const client = await pool.connect();
let inserted = 0,
  updated = 0,
  skipped = 0;

try {
  await client.query("begin");
  let uni = (
    await client.query("select id from universities where name = $1 limit 1", [university])
  ).rows[0];
  const uniId = uni?.id
    ? uni.id
    : (
        await client.query(
          "insert into universities(name, is_active) values ($1, true) returning id",
          [university],
        )
      ).rows[0].id;

  for (const r of rows) {
    if (r.university_name && r.university_name !== university) {
      skipped++;
      continue;
    }
    const gradeNum = Number(r.grade || 1);
    const pageQ = await client.query(
      `select id from syllabus_pages
         where university_id = $1 and academic_year = $2 and term_number = $3
           and grade = $4 and department = $5 and source_kind = 'hamamatsu_csv' limit 1`,
      [uniId, academicYear, termNumber, gradeNum, department],
    );
    const pageId = pageQ.rows[0]?.id ?? (
      await client.query(
        `insert into syllabus_pages
           (university_id, academic_year, term_number, grade, department, source_kind, is_active)
         values ($1, $2, $3, $4, $5, 'hamamatsu_csv', true) returning id`,
        [uniId, academicYear, termNumber, gradeNum, department],
      )
    ).rows[0].id;

    const schedule = JSON.stringify({
      day: r.day_of_week,
      period: Number(r.period),
      starts_at: r.time_start && r.time_start.length === 8 ? r.time_start : null,
      ends_at: r.time_end && r.time_end.length === 8 ? r.time_end : null,
    });

    const classKey = r.id || `${r.subject}|${r.date}|${r.period}`;
    const existed = await client.query(
      "select id from syllabus_class_entries where syllabus_page_id = $1 and class_key = $2",
      [pageId, classKey],
    );

    if (existed.rows[0]) {
      await client.query(
        `update syllabus_class_entries
           set title = $3, instructor = $4, room = $5, schedule = $6::jsonb,
               is_official = true, is_active = true
         where id = $2`,
        [pageId, existed.rows[0].id, r.subject, r.teacher || null, r.room || null, schedule],
      );
      updated++;
    } else {
      await client.query(
        `insert into syllabus_class_entries
           (syllabus_page_id, class_key, title, instructor, room, schedule,
            source_type, is_official, is_active)
         values ($1, $2, $3, $4, $5, $6::jsonb, 'hamamatsu_csv', true, true)`,
        [pageId, classKey, r.subject, r.teacher || null, r.room || null, schedule],
      );
      inserted++;
    }
  }
  await client.query("commit");
} catch (e) {
  await client.query("rollback");
  throw e;
} finally {
  client.release();
  await pool.end();
}

console.log(`inserted: ${inserted} / updated: ${updated} / skipped: ${skipped}`);
