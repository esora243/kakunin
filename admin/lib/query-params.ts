import { ValidationError } from "./errors";

export function stringParamFromAllowlist(value: string | null, allowed: readonly string[]): string | undefined {
  if (!value) return undefined;
  return allowed.includes(value) ? value : undefined;
}

function firstString(value: string | string[] | null | undefined): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") return item;
    }
    return undefined;
  }
  return typeof value === "string" ? value : undefined;
}

export function singleStringParam(value: string | string[] | null | undefined): string | undefined {
  const text = firstString(value);
  if (!text) return undefined;
  const trimmed = text.trim();
  return trimmed ? trimmed : undefined;
}

export function integerParam(value: string | null, field: string): number | undefined {
  if (!value) return undefined;
  if (!/^\d+$/.test(value)) {
    throw new ValidationError(`${field} must be a valid integer`);
  }
  return Number(value);
}

export function optionalIntegerParam(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  return Number(value);
}

export function boundedNonNegativeIntegerParam(
  value: string | string[] | null | undefined,
  field: string,
  { min = 0, max = Number.MAX_SAFE_INTEGER }: { min?: number; max?: number } = {},
): number | undefined {
  const text = singleStringParam(value);
  if (!text) return undefined;
  if (!/^\d+$/.test(text)) {
    throw new ValidationError(`${field} must be a valid integer`);
  }
  const parsed = Number(text);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new ValidationError(`${field} must be between ${min} and ${max}`);
  }
  return parsed;
}

export function isoDateParam(value: string | string[] | null | undefined, field: string): string | undefined {
  const text = singleStringParam(value);
  if (!text) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new ValidationError(`${field} must be YYYY-MM-DD`);
  }
  const parsed = new Date(`${text}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== Number(text.slice(0, 4)) ||
    parsed.getUTCMonth() + 1 !== Number(text.slice(5, 7)) ||
    parsed.getUTCDate() !== Number(text.slice(8, 10))
  ) {
    throw new ValidationError(`${field} must be YYYY-MM-DD`);
  }
  return text;
}

export function isoDateTimeParam(value: string | string[] | null | undefined, field: string): string | undefined {
  const text = singleStringParam(value);
  if (!text) return undefined;
  if (Number.isNaN(Date.parse(text))) {
    throw new ValidationError(`${field} must be a valid date/time`);
  }
  return text;
}

export function uuidParam(value: string | string[] | null | undefined, field: string): string | undefined {
  const text = singleStringParam(value);
  if (!text) return undefined;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text)) {
    throw new ValidationError(`${field} must be a valid UUID`);
  }
  return text;
}

export function requireUuidParam(value: string | string[] | null | undefined, field: string): string {
  const text = uuidParam(value, field);
  if (!text) throw new ValidationError(`${field} must be a valid UUID`, "invalid_id");
  return text;
}

export function pageUuidParam(value: string | string[] | null | undefined): string | undefined {
  const text = singleStringParam(value);
  if (!text) return undefined;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) ? text : undefined;
}
