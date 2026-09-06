import { NextResponse, type NextRequest } from "next/server";
import { AUTH_SESSION_COOKIE, SESSION_HINT_COOKIE, SESSION_HINT_VALUE } from "@/lib/auth/session-hint";

function configuredHttpsOrigin(value: string | undefined) {
  const text = value?.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

function contentSecurityPolicy(nonce: string) {
  const devScriptPolicy = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  const syllabusOrigin = configuredHttpsOrigin(process.env.NEXT_PUBLIC_SYLLABUS_URL);
  const lineScriptSources = ["https://static.line-scdn.net", "https://liffsdk.line-scdn.net"];
  const lineConnectSources = [
    "https://api.line.me",
    "https://access.line.me",
    "https://liff.line.me",
    "https://liff-subwindow.line.me",
    "https://liff-shortcut.line.me",
    "https://liffsdk.line-scdn.net",
    "https://uts-front.line-apps.com",
  ];
  const lineFrameSources = ["https://access.line.me", "https://liff.line.me", "https://liff-subwindow.line.me"];
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${lineScriptSources.join(" ")}${devScriptPolicy}`,
    // フォントは next/font でセルフホストするため Google Fonts の許可は不要。
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${lineConnectSources.join(" ")}`,
    ["frame-src 'self'", ...lineFrameSources, syllabusOrigin].filter(Boolean).join(" "),
    "frame-ancestors 'self' https://liff.line.me https://*.line.me",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("Content-Security-Policy", csp);
  syncSessionHintCookie(request, response);
  return response;
}

/**
 * httpOnly のセッション Cookie の有無を、クライアントから読める非機密のヒントに同期する。
 * これがあると未ログイン訪問者は `/api/me` を呼ばずに済み、想定内の 401 が
 * コンソールエラーとして残らなくなる。
 * 既にログイン済みの利用者にも、次のページ遷移でヒントが自動的に付与される。
 */
function syncSessionHintCookie(request: NextRequest, response: NextResponse) {
  const hasSession = request.cookies.has(AUTH_SESSION_COOKIE);
  const hint = request.cookies.get(SESSION_HINT_COOKIE)?.value;

  if (hasSession && hint !== SESSION_HINT_VALUE) {
    response.cookies.set(SESSION_HINT_COOKIE, SESSION_HINT_VALUE, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return;
  }

  if (!hasSession && hint !== undefined) {
    response.cookies.set(SESSION_HINT_COOKIE, "", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
    },
  ],
};
