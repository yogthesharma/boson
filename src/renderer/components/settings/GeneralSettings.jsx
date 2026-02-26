import { useSettingsStore } from "@/stores/settingsStore";
import { GENERAL_FIELDS } from "./settingsFieldsConfig";
import { SettingsField } from "./SettingsField";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function GeneralSettings() {
  const general = useSettingsStore((s) => s.general);
  const setGeneral = useSettingsStore((s) => s.setGeneral);

  return (
    <Card className="border-0">
      <CardHeader>
        <CardTitle>General</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {GENERAL_FIELDS.map((field) => (
          <SettingsField
            key={field.key}
            field={field}
            value={general[field.key]}
            onChange={(v) => setGeneral({ [field.key]: v })}
          />
        ))}
      </CardContent>
    </Card>
  );
}
