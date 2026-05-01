import { Badge } from "@/components/ui/badge"
import { TabsContent } from "@/components/ui/tabs"
import type { RouteDefinition } from "@/api"
import { describeTest, formatTestType } from "./helpers"

type TestsPanelProps = {
  tests: RouteDefinition["tests"]
}

export function TestsPanel({ tests }: TestsPanelProps) {
  return (
    <TabsContent value="tests" className="mt-1 flex min-h-0 flex-1 px-2 pb-2">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md">
        <div className="grid grid-cols-2 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span>Assertion</span>
          <span>Type</span>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {tests.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              No tests defined.
            </p>
          )}
          {tests.map((test, index) => (
            <div
              key={index}
              className="grid grid-cols-2 gap-3 px-3 py-2 text-sm odd:bg-muted/10 even:bg-background hover:bg-muted/20"
            >
              <span className="text-foreground/90">{describeTest(test)}</span>
              <div>
                <Badge variant="secondary" className="text-[11px]">
                  {formatTestType(test.type)}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </div>
    </TabsContent>
  )
}
