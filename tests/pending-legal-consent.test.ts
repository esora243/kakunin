import assert from "node:assert/strict";
import test, { afterEach, beforeEach } from "node:test";
import {
  clearPendingLegalConsent,
  PENDING_LEGAL_CONSENT_STORAGE_KEY,
  readPendingLegalConsent,
  storePendingLegalConsent,
} from "../lib/auth/pending-legal-consent";
import { LEGAL_CONSENT_VERSION } from "../lib/legal-consent";

const storage = new Map<string, string>();
const sessionStorage = {
  getItem(key: string) {
    return storage.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    storage.set(key, value);
  },
  removeItem(key: string) {
    storage.delete(key);
  },
};

beforeEach(() => {
  storage.clear();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { sessionStorage },
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

test("pending legal consent survives the LINE redirect in the current tab", () => {
  assert.equal(storePendingLegalConsent(LEGAL_CONSENT_VERSION), true);
  assert.equal(storage.get(PENDING_LEGAL_CONSENT_STORAGE_KEY), LEGAL_CONSENT_VERSION);
  assert.equal(readPendingLegalConsent(), LEGAL_CONSENT_VERSION);
});

test("stale pending legal consent is rejected and removed", () => {
  storage.set(PENDING_LEGAL_CONSENT_STORAGE_KEY, "2026-01-01");
  assert.equal(readPendingLegalConsent(), null);
  assert.equal(storage.has(PENDING_LEGAL_CONSENT_STORAGE_KEY), false);
});

test("restricted session storage fails closed", () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      sessionStorage: {
        getItem() {
          throw new DOMException("blocked", "SecurityError");
        },
        setItem() {
          throw new DOMException("blocked", "SecurityError");
        },
        removeItem() {
          throw new DOMException("blocked", "SecurityError");
        },
      },
    },
  });

  assert.equal(storePendingLegalConsent(LEGAL_CONSENT_VERSION), false);
  assert.equal(readPendingLegalConsent(), null);
  assert.doesNotThrow(clearPendingLegalConsent);
});
