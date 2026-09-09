"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Banner } from "@/components/ui/Banner";
import { Card } from "@/components/ui/Card";

type ImportResult = {
  inserted: number;
  skippedDuplicates: number;
  errors: Array<{ row: number; message: string }>;
};

const SAMPLE_CSV = `university_name,academic_year,term_number,department_label,class_title,day_of_week,period,room,instructor,note,source_url,sort_order
東京大学,2026,1,医学部,解剖学Ⅰ,月,1,101講義室,山田太郎,,https://example.edu/timetable,0
東京大学,2026,1,医学部,生理学Ⅰ,火,2,102講義室,佐藤花子,,,0
東京大学,2026,1,医学部,生化学,水,3,,,,,0`;

export function TimetableCsvImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);

  async function handleImport() {
    if (inFlightRef.current) return;
    if (!file) {
      setError("CSVファイルを選択してください");
      return;
    }
    inFlightRef.current = true;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/school/timetable/import", { method: "POST", body });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error?.message ?? "CSVの取り込みに失敗しました");
        return;
      }
      const data = (await response.json()) as { result: ImportResult };
      setResult(data.result);
      if (data.result.inserted > 0) {
        toast.success(`${data.result.inserted}件の時間割を登録しました`);
      }
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      inFlightRef.current = false;
      setUploading(false);
    }
  }

  function downloadSample() {
    const blob = new Blob(["\uFEFF" + SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "timetable_sample.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {error ? <Banner variant="error" title="取り込みに失敗しました">{error}</Banner> : null}

      <Card title="CSVファイルを選択" description="1行目はヘッダー行です。UTF-8 (BOM付き可) / 最大 2 MB / 1000 行まで">
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="text-sm text-stone-700 file:mr-3 file:rounded-md file:border file:border-stone-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-stone-700 hover:file:bg-stone-50"
          />
          <Button type="button" onClick={() => void handleImport()} disabled={uploading || !file}>
            {uploading ? "取り込み中…" : "取り込む"}
          </Button>
          <Button type="button" variant="secondary" onClick={downloadSample}>
            サンプルCSVをダウンロード
          </Button>
        </div>
      </Card>

      {result ? (
        <Card title="取り込み結果">
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-stone-500">新規登録</dt>
              <dd className="font-mono text-lg font-semibold text-stone-900">{result.inserted}件</dd>
            </div>
            <div>
              <dt className="text-stone-500">重複スキップ</dt>
              <dd className="font-mono text-lg font-semibold text-stone-900">{result.skippedDuplicates}件</dd>
            </div>
            <div>
              <dt className="text-stone-500">エラー</dt>
              <dd className="font-mono text-lg font-semibold text-red-600">{result.errors.length}件</dd>
            </div>
          </dl>
          {result.errors.length > 0 ? (
            <ul className="mt-4 space-y-1 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {result.errors.slice(0, 20).map((entry) => (
                <li key={entry.row}>{entry.row}行目: {entry.message}</li>
              ))}
              {result.errors.length > 20 ? <li>…ほか {result.errors.length - 20} 件</li> : null}
            </ul>
          ) : null}
        </Card>
      ) : null}

      <Card title="CSVフォーマット">
        <p className="text-sm text-stone-600">
          ヘッダー行の列名は英語・日本語どちらでも使えます。大学は <code>university_id</code> の代わりに{" "}
          <code>university_name</code> (大学名) でも指定でき、未登録の大学名は自動で登録されます。
          同じ大学・年度・学期・学科・科目・曜限の行は重複登録されずスキップされます。
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md bg-stone-100 p-3 text-xs text-stone-800">{SAMPLE_CSV}</pre>
      </Card>
    </div>
  );
}
