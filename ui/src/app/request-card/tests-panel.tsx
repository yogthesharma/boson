import { Badge } from "@/components/ui/badge"
import { TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { RouteDefinition } from "@/api"
import { describeTest, formatTestType } from "./helpers"

type TestsPanelProps = {
  tests: RouteDefinition["tests"]
  onTestsChange: (tests: RouteDefinition["tests"]) => void
}

export function TestsPanel({ tests, onTestsChange }: TestsPanelProps) {
  const serialized = JSON.stringify(tests, null, 2)
  return (
    <TabsContent value="tests" className="mt-1 flex min-h-0 flex-1 px-2 pb-2">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md">
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="[&_tr]:border-0">
              <TableRow className="border-0 bg-muted/30 hover:bg-muted/30">
                <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                  Assertion
                </TableHead>
                <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                  Type
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_tr:last-child]:border-0">
              {tests.length === 0 && (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell
                    colSpan={2}
                    className="px-3 py-3 text-sm text-muted-foreground"
                  >
                    No tests defined.
                  </TableCell>
                </TableRow>
              )}
              {tests.map((test, index) => (
                <TableRow
                  key={index}
                  className="border-0 odd:bg-muted/10 even:bg-background hover:bg-muted/20"
                >
                  <TableCell className="px-3 py-2 text-sm text-foreground/90">
                    {describeTest(test)}
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Badge variant="secondary" className="text-[11px]">
                      {formatTestType(test.type)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-3 py-2">
            <p className="mb-1 text-xs text-muted-foreground">Assertion JSON</p>
            <Textarea
              value={serialized}
              onChange={(event) => {
                const value = event.target.value.trim()
                if (!value) {
                  onTestsChange([])
                  return
                }
                try {
                  const parsed = JSON.parse(value) as RouteDefinition["tests"]
                  if (Array.isArray(parsed)) {
                    onTestsChange(parsed)
                  }
                } catch {
                  // keep draft text permissive; apply only on valid JSON
                }
              }}
              className="min-h-48 font-mono text-xs"
            />
          </div>
        </div>
      </div>
    </TabsContent>
  )
}
