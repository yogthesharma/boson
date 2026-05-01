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

type MetaPanelProps = {
  route: RouteDefinition
}

export function MetaPanel({ route }: MetaPanelProps) {
  return (
    <TabsContent value="meta" className="mt-1 flex min-h-0 flex-1 px-2 pb-2">
      <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-md">
        <div className="min-h-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="[&_tr]:border-0">
              <TableRow className="border-0 bg-muted/30 hover:bg-muted/30">
                <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                  Field
                </TableHead>
                <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                  Value
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_tr:last-child]:border-0">
              <MetaRow label="ID" value={route.id} />
              <MetaRow label="Name" value={route.name} />
              <MetaRow label="Method" value={route.method} />
              <MetaRow label="Path" value={route.path} />
            </TableBody>
          </Table>
        </div>
      </div>
    </TabsContent>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <TableRow className="border-0 odd:bg-muted/10 even:bg-background hover:bg-muted/20">
      <TableCell className="px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </TableCell>
      <TableCell className="px-3 py-2 font-medium text-foreground/90">
        {value}
      </TableCell>
    </TableRow>
  )
}
