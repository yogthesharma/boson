import { TabsContent } from "@/components/ui/tabs"

type HeadersPanelProps = {
  headers: Array<[string, string]>
}

export function HeadersPanel({ headers }: HeadersPanelProps) {
  return (
    <TabsContent value="headers" className="mt-1 flex min-h-0 flex-1">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
        <div className="grid grid-cols-2 border-b border-border/70 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          <span>Header</span>
          <span>Value</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {headers.length === 0 && (
            <div className="px-3 py-3 text-sm text-muted-foreground">
              No custom headers.
            </div>
          )}
          {headers.map(([key, value]) => (
            <div
              key={key}
              className="grid grid-cols-2 border-b border-border/60 px-3 py-2 text-sm last:border-b"
            >
              <span className="font-mono text-xs text-foreground/90">
                {key}
              </span>
              <span className="font-mono text-xs text-foreground/80">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </TabsContent>
  )
}
