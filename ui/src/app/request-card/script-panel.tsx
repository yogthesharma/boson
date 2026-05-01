import { TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { RequestTabState } from "./helpers"

type ScriptPanelProps = {
  script: RequestTabState["script"]
  onChange: (value: RequestTabState["script"]) => void
}

export function ScriptPanel({ script, onChange }: ScriptPanelProps) {
  return (
    <TabsContent value="script" className="mt-1 flex min-h-0 flex-1 px-2 pb-2">
      <div className="grid min-h-0 flex-1 gap-3 overflow-auto rounded-md">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Pre-request script</p>
          <Textarea
            value={script.preRequest}
            onChange={(event) =>
              onChange({ ...script, preRequest: event.target.value })
            }
            className="min-h-40 font-mono text-xs"
            placeholder="// runs before request"
          />
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Post-response script</p>
          <Textarea
            value={script.postResponse}
            onChange={(event) =>
              onChange({ ...script, postResponse: event.target.value })
            }
            className="min-h-40 font-mono text-xs"
            placeholder="// runs after response"
          />
        </div>
      </div>
    </TabsContent>
  )
}
