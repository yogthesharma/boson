import { TabsContent } from "@/components/ui/tabs"

type HeadersPanelProps = {
  headers: Array<[string, string]>
}

export function HeadersPanel({ headers }: HeadersPanelProps) {
  return (
    <TabsContent value="headers" className="mt-1 flex min-h-0 flex-1 px-2 pb-2">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md">
        <div className="grid grid-cols-2 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
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
              className="grid grid-cols-2 px-3 py-2 text-sm odd:bg-muted/10 even:bg-background hover:bg-muted/20"
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
