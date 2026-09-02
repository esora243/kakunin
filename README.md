# Hugmeid Web

Hugmeid Web is a Next.js App Router application for the Phase 1 LIFF-based medical-student platform.

開発・リリース時のブランチ運用は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## Current Backend Contract

- LINE authentication uses a LIFF ID token posted to a Next.js Route Handler.
- The server verifies the token, resolves the Hugmeid user, and issues a signed httpOnly Hugmeid session cookie.
- Browser code must not receive raw `line_uid`, LINE tokens, or database credentials.
- Personal data APIs are scoped by the Hugmeid session `userId`.
- Private Cloud SQL tables are accessed from Route Handlers after session checks.
- Public Jobs, Activities, and Contents use canonical slug URLs.
- Saved Jobs, Activities, and Contents are account-backed in Cloud SQL.

## Local Development

1. Use Node.js 22.12.0 or newer.
2. Copy `.env.example` to `.env.local`.
3. Fill Cloud SQL, LINE, and session values for the environment you are testing.
4. Install dependencies and run the app:

```sh
npm install
npm run dev
```

## Verification Commands

Run these before opening a production-readiness PR:

```sh
npm run test
npm run typecheck
npm run build
npm audit --omit=dev --audit-level=moderate
```

The runtime-only audit is intentionally listed as a release gate. A failure
blocks production deployment until a focused remediation PR lands and the
command passes. Record a full audit separately so development-tool advisories
remain visible, but do not force incompatible transitive versions underneath
the lint toolchain to make that report appear clean.

## Deployment

Use [docs/production-deployment-checklist.md](docs/production-deployment-checklist.md) for the Cloud Run, Cloud SQL, LINE, and cutover checklist.

Use the checksum-registered Cloud SQL workflow in
[`docs/cloudsql-rebaseline.md`](docs/cloudsql-rebaseline.md). New databases are
created with `npm run db:migrate` and checked with `npm run db:verify`; never
run the pre-release SQL history as a directory.

確認できた運用経路は、GitHub Actions が検証と本番公開アプリのデプロイを担い、Cloud Run の --source デプロイでビルドする形です。管理画面用の自動デプロイ job はこの workflow には見当たらないため、そこは「別 Cloud Run サービスへ別途運用」として整理します。

これは Google Cloud（GCP）上で運用する Next.js アプリです。

公開アプリ: Next.js を Cloud Run にデプロイ
管理画面: admin を公開アプリとは別の Cloud Run サービスとしてデプロイ
データベース: Cloud SQL for PostgreSQL
画像・アセット: 非公開の Cloud Storage バケット
公開経路: 本番公開アプリは外部 HTTPS Load Balancer 経由で、Cloud Armor も利用
認証:
一般ユーザー: LINE LIFF
管理者: Google OAuth/OIDC + admin_users による権限管理
秘密情報: Cloud Run の環境変数と Secret Manager で管理
実行環境: Node.js 22.12.0 以上
運用環境は staging と production を分離し、それぞれ別の Cloud Run サービス、Cloud SQL の接続情報、LINE LIFF、画像バケットを使います。

デプロイフローは、GitHub Actions がテスト・lint・typecheck・build を実行し、main への push 後に公開アプリを本番 Cloud Run へカナリアデプロイします。GitHub Actions から GCP へはサービスアカウントキーではなく Workload Identity Federation で認証します。

なお、DB マイグレーションはアプリのデプロイとは分離され、運用者が明示的に実行します。詳細は production-deployment-checklist.md と admin-runbooks.md にまとまっています。