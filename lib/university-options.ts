import type { ProfileOptionsDto } from "@/lib/auth/types";

export type UniversityOption = ProfileOptionsDto["universities"][number];

function normalizeSearchText(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ja");
}

export function listUniversityPrefectures(universities: UniversityOption[]) {
  return [...new Set(universities.map((university) => university.prefecture).filter((value): value is string => Boolean(value)))]
    .sort((left, right) => left.localeCompare(right, "ja"));
}

export function filterUniversityOptions(
  universities: UniversityOption[],
  filters: { query: string; prefecture: string },
) {
  const query = normalizeSearchText(filters.query);
  return universities.filter((university) => {
    if (filters.prefecture && university.prefecture !== filters.prefecture) return false;
    return !query || normalizeSearchText(university.name).includes(query);
  });
}

