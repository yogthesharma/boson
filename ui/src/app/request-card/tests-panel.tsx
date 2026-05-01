import { Badge } from "@/components/ui/badge"
import { TabsContent } from "@/components/ui/tabs"
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
}

export function TestsPanel({ tests }: TestsPanelProps) {
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
        </div>
      </div>
    </TabsContent>
  )
}
