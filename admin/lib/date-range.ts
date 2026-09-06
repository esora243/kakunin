import { ValidationError } from "./errors";

export function assertOrderedDateRange(
  start: string | null,
  end: string | null,
  startField: string,
  endField: string,
): void {
  if (!start || !end) return;
  if (Date.parse(start) > Date.parse(end)) {
    throw new Error(`${startField} must be on or before ${endField}`);
  }
}

export function assertActivityDateRange(startsAt: string | null, endsAt: string | null): void {
  try {
    assertOrderedDateRange(startsAt, endsAt, "Starts at", "Ends at");
  } catch {
    throw new ValidationError("Starts at must be on or before Ends at");
  }
}
