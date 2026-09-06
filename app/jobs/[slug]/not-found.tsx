import { DetailUnavailable } from "@/components/DetailUnavailable";

export default function JobNotFound() {
  return (
    <DetailUnavailable
      title="求人が見つかりません"
      message="この求人は削除されたか、まだ公開されていません。"
      backHref="/jobs"
      backLabel="求人一覧へ戻る"
    />
  );
}
