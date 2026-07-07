"use client";

import { BookmarkCheck, BookmarkPlus } from "lucide-react";

/**
 * SaveButton - TestAPP ネイビーテイスト:
 *   通常: 灰色 → ネイビー(#1E3A8A) hover。保存済み: ネイビー塗り or 白抜き。
 * - compact モードはカード右上のフローティング配置(求人カード等)。
 */
type SaveButtonProps = {
  saved: boolean;
  onClick: () => void;
  compact?: boolean;
};

export function SaveButton({ saved, onClick, compact = false }: SaveButtonProps) {
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`absolute top-4 right-4 transition-colors active:scale-90 ${
          saved ? "text-[#1E3A8A]" : "text-gray-300 hover:text-[#1E3A8A]"
        }`}
        aria-label={saved ? "保存済みから外す" : "保存する"}
      >
        {saved ? (
          <BookmarkCheck size={22} strokeWidth={1.8} />
        ) : (
          <BookmarkPlus size={22} strokeWidth={1.5} />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-16 shrink-0 rounded-xl border transition-colors active:scale-95 py-2 ${
        saved
          ? "bg-[#1E3A8A] text-white border-[#1E3A8A]"
          : "bg-[#F2F4F8] text-[#1E3A8A] border-[#B9C2DB] hover:bg-[#B9C2DB]/30"
      }`}
      aria-label={saved ? "保存済みから外す" : "保存する"}
    >
      {saved ? (
        <BookmarkCheck size={20} className="mb-0.5" />
      ) : (
        <BookmarkPlus size={20} className="mb-0.5" />
      )}
      <span className="text-[10px] font-bold">{saved ? "保存済み" : "保存"}</span>
    </button>
  );
}
