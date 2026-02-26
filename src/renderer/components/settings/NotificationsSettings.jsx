import { useSettingsStore } from "@/stores/settingsStore";
import { NOTIFICATIONS_FIELDS } from "./settingsFieldsConfig";
import { SettingsField } from "./SettingsField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NotificationsSettings() {
  const notifications = useSettingsStore((s) => s.notifications);
  const setNotifications = useSettingsStore((s) => s.setNotifications);

  return (
    <Card className="mt-8 border-0">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {NOTIFICATIONS_FIELDS.map((field) => (
          <SettingsField
            key={field.key}
            field={field}
            value={notifications[field.key]}
            onChange={(v) => setNotifications({ [field.key]: v })}
          />
        ))}
      </CardContent>
    </Card>
  );
}
