import { TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { RequestVar } from "./helpers"

type VarsPanelProps = {
  vars: RequestVar[]
  onChange: (vars: RequestVar[]) => void
}

export function VarsPanel({ vars, onChange }: VarsPanelProps) {
  const rows = [...vars, { key: "", value: "", enabled: true }]

  function onRowChange(index: number, field: keyof RequestVar, value: string | boolean) {
    const isNew = index >= vars.length
    if (isNew && field !== "enabled" && String(value).trim().length === 0) return
    const next = isNew
      ? [...vars, { key: "", value: "", enabled: true }]
      : vars.map((row, rowIndex) => (rowIndex === index ? row : row))
    const targetIndex = isNew ? next.length - 1 : index
    const target = next[targetIndex]
    next[targetIndex] = { ...target, [field]: value } as RequestVar
    onChange(
      next.filter(
        (item) => item.key.trim().length > 0 || item.value.trim().length > 0
      )
    )
  }

  return (
    <TabsContent value="vars" className="mt-1 flex min-h-0 flex-1 px-2 pb-2">
      <div className="min-h-0 flex-1 overflow-auto rounded-md">
        <Table>
          <TableHeader className="[&_tr]:border-0">
            <TableRow className="border-0 bg-muted/30 hover:bg-muted/30">
              <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                Enabled
              </TableHead>
              <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                Key
              </TableHead>
              <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                Value
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr:last-child]:border-0">
            {rows.map((row, index) => (
              <TableRow
                key={`var-${index}`}
                className="border-0 odd:bg-muted/10 even:bg-background hover:bg-muted/20"
              >
                <TableCell className="px-3 py-2">
                  <Switch
                    checked={row.enabled}
                    onCheckedChange={(checked) =>
                      onRowChange(index, "enabled", checked)
                    }
                  />
                </TableCell>
                <TableCell className="px-3 py-2">
                  <Input
                    value={row.key}
                    onChange={(event) =>
                      onRowChange(index, "key", event.target.value)
                    }
                    className="h-7 font-mono text-xs"
                    placeholder="key"
                  />
                </TableCell>
                <TableCell className="px-3 py-2">
                  <Input
                    value={row.value}
                    onChange={(event) =>
                      onRowChange(index, "value", event.target.value)
                    }
                    className="h-7 font-mono text-xs"
                    placeholder="value"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </TabsContent>
  )
}
