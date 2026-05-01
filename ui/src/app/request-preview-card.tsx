import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { RouteDefinition, RunRouteOverrides } from "@/api"
import { AuthPanel } from "@/app/request-card/auth-panel"
import { BodyPanel } from "@/app/request-card/body-panel"
import { DocsPanel } from "@/app/request-card/docs-panel"
import { FilePanel } from "@/app/request-card/file-panel"
import { HeadersPanel } from "@/app/request-card/headers-panel"
import {
  getInitialRequestTabState,
  toStateFingerprint,
  withUpdatedHeaders,
  withUpdatedParams,
  withUpdatedUrl,
  withUpdatedVars,
  withUpdatedMultipart,
  type RequestTabState,
} from "@/app/request-card/helpers"
import { ParamsPanel } from "@/app/request-card/params-panel"
import { RequestBar } from "@/app/request-card/request-bar"
import { ScriptPanel } from "@/app/request-card/script-panel"
import { SettingsPanel } from "@/app/request-card/settings-panel"
import { TestsPanel } from "@/app/request-card/tests-panel"
import { VarsPanel } from "@/app/request-card/vars-panel"
import { useEffect, useMemo, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const REQUEST_DRAFTS_SESSION_KEY = "boson.request.drafts.v2"

type RequestDraftMap = Record<string, RequestTabState>

type RequestPreviewCardProps = {
  selectedRoute?: RouteDefinition
  isRunning: boolean
  onRun: (overrides?: RunRouteOverrides) => void
}

export function RequestPreviewCard(props: RequestPreviewCardProps) {
  const { selectedRoute, isRunning, onRun } = props
  const [draftsByRoute, setDraftsByRoute] = useState<RequestDraftMap>(() => {
    if (typeof window === "undefined") return {}
    try {
      const raw = window.sessionStorage.getItem(REQUEST_DRAFTS_SESSION_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw) as RequestDraftMap
      return parsed && typeof parsed === "object" ? parsed : {}
    } catch {
      return {}
    }
  })
  const [activeTab, setActiveTab] = useState("params")

  useEffect(() => {
    if (typeof window === "undefined") return
    window.sessionStorage.setItem(
      REQUEST_DRAFTS_SESSION_KEY,
      JSON.stringify(draftsByRoute)
    )
  }, [draftsByRoute])

  const defaultState = useMemo(
    () => (selectedRoute ? getInitialRequestTabState(selectedRoute) : null),
    [selectedRoute]
  )
  const currentState = useMemo(() => {
    if (!selectedRoute || !defaultState) return null
    return draftsByRoute[selectedRoute.id] ?? defaultState
  }, [defaultState, draftsByRoute, selectedRoute])

  function updateCurrentRouteDraft(nextState: RequestTabState) {
    if (!selectedRoute) return
    setDraftsByRoute((current) => ({
      ...current,
      [selectedRoute.id]: nextState,
    }))
  }

  const headers = useMemo(() => currentState?.headers ?? [], [currentState])
  const queryEntries = useMemo(() => currentState?.params ?? [], [currentState])
  const runOverrides = useMemo<RunRouteOverrides | undefined>(() => {
    if (!currentState) return undefined
    const headers = Object.fromEntries(currentState.headers)
    const hasHeader = (name: string) =>
      Object.keys(headers).some((key) => key.toLowerCase() === name.toLowerCase())
    const vars = currentState.vars.map((item) => ({
      key: item.key,
      value: item.value,
      enabled: item.enabled,
    }))
    let parsedBody: unknown = undefined
    const bodyText = currentState.bodyText.trim()
    if (currentState.bodyMode !== "none" && bodyText.length > 0) {
      if (currentState.bodyMode === "json") {
        try {
          parsedBody = JSON.parse(bodyText)
        } catch {
          parsedBody = bodyText
        }
      } else if (currentState.bodyMode === "form_urlencoded") {
        parsedBody = Object.fromEntries(currentState.bodyFormEntries)
      } else if (currentState.bodyMode === "multipart_form") {
        parsedBody = currentState.bodyMultipartEntries.map((entry) => ({
          key: entry.key,
          value: entry.value,
          type: entry.type,
        }))
      } else if (currentState.bodyMode === "binary") {
        parsedBody = currentState.bodyBinaryPath
      } else {
        parsedBody = bodyText
      }
    }

    if (currentState.bodyMode === "json" && bodyText.length > 0 && !hasHeader("Content-Type")) {
      headers["Content-Type"] = "application/json"
    }
    if (
      currentState.bodyMode === "xml" &&
      bodyText.length > 0 &&
      !hasHeader("Content-Type")
    ) {
      headers["Content-Type"] = "application/xml"
    }
    if (
      currentState.bodyMode === "text" &&
      bodyText.length > 0 &&
      !hasHeader("Content-Type")
    ) {
      headers["Content-Type"] = "text/plain"
    }
    if (
      currentState.bodyMode === "sparql" &&
      bodyText.length > 0 &&
      !hasHeader("Content-Type")
    ) {
      headers["Content-Type"] = "application/sparql-query"
    }
    if (
      currentState.bodyMode === "form_urlencoded" &&
      currentState.bodyFormEntries.length > 0 &&
      !hasHeader("Content-Type")
    ) {
      headers["Content-Type"] = "application/x-www-form-urlencoded"
    }
    if (
      currentState.bodyMode === "multipart_form" &&
      currentState.bodyMultipartEntries.length > 0 &&
      !hasHeader("Content-Type")
    ) {
      headers["Content-Type"] = "multipart/form-data"
    }
    if (
      currentState.bodyMode === "binary" &&
      currentState.bodyBinaryPath.trim().length > 0 &&
      !hasHeader("Content-Type")
    ) {
      headers["Content-Type"] = "application/octet-stream"
    }
    return {
      method: currentState.method,
      path: currentState.url,
      headers,
      body: parsedBody,
      tests: currentState.assertions,
      auth: {
        type: currentState.auth.type,
        basic: {
          username: currentState.auth.username,
          password: currentState.auth.password,
        },
        bearer: {
          token: currentState.auth.token,
        },
        api_key: {
          key: currentState.auth.apiKeyName,
          value: currentState.auth.apiKeyValue,
          add_to: currentState.auth.apiKeyAddTo,
        },
      },
      vars,
    }
  }, [currentState])

  const hasDraftChanges = useMemo(() => {
    if (!defaultState || !currentState) return false
    return toStateFingerprint(defaultState) !== toStateFingerprint(currentState)
  }, [currentState, defaultState])

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 overflow-hidden pb-2">
      {!selectedRoute && (
        <p className="text-muted-foreground">Select a route to continue.</p>
      )}
      {selectedRoute && (
        <>
          <div className="px-4 pt-1 pl-2">
            <RequestBar
              requestMethod={
                currentState?.method ?? selectedRoute.method.toUpperCase()
              }
              requestUrl={currentState?.url ?? selectedRoute.path}
              hasDraftChanges={hasDraftChanges}
              onMethodChange={(value) => {
                if (!currentState) return
                const method = value.toUpperCase()
                updateCurrentRouteDraft({ ...currentState, method })
              }}
              onUrlChange={(value) => {
                if (!currentState) return
                updateCurrentRouteDraft(withUpdatedUrl(currentState, value))
              }}
              onResetDraft={() => {
                if (!defaultState) return
                setDraftsByRoute((current) => {
                  const next = { ...current }
                  delete next[selectedRoute.id]
                  return next
                })
                setActiveTab("params")
              }}
              isRunning={isRunning}
              onRun={() => onRun(runOverrides)}
            />
          </div>

          <div className="flex min-h-0 flex-1 px-2">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              defaultValue="params"
              className="flex min-h-0 w-full flex-1 flex-col overflow-hidden"
            >
              <TabsList
                variant="line"
                className="mr-4 ml-1 h-auto w-fit justify-start border-none p-0"
              >
                <TabsTrigger value="params">
                  Params{" "}
                  <span className="text-[10px] text-muted-foreground">
                    {queryEntries.length}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="body">Body</TabsTrigger>
                <TabsTrigger value="headers">
                  Headers ({headers.length})
                </TabsTrigger>
                <TabsTrigger value="auth">Auth</TabsTrigger>
                <TabsTrigger value="vars">Vars</TabsTrigger>
                <TabsTrigger value="script">Script</TabsTrigger>
                <TabsTrigger value="tests">
                  Assert ({selectedRoute.tests.length})
                </TabsTrigger>
                <TabsTrigger value="tests-report">Tests</TabsTrigger>
                <TabsTrigger value="docs">Docs</TabsTrigger>
                <TabsTrigger value="file">File</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              <ParamsPanel
                queryEntries={queryEntries}
                onQueryEntriesChange={(nextEntries) => {
                  if (!currentState) return
                  updateCurrentRouteDraft(withUpdatedParams(currentState, nextEntries))
                }}
              />
              <BodyPanel
                bodyMode={currentState?.bodyMode ?? "none"}
                bodyText={currentState?.bodyText ?? ""}
                bodyFormEntries={currentState?.bodyFormEntries ?? []}
                bodyMultipartEntries={currentState?.bodyMultipartEntries ?? []}
                bodyBinaryPath={currentState?.bodyBinaryPath ?? ""}
                onBodyModeChange={(mode) =>
                  currentState && updateCurrentRouteDraft({ ...currentState, bodyMode: mode })
                }
                onBodyChange={(value) =>
                  currentState && updateCurrentRouteDraft({ ...currentState, bodyText: value })
                }
                onBodyFormEntriesChange={(entries) =>
                  currentState &&
                  updateCurrentRouteDraft({ ...currentState, bodyFormEntries: entries })
                }
                onBodyMultipartEntriesChange={(entries) =>
                  currentState &&
                  updateCurrentRouteDraft({ ...currentState, bodyMultipartEntries: entries })
                }
                onBodyBinaryPathChange={(path) =>
                  currentState &&
                  updateCurrentRouteDraft({ ...currentState, bodyBinaryPath: path })
                }
              />
              <HeadersPanel
                headers={headers}
                onHeadersChange={(next) =>
                  currentState &&
                  updateCurrentRouteDraft(withUpdatedHeaders(currentState, next))
                }
              />
              <AuthPanel
                auth={
                  currentState?.auth ??
                  defaultState?.auth ?? {
                    type: "none",
                    username: "",
                    password: "",
                    token: "",
                    apiKeyName: "",
                    apiKeyValue: "",
                    apiKeyAddTo: "header",
                  }
                }
                onChange={(auth) =>
                  currentState && updateCurrentRouteDraft({ ...currentState, auth })
                }
              />
              <VarsPanel
                vars={currentState?.vars ?? []}
                onChange={(vars) =>
                  currentState &&
                  updateCurrentRouteDraft(withUpdatedVars(currentState, vars))
                }
              />
              <ScriptPanel
                script={currentState?.script ?? { preRequest: "", postResponse: "" }}
                onChange={(script) =>
                  currentState &&
                  updateCurrentRouteDraft({ ...currentState, script })
                }
              />
              <TestsPanel
                tests={currentState?.assertions ?? []}
                onTestsChange={(assertions) =>
                  currentState &&
                  updateCurrentRouteDraft({ ...currentState, assertions })
                }
              />
              <TabsContent
                value="tests-report"
                className="mt-1 flex min-h-0 flex-1 px-2 pb-2"
              >
                <div className="min-h-0 flex-1 overflow-auto rounded-md">
                  <Table>
                    <TableHeader className="[&_tr]:border-0">
                      <TableRow className="border-0 bg-muted/30 hover:bg-muted/30">
                        <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                          Metric
                        </TableHead>
                        <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                          Value
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="[&_tr:last-child]:border-0">
                      <TableRow className="border-0 odd:bg-muted/10 even:bg-background hover:bg-muted/20">
                        <TableCell className="px-3 py-2">Assertions configured</TableCell>
                        <TableCell className="px-3 py-2">
                          {currentState?.assertions.length ?? 0}
                        </TableCell>
                      </TableRow>
                      <TableRow className="border-0 odd:bg-muted/10 even:bg-background hover:bg-muted/20">
                        <TableCell className="px-3 py-2">Auth mode</TableCell>
                        <TableCell className="px-3 py-2">
                          {currentState?.auth.type ?? "none"}
                        </TableCell>
                      </TableRow>
                      <TableRow className="border-0 odd:bg-muted/10 even:bg-background hover:bg-muted/20">
                        <TableCell className="px-3 py-2">Variables</TableCell>
                        <TableCell className="px-3 py-2">
                          {currentState?.vars.length ?? 0}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              <DocsPanel
                docs={currentState?.docs ?? { summary: "", description: "" }}
                onChange={(docs) =>
                  currentState &&
                  updateCurrentRouteDraft({ ...currentState, docs })
                }
              />
              <FilePanel
                file={
                  currentState?.file ?? {
                    mode: "none",
                    path: "",
                    multipart: [],
                  }
                }
                onChange={(file) => {
                  if (!currentState) return
                  const normalized = withUpdatedMultipart(currentState, file.multipart)
                  updateCurrentRouteDraft({
                    ...normalized,
                    file: {
                      ...file,
                      multipart: normalized.file.multipart,
                    },
                  })
                }}
              />
              <SettingsPanel
                settings={
                  currentState?.settings ?? {
                    timeoutMs: "",
                    followRedirects: true,
                    retryCount: "",
                  }
                }
                onChange={(settings) =>
                  currentState &&
                  updateCurrentRouteDraft({ ...currentState, settings })
                }
              />
            </Tabs>
          </div>
        </>
      )}
    </section>
  )
}
