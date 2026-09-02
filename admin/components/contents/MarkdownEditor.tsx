"use client";

import { useEffect, useRef, useState } from "react";
import { Bold, Code2, Eye, Heading2, ImagePlus, Italic, Link, List, ListOrdered, Pencil, Quote } from "lucide-react";
import { renderSanitizedContentHtml } from "@/lib/markdown";
import { cx } from "@/components/ui/cn";

type ViewMode = "edit" | "preview";

export function MarkdownEditor({
  value,
  onChange,
  onUploadImage,
  uploadDisabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  onUploadImage: (file: File) => Promise<string | null>;
  uploadDisabled?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncingRef = useRef(false);
  const [html, setHtml] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [scrollSync, setScrollSync] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(() => {
      void renderSanitizedContentHtml(value).then((rendered) => {
        if (active) setHtml(rendered);
      });
    }, 120);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [value]);

  function replaceSelection(before: string, after = before, placeholder = "テキスト") {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = `${value.slice(0, start)}${before}${selected}${after}${value.slice(end)}`;
    onChange(next);
    window.requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function prefixLines(prefix: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = value.lastIndexOf("\n", textarea.selectionStart - 1) + 1;
    const selectionEnd = textarea.selectionEnd;
    const endIndex = value.indexOf("\n", selectionEnd);
    const end = endIndex === -1 ? value.length : endIndex;
    const selected = value.slice(start, end) || "項目";
    const nextBlock = selected.split("\n").map((line, index) => `${prefix.replace("{n}", String(index + 1))}${line}`).join("\n");
    onChange(`${value.slice(0, start)}${nextBlock}${value.slice(end)}`);
    window.requestAnimationFrame(() => textarea.focus());
  }

  function syncScroll(source: HTMLElement, target: HTMLElement) {
    if (!scrollSync || syncingRef.current) return;
    const sourceRange = source.scrollHeight - source.clientHeight;
    const targetRange = target.scrollHeight - target.clientHeight;
    if (sourceRange <= 0 || targetRange <= 0) return;
    syncingRef.current = true;
    target.scrollTop = (source.scrollTop / sourceRange) * targetRange;
    window.requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }

  async function uploadImage(file: File) {
    if (uploadDisabled) return;
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      if (url) replaceSelection(`![`, `](${url})`, file.name.replace(/\.[^.]+$/, "") || "画像");
    } finally {
      setUploading(false);
    }
  }

  const tools = [
    { id: "heading", label: "見出し", icon: Heading2 },
    { id: "bold", label: "太字", icon: Bold },
    { id: "italic", label: "斜体", icon: Italic },
    { id: "link", label: "リンク", icon: Link },
    { id: "quote", label: "引用", icon: Quote },
    { id: "list", label: "箇条書き", icon: List },
    { id: "ordered-list", label: "番号付き", icon: ListOrdered },
    { id: "code", label: "コード", icon: Code2 },
  ] as const;

  function applyTool(id: (typeof tools)[number]["id"]) {
    if (id === "heading") prefixLines("## ");
    if (id === "bold") replaceSelection("**", "**");
    if (id === "italic") replaceSelection("*", "*");
    if (id === "link") replaceSelection("[", "](https://)");
    if (id === "quote") prefixLines("> ");
    if (id === "list") prefixLines("- ");
    if (id === "ordered-list") prefixLines("{n}. ");
    if (id === "code") replaceSelection("`", "`", "コード");
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone-300 bg-white shadow-sm">
      <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-stone-200 bg-stone-50 px-2 py-1.5">
        <div className="flex flex-wrap items-center gap-0.5">
          {tools.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" title={label} aria-label={label} onClick={() => applyTool(id)} className="rounded-md p-2 text-stone-500 hover:bg-white hover:text-stone-900 hover:shadow-sm">
              <Icon className="h-4 w-4" />
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-stone-200" />
          <button type="button" disabled={uploading || uploadDisabled} title="画像を挿入" aria-label="画像を挿入" onClick={() => fileInputRef.current?.click()} className="rounded-md p-2 text-stone-500 hover:bg-white hover:text-stone-900 hover:shadow-sm disabled:opacity-50">
            <ImagePlus className="h-4 w-4" />
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void uploadImage(file);
            event.currentTarget.value = "";
          }} />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg bg-stone-200/70 p-0.5 lg:hidden">
            <button type="button" onClick={() => setViewMode("edit")} className={cx("flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium", viewMode === "edit" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500")}><Pencil className="h-3.5 w-3.5" />編集</button>
            <button type="button" onClick={() => setViewMode("preview")} className={cx("flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium", viewMode === "preview" ? "bg-white text-stone-900 shadow-sm" : "text-stone-500")}><Eye className="h-3.5 w-3.5" />プレビュー</button>
          </div>
          <label className="hidden cursor-pointer items-center gap-2 text-xs text-stone-500 lg:flex">
            <input type="checkbox" checked={scrollSync} onChange={(event) => setScrollSync(event.target.checked)} className="h-4 w-4 accent-orange-600" />
            スクロール同期
          </label>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 lg:divide-x lg:divide-stone-200">
        <div className={cx("relative", viewMode === "preview" && "hidden lg:block")}>
          <span className="absolute right-3 top-3 rounded bg-stone-100 px-2 py-1 text-[10px] font-medium text-stone-400">Markdown</span>
          <textarea
            ref={textareaRef}
            id="content-body"
            aria-label="本文"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (!(event.metaKey || event.ctrlKey)) return;
              const key = event.key.toLowerCase();
              if (key === "b") {
                event.preventDefault();
                replaceSelection("**", "**");
              } else if (key === "i") {
                event.preventDefault();
                replaceSelection("*", "*");
              } else if (key === "k") {
                event.preventDefault();
                replaceSelection("[", "](https://)");
              }
            }}
            onScroll={(event) => {
              if (previewRef.current) syncScroll(event.currentTarget, previewRef.current);
            }}
            onPaste={(event) => {
              const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith("image/"));
              if (image && !uploadDisabled) {
                event.preventDefault();
                void uploadImage(image);
              }
            }}
            onDragOver={(event) => {
              if (!uploadDisabled && Array.from(event.dataTransfer.items).some((item) => item.type.startsWith("image/"))) {
                event.preventDefault();
              }
            }}
            onDrop={(event) => {
              const image = Array.from(event.dataTransfer.files).find((file) => file.type.startsWith("image/"));
              if (image && !uploadDisabled) {
                event.preventDefault();
                void uploadImage(image);
              }
            }}
            placeholder="本文をMarkdownで入力"
            className="h-[620px] w-full resize-none bg-white px-6 py-8 pr-20 font-mono text-[15px] leading-7 text-stone-800 outline-none placeholder:text-stone-300"
          />
        </div>
        <div className={cx("relative bg-white", viewMode === "edit" && "hidden lg:block")}>
          <span className="absolute right-3 top-3 rounded bg-sky-100 px-2 py-1 text-[10px] font-medium text-sky-700">Preview</span>
          <div
            ref={previewRef}
            onScroll={(event) => {
              if (textareaRef.current) syncScroll(event.currentTarget, textareaRef.current);
            }}
            className="h-[620px] overflow-y-auto px-7 py-8 pt-14 text-sm leading-7 text-stone-700 [&_a]:text-orange-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-stone-200 [&_blockquote]:pl-4 [&_blockquote]:text-stone-500 [&_code]:rounded [&_code]:bg-stone-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_h1]:mb-5 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mb-4 [&_h2]:mt-9 [&_h2]:border-b [&_h2]:border-stone-200 [&_h2]:pb-2 [&_h2]:text-xl [&_h2]:font-bold [&_h3]:mb-3 [&_h3]:mt-7 [&_h3]:text-lg [&_h3]:font-semibold [&_img]:my-5 [&_img]:max-w-full [&_img]:rounded-lg [&_li]:ml-5 [&_ol]:my-4 [&_ol]:list-decimal [&_p]:my-4 [&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-stone-900 [&_pre]:p-4 [&_pre]:text-stone-100 [&_ul]:my-4 [&_ul]:list-disc"
            dangerouslySetInnerHTML={{ __html: html || '<p class="text-stone-400">ここにプレビューが表示されます</p>' }}
          />
        </div>
      </div>
      <div className="flex items-center justify-between border-t border-stone-200 bg-stone-50 px-4 py-2 text-xs text-stone-400">
        <span>{uploading || uploadDisabled ? "画像を追加しています..." : "画像は貼り付けまたはツールバーから追加できます"}</span>
        <span>{value.length.toLocaleString("ja-JP")}文字</span>
      </div>
    </div>
  );
}
