import { TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { MultipartField, RequestTabState } from "./helpers"

type FilePanelProps = {
  file: RequestTabState["file"]
  onChange: (value: RequestTabState["file"]) => void
}

export function FilePanel({ file, onChange }: FilePanelProps) {
  const rows = [...file.multipart, { key: "", value: "", type: "text" as const }]

  function onRowChange(index: number, field: keyof MultipartField, value: string) {
    const isNew = index >= file.multipart.length
    if (isNew && !value.trim()) return
    const next = isNew
      ? [...file.multipart, { key: "", value: "", type: "text" as const }]
      : file.multipart.map((item) => ({ ...item }))
    const target = isNew ? next[next.length - 1] : next[index]
    if (field === "type") {
      target.type = value === "file" ? "file" : "text"
    } else if (field === "key") {
      target.key = value
    } else {
      target.value = value
    }
    onChange({
      ...file,
      multipart: next.filter(
        (item) => item.key.trim().length > 0 || item.value.trim().length > 0
      ),
    })
  }

  return (
    <TabsContent value="file" className="mt-1 flex min-h-0 flex-1 px-2 pb-2">
      <div className="grid min-h-0 flex-1 gap-3 overflow-auto rounded-md px-1 py-1">
        <div className="max-w-sm">
          <p className="mb-1 text-xs text-muted-foreground">Mode</p>
          <Select
            value={file.mode}
            onValueChange={(value) =>
              onChange({
                ...file,
                mode: value as RequestTabState["file"]["mode"],
              })
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="binary">Binary</SelectItem>
              <SelectItem value="multipart">Multipart form-data</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(file.mode === "binary" || file.mode === "multipart") && (
          <div className="max-w-xl">
            <p className="mb-1 text-xs text-muted-foreground">File path</p>
            <Input
              value={file.path}
              onChange={(event) => onChange({ ...file, path: event.target.value })}
              placeholder="/path/to/file"
            />
          </div>
        )}

        {file.mode === "multipart" && (
          <Table>
            <TableHeader className="[&_tr]:border-0">
              <TableRow className="border-0 bg-muted/30 hover:bg-muted/30">
                <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                  Field
                </TableHead>
                <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                  Value
                </TableHead>
                <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                  Type
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_tr:last-child]:border-0">
              {rows.map((row, index) => (
                <TableRow
                  key={`multipart-${index}`}
                  className="border-0 odd:bg-muted/10 even:bg-background hover:bg-muted/20"
                >
                  <TableCell className="px-3 py-2">
                    <Input
                      value={row.key}
                      onChange={(event) =>
                        onRowChange(index, "key", event.target.value)
                      }
                      className="h-7 text-xs"
                      placeholder="name"
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Input
                      value={row.value}
                      onChange={(event) =>
                        onRowChange(index, "value", event.target.value)
                      }
                      className="h-7 text-xs"
                      placeholder="value"
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2">
                    <Select
                      value={row.type}
                      onValueChange={(value) => onRowChange(index, "type", value)}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="text">text</SelectItem>
                        <SelectItem value="file">file</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </TabsContent>
  )
}
