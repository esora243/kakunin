/**
 * セッション有無の「ヒント」Cookie。
 *
 * 本体の `hugmeid_session` は httpOnly なのでクライアントから読めず、その結果
 * 未ログイン訪問者でも毎回 `/api/me` を叩いて 401 を受け、ブラウザのコンソールに
 * `Failed to load resource: 401` が残っていた (DevTools を開いた人には壊れて見える)。
 *
 * ここではセッションの**存在だけ**を示す非機密の値を別 Cookie に持たせ、
 * クライアントは「セッションが無いことが確定している」ときにリクエスト自体を送らない。
 *
 * - 認証判断は従来どおりサーバ側 (`hugmeid_session` の署名検証) が行う。
 * - `/api/me` の 401 という API 契約は変更していない。
 * - この Cookie を偽装しても得られるのは 401 だけで、権限は一切増えない。
 */
export const AUTH_SESSION_COOKIE = "hugmeid_session";
export const SESSION_HINT_COOKIE = "hugmeid_session_present";
export const SESSION_HINT_VALUE = "1";

/** ブラウザ側の判定。SSR 中は false を返す。 */
export function hasSessionHintCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .some((entry) => entry.trim() === `${SESSION_HINT_COOKIE}=${SESSION_HINT_VALUE}`);
}
