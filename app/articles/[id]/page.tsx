"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseRestFetch } from "@/lib/supabase/rest";

export default function SchoolArticleDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      // Supabaseのarticlesテーブルから直接取得
      const res = await supabaseRestFetch<any[]>({
        path: `articles?id=eq.${id}`,
      });
      if (res && res.length > 0) {
        setData(res[0]);
      }
    }
    fetchData();
  }, [id]);

  if (!data) return <div>読み込み中...</div>;

  return (
    <div>
      <h1>{data.title}</h1>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{data.content}</pre>
    </div>
  );
}