import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AccessDenied } from "../components/AccessDenied";
import { AdminAccessDenied } from "../components/AdminAccessDenied";
import { AdminAccessContractCopy } from "../components/AdminAccessContractCopy";

test("admin access denied copy explains OAuth session and admin_users are both required", () => {
  const html = renderToStaticMarkup(<AccessDenied />);
  assert.match(
    html,
    /Google OAuth でサインイン済みで、かつ active な admin_users レコードがあるアカウントだけが使えます。/,
  );
  assert.match(html, /DB の行だけではログインにならず、Google OAuth ログインだけでも active な admin_users レコードがなければアプリ権限はありません。/);
});

test("root admin denied copy keeps the same OAuth plus active row contract wording", () => {
  const html = renderToStaticMarkup(<AdminAccessDenied />);
  assert.match(
    html,
    /Google OAuth でサインイン済みで、かつ active な admin_users レコードがあるアカウントだけが使えます。/,
  );
  assert.match(html, /Google でサインイン/);
});

test("admin users contract overview explains OAuth login, app role, status, and audit identity", () => {
  const html = renderToStaticMarkup(<AdminAccessContractCopy variant="overview" />);
  assert.match(
    html,
    /Google OAuth が管理画面へのログインを受け持ち、admin_users は Google アカウントのメールを app role、active\/deactivated state、監査上の actor identity に対応づけます。/,
  );
  assert.match(html, /Google OAuth ログインが成立していても、active な admin_users レコードがなければアプリ権限はありません。/);
  assert.match(html, /admin_users レコードを作成しても、それだけではログインになりません。Google OAuth セッションがなければ入口は開きません。/);
});
