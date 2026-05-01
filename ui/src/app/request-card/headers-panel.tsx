import { TabsContent } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type HeadersPanelProps = {
  headers: Array<[string, string]>
}

export function HeadersPanel({ headers }: HeadersPanelProps) {
  return (
    <TabsContent value="headers" className="mt-1 flex min-h-0 flex-1 px-2 pb-2">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md">
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="[&_tr]:border-0">
              <TableRow className="border-0 bg-muted/30 hover:bg-muted/30">
                <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                  Header
                </TableHead>
                <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                  Value
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_tr:last-child]:border-0">
              {headers.length === 0 && (
                <TableRow className="border-0 hover:bg-transparent">
                  <TableCell
                    colSpan={2}
                    className="px-3 py-3 text-sm text-muted-foreground"
                  >
                    No custom headers.
                  </TableCell>
                </TableRow>
              )}
              {headers.map(([key, value]) => (
                <TableRow
                  key={key}
                  className="border-0 odd:bg-muted/10 even:bg-background hover:bg-muted/20"
                >
                  <TableCell className="px-3 py-2 font-mono text-xs text-foreground/90">
                    {key}
                  </TableCell>
                  <TableCell className="px-3 py-2 font-mono text-xs text-foreground/80">
                    {value}
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
