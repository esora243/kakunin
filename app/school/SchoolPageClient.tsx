"use client";

import dynamic from "next/dynamic";
import { AdBanner } from "@/components/AdBanner";
import { Container } from "@/components/ui/Container";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import type { TimetableClassDto, TimetableDay } from "@/lib/timetable-dto";

type SchoolPageClientProps = {
  initialSharedClasses: TimetableClassDto[];
  initialDays: TimetableDay[];
  initialPeriods: number[];
  initialSharedClassesError: string | null;
};

const SchoolWorkspaceClient = dynamic(
  () => import("@/app/school/SchoolWorkspaceClient").then((module) => module.SchoolWorkspaceClient),
  {
    ssr: false,
    // ローディングも本体と同じ骨格で出す (空 div による白画面フラッシュを作らない)。
    loading: () => (
      <div className="bg-surface-canvas pb-8">
        <PageHeader title="学校" description="時間割とシラバスをまとめて確認" />
        <Container className="py-section">
          <LoadingState label="学校ページを読み込んでいます" />
        </Container>
      </div>
    ),
  },
);

export function SchoolPageClient(props: SchoolPageClientProps) {
  return (
    <>
      <AdBanner placement="school" />
      <SchoolWorkspaceClient {...props} />
    </>
  );
}
