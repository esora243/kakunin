import type { ProfileOptionsDto, UpdateProfileRequest } from "@/lib/auth/types";

export type NormalizedUpdateProfileRequest = {
  gender: string | null;
  universityId: string;
  graduationYear: number;
  clubIds: string[];
  desiredSpecialtyId: string | null;
  consentMarketing: boolean;
  pushEnabled: boolean;
};

export class ProfileValidationError extends Error {
  issues: string[];

  constructor(issues: string[]) {
    super("Profile request validation failed");
    this.name = "ProfileValidationError";
    this.issues = issues;
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function validateUpdateProfileRequest(input: unknown): UpdateProfileRequest {
  const issues: string[] = [];
  const value = input && typeof input === "object" ? (input as Record<string, unknown>) : null;
  if (!value) {
    throw new ProfileValidationError(["body must be an object"]);
  }

  if (typeof value.universityId !== "string" || value.universityId.trim() === "") {
    issues.push("universityId is required");
  }
  if (!Number.isInteger(value.graduationYear)) {
    issues.push("graduationYear is required");
  }
  if (value.gender !== undefined && value.gender !== null && typeof value.gender !== "string") {
    issues.push("gender must be a string or null");
  }
  if (value.clubIds !== undefined && !isStringArray(value.clubIds)) {
    issues.push("clubIds must be an array of strings");
  }
  if (
    value.desiredSpecialtyId !== undefined &&
    value.desiredSpecialtyId !== null &&
    typeof value.desiredSpecialtyId !== "string"
  ) {
    issues.push("desiredSpecialtyId must be a string or null");
  }
  if (value.consentMarketing !== undefined && typeof value.consentMarketing !== "boolean") {
    issues.push("consentMarketing must be a boolean");
  }
  if (value.pushEnabled !== undefined && typeof value.pushEnabled !== "boolean") {
    issues.push("pushEnabled must be a boolean");
  }

  if (issues.length > 0) {
    throw new ProfileValidationError(issues);
  }

  return {
    gender: typeof value.gender === "string" ? value.gender : value.gender === null ? null : undefined,
    universityId: String(value.universityId),
    graduationYear: Number(value.graduationYear),
    clubIds: isStringArray(value.clubIds) ? value.clubIds : undefined,
    desiredSpecialtyId:
      typeof value.desiredSpecialtyId === "string"
        ? value.desiredSpecialtyId
        : value.desiredSpecialtyId === null
          ? null
          : undefined,
    consentMarketing: typeof value.consentMarketing === "boolean" ? value.consentMarketing : undefined,
    pushEnabled: typeof value.pushEnabled === "boolean" ? value.pushEnabled : undefined,
  };
}

export function normalizeUpdateProfileRequestForOptions(
  request: UpdateProfileRequest,
  options: ProfileOptionsDto,
): NormalizedUpdateProfileRequest {
  const issues: string[] = [];
  const universityIds = new Set(options.universities.map((item) => item.id));
  const clubIds = new Set(options.clubs.map((item) => item.id));
  const specialtyIds = new Set(options.specialties.map((item) => item.id));
  const graduationYears = new Set(options.graduationYears);
  const genders = new Set(options.genders);
  const requestedClubIds = request.clubIds ?? [];
  const seenClubIds = new Set<string>();

  if (!universityIds.has(request.universityId)) {
    issues.push("universityId is not selectable");
  }
  if (!graduationYears.has(request.graduationYear)) {
    issues.push("graduationYear is not selectable");
  }
  if (request.gender !== undefined && request.gender !== null && !genders.has(request.gender)) {
    issues.push("gender is not selectable");
  }
  for (const clubId of requestedClubIds) {
    if (seenClubIds.has(clubId)) {
      issues.push("clubIds contains duplicate clubs");
      break;
    }
    seenClubIds.add(clubId);
  }
  for (const clubId of requestedClubIds) {
    if (!clubIds.has(clubId)) {
      issues.push("clubIds contains a non-selectable club");
      break;
    }
  }
  if (request.desiredSpecialtyId && !specialtyIds.has(request.desiredSpecialtyId)) {
    issues.push("desiredSpecialtyId is not selectable");
  }

  if (issues.length > 0) {
    throw new ProfileValidationError(issues);
  }

  return {
    gender: request.gender ?? null,
    universityId: request.universityId,
    graduationYear: request.graduationYear,
    clubIds: requestedClubIds,
    desiredSpecialtyId: request.desiredSpecialtyId ?? null,
    consentMarketing: request.consentMarketing ?? false,
    pushEnabled: request.pushEnabled ?? false,
  };
}

export function createDefaultProfileOptions(now = new Date()): ProfileOptionsDto {
  const currentYear = now.getFullYear();
  return {
    universities: [{ id: "dev-university-hamamatsu", name: "浜松医科大学", prefecture: "静岡県" }],
    clubs: [
      { id: "dev-club-sports", name: "運動部" },
      { id: "dev-club-culture", name: "文化部" },
      { id: "dev-club-medical", name: "医療系サークル" },
      { id: "dev-club-other", name: "その他" },
      { id: "dev-club-none", name: "所属していない" },
    ],
    specialties: [
      { id: "dev-specialty-internal", name: "内科" },
      { id: "dev-specialty-surgery", name: "外科" },
      { id: "dev-specialty-pediatrics", name: "小児科" },
      { id: "dev-specialty-obgyn", name: "産婦人科" },
      { id: "dev-specialty-orthopedics", name: "整形外科" },
      { id: "dev-specialty-psychiatry", name: "精神科" },
      { id: "dev-specialty-dermatology", name: "皮膚科" },
      { id: "dev-specialty-ophthalmology", name: "眼科" },
      { id: "dev-specialty-ent", name: "耳鼻咽喉科" },
      { id: "dev-specialty-other", name: "その他" },
      { id: "dev-specialty-undecided", name: "未定" },
    ],
    graduationYears: Array.from({ length: 8 }, (_, index) => currentYear + index),
    genders: ["男性", "女性", "その他", "回答しない"],
  };
}
