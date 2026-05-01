import { TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import type { RequestTabState } from "./helpers"

type DocsPanelProps = {
  docs: RequestTabState["docs"]
  onChange: (value: RequestTabState["docs"]) => void
}

export function DocsPanel({ docs, onChange }: DocsPanelProps) {
  return (
    <TabsContent value="docs" className="mt-1 flex min-h-0 flex-1 px-2 pb-2">
      <div className="grid min-h-0 flex-1 gap-3 overflow-auto rounded-md px-1 py-1">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Summary</p>
          <Input
            value={docs.summary}
            onChange={(event) =>
              onChange({ ...docs, summary: event.target.value })
            }
            placeholder="One-line summary"
          />
        </div>
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Description</p>
          <Textarea
            value={docs.description}
            onChange={(event) =>
              onChange({ ...docs, description: event.target.value })
            }
            className="min-h-48"
            placeholder="Detailed request notes and examples"
          />
        </div>
      </div>
    </TabsContent>
  )
}
