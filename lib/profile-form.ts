import type { MeDto, ProfileOptionsDto } from "@/lib/auth/types";

/**
 * `/register` (5 ステップウィザード) と `/profile/edit` (1 画面) は同じ 5 項目を
 * 別デザインで二重実装しており、選択ロジックも各ファイルにコピーされていた。
 * 状態・選択肢の組み立て・保存ペイロードをここに集約する。
 */
export type ProfileFormState = {
  gender: string;
  graduationYear: number | null;
  universityId: string;
  clubIds: string[];
  desiredSpecialtyId: string | null;
};

export type ProfileFieldKey = keyof ProfileFormState;

export const emptyProfileForm: ProfileFormState = {
  gender: "",
  graduationYear: null,
  universityId: "",
  clubIds: [],
  desiredSpecialtyId: null,
};

export function profileFormFromMe(me: MeDto): ProfileFormState {
  return {
    gender: me.gender ?? "",
    graduationYear: me.graduationYear,
    universityId: me.university?.id ?? "",
    clubIds: me.clubs.map((club) => club.id),
    desiredSpecialtyId: me.desiredSpecialty?.id ?? null,
  };
}

/**
 * 部活・サークルは配列型で、表示側も `join("、")` で複数前提なのに、
 * 以前は `includes(id) ? [] : [id]` で常に 1 件しか選べなかった。
 */
export function toggleClubId(clubIds: string[], id: string): string[] {
  return clubIds.includes(id) ? clubIds.filter((value) => value !== id) : [...clubIds, id];
}

export function buildProfilePayload(
  profile: ProfileFormState,
  consent: { consentMarketing: boolean; pushEnabled: boolean },
) {
  return {
    gender: profile.gender || null,
    universityId: profile.universityId,
    graduationYear: profile.graduationYear,
    clubIds: profile.clubIds,
    desiredSpecialtyId: profile.desiredSpecialtyId,
    consentMarketing: consent.consentMarketing,
    pushEnabled: consent.pushEnabled,
  };
}

export function canSaveProfile(profile: ProfileFormState) {
  return Boolean(profile.universityId) && profile.graduationYear !== null;
}

export type ProfileFieldDefinition = {
  key: ProfileFieldKey;
  legend: string;
  optional?: boolean;
  multiple?: boolean;
  columns: 1 | 2;
  options: (options: ProfileOptionsDto) => Array<{ id: string; name: string }>;
};

/** `/register` と `/profile/edit` が共有する項目定義。 */
export const PROFILE_FIELDS: ProfileFieldDefinition[] = [
  {
    key: "gender",
    legend: "性別",
    columns: 2,
    options: (options) => options.genders.map((name) => ({ id: name, name })),
  },
  {
    key: "graduationYear",
    legend: "卒業年度",
    columns: 2,
    options: (options) => options.graduationYears.map((year) => ({ id: String(year), name: `${year}年卒` })),
  },
  {
    key: "universityId",
    legend: "大学名",
    columns: 1,
    options: (options) => options.universities,
  },
  {
    key: "clubIds",
    legend: "部活・サークル",
    optional: true,
    multiple: true,
    columns: 2,
    options: (options) => options.clubs,
  },
  {
    key: "desiredSpecialtyId",
    legend: "希望診療科",
    optional: true,
    columns: 2,
    options: (options) => options.specialties,
  },
];

/** 単一選択フィールドの現在値を OptionSelector 用の id に落とす。 */
export function singleValueOf(profile: ProfileFormState, key: ProfileFieldKey): string | null {
  if (key === "gender") return profile.gender || null;
  if (key === "graduationYear") return profile.graduationYear === null ? null : String(profile.graduationYear);
  if (key === "universityId") return profile.universityId || null;
  if (key === "desiredSpecialtyId") return profile.desiredSpecialtyId;
  return null;
}

export function applySingleValue(
  profile: ProfileFormState,
  key: ProfileFieldKey,
  id: string,
): ProfileFormState {
  if (key === "gender") return { ...profile, gender: id };
  if (key === "graduationYear") return { ...profile, graduationYear: Number(id) };
  if (key === "universityId") return { ...profile, universityId: id };
  if (key === "desiredSpecialtyId") return { ...profile, desiredSpecialtyId: id };
  return profile;
}
