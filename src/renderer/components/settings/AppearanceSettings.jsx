import { useSettingsStore } from "@/stores/settingsStore";
import { APPEARANCE_FIELDS } from "./settingsFieldsConfig";
import { SettingsField } from "./SettingsField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AppearanceSettings() {
  const appearance = useSettingsStore((s) => s.appearance);
  const setAppearance = useSettingsStore((s) => s.setAppearance);

  return (
    <Card className="mt-8 border-0">
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {APPEARANCE_FIELDS.map((field) => (
          <SettingsField
            key={field.key}
            field={field}
            value={field.type === "font" ? undefined : appearance[field.key]}
            onChange={(v) => setAppearance({ [field.key]: v })}
            sectionValues={appearance}
            onSectionChange={setAppearance}
          />
        ))}
      </CardContent>
    </Card>
  );
}
