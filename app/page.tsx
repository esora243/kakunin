import { redirect } from "next/navigation";

/**
 * ルート(/)。
 * - 画面遷移書: 初回判定(LIFF)後はリッチメニュー、Web起動時は学校トップへ。
 * - Hugmeid mock の routes.tsx も index → School としているため、それに合わせる。
 */
export default function Home() {
  redirect("/school");
}
