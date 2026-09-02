import "server-only";

import type { AuthSessionPayload } from "./auth/types";
import { dbQuery } from "./db/postgres";
import type { NotificationSettingsDto } from "./notification-settings-contract";

type NotificationSettingsRow = {
  class_reminder_enabled: boolean;
  class_reminder_minutes_before: number;
  task_due_reminder_enabled: boolean;
  task_due_reminder_days_before: number;
  class_change_notification_enabled: boolean;
};

function mapSettings(row: NotificationSettingsRow): NotificationSettingsDto {
  return { classReminderEnabled: row.class_reminder_enabled, classReminderMinutesBefore: row.class_reminder_minutes_before, taskDueReminderEnabled: row.task_due_reminder_enabled, taskDueReminderDaysBefore: row.task_due_reminder_days_before, classChangeNotificationEnabled: row.class_change_notification_enabled };
}

export async function getNotificationSettings(session: AuthSessionPayload) {
  await dbQuery(`
    insert into user_notification_settings (user_id)
    select id from users where id = $1 and deactivated_at is null
    on conflict (user_id) do nothing
  `, [session.userId]);
  const { rows } = await dbQuery<NotificationSettingsRow>(`
    select class_reminder_enabled, class_reminder_minutes_before, task_due_reminder_enabled, task_due_reminder_days_before, class_change_notification_enabled
    from user_notification_settings
    where user_id = $1
  `, [session.userId]);
  return rows[0] ? mapSettings(rows[0]) : null;
}

export async function updateNotificationSettings(session: AuthSessionPayload, settings: NotificationSettingsDto) {
  const { rows } = await dbQuery<NotificationSettingsRow>(`
    insert into user_notification_settings (user_id, class_reminder_enabled, class_reminder_minutes_before, task_due_reminder_enabled, task_due_reminder_days_before, class_change_notification_enabled)
    select id, $2, $3, $4, $5, $6 from users where id = $1 and deactivated_at is null
    on conflict (user_id) do update set class_reminder_enabled = excluded.class_reminder_enabled, class_reminder_minutes_before = excluded.class_reminder_minutes_before, task_due_reminder_enabled = excluded.task_due_reminder_enabled, task_due_reminder_days_before = excluded.task_due_reminder_days_before, class_change_notification_enabled = excluded.class_change_notification_enabled
    returning class_reminder_enabled, class_reminder_minutes_before, task_due_reminder_enabled, task_due_reminder_days_before, class_change_notification_enabled
  `, [session.userId, settings.classReminderEnabled, settings.classReminderMinutesBefore, settings.taskDueReminderEnabled, settings.taskDueReminderDaysBefore, settings.classChangeNotificationEnabled]);
  return rows[0] ? mapSettings(rows[0]) : null;
}
