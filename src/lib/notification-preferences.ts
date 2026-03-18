export const NOTIFICATION_TYPE_DEFINITIONS = [
  {
    key: "period_reminder",
    code: 101,
    label: "Period reminder",
    description: "A gentle reminder before your next period.",
  },
  {
    key: "ovulation_alert",
    code: 102,
    label: "Ovulation alert",
    description: "A simple heads-up during your fertile phase.",
  },
  {
    key: "late_period_alert",
    code: 103,
    label: "Late period alert",
    description: "A calm message when your period seems delayed.",
  },
  {
    key: "irregular_cycle_alert",
    code: 104,
    label: "Irregular cycle alert",
    description: "Supportive advice when your cycle looks irregular.",
  },
  {
    key: "high_risk_alert",
    code: 105,
    label: "High risk alert",
    description: "A stronger nudge when higher health concerns appear.",
  },
  {
    key: "doctor_suggestion",
    code: 106,
    label: "Doctor suggestion",
    description: "Nearby specialist suggestions when extra support may help.",
  },
  {
    key: "daily_health_tip",
    code: 107,
    label: "Daily health tip",
    description: "Short everyday tips for better cycle wellness.",
  },
] as const;

export type NotificationTypeKey = (typeof NOTIFICATION_TYPE_DEFINITIONS)[number]["key"];
export type NotificationTypePreferences = Record<NotificationTypeKey, boolean>;

const REMINDER_DAY_OPTIONS = [1, 2] as const;

export const DEFAULT_NOTIFICATION_TIME = "09:00";

export const DEFAULT_NOTIFICATION_TYPES: NotificationTypePreferences = NOTIFICATION_TYPE_DEFINITIONS.reduce(
  (acc, item) => ({ ...acc, [item.key]: true }),
  {} as NotificationTypePreferences,
);

export const isReminderDayValue = (value: number) => REMINDER_DAY_OPTIONS.includes(value as (typeof REMINDER_DAY_OPTIONS)[number]);

export const decodeReminderDays = (values?: number[] | null) => {
  const days = Array.from(new Set((values ?? []).filter(isReminderDayValue))).sort((a, b) => a - b);
  return days.length > 0 ? days : [1];
};

export const decodeNotificationTypes = (values?: number[] | null): NotificationTypePreferences => {
  const valueSet = new Set(values ?? []);
  const hasExplicitTypeCodes = NOTIFICATION_TYPE_DEFINITIONS.some((item) => valueSet.has(item.code));

  return NOTIFICATION_TYPE_DEFINITIONS.reduce((acc, item) => {
    acc[item.key] = hasExplicitTypeCodes ? valueSet.has(item.code) : true;
    return acc;
  }, {} as NotificationTypePreferences);
};

export const encodeNotificationSettings = ({
  reminderDays,
  notificationTypes,
}: {
  reminderDays: number[];
  notificationTypes: NotificationTypePreferences;
}) => {
  const enabledCodes = NOTIFICATION_TYPE_DEFINITIONS.filter((item) => notificationTypes[item.key]).map((item) => item.code);
  return Array.from(new Set([...decodeReminderDays(reminderDays), ...enabledCodes])).sort((a, b) => a - b);
};
