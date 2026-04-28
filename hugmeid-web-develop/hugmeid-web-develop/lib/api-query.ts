export type NumberQueryParseResult =
  | { ok: true; value: number | undefined }
  | { ok: false; message: string };

export function parseNonNegativeNumberParam(value: string | null, label: string): NumberQueryParseResult {
  if (!value) return { ok: true, value: undefined };

  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return { ok: false, message: `${label} は0以上の数値で指定してください` };
  }

  return { ok: true, value: parsedValue };
}
