export function operatorSlug(title: string): string {
  const ascii = title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  if (ascii) return ascii;

  let hash = 2166136261;
  for (const character of title.trim()) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return title.trim() ? `item-${(hash >>> 0).toString(36)}` : "";
}

export function isSafePublicUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export function japanLocalDateTimeToIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const utc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 9, Number(minute));
  const date = new Date(utc);
  const localParts = new Date(utc + 9 * 60 * 60 * 1000);
  if (
    Number.isNaN(date.getTime()) ||
    localParts.getUTCFullYear() !== Number(year) ||
    localParts.getUTCMonth() + 1 !== Number(month) ||
    localParts.getUTCDate() !== Number(day) ||
    localParts.getUTCHours() !== Number(hour) ||
    localParts.getUTCMinutes() !== Number(minute)
  ) return null;
  return date.toISOString();
}
