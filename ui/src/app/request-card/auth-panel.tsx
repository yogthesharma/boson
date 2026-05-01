import { TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { RequestTabState } from "./helpers"

type AuthPanelProps = {
  auth: RequestTabState["auth"]
  onChange: (next: RequestTabState["auth"]) => void
}

export function AuthPanel({ auth, onChange }: AuthPanelProps) {
  return (
    <TabsContent value="auth" className="mt-1 flex min-h-0 flex-1 px-2 pb-2">
      <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-auto rounded-md px-3 py-2">
        <div className="w-52">
          <p className="mb-1 text-xs text-muted-foreground">Type</p>
          <Select
            value={auth.type}
            onValueChange={(value) =>
              onChange({ ...auth, type: value as RequestTabState["auth"]["type"] })
            }
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="basic">Basic</SelectItem>
              <SelectItem value="bearer">Bearer</SelectItem>
              <SelectItem value="api_key">API Key</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {auth.type === "basic" && (
          <div className="grid max-w-xl gap-3">
            <Input
              value={auth.username}
              onChange={(event) =>
                onChange({ ...auth, username: event.target.value })
              }
              placeholder="Username"
            />
            <Input
              type="password"
              value={auth.password}
              onChange={(event) =>
                onChange({ ...auth, password: event.target.value })
              }
              placeholder="Password"
            />
          </div>
        )}

        {auth.type === "bearer" && (
          <div className="max-w-xl">
            <Input
              value={auth.token}
              onChange={(event) => onChange({ ...auth, token: event.target.value })}
              placeholder="Token"
            />
          </div>
        )}

        {auth.type === "api_key" && (
          <div className="grid max-w-xl gap-3">
            <Input
              value={auth.apiKeyName}
              onChange={(event) =>
                onChange({ ...auth, apiKeyName: event.target.value })
              }
              placeholder="Key"
            />
            <Input
              value={auth.apiKeyValue}
              onChange={(event) =>
                onChange({ ...auth, apiKeyValue: event.target.value })
              }
              placeholder="Value"
            />
            <Select
              value={auth.apiKeyAddTo}
              onValueChange={(value) =>
                onChange({
                  ...auth,
                  apiKeyAddTo: value as RequestTabState["auth"]["apiKeyAddTo"],
                })
              }
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="header">Header</SelectItem>
                <SelectItem value="query">Query</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </TabsContent>
  )
}
