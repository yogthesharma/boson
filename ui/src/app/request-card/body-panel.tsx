import { TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type BodyPanelProps = {
  bodyText: string
  onBodyChange: (value: string) => void
}

export function BodyPanel({ bodyText, onBodyChange }: BodyPanelProps) {
  return (
    <TabsContent value="body" className="mt-1 flex min-h-0 flex-1 px-2 pb-2">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md">
        <div className="bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Body
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-3 py-2">
          <Textarea
            value={bodyText}
            onChange={(event) => onBodyChange(event.target.value)}
            className="min-h-72 font-mono text-xs"
            placeholder='{\n  "example": true\n}'
          />
        </div>
      </div>
    </TabsContent>
  )
}
