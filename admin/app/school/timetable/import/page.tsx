import { PageHeader } from "@/components/ui/PageHeader";
import { TimetableCsvImporter } from "@/components/school/TimetableCsvImporter";

export const dynamic = "force-dynamic";

export default function TimetableCsvImportPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="時間割"
        title="CSVで時間割を一括登録"
        description="CSVファイルをアップロードすると、大学ごとの時間割データにまとめて取り込まれます。"
      />
      <TimetableCsvImporter />
    </div>
  );
}
