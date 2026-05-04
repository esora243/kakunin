import "./globals.css"; // 環境に合わせてパスは調整してください
import Link from "next/link";
import { Briefcase, GraduationCap, Users, MessageCircle, User, Building2 } from "lucide-react";

export const metadata = {
  title: "Hugmeid - 6万人の医学生で創る縁",
  description: "医学生のための総合プラットフォーム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      {/* 背景をわずかに温かみのある白に設定 */}
      <body className="bg-[#fffcfc] text-gray-900 font-sans antialiased m-0 p-0 min-h-screen flex flex-col">
        
        {/* ========================================================= */}
        {/* 白い共通ヘッダー（画像2枚目に完全準拠） */}
        {/* ========================================================= */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-50 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
            
            {/* 左側・中央: ロゴエリア（クリックでトップへ） */}
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm">
                Hm
              </div>
              <div>
                <h1 className="text-orange-500 font-bold text-xl leading-none tracking-tight">Hugmeid</h1>
                <p className="text-[10px] text-gray-400 mt-1 font-medium">6万人の医学生で創る縁</p>
              </div>
            </Link>

            {/* 中央: メインナビゲーション */}
            <nav className="hidden md:flex items-center gap-8 absolute left-1/2 transform -translate-x-1/2">
              {/* ※実際の運用時は現在のページURLを取得して active 状態（オレンジ色）を切り替えます */}
              <Link href="/jobs" className="flex flex-col items-center gap-1 text-orange-500 transition-colors">
                <Briefcase size={22} />
                <span className="text-[10px] font-bold">求人</span>
              </Link>
              <Link href="/school" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
                <GraduationCap size={22} />
                <span className="text-[10px] font-bold">学校</span>
              </Link>
              <Link href="/activities" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
                <Users size={22} />
                <span className="text-[10px] font-bold">課外活動</span>
              </Link>
              <Link href="/connect" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
                <MessageCircle size={22} />
                <span className="text-[10px] font-bold">繋がり</span>
              </Link>
              <Link href="/mypage" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
                <User size={22} />
                <span className="text-[10px] font-bold">マイページ</span>
              </Link>
            </nav>

            {/* 右側: スポンサーリンク */}
            <Link href="/sponsors" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
              <Building2 size={22} />
              <span className="text-[10px] font-bold">スポンサー</span>
            </Link>
          </div>
        </header>

        {/* ========================================================= */}
        {/* ページごとのコンテンツがここに入ります */}
        {/* ========================================================= */}
        <main className="flex-1">
          {children}
        </main>
        
        {/* ※下部の黒いフッターコードは完全に削除しています */}

      </body>
    </html>
  );
}