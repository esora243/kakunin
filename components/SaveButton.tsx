"use client";

import { BookmarkCheck, BookmarkPlus } from "lucide-react";

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
        className={`absolute top-4 right-4 transition-colors active:scale-90 ${saved ? "text-orange-500" : "text-gray-300 hover:text-orange-500"}`}
        aria-label={saved ? "保存済みから外す" : "保存する"}
      >
        {saved ? <BookmarkCheck size={22} strokeWidth={1.8} /> : <BookmarkPlus size={22} strokeWidth={1.5} />}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center w-16 shrink-0 rounded-xl border transition-colors active:scale-95 py-2 ${
        saved
          ? "bg-orange-500 text-white border-orange-500"
          : "bg-orange-50 text-orange-500 border-orange-100 hover:bg-orange-100"
      }`}
      aria-label={saved ? "保存済みから外す" : "保存する"}
    >
      {saved ? <BookmarkCheck size={20} className="mb-0.5" /> : <BookmarkPlus size={20} className="mb-0.5" />}
      <span className="text-[10px] font-bold">{saved ? "保存済み" : "保存"}</span>
    </button>
  );
}
