"use client";

import { useEffect, useState } from "react";
import { supabaseRestFetch } from "@/lib/supabase/rest";

export default function SchoolPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function testFetch() {
      try {
        // 余計な処理を一切省き、ただデータを取りに行くだけ
        const res = await supabaseRestFetch<any>({ path: "timetable_classes?select=*" });
        setData(res);
      } catch (err: any) {
        setError(err.message || String(err));
      } finally {
        setLoading(false);
      }
    }
    testFetch();
  }, []);

  return (
    <div style={{ padding: "20px", background: "white", color: "black", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <h1 style={{ color: "red" }}>【テスト画面】この文字が見えれば、画面のクラッシュは直っています</h1>
      
      <div style={{ marginTop: "20px", padding: "15px", border: "2px solid #ccc" }}>
        <h2>1. 通信ステータス: {loading ? "データ取得中..." : "完了"}</h2>
        
        <h2>2. エラー情報: <span style={{ color: "red" }}>{error ? error : "エラーなし"}</span></h2>
        
        <h2>3. 取得できたデータ件数: {Array.isArray(data) ? `${data.length}件` : "配列ではありません"}</h2>
      </div>

      <h3 style={{ marginTop: "20px" }}>▼ 取得した生データ（最初の2件だけ表示）</h3>
      <pre style={{ background: "#f4f4f4", padding: "10px", border: "1px solid #ddd", overflow: "auto" }}>
        {JSON.stringify(Array.isArray(data) ? data.slice(0, 2) : data, null, 2)}
      </pre>
    </div>
  );
}