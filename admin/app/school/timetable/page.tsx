import { PageHeader } from "@/components/ui/PageHeader";
import { SchoolTimetableManager } from "@/components/school/SchoolTimetableManager";
import { listActiveUniversities } from "@/lib/school";
import { listAdminTimetableRows } from "@/lib/timetable-admin";

export const dynamic = "force-dynamic";

export default async function SchoolTimetablePage() {
  const [universities, entries] = await Promise.all([
    listActiveUniversities(),
    listAdminTimetableRows(),
  ]);
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader eyebrow="時間割" title="大学ごとの時間割データ" description="公式時間割を登録すると、ユーザーは一覧から授業を選択できます。" />
      <SchoolTimetableManager initialUniversities={universities} initialEntries={entries} />
    </div>
  );
}
