import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\[[^\]]+\]\(https:\/\/[^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((https:\/\/[^)]+)\)$/);
    if (link)
      return (
        <a
          key={index}
          href={link[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-600 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {link[1]}
        </a>
      );
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

/**
 * 本文の見出しは h2 から始める。
 * ページの h1 は記事タイトル (詳細画面側) が持つため、本文の `#` を h1 にすると
 * 1 ページに h1 が 2 つできてしまう。`#`→h2 / `##`→h3 / `###`→h4 に落とす。
 */
export function MarkdownContent({ source }: { source: string | null }) {
  if (!source) return null;
  const blocks: ReactNode[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (list.length) {
      blocks.push(
        <ul key={`list-${blocks.length}`} className="list-disc space-y-1 pl-6">
          {list.map((item, index) => (
            <li key={index}>{inline(item)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };

  source.split(/\r?\n/).forEach((line) => {
    if (line.startsWith("- ")) {
      list.push(line.slice(2));
      return;
    }
    flushList();
    if (!line.trim()) return;
    if (line.startsWith("### "))
      blocks.push(
        <h4 key={blocks.length} className="mt-6 text-body font-bold text-primary">
          {inline(line.slice(4))}
        </h4>,
      );
    else if (line.startsWith("## "))
      blocks.push(
        <h3 key={blocks.length} className="mt-6 text-h3 font-bold text-primary">
          {inline(line.slice(3))}
        </h3>,
      );
    else if (line.startsWith("# "))
      blocks.push(
        <h2 key={blocks.length} className="mt-7 text-h2 font-bold text-primary">
          {inline(line.slice(2))}
        </h2>,
      );
    else
      blocks.push(
        <p key={blocks.length} className="leading-8">
          {inline(line)}
        </p>,
      );
  });

  flushList();
  return <div className="space-y-3">{blocks}</div>;
}
