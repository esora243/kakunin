import { ValidationError } from "./errors";
import type { PoolClient } from "pg";

export function requireExpectedUpdatedAt(value: unknown): string {
  if (typeof value !== "string") {
    throw new ValidationError("expectedUpdatedAt must be a valid timestamp", "invalid_expected_updated_at");
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|[+-](\d{2})(?::?(\d{2}))?)$/.exec(value);
  if (!match) {
    throw new ValidationError("expectedUpdatedAt must be a valid timestamp", "invalid_expected_updated_at");
  }
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const daysInMonth = month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
  if (
    year < 1 ||
    day < 1 ||
    day > daysInMonth ||
    Number(hourText) > 23 ||
    Number(minuteText) > 59 ||
    Number(secondText) > 59 ||
    (offsetHourText !== undefined && Number(offsetHourText) > 14) ||
    (Number(offsetHourText) === 14 && Number(offsetMinuteText ?? 0) > 0) ||
    (offsetMinuteText !== undefined && Number(offsetMinuteText) > 59)
  ) {
    throw new ValidationError("expectedUpdatedAt must be a valid timestamp", "invalid_expected_updated_at");
  }
  return value;
}

export async function timestampsMatch(client: PoolClient, actual: string, expected: string): Promise<boolean> {
  const { rows } = await client.query<{ matches: boolean }>(
    "select $1::timestamptz = $2::timestamptz as matches",
    [actual, expected],
  );
  return rows[0]?.matches === true;
}
