import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type ReminderSettingsRow = {
  user_id: string;
  notification_enabled: boolean | null;
  notification_time: string | null;
  reminder_days: number[] | null;
  timezone: string | null;
  average_cycle_length: number | null;
};

type LatestAssessment = {
  created_at: string;
  recommendations: Record<string, unknown> | null;
  risk_category: string | null;
};

type LatestCycle = {
  start_date: string;
};

type LatestPrediction = {
  predicted_start_date: string;
};

type NotificationTypeKey =
  | "period_reminder"
  | "ovulation_alert"
  | "late_period_alert"
  | "irregular_cycle_alert"
  | "high_risk_alert"
  | "doctor_suggestion"
  | "daily_health_tip";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const NOTIFICATION_TYPE_CODES: Record<NotificationTypeKey, number> = {
  period_reminder: 101,
  ovulation_alert: 102,
  late_period_alert: 103,
  irregular_cycle_alert: 104,
  high_risk_alert: 105,
  doctor_suggestion: 106,
  daily_health_tip: 107,
};

const DAILY_TIPS = [
  "🌿 Tip: Proper sleep and stress management help maintain a healthy cycle.",
  "🌿 Tip: Drinking enough water can help you feel better through your cycle.",
  "🌿 Tip: Gentle movement and balanced meals can support cycle wellness.",
  "🌿 Tip: Rest, hydration, and a calm routine can make cycle days easier.",
];

const createDateFormatter = (timeZone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

const getTodayInTimezone = (timeZone: string) => createDateFormatter(timeZone).format(new Date());

const addDaysToDateString = (dateString: string, days: number) => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const diffInDays = (fromDate: string, toDate: string) => {
  const from = new Date(`${fromDate}T00:00:00Z`).getTime();
  const to = new Date(`${toDate}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86400000);
};

const decodeReminderDays = (values?: number[] | null) => {
  const days = Array.from(new Set((values ?? []).filter((value) => value === 1 || value === 2))).sort((a, b) => a - b);
  return days.length > 0 ? days : [1];
};

const decodeNotificationTypes = (values?: number[] | null) => {
  const valueSet = new Set(values ?? []);
  const hasTypeCodes = Object.values(NOTIFICATION_TYPE_CODES).some((code) => valueSet.has(code));

  return Object.entries(NOTIFICATION_TYPE_CODES).reduce((acc, [key, code]) => {
    acc[key as NotificationTypeKey] = hasTypeCodes ? valueSet.has(code) : true;
    return acc;
  }, {} as Record<NotificationTypeKey, boolean>);
};

const deterministicUuid = async (seed: string) => {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed)));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes.slice(0, 16), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

const normalizeAssessment = (
  assessment: LatestAssessment | null,
  cycle: LatestCycle | null,
  prediction: LatestPrediction | null,
  fallbackCycleLength: number,
) => {
  const recommendations = assessment?.recommendations ?? {};
  const cycleStatusRaw = typeof recommendations.cycle_status === "string" ? recommendations.cycle_status : null;
  const severityRaw = typeof recommendations.severity === "string" ? recommendations.severity : null;
  const predictedCycle =
    typeof recommendations.predicted_cycle === "number"
      ? recommendations.predicted_cycle
      : fallbackCycleLength;
  const lastPeriodDate =
    typeof recommendations.last_period_date === "string"
      ? recommendations.last_period_date
      : cycle?.start_date ?? null;
  const nextPeriodDate =
    typeof recommendations.next_period_date === "string"
      ? recommendations.next_period_date
      : prediction?.predicted_start_date ?? (lastPeriodDate ? addDaysToDateString(lastPeriodDate, predictedCycle) : null);

  return {
    cycleStatus: cycleStatusRaw === "Regular" ? "Regular" : "Irregular",
    severity: severityRaw === "High" ? "High" : "Moderate",
    predictedCycle,
    lastPeriodDate,
    nextPeriodDate,
  };
};

const buildNotifications = ({
  today,
  assessmentCreatedDate,
  cycleStatus,
  severity,
  nextPeriodDate,
  predictedCycle,
  reminderDays,
  notificationTypes,
}: {
  today: string;
  assessmentCreatedDate: string | null;
  cycleStatus: "Regular" | "Irregular";
  severity: "Moderate" | "High";
  nextPeriodDate: string | null;
  predictedCycle: number;
  reminderDays: number[];
  notificationTypes: Record<NotificationTypeKey, boolean>;
}) => {
  const items: Array<{ type: NotificationTypeKey; title: string; message: string }> = [];

  if (nextPeriodDate) {
    const daysUntilPeriod = diffInDays(today, nextPeriodDate);
    const ovulationDate = addDaysToDateString(nextPeriodDate, -14);

    if (notificationTypes.period_reminder && reminderDays.includes(daysUntilPeriod)) {
      items.push({
        type: "period_reminder",
        title: "Period reminder",
        message: "💜 Your period is expected soon. Keep your essentials ready and take care!",
      });
    }

    if (notificationTypes.ovulation_alert && today === ovulationDate) {
      items.push({
        type: "ovulation_alert",
        title: "Ovulation alert",
        message: "🌸 You are in your fertile phase today. Take extra care of your health.",
      });
    }

    if (notificationTypes.late_period_alert && diffInDays(nextPeriodDate, today) === 1) {
      items.push({
        type: "late_period_alert",
        title: "Late period alert",
        message: "⚠️ Your period seems delayed. Don’t worry, but keep track and consult a doctor if needed.",
      });
    }
  }

  const assessmentIsFresh = assessmentCreatedDate === today;

  if (assessmentIsFresh && cycleStatus === "Irregular" && notificationTypes.irregular_cycle_alert) {
    items.push({
      type: "irregular_cycle_alert",
      title: "Cycle update",
      message: "🚨 Your cycle looks a bit irregular. Maintaining a healthy lifestyle can help.",
    });
  }

  if (assessmentIsFresh && severity === "High" && notificationTypes.high_risk_alert) {
    items.push({
      type: "high_risk_alert",
      title: "Health support",
      message: "🚨 We noticed some health concerns. It’s a good idea to consult a doctor.",
    });
  }

  if (assessmentIsFresh && (severity === "High" || cycleStatus === "Irregular") && notificationTypes.doctor_suggestion) {
    items.push({
      type: "doctor_suggestion",
      title: "Doctor suggestion",
      message: "🩺 Nearby specialists are available. Book a consultation for better guidance.",
    });
  }

  if (notificationTypes.daily_health_tip) {
    const tipIndex = Math.abs(diffInDays("2026-01-01", today) + predictedCycle) % DAILY_TIPS.length;
    items.push({
      type: "daily_health_tip",
      title: "Daily health tip",
      message: DAILY_TIPS[tipIndex],
    });
  }

  return items;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  const cronSecret = Deno.env.get("NOTIFICATION_CRON_SECRET");
  const providedSecret = req.headers.get("x-cron-secret");

  if (!cronSecret || providedSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const oneSignalAppId = Deno.env.get("ONESIGNAL_APP_ID");
  const oneSignalRestApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

  if (!supabaseUrl || !serviceRoleKey || !oneSignalAppId || !oneSignalRestApiKey) {
    return new Response(JSON.stringify({ error: "Missing required environment variables" }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: rows, error } = await supabase
    .from("user_cycle_settings")
    .select("user_id, notification_enabled, notification_time, reminder_days, timezone, average_cycle_length")
    .eq("notification_enabled", true);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of (rows as ReminderSettingsRow[] | null) ?? []) {
    const timeZone = row.timezone || "UTC";
    const today = getTodayInTimezone(timeZone);
    const reminderDays = decodeReminderDays(row.reminder_days);
    const notificationTypes = decodeNotificationTypes(row.reminder_days);

    try {
      const [assessmentResult, cycleResult, predictionResult] = await Promise.all([
        supabase
          .from("health_assessments")
          .select("created_at, recommendations, risk_category")
          .eq("user_id", row.user_id)
          .or("assessment_type.eq.menstrual_ml_api,assessment_type.eq.menstrual_ml_local")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("cycle_logs")
          .select("start_date")
          .eq("user_id", row.user_id)
          .order("start_date", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("cycle_predictions")
          .select("predicted_start_date")
          .eq("user_id", row.user_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (assessmentResult.error || cycleResult.error || predictionResult.error) {
        skipped += 1;
        continue;
      }

      const normalized = normalizeAssessment(
        (assessmentResult.data as LatestAssessment | null) ?? null,
        (cycleResult.data as LatestCycle | null) ?? null,
        (predictionResult.data as LatestPrediction | null) ?? null,
        row.average_cycle_length ?? 28,
      );

      if (!normalized.lastPeriodDate && !normalized.nextPeriodDate) {
        skipped += 1;
        continue;
      }

      const assessmentCreatedDate = assessmentResult.data?.created_at?.slice(0, 10) ?? null;
      const queue = buildNotifications({
        today,
        assessmentCreatedDate,
        cycleStatus: normalized.cycleStatus,
        severity: normalized.severity,
        nextPeriodDate: normalized.nextPeriodDate,
        predictedCycle: normalized.predictedCycle,
        reminderDays,
        notificationTypes,
      });

      if (queue.length === 0) {
        skipped += 1;
        continue;
      }

      for (const item of queue) {
        const idempotencyKey = await deterministicUuid(`${row.user_id}:${item.type}:${today}`);
        const response = await fetch("https://api.onesignal.com/notifications", {
          method: "POST",
          headers: {
            Authorization: `Key ${oneSignalRestApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            app_id: oneSignalAppId,
            target_channel: "push",
            include_aliases: {
              external_id: [row.user_id],
            },
            contents: {
              en: item.message,
            },
            headings: {
              en: item.title,
            },
            idempotency_key: idempotencyKey,
          }),
        });

        const body = await response.text();
        if (!response.ok) {
          if (body.includes("not subscribed") || body.includes("All included players are not subscribed")) {
            skipped += 1;
            continue;
          }
          throw new Error(`OneSignal request failed [${response.status}]: ${body}`);
        }

        sent += 1;
      }
    } catch (userError) {
      errors.push(`${row.user_id}: ${userError instanceof Error ? userError.message : "Unknown error"}`);
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      processed: rows?.length ?? 0,
      sent,
      skipped,
      errors,
    }),
    { status: 200, headers: corsHeaders },
  );
});
