import {
  isCurrentLegalConsentVersion,
  type LegalConsentVersion,
} from "../legal-consent";

export const PENDING_LEGAL_CONSENT_STORAGE_KEY = "hugmeid.pendingLegalConsent";

export function storePendingLegalConsent(version: LegalConsentVersion) {
  if (typeof window === "undefined") return false;
  try {
    window.sessionStorage.setItem(PENDING_LEGAL_CONSENT_STORAGE_KEY, version);
    return true;
  } catch {
    return false;
  }
}

export function readPendingLegalConsent() {
  if (typeof window === "undefined") return null;
  try {
    const version = window.sessionStorage.getItem(PENDING_LEGAL_CONSENT_STORAGE_KEY);
    if (isCurrentLegalConsentVersion(version)) return version;
    clearPendingLegalConsent();
  } catch {
    // Restricted storage means the redirect cannot safely resume consent.
  }
  return null;
}

export function clearPendingLegalConsent() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PENDING_LEGAL_CONSENT_STORAGE_KEY);
  } catch {
    // Nothing else can be cleared when storage access is restricted.
  }
}
