# Hugmeid (旧 kakunin) — Hugmeid mock デザイン反映版

医学生向けプラットフォーム「Hugmeid」の Web アプリ実装(Next.js 15 / App Router)です。
本リポジトリは、もともとの `kakunin-main` をベースに、`Hugmeid Web app mock` のデザインシステムを完全反映させた改修版です。

## 主な改修点

### デザイン (Hugmeid mock 由来)

| 項目 | 改修内容 |
|---|---|
| 全体背景 | `bg-[#FFF9FA]` (温かみのある白) に統一 |
| ロゴ | `Hm` 円形 + `Hugmeid` グラデーション(orange-500→rose-400) + サブコピー「6万人の医学生で創る縁」 |
| ナビゲーション | 学校 / 課外活動 / 記事 / 繋がり / マイページ + 右端スポンサー(求人はマイページ配下) |
| タブ UI | 角丸ピル型(active: orange-500 bg + shadow-md) |
| カードスタイル | `rounded-2xl` + `border-orange-50` + `shadow-sm` |
| 広告コンポーネント | `FloatingBanner` (ヘッダー直下クローズ可能) を新規追加 / `AdBanner` をオレンジ基調に |
| CTA ボタン | LINE 緑 `#06C755` (ログイン) / orange-400→500 グラデ (汎用) / orange-500→rose-400 (キャンペーン) |
| ログイン UI | グラデ H ロゴ + orange-50/50 パネル + LINE 緑ボタン |

### 機能保持 (既存の挙動を破壊しない)

- **認証** : `AuthContext` (`localStorage` で `hugmeid_logged_in` 管理)
- **保存機能** : `SavedItemsContext` (求人/キャンペーン両対応)
- **Supabase 連携** : `supabaseRestFetch` ヘルパー、各テーブル(`timetable_classes`, `class_tasks`, `student_groups`, `study_abroad_programs`, `articles`, `sponsors`, `campaigns`, `faqs`, `inquiries`, `jobs`)
- **API Routes** : `/api/health`, `/api/jobs`, `/api/jobs/[slugOrId]`, `/api/timetable`
- **テスト** : `tests/api-query.test.ts`, `tests/timetable-core.test.ts` (既存4件すべてパス)

### 新規追加

- **`/articles`** : Hugmeid mock のグローバル「記事」ナビ用ページ(学校 + 課外活動の記事を統合)
- **`/articles/[id]`** : 統合記事詳細ページ
- **`components/FloatingBanner.tsx`** : ヘッダー直下のクローズ可能な広告

## 環境変数 (.env.local)

```
NEXT_PUBLIC_APP_NAME=Hugmeid
NEXT_PUBLIC_APP_TAGLINE=6万人の医学生で創る縁
NEXT_PUBLIC_SITE_URL=https://your-project.vercel.app
NEXT_PUBLIC_LINE_LOGIN_URL=
NEXT_PUBLIC_DEFAULT_APPLY_URL=
NEXT_PUBLIC_SYLLABUS_URL=
NEXT_PUBLIC_CONTACT_EMAIL=contact@example.com

# Supabase (lib/supabase/rest.ts が参照)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## セットアップ & 起動

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # 本番ビルド
npm test             # テスト実行
npm run typecheck    # 型チェック
```

## ルート一覧

| Path | 説明 |
|---|---|
| `/` | `/school` へリダイレクト |
| `/school` | 時間割 / シラバス / 勉強系記事 / 研修病院 / 国試対策 |
| `/school/articles/[id]` | 学校 記事詳細 |
| `/activities` | 学生団体 / 留学情報 / 記事 |
| `/activities/groups/[id]` | 団体詳細 |
| `/activities/admin/inquiries` | 管理画面: お問い合わせ管理 |
| `/articles` | 統合記事一覧 (新規) |
| `/articles/[id]` | 統合記事詳細 (新規) |
| `/connect` | お問い合わせ / FAQ / OBマッチング(P2) / コミュニティ(P2) |
| `/jobs` | 求人一覧(検索 + カテゴリ + AdBanner infeed) |
| `/jobs/[id]` | 求人詳細(API Routes 経由) |
| `/campaign` | キャンペーン一覧 |
| `/campaign/[id]` | キャンペーン詳細 |
| `/sponsors` | Platinum / Gold / Supporter 3階層 |
| `/saved` | 保存済み(認証必須) |
| `/profile` | マイページ |
| `/profile/edit` | プロフィール編集 |
| `/register` | LIFF 登録(5ステップ) |

## 関連設計書 (本改修と同梱で更新)

- `要件定義書_v1.3.pdf` (画面仕様の変更を追記)
- `画面遷移_v1.1.pdf` (ナビ統合と /articles 追加を反映)
- `技術スタック_v1.1.pdf` (FloatingBanner の追加など)
- `認証設計_v1.1.pdf` (LoginModal のデザイン要件追記)
