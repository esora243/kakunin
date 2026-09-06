import { DetailUnavailable } from "@/components/DetailUnavailable";

export default function ActivityNotFound() {
  return <DetailUnavailable title="課外活動が見つかりません" message="この課外活動は削除されたか、まだ公開されていません。" backHref="/activities" backLabel="課外活動一覧へ戻る" />;
}
