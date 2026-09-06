import { DetailUnavailable } from "@/components/DetailUnavailable";

export default function ContentNotFound() {
  return <DetailUnavailable title="コンテンツが見つかりません" message="このコンテンツは削除されたか、まだ公開されていません。" backHref="/contents" backLabel="コンテンツ一覧へ戻る" />;
}
