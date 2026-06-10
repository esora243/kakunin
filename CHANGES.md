# 変更ファイル一覧（kakunin 改修）

> Next.js (App Router) プロジェクトに対する以下3案件の改修を実施。
> - ① 記事タブのお気に入り / フィルタ / 記事発信機能
> - ② 時間割・カレンダー機能の拡張（1〜6年生、診療科モーダル、課題・通知統合）
> - ③ 公式 LINE 連携（Webhook + 友だち追加導線）

## 🆕 新規追加ファイル

| ファイル | 役割 |
| --- | --- |
| `data/articles.json` | 記事のシングルソース。今後の発信や編集はこの JSON を中心に運用。 |
| `lib/articles.ts` | `articles.json` を読み込むユーティリティ（normalize / フィルタ / ソート）。 |
| `components/LineFollowFloating.tsx` | 公式 LINE 友だち追加用フローティング常駐ボタン（モバイル配慮）。 |
| `app/api/line/webhook/route.ts` | LINE Messaging API Webhook 受信エンドポイント。follow イベントで画像付き案内を Reply。 |
| `CHANGES.md` | 本ファイル。 |

## ✏️ 修正ファイル

| ファイル | 変更概要 |
| --- | --- |
| `lib/types.ts` | `Article` 型を拡張（`id` 文字列対応 / `type` / `tags` / `author`）。`SavedItemType` に `"article"` を追加。 |
| `lib/data.ts` | `schoolArticles` / `activityArticles` をハードコードではなく `articles.json` 起点に変更（互換維持）。 |
| `lib/timetable-dto.ts` | `grade` / `slotKind` / `isCuttable` / `attendanceWeight` / `departmentName` / `departmentSummary` / `examMaterialsUrl` / `activityScope` を追加。`TimetableResponse` に `periodLabels` 追加。 |
| `lib/timetable-core.ts` | `PERIODS` を 1〜6 + 昼休み(7) + 放課後(8) + 特別(99) に拡張。`normalizePeriod` / `slotKindOfPeriod` / `clampAttendanceWeight` / `filterByGrade` 等のヘルパを追加。 |
| `lib/timetable.ts` | 拡張 DTO に合わせて Supabase 行から isCuttable / attendanceWeight / departmentSummary 等をマッピング。`listTimetableClasses({ grade, universityName })` で学年フィルタ。 |
| `app/api/timetable/route.ts` | クエリ `?grade=` `?university=` を受け取り、拡張レスポンスを返却。 |
| `app/articles/page.tsx` | データソースを `articles.json` (lib/articles.ts) に統一。「お気に入り / すべて / 学習法」タブを追加。記事発信フォーム（タイトル・カテゴリ・本文）を追加。各カードに Save ボタン。 |
| `components/SavedItemsContext.tsx` | 記事 (`article`) を含む3種類のお気に入りに対応。`getSavedIds()` を追加。localStorage の型ガード強化。 |
| `app/saved/page.tsx` | `articles.json` 経由でお気に入り記事を解決。求人 / キャンペーン / 記事をひとつのリストで表示。 |
| `app/school/page.tsx` | 大学名 + 1〜6 年生の学年セレクタを追加。`isCuttable` / `attendanceWeight` に応じてセル背景を動的変更。診療科名クリックでモーダル（概要 + `examMaterialsUrl`）。課題メモ・通知タブを廃止し、コマ詳細にインライン統合。昼休み(7) / 放課後(8) 行を表示。 |
| `app/layout.tsx` | `LineFollowFloating` を全画面に組み込み。 |
| `tests/timetable-core.test.ts` | 新ヘルパ向けテスト追加（`normalizePeriod` / `slotKindOfPeriod` / `clampAttendanceWeight` / `filterByGrade`）。既存テストも DTO 追加プロパティに合わせて更新。 |

## 🔐 必要な環境変数

```env
# LINE Messaging API
LINE_CHANNEL_SECRET=...                # Channel Secret
LINE_CHANNEL_ACCESS_TOKEN=...          # 長期 Access Token
LINE_WELCOME_IMAGE_URL=https://.../welcome.png       # 友だち追加時の機能説明 PNG
LINE_WELCOME_PREVIEW_URL=https://.../welcome.png     # プレビュー画像（省略時は上と同じ）

# クライアント側（友だち追加ボタンのリンク先）
NEXT_PUBLIC_LINE_ADD_FRIEND_URL=https://lin.ee/xxxxxxxx
```

LINE Developers の Webhook URL は

```
https://<your-domain>/api/line/webhook
```

を指定し、「応答メッセージ」をオフ / 「Webhook の利用」をオンにしてください。

## ✅ 動作確認結果

- `npx tsc --noEmit` ：エラーなし
- `npm test` ：全 8 件パス（既存2 + 追加6）

## 🔄 旧データ仕様との互換

- `schoolArticles` / `activityArticles` の export は維持。中身は `articles.json` 由来になっただけなので、既存 import は壊れません。
- 旧 `period = "special"` の文字列は `99` として表示・編集可能。`normalizePeriod` が自動変換します。
- `SavedEntry` の旧フォーマットは hydrate 時に sanitize されます。
