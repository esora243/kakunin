import type { ContentType } from "./content-dto";
import type { PublishState } from "./publishing";

export const PUBLISH_STATE_LABEL: Record<PublishState, string> = {
  draft: "下書き",
  review: "確認待ち",
  approved: "公開承認済み",
  scheduled: "公開予約",
  published: "公開中",
  deactivated: "利用停止",
};

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  article: "記事",
  guide: "ガイド",
  faq: "よくある質問",
  story: "体験談・インタビュー",
  sponsor_story: "パートナー記事",
};

const ACTION_LABELS: Record<string, string> = {
  "admin.access": "管理画面へログイン",
  "admin_user.create": "運営メンバーを追加",
  "admin_user.role_update": "運営メンバーの権限を変更",
  "admin_user.active_update": "運営メンバーの利用状態を変更",
  "admin_user.remove": "運営メンバーを一覧から削除",
  "content.create": "記事を作成",
  "content.update": "記事を更新",
  "content.publish": "記事を公開",
  "content.schedule_publish": "記事の公開を予約",
  "content.unpublish": "記事を非公開に変更",
  "content.deactivate": "記事を利用停止",
  "content.version_restore": "記事の変更履歴を復元",
  "job.create": "求人を作成",
  "job.update": "求人を更新",
  "job.publish": "求人を公開",
  "job.schedule_publish": "求人の公開を予約",
  "job.unpublish": "求人を非公開に変更",
  "job.deactivate": "求人を利用停止",
  "activity.create": "課外活動を作成",
  "activity.update": "課外活動を更新",
  "activity.publish": "課外活動を公開",
  "activity.schedule_publish": "課外活動の公開を予約",
  "activity.unpublish": "課外活動を非公開に変更",
  "activity.deactivate": "課外活動を利用停止",
  "inquiry.status_update": "お問い合わせの状態を変更",
  "asset.upload": "画像を追加",
  "asset.delete": "画像を削除",
  "asset.purge": "画像を完全削除",
  "school.syllabus_page.update": "シラバスページを更新",
  "school.class_entry.update": "授業情報を更新",
  "cache_invalidation_failed": "公開サイトへの反映に失敗",
  "cache_invalidation_retry_succeeded": "公開サイトへの反映を再実行",
};

const RESOURCE_LABELS: Record<string, string> = {
  contents: "記事",
  jobs: "求人",
  activities: "課外活動",
  inquiries: "お問い合わせ",
  assets: "画像",
  admin_users: "運営メンバー",
  school: "学校・授業",
  master_data: "選択肢",
  system: "システム",
};

export function auditActionLabel(value: string): string {
  return ACTION_LABELS[value] ?? "設定を変更";
}

export function auditResourceLabel(value: string): string {
  return RESOURCE_LABELS[value] ?? "管理データ";
}

export function activityActionLabel(value: string): string {
  return ({ apply: "応募", signup: "申込", join: "参加", attend: "出席登録", inquire: "問い合わせ" } as Record<string, string>)[value] ?? "詳細確認";
}
