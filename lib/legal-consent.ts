export const LEGAL_CONSENT_VERSION = "2026-07-25" as const;

export type LegalConsentVersion = typeof LEGAL_CONSENT_VERSION;

export function isCurrentLegalConsentVersion(value: unknown): value is LegalConsentVersion {
  return value === LEGAL_CONSENT_VERSION;
}
