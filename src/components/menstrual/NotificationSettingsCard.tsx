import { useEffect, useMemo, useState } from "react";
import { Bell, Clock3, HeartHandshake, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import {
  DEFAULT_NOTIFICATION_TIME,
  DEFAULT_NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_DEFINITIONS,
  NotificationTypePreferences,
  decodeNotificationTypes,
  decodeReminderDays,
  encodeNotificationSettings,
} from "@/lib/notification-preferences";

interface NotificationSettingsCardProps {
  settings: {
    notification_enabled: boolean | null;
    notification_time: string | null;
    reminder_days: number[] | null;
  } | null;
  saving: boolean;
  onSave: (updates: {
    notification_enabled: boolean;
    notification_time: string;
    reminder_days: number[];
    timezone: string;
  }) => Promise<void> | void;
}

export function NotificationSettingsCard({ settings, saving, onSave }: NotificationSettingsCardProps) {
  const { toast } = useToast();
  const { permission, initializing, subscribed, ready, requestPermission, refreshStatus, statusLabel } = usePushNotifications();
  const [enabled, setEnabled] = useState(Boolean(settings?.notification_enabled));
  const [reminderDay, setReminderDay] = useState(1);
  const [notificationTime, setNotificationTime] = useState(DEFAULT_NOTIFICATION_TIME);
  const [notificationTypes, setNotificationTypes] = useState<NotificationTypePreferences>(DEFAULT_NOTIFICATION_TYPES);

  useEffect(() => {
    setEnabled(Boolean(settings?.notification_enabled));
    setReminderDay(decodeReminderDays(settings?.reminder_days)[0] ?? 1);
    setNotificationTime(settings?.notification_time || DEFAULT_NOTIFICATION_TIME);
    setNotificationTypes(decodeNotificationTypes(settings?.reminder_days));
  }, [settings]);

  const selectedCount = useMemo(
    () => Object.values(notificationTypes).filter(Boolean).length,
    [notificationTypes],
  );

  const handleSave = async () => {
    try {
      let canReceivePush = subscribed;

      if (enabled && !canReceivePush) {
        canReceivePush = await requestPermission();
      }

      if (enabled && !canReceivePush) {
        throw new Error("Please allow browser notifications to turn reminders on.");
      }

      await onSave({
        notification_enabled: enabled && canReceivePush,
        notification_time: notificationTime,
        reminder_days: encodeNotificationSettings({
          reminderDays: [reminderDay],
          notificationTypes,
        }),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });

      await refreshStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save your notification settings.";
      toast({
        title: "Notification setup incomplete",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-border shadow-sm overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-primary via-accent to-secondary" />
      <CardContent className="p-5 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-heading text-lg font-semibold text-foreground">Smart cycle notifications</h3>
                <p className="text-sm text-muted-foreground">Friendly reminders based on your latest cycle prediction.</p>
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="self-start">{statusLabel}</Badge>
        </div>

        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-foreground">Enable notifications</p>
              <p className="text-sm text-muted-foreground">Get supportive reminders, alerts, and daily health tips.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>
              {permission === "denied"
                ? "Notifications are blocked in this browser. Please allow them in browser settings first."
                : "Notifications are sent only if your browser or device allows them."}
            </span>
          </div>

          {ready && !subscribed && (
            <Button type="button" variant="outline" onClick={requestPermission} disabled={initializing}>
              Allow push notifications
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock3 className="w-4 h-4 text-primary" />
            <p className="font-medium text-foreground">Reminder timing</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[1, 2].map((day) => (
              <Button
                key={day}
                type="button"
                variant={reminderDay === day ? "default" : "outline"}
                onClick={() => setReminderDay(day)}
              >
                {day} day{day > 1 ? "s" : ""} before
              </Button>
            ))}
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">Preferred time</label>
            <Input type="time" value={notificationTime} onChange={(event) => setNotificationTime(event.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <HeartHandshake className="w-4 h-4 text-primary" />
            <div>
              <p className="font-medium text-foreground">Choose notification types</p>
              <p className="text-sm text-muted-foreground">{selectedCount} alerts enabled</p>
            </div>
          </div>
          <div className="space-y-2">
            {NOTIFICATION_TYPE_DEFINITIONS.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background p-3">
                <div>
                  <p className="font-medium text-foreground">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
                <Switch
                  checked={notificationTypes[item.key]}
                  onCheckedChange={(checked) =>
                    setNotificationTypes((current) => ({
                      ...current,
                      [item.key]: checked,
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <Button type="button" className="w-full" onClick={handleSave} disabled={saving || initializing}>
          Save notification settings
        </Button>
      </CardContent>
    </Card>
  );
}
