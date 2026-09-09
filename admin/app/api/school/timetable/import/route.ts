import { adminApiRoute } from "@/lib/api-route";
import { dbTransaction } from "@/lib/db/postgres";
import { importTimetableCsv, MAX_CSV_BYTES } from "@/lib/timetable-csv";
import { ValidationError, PayloadTooLargeError } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * 時間割 CSV 一括取り込み API。
 * multipart/form-data の `file` フィールド、または text/csv の生ボディを受け付ける。
 */
export const POST = adminApiRoute("any", async (identity, request) => {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  let csvText: string;

  if (contentType.startsWith("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    if (!formData) throw new ValidationError("CSVファイルの読み取りに失敗しました", "invalid_multipart");
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError("file フィールドにCSVファイルを指定してください", "file_missing");
    }
    if (file.size > MAX_CSV_BYTES) {
      throw new PayloadTooLargeError("CSVファイルは 2 MB までです", "file_too_large");
    }
    csvText = await file.text();
  } else {
    const declaredLength = Number(request.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_CSV_BYTES) {
      throw new PayloadTooLargeError("CSVファイルは 2 MB までです", "file_too_large");
    }
    csvText = await request.text();
  }

  if (!csvText.trim()) {
    throw new ValidationError("CSVファイルが空です", "csv_empty");
  }

  const result = await dbTransaction((client) => importTimetableCsv(client, csvText, identity.adminId));
  return { result };
});
