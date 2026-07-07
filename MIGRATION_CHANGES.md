# TestAPP → kakunin UI/UX 移植 - 変更点

## 概要

TestAPP-main の UI/UX (ネイビー系デザイン) を、kakunin-main (Next.js 16 + Supabase バックエンド)
にそのまま移植した。**kakunin の機能・バックエンド・API・データ層は一切変更していない**。

主な要件対応:

1. ✅ TestAPPのUI/UXをそのまま再現 (カラーパレット・レイアウト・カードデザイン)
2. ✅ Kakunin の機能・バックエンド (Supabase / API Routes / 認証 / 保存機能) を完全保持
3. ✅ 規約同意画面 (LegalConsentModal + 利用規約 / プライバシーポリシー) を新規追加
4. ✅ **求人タブ**を上部ナビゲーションに追加
5. ✅ **スポンサータブを廃止**し、求人ページ (`/jobs`) 内に SPONSORS & PARTNERS セクションとして表示
6. ✅ 疑似ブラウザヘッダー / フッターツールバーを削除
7. ✅ "H" / "HagNavi" / "HugNavi" ロゴをナビ上から削除
8. ✅ 記事タブのサムネイル画像を現状の半分に縮小

---

## 追加ファイル

| ファイル | 用途 |
|---|---|
| `lib/legal.ts` | 利用規約 / プライバシーポリシーの本文データ (2026-06-23 版) |
| `components/LegalConsentModal.tsx` | 初回起動時に表示する規約同意モーダル。2タブ・両方の最下部までスクロール+チェックボックスで初めて「同意して始める」が有効化。 |
| `MIGRATION_CHANGES.md` | 本ファイル (変更点まとめ) |

---

## 変更ファイル

### 1. デザインシステム基盤

| ファイル | 変更内容 |
|---|---|
| `app/globals.css` | カラーパレットを orange → navy に刷新。背景 `#FFF9FA` → `#F2F4F8`、ブランド `#F97316` → `#1E3A8A`。 |
| `tailwind.config.ts` | `colors.brand` のスケールをネイビー (`#F2F4F8`〜`#11204C`) に置換。 |

### 2. レイアウト・共有コンポーネント

| ファイル | 変更内容 |
|---|---|
| `components/AppLayout.tsx` | 全面書き換え。**疑似ブラウザヘッダー・フッターは削除**。上部に 5タブ (求人 / 学校 / 課外活動 / 記事 / マイページ) のネイビーナビ。スポンサータブは廃止。初回起動時に LegalConsentModal を表示。 |
| `app/layout.tsx` | 変更なし (AuthProvider / SavedItemsProvider / AppLayout の構造保持)。 |
| `components/LoginModal.tsx` | 色をネイビーに変更。"H" 文字ロゴを削除し `ShieldCheck` アイコンに置換。 |
| `components/AdBanner.tsx` | PRバッジと背景をネイビー系に統一。 |
| `components/FloatingBanner.tsx` | 同上 (border-[#B9C2DB] / bg-[#1E3A8A]/95)。 |
| `components/JobFilterModal.tsx` | チップ選択時の色を `bg-[#1E3A8A]`、適用CTAを `from-[#1E3A8A] to-[#11204C]` グラデに変更。 |
| `components/SaveButton.tsx` | オレンジ → ネイビー基調に。 |
| `components/LineFollowFloating.tsx` | 疑似フッター削除に合わせ、ボトム位置を `bottom-6` に調整。 |

### 3. 各ページ (機能は保持、色調とレイアウトをTestAPP準拠に置換)

| ファイル | 主な変更 |
|---|---|
| `app/jobs/page.tsx` | **フル書き換え**。TestAPP準拠の sticky ヘッダー・検索・フィルタ・カテゴリタブ・カードUI に統一。**ページ下部に SPONSORS & PARTNERS セクション**を Supabase 由来データで表示 (スポンサータブ廃止分を移設)。 |
| `app/jobs/[id]/page.tsx` | **フル書き換え**。TestAPP JobDetail 準拠。応募CTAを LINE緑 (#06C755) の「LINEで応募する」に変更。API `/api/jobs/:id` と `SaveButton` / `SavedItems` は保持。 |
| `app/sponsors/page.tsx` | カラー再着色 (orange → navy)。PLATINUM / GOLD / SUPPORTER の3階層構成を保持。ナビからは非表示だが `/sponsors` パス自体は残置 (Supabase バックエンド接続保持のため)。 |
| `app/sponsors/[id]/page.tsx` | カラー再着色のみ。 |
| `app/school/page.tsx` | カラー再着色 + 記事タブサムネイル縮小 (`w-28 h-28` → `w-14 h-14`)。時間割 / 講義詳細 / API `/api/timetable` は完全保持。 |
| `app/activities/page.tsx` | カラー再着色 + 記事タブサムネイル縮小 (`w-24 h-24` → `w-12 h-12`)。 |
| `app/activities/groups/[id]/page.tsx` | カラー再着色のみ。 |
| `app/activities/admin/inquiries/page.tsx` | カラー再着色のみ。 |
| `app/articles/page.tsx` | カラー再着色 + **記事タブのサムネイルを半分に縮小** (`w-28 h-28` → `w-14 h-14`)。SavedItemsContext・お気に入りタブ・記事発信ボタンは保持。 |
| `app/articles/[id]/page.tsx` | カラー再着色のみ。 |
| `app/campaign/page.tsx` | カラー再着色のみ。 |
| `app/campaign/[id]/page.tsx` | カラー再着色のみ。CTA・保存機能は完全保持。 |
| `app/profile/page.tsx` | カラー再着色のみ。ログイン時の分岐・localStorage 連携は保持。 |
| `app/profile/edit/page.tsx` | カラー再着色のみ。 |
| `app/register/page.tsx` | カラー再着色のみ。5ステップ登録フロー保持。 |
| `app/saved/page.tsx` | カラー再着色のみ。 |
| `app/connect/page.tsx` | カラー再着色のみ。 |
| `app/school/articles/[id]/page.tsx` | カラー再着色のみ。 |

---

## 変更していないもの (バックエンド・機能完全保持)

- `lib/supabase/rest.ts` (Supabase REST クライアント)
- `app/api/health/route.ts`, `app/api/jobs/route.ts`, `app/api/jobs/[slugOrId]/route.ts`, `app/api/line/webhook/route.ts`, `app/api/timetable/route.ts`
- `components/AuthContext.tsx` (LINE LIFF / localStorage 認証)
- `components/SavedItemsContext.tsx` (お気に入り job / campaign / article)
- `lib/articles.ts`, `lib/data.ts`, `lib/job-dto.ts`, `lib/jobs.ts`, `lib/timetable-core.ts`, `lib/timetable-dto.ts`, `lib/timetable.ts`, `lib/site.ts`, `lib/types.ts`, `lib/utils.ts`, `lib/api-query.ts`
- `data/articles.json`
- `tests/` (Node テストランナー用のテストファイル)
- `package.json` (依存関係も一切変更なし)
- `next.config.mjs`, `tsconfig.json`, `postcss.config.mjs`, `vercel.json`, `eslint.config.mjs`

---

## 主要カラーパレット対応表 (機械置換)

| 用途 | 旧 (kakunin) | 新 (TestAPP準拠) |
|---|---|---|
| 全体背景 | `#FFF9FA` (オレンジがかった淡いピンク) | `#F2F4F8` (ライトグレー) |
| プライマリ | `orange-500` `#F97316` | `#1E3A8A` (ネイビー) |
| プライマリDark | `orange-600` `#EA580C` | `#11204C` (深いネイビー) |
| ボーダー / 淡色 | `orange-100` `#FFEDD5` | `#B9C2DB` (ブルーグレー) |
| 淡背景 | `orange-50` | `#F2F4F8` |
| 記事カテゴリ ピル | `bg-orange-50 text-orange-600` | `bg-[#F2F4F8] text-[#1E3A8A]` |
| CTAボタン | `bg-orange-500` | `bg-[#1E3A8A]` / グラデ `from-[#1E3A8A] to-[#11204C]` |
| LINE 応募 CTA | `#06C755` | `#06C755` (LINEブランド色は保持) |

---

## ビルド確認

`npx next build` が全ページ (Static 11 / Dynamic 4) + API Routes 5本を **エラーなくコンパイル完了**。

```
Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /activities
├ ○ /activities/admin/inquiries
├ ƒ /activities/groups/[id]
├ ƒ /api/health
├ ƒ /api/jobs
├ ƒ /api/jobs/[slugOrId]
├ ƒ /api/line/webhook
├ ƒ /api/timetable
├ ○ /articles
├ ƒ /articles/[id]
├ ○ /campaign
├ ƒ /campaign/[id]
├ ○ /connect
├ ○ /jobs
├ ƒ /jobs/[id]
├ ○ /profile
├ ○ /profile/edit
├ ○ /register
├ ○ /saved
├ ○ /school
├ ƒ /school/articles/[id]
├ ○ /sponsors
└ ƒ /sponsors/[id]
```

---

## 起動方法

```bash
cd kakunin-migrated
npm install
npm run dev       # 開発サーバ (http://localhost:3000)
# または
npm run build && npm start
```

環境変数 (kakunin と同一):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_LINE_LOGIN_URL` (LIFF)
- `NEXT_PUBLIC_LINE_ADD_FRIEND_URL`
- `NEXT_PUBLIC_DEFAULT_APPLY_URL`
- その他 `lib/site.ts` 参照
