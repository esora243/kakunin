import "server-only";

export type SafeLogEvent = {
  event: string;
  code: string;
  requestId?: string;
  resourceId?: string;
};

export function logSafeError(entry: SafeLogEvent): void {
  console.error(JSON.stringify(entry));
}
