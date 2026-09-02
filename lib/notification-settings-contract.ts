export type NotificationSettingsDto = {
  classReminderEnabled: boolean;
  classReminderMinutesBefore: number;
  taskDueReminderEnabled: boolean;
  taskDueReminderDaysBefore: number;
  classChangeNotificationEnabled: boolean;
};

export class NotificationSettingsValidationError extends Error {}

export function validateNotificationSettings(value: unknown): NotificationSettingsDto {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new NotificationSettingsValidationError("設定形式が不正です");
  const record = value as Record<string, unknown>;
  const allowed = new Set(["classReminderEnabled", "classReminderMinutesBefore", "taskDueReminderEnabled", "taskDueReminderDaysBefore", "classChangeNotificationEnabled"]);
  if (Object.keys(record).some((key) => !allowed.has(key))) throw new NotificationSettingsValidationError("未対応の設定項目が含まれています");
  if (typeof record.classReminderEnabled !== "boolean" || typeof record.taskDueReminderEnabled !== "boolean" || typeof record.classChangeNotificationEnabled !== "boolean") throw new NotificationSettingsValidationError("通知の有効状態が不正です");
  if (!Number.isInteger(record.classReminderMinutesBefore) || Number(record.classReminderMinutesBefore) < 0 || Number(record.classReminderMinutesBefore) > 1440) throw new NotificationSettingsValidationError("授業通知は0〜1440分で指定してください");
  if (!Number.isInteger(record.taskDueReminderDaysBefore) || Number(record.taskDueReminderDaysBefore) < 0 || Number(record.taskDueReminderDaysBefore) > 30) throw new NotificationSettingsValidationError("課題通知は0〜30日で指定してください");
  return record as NotificationSettingsDto;
}
