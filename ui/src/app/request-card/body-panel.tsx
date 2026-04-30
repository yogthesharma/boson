import { TabsContent } from "@/components/ui/tabs"

type BodyPanelProps = {
  bodyPreview: string
}

export function BodyPanel({ bodyPreview }: BodyPanelProps) {
  return (
    <TabsContent value="body" className="mt-1 flex min-h-0 flex-1">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md border">
        <div className="border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Body
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <pre className="p-3 text-xs leading-relaxed text-foreground/90">
            {bodyPreview || "// No body configured for this route"}
          </pre>
        </div>
      </div>
    </TabsContent>
  )
}
