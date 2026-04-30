import { TabsContent } from "@/components/ui/tabs"
import type { RouteDefinition } from "@/api"

type MetaPanelProps = {
  route: RouteDefinition
}

export function MetaPanel({ route }: MetaPanelProps) {
  return (
    <TabsContent value="meta" className="mt-1 flex min-h-0 flex-1">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <div className="grid grid-cols-2 border-b border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <span>Field</span>
          <span>Value</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <MetaRow label="ID" value={route.id} />
          <MetaRow label="Name" value={route.name} />
          <MetaRow label="Method" value={route.method} />
          <MetaRow label="Path" value={route.path} />
        </div>
      </div>
    </TabsContent>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-2 border-b border-border/60 px-3 py-2 text-sm last:border-b">
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </span>
      <span className="font-medium text-foreground/90">{value}</span>
    </div>
  )
}
