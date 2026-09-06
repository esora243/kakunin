import assert from "node:assert/strict";
import test from "node:test";
import { assertLoginUserCanReceiveSession, LoginUserRejectedError } from "../lib/auth/line-session";

test("deactivated users cannot receive a login session", () => {
  assert.throws(
    () => assertLoginUserCanReceiveSession({ deactivated_at: "2026-05-05T00:00:00.000Z" }),
    (error) =>
      error instanceof LoginUserRejectedError &&
      error.code === "login_user_rejected" &&
      error.httpStatus === 403 &&
      error.clearExistingSession === true,
  );
});

test("active users can receive a login session", () => {
  assert.doesNotThrow(() => assertLoginUserCanReceiveSession({ deactivated_at: null }));
});
