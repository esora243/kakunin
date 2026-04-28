export type TimetableDay = "月" | "火" | "水" | "木" | "金" | "土" | "日";

export type TimetableClassDto = {
  id: string;
  classKey: string;
  title: string;
  instructor: string | null;
  room: string | null;
  location: string | null;
  day: TimetableDay;
  period: number;
  startsAt: string | null;
  endsAt: string | null;
  academicYear: number | null;
  termNumber: number | null;
  universityName: string | null;
  sourceType: string;
  isOfficial: boolean;
};

export type TimetableGridDto = Record<TimetableDay, Record<number, TimetableClassDto>>;

export type TimetableResponse = {
  ok: true;
  days: TimetableDay[];
  periods: number[];
  items: TimetableClassDto[];
  grid: TimetableGridDto;
};
