export function normalizeExternalHttpsUrl(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;

  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function normalizeSiteUrl(value: string | null | undefined): string | null {
  const text = value?.trim();
  if (!text) return null;

  try {
    const url = new URL(text);
    if (url.protocol === "https:") return url.toString();
    if (url.protocol === "http:" && ["localhost", "127.0.0.1", "::1", "[::1]"].includes(url.hostname)) return url.toString();
    return null;
  } catch {
    return null;
  }
}

export function normalizeEmailAddress(value: string | null | undefined, fallback = "contact@example.com") {
  const text = value?.trim() ?? "";
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(text) ? text : fallback;
}
