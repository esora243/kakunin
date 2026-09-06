type ApiErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export type MeDto = {
  id: string;
  lineUidMasked: string;
  gender: string | null;
  university: { id: string; name: string } | null;
  graduationYear: number | null;
  isProfileComplete: boolean;
  consentMarketingAt: string | null;
  lineFriendStatus: "active" | "unsubscribed" | "unknown";
  pushEnabled: boolean;
  clubs: Array<{ id: string; name: string }>;
  desiredSpecialty: { id: string; name: string } | null;
};

export type UpdateProfileRequest = {
  gender?: string | null;
  universityId: string;
  graduationYear: number;
  clubIds?: string[];
  desiredSpecialtyId?: string | null;
  consentMarketing?: boolean;
  pushEnabled?: boolean;
};

export type ProfileOptionsDto = {
  universities: Array<{ id: string; name: string; prefecture: string | null }>;
  clubs: Array<{ id: string; name: string }>;
  specialties: Array<{ id: string; name: string }>;
  graduationYears: number[];
  genders: string[];
};

type ProfileOptionsResponse = { ok: true; item: unknown } | ApiErrorResponse;

export type AuthSessionPayload = {
  userId: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringOption(value: unknown): value is { id: string; name: string } {
  return isRecord(value) && typeof value.id === "string" && typeof value.name === "string";
}

function isUniversityOption(value: unknown) {
  return (
    isStringOption(value) &&
    (!("prefecture" in value) || value.prefecture === null || typeof value.prefecture === "string")
  );
}

function isProfileOptionsDto(value: unknown): value is ProfileOptionsDto {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.universities) &&
    value.universities.every(isUniversityOption) &&
    Array.isArray(value.clubs) &&
    value.clubs.every(isStringOption) &&
    Array.isArray(value.specialties) &&
    value.specialties.every(isStringOption) &&
    Array.isArray(value.graduationYears) &&
    value.graduationYears.every((year) => typeof year === "number") &&
    Array.isArray(value.genders) &&
    value.genders.every((gender) => typeof gender === "string")
  );
}

function isProfileOptionsSuccessResponse(value: unknown): value is Extract<ProfileOptionsResponse, { ok: true }> {
  return isRecord(value) && value.ok === true;
}

export function parseProfileOptionsResponse(value: unknown): ProfileOptionsDto | null {
  if (!isProfileOptionsSuccessResponse(value)) return null;
  if (!isProfileOptionsDto(value.item)) return null;
  return {
    ...value.item,
    universities: value.item.universities.map((university) => ({
      ...university,
      prefecture: "prefecture" in university && typeof university.prefecture === "string" ? university.prefecture : null,
    })),
  };
}
