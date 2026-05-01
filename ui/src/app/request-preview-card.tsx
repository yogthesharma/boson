import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { PresetDefinition, RouteDefinition, RunRouteOverrides } from "@/api"
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
import { computeMissingEnvironmentVariables } from "@/app/request-card/missing-vars"
import {
  computeRequestDiagnostics,
  shouldShowDiagnosticsTab,
} from "@/app/request-card/diagnostics"
import { applyPresetToRequestState } from "@/app/request-card/preset-apply"
import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
  presets: PresetDefinition[]
  activeEnvironment: string
  activeBaseUrl: string
  activeEnvironmentVariables: Record<string, string>
  isRunning: boolean
  onRun: (overrides?: RunRouteOverrides) => void
}

export function RequestPreviewCard(props: RequestPreviewCardProps) {
  const {
    selectedRoute,
    presets,
    activeEnvironment,
    activeBaseUrl,
    activeEnvironmentVariables,
    isRunning,
    onRun,
  } = props
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
  const [selectedPresetId, setSelectedPresetId] = useState<string>("")
  const [lastPresetConflictFields, setLastPresetConflictFields] = useState<string[]>([])
  const [previewConflictFields, setPreviewConflictFields] = useState<string[]>([])
  const [previewTouchedSections, setPreviewTouchedSections] = useState<string[]>([])
  const [lastAppliedPreset, setLastAppliedPreset] = useState<string>("")
  const [lastAppliedLabel, setLastAppliedLabel] = useState<string>("")

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
  const selectedPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId),
    [presets, selectedPresetId]
  )
  const selectedPresetTouchedSections = useMemo(() => {
    if (!selectedPreset) return []
    const sections: string[] = []
    if (selectedPreset.headers && Object.keys(selectedPreset.headers).length > 0) {
      sections.push(`headers (${Object.keys(selectedPreset.headers).length})`)
    }
    if (selectedPreset.auth) sections.push("auth")
    if (selectedPreset.vars && selectedPreset.vars.length > 0) {
      sections.push(`vars (${selectedPreset.vars.length})`)
    }
    if (selectedPreset.body_config) sections.push("body")
    if (selectedPreset.settings) sections.push("settings")
    return sections
  }, [selectedPreset])
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
    if (currentState.bodyMode === "json" && bodyText.length > 0) {
      try {
        parsedBody = JSON.parse(bodyText)
      } catch {
        parsedBody = bodyText
      }
    } else if (currentState.bodyMode === "xml" && bodyText.length > 0) {
      parsedBody = bodyText
    } else if (currentState.bodyMode === "text" && bodyText.length > 0) {
      parsedBody = bodyText
    } else if (currentState.bodyMode === "sparql" && bodyText.length > 0) {
      parsedBody = bodyText
    } else if (
      currentState.bodyMode === "form_urlencoded" &&
      currentState.bodyFormEntries.length > 0
    ) {
      parsedBody = Object.fromEntries(currentState.bodyFormEntries)
    } else if (
      currentState.bodyMode === "multipart_form" &&
      currentState.bodyMultipartEntries.length > 0
    ) {
      parsedBody = {
        __boson_body: {
          mode: "multipart_form",
          entries: currentState.bodyMultipartEntries.map((entry) => ({
            key: entry.key,
            value: entry.value,
            type: entry.type,
            file_name: entry.fileName ?? "",
            file_base64: entry.fileBase64 ?? "",
          })),
        },
      }
    } else if (
      currentState.bodyMode === "binary" &&
      (currentState.bodyBinaryPath.trim().length > 0 ||
        currentState.bodyBinaryBase64.trim().length > 0)
    ) {
      parsedBody = {
        __boson_body: {
          mode: "binary",
          path: currentState.bodyBinaryPath,
          file_name: currentState.bodyBinaryFileName,
          file_base64: currentState.bodyBinaryBase64,
        },
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
      (currentState.bodyBinaryPath.trim().length > 0 ||
        currentState.bodyBinaryBase64.trim().length > 0) &&
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

  const missingVariables = useMemo(() => {
    return computeMissingEnvironmentVariables(currentState, activeEnvironmentVariables)
  }, [activeEnvironmentVariables, currentState])
  const diagnostics = useMemo(
    () => computeRequestDiagnostics(currentState, missingVariables),
    [currentState, missingVariables]
  )
  const diagnosticsSummary = useMemo(
    () => ({
      errorCount: diagnostics.errors.length,
      warningCount: diagnostics.warnings.length,
      blockingMessage:
        diagnostics.errors.length > 0
          ? diagnostics.errors[0]?.message ?? "Fix diagnostics errors before running."
          : undefined,
    }),
    [diagnostics.errors, diagnostics.warnings.length]
  )

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
              activeEnvironment={activeEnvironment}
              activeBaseUrl={activeBaseUrl}
              diagnostics={diagnosticsSummary}
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
                <TabsTrigger value="presets">Presets</TabsTrigger>
                {shouldShowDiagnosticsTab(diagnostics) && (
                  <TabsTrigger value="diagnostics">
                    Diagnostics ({diagnostics.errors.length}E/{diagnostics.warnings.length}W)
                  </TabsTrigger>
                )}
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
                bodyBinaryFileName={currentState?.bodyBinaryFileName ?? ""}
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
                onBodyBinaryFileSelect={({ fileName, fileBase64 }) =>
                  currentState &&
                  updateCurrentRouteDraft({
                    ...currentState,
                    bodyBinaryPath: fileName,
                    bodyBinaryFileName: fileName,
                    bodyBinaryBase64: fileBase64,
                  })
                }
                onBodyBinaryClear={() =>
                  currentState &&
                  updateCurrentRouteDraft({
                    ...currentState,
                    bodyBinaryPath: "",
                    bodyBinaryFileName: "",
                    bodyBinaryBase64: "",
                  })
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
              <TabsContent
                value="presets"
                className="mt-1 flex min-h-0 flex-1 px-2 pb-2"
              >
                <div className="flex h-full min-h-0 w-full flex-col gap-3 overflow-auto rounded-md">
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={selectedPresetId} onValueChange={setSelectedPresetId}>
                      <SelectTrigger className="h-8 min-w-64 border-border/60 !bg-transparent text-xs">
                        <SelectValue placeholder="Select preset..." />
                      </SelectTrigger>
                      <SelectContent>
                        {presets.length === 0 && (
                          <SelectItem value="__none__" disabled>
                            No presets found in .api/presets
                          </SelectItem>
                        )}
                        {presets.map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={!selectedPreset || !currentState}
                      onClick={() => {
                        if (!selectedPreset || !currentState) return
                        const { nextState, conflicts } = applyPresetToRequestState(
                          currentState,
                          selectedPreset
                        )
                        updateCurrentRouteDraft(nextState)
                        setLastPresetConflictFields(conflicts.map((item) => item.field))
                        setLastAppliedPreset(selectedPreset.id)
                        setLastAppliedLabel("just now")
                      }}
                    >
                      Apply Preset
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={!selectedPreset || !currentState}
                      onClick={() => {
                        if (!selectedPreset || !currentState) return
                        const { conflicts } = applyPresetToRequestState(currentState, selectedPreset)
                        setPreviewConflictFields(conflicts.map((item) => item.field))
                        setPreviewTouchedSections(selectedPresetTouchedSections)
                      }}
                    >
                      Dry-run Preview
                    </Button>
                    {lastPresetConflictFields.length > 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="h-6 text-[10px]">
                              Overwrites {lastPresetConflictFields.length}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent sideOffset={6}>
                            {lastPresetConflictFields.slice(0, 6).join(", ")}
                            {lastPresetConflictFields.length > 6 ? " ..." : ""}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    {lastAppliedPreset === selectedPreset?.id && lastAppliedLabel && (
                      <Badge variant="secondary" className="h-6 text-[10px]">
                        Re-applied {lastAppliedLabel}
                      </Badge>
                    )}
                  </div>
                  <div className="rounded-md border border-border/60 bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
                    {selectedPreset ? (
                      <>
                        <p className="font-medium text-foreground">{selectedPreset.name}</p>
                        <p className="mt-1">
                          {selectedPreset.description ?? "No description provided."}
                        </p>
                        <p className="mt-2 font-mono text-[11px]">
                          Source: .api/presets/{selectedPreset.source_path ?? `${selectedPreset.id}.json`}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {selectedPresetTouchedSections.length === 0 && (
                            <Badge variant="outline" className="text-[10px]">
                              no-op preset
                            </Badge>
                          )}
                          {selectedPresetTouchedSections.map((section) => (
                            <Badge key={section} variant="outline" className="text-[10px]">
                              {section}
                            </Badge>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p>Select a preset, review impact, then apply it to current draft.</p>
                    )}
                  </div>
                  {previewTouchedSections.length > 0 && (
                    <div className="rounded-md border border-border/60 bg-background px-3 py-2 text-xs">
                      <p className="font-medium text-foreground">Dry-run impact preview</p>
                      <p className="mt-1 text-muted-foreground">
                        Touches: {previewTouchedSections.join(", ")}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        Overwrites: {previewConflictFields.length}
                        {previewConflictFields.length > 0
                          ? ` (${previewConflictFields.slice(0, 8).join(", ")}${
                              previewConflictFields.length > 8 ? " ..." : ""
                            })`
                          : ""}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent
                value="diagnostics"
                className="mt-1 flex min-h-0 flex-1 px-2 pb-2"
              >
                <div className="min-h-0 flex-1 overflow-auto rounded-md">
                  <Table>
                    <TableHeader className="[&_tr]:border-0">
                      <TableRow className="border-0 bg-muted/30 hover:bg-muted/30">
                        <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                          Severity
                        </TableHead>
                        <TableHead className="h-auto px-3 py-2 text-xs text-muted-foreground">
                          Message
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="[&_tr:last-child]:border-0">
                      {diagnostics.items.map((item) => (
                        <TableRow
                          key={`${item.code}-${item.message}`}
                          className="border-0 odd:bg-muted/10 even:bg-background hover:bg-muted/20"
                        >
                          <TableCell className="px-3 py-2">
                            <Badge
                              variant={item.severity === "error" ? "destructive" : "outline"}
                              className="h-6 text-[10px] uppercase"
                            >
                              {item.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-3 py-2 text-sm text-foreground/90">
                            {item.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
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
