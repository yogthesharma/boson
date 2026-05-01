import { TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import type { RequestTabState } from "./helpers"

type SettingsPanelProps = {
  settings: RequestTabState["settings"]
  onChange: (value: RequestTabState["settings"]) => void
}

export function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  return (
    <TabsContent value="settings" className="mt-1 flex min-h-0 flex-1 px-2 pb-2">
      <div className="grid min-h-0 flex-1 max-w-xl gap-3 overflow-auto rounded-md px-1 py-1">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Timeout (ms)</p>
          <Input
            value={settings.timeoutMs}
            onChange={(event) =>
              onChange({ ...settings, timeoutMs: event.target.value })
            }
            placeholder="10000"
          />
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Retry count</p>
          <Input
            value={settings.retryCount}
            onChange={(event) =>
              onChange({ ...settings, retryCount: event.target.value })
            }
            placeholder="0"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={settings.followRedirects}
            onCheckedChange={(checked) =>
              onChange({ ...settings, followRedirects: checked })
            }
          />
          <span className="text-sm text-foreground/90">Follow redirects</span>
        </div>
      </div>
    </TabsContent>
  )
}
