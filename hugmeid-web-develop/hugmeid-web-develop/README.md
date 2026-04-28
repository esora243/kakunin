求人、キャンペーン、学校、課外活動、スポンサー、FAQ などは、データ未投入でも壊れず、空状態メッセージを出す。
応募先URL、LINEログインURL、シラバスURL、問い合わせ先メールは .env.example と lib/site.ts 経由で差し替え
vercel.json を追加し、.env.example 作成
チェック用： app/api/health/route.ts 
package.json には typecheck と Node 指定
バックエンド側作成次第marge

項目	判定	コメント
Next.js App Router	○	app/ 構成で確認
TypeScript	○	使用中
Vercel前提	○	vercel.json あり
LIFF	×	未導入
Supabase	×	未導入
LINE OAuth検証	×	/api/auth/line なし
Supabase JWT	×	未発行
localStorage運用（Phase1暫定）	△	使っているが、設計書の想定用途と違う
bookmarksテーブル前提	×	localStorage実装
users/jobs/articles/classes DB	×	静的配列のみ
RLS	×	未実装
LINE Messaging API/Webhook	×	未実装
環境変数設計	×	必須項目不足
CMS方針（Supabase Studio入稿）	×	まだStudio接続前
SEO土台	△	metadata はあるが構造化データ等は未実装
