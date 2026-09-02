import assert from "node:assert/strict";
import test from "node:test";
import { NotificationSettingsValidationError, validateNotificationSettings } from "../lib/notification-settings-contract";

const valid = { classReminderEnabled: true, classReminderMinutesBefore: 30, taskDueReminderEnabled: true, taskDueReminderDaysBefore: 2, classChangeNotificationEnabled: false };

test("notification settings accept the complete bounded contract", () => { assert.deepEqual(validateNotificationSettings(valid), valid); });
test("notification settings reject unknown fields and out-of-range values", () => {
  assert.throws(() => validateNotificationSettings({ ...valid, unknown: true }), NotificationSettingsValidationError);
  assert.throws(() => validateNotificationSettings({ ...valid, classReminderMinutesBefore: 1441 }), NotificationSettingsValidationError);
  assert.throws(() => validateNotificationSettings({ ...valid, taskDueReminderDaysBefore: -1 }), NotificationSettingsValidationError);
});
