import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultProfileOptions,
  normalizeUpdateProfileRequestForOptions,
  ProfileValidationError,
  validateUpdateProfileRequest,
} from "../lib/profile";

test("validateUpdateProfileRequest accepts the UpdateProfileRequest shape", () => {
  assert.deepEqual(
    validateUpdateProfileRequest({
      gender: "回答しない",
      universityId: "university-1",
      graduationYear: 2028,
      clubIds: ["club-1"],
      desiredSpecialtyId: null,
      consentMarketing: true,
      pushEnabled: false,
    }),
    {
      gender: "回答しない",
      universityId: "university-1",
      graduationYear: 2028,
      clubIds: ["club-1"],
      desiredSpecialtyId: null,
      consentMarketing: true,
      pushEnabled: false,
    },
  );
});

test("validateUpdateProfileRequest rejects missing required profile fields", () => {
  assert.throws(
    () => validateUpdateProfileRequest({ universityId: "", graduationYear: "2028" }),
    (error) =>
      error instanceof ProfileValidationError &&
      error.issues.includes("universityId is required") &&
      error.issues.includes("graduationYear is required"),
  );
});

test("normalizeUpdateProfileRequestForOptions accepts server-defined option values", () => {
  const options = createDefaultProfileOptions(new Date("2026-05-05T00:00:00Z"));

  assert.deepEqual(
    normalizeUpdateProfileRequestForOptions(
      {
        gender: "回答しない",
        universityId: "dev-university-hamamatsu",
        graduationYear: 2028,
        clubIds: ["dev-club-sports", "dev-club-culture"],
        desiredSpecialtyId: "dev-specialty-internal",
        consentMarketing: true,
      },
      options,
    ),
    {
      gender: "回答しない",
      universityId: "dev-university-hamamatsu",
      graduationYear: 2028,
      clubIds: ["dev-club-sports", "dev-club-culture"],
      desiredSpecialtyId: "dev-specialty-internal",
      consentMarketing: true,
      pushEnabled: false,
    },
  );
});

test("normalizeUpdateProfileRequestForOptions rejects out-of-range graduation years", () => {
  const options = createDefaultProfileOptions(new Date("2026-05-05T00:00:00Z"));

  assert.throws(
    () =>
      normalizeUpdateProfileRequestForOptions(
        {
          universityId: "dev-university-hamamatsu",
          graduationYear: 1900,
        },
        options,
      ),
    (error) => error instanceof ProfileValidationError && error.issues.includes("graduationYear is not selectable"),
  );
});

test("normalizeUpdateProfileRequestForOptions rejects unknown gender values", () => {
  const options = createDefaultProfileOptions(new Date("2026-05-05T00:00:00Z"));

  assert.throws(
    () =>
      normalizeUpdateProfileRequestForOptions(
        {
          gender: "unknown",
          universityId: "dev-university-hamamatsu",
          graduationYear: 2028,
        },
        options,
      ),
    (error) => error instanceof ProfileValidationError && error.issues.includes("gender is not selectable"),
  );
});

test("normalizeUpdateProfileRequestForOptions rejects duplicate club ids before writes", () => {
  const options = createDefaultProfileOptions(new Date("2026-05-05T00:00:00Z"));

  assert.throws(
    () =>
      normalizeUpdateProfileRequestForOptions(
        {
          universityId: "dev-university-hamamatsu",
          graduationYear: 2028,
          clubIds: ["dev-club-sports", "dev-club-sports"],
        },
        options,
      ),
    (error) => error instanceof ProfileValidationError && error.issues.includes("clubIds contains duplicate clubs"),
  );
});
