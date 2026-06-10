import type { Article } from "./types";
import articlesJson from "@/data/articles.json";

/**
 * articles.json をシングルソースとして扱うフェッチユーティリティ。
 *
 * 旧 lib/data.ts の `schoolArticles` / `activityArticles` という
 * JS で書かれた静的配列はもう使わず、本ファイル経由で必ず JSON から
 * 読み込むこと。SavedItemsContext / app/articles / app/saved 等で共有する。
 */

/** 生 JSON を Article 型として正規化 */
function normalize(item: any): Article {
  return {
    id: String(item.id ?? ""),
    type: item.type === "activity" ? "activity" : "school",
    title: String(item.title ?? "無題"),
    category: String(item.category ?? "未分類"),
    date: String(item.date ?? item.publish_date ?? ""),
    image: String(item.image ?? item.image_url ?? ""),
    excerpt: item.excerpt ?? "",
    content: item.content ?? "",
    url: item.url ?? undefined,
    author: item.author ?? undefined,
    tags: Array.isArray(item.tags) ? item.tags : [],
  };
}

/** クライアント / サーバー両対応の同期読み込み（バンドル時 JSON import） */
export function getAllArticles(): Article[] {
  return (articlesJson as any[]).map(normalize);
}

/** id（文字列 or 数値）で1件取得 */
export function getArticleById(id: string | number): Article | null {
  const all = getAllArticles();
  const target = String(id);
  return all.find((a) => String(a.id) === target) ?? null;
}

/**
 * カテゴリでフィルタ。
 * - "すべて" は全件返す
 * - "学習法" など個別カテゴリは exact match
 */
export function filterArticlesByCategory(articles: Article[], category: string): Article[] {
  if (!category || category === "すべて") return articles;
  return articles.filter((a) => a.category === category);
}

/** 日付降順ソート */
export function sortArticlesByDateDesc(articles: Article[]): Article[] {
  return [...articles].sort((a, b) => {
    const ta = new Date(a.date || 0).getTime();
    const tb = new Date(b.date || 0).getTime();
    return tb - ta;
  });
}
