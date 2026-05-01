import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { RouteDefinition } from "@/api"
import { BodyPanel } from "@/app/request-card/body-panel"
import { HeadersPanel } from "@/app/request-card/headers-panel"
import {
  extractQueryEntries,
  updateQueryEntriesInPath,
} from "@/app/request-card/helpers"
import { MetaPanel } from "@/app/request-card/meta-panel"
import { ParamsPanel } from "@/app/request-card/params-panel"
import { RequestBar } from "@/app/request-card/request-bar"
import { TestsPanel } from "@/app/request-card/tests-panel"
import { useEffect, useMemo, useState } from "react"

const REQUEST_DRAFTS_SESSION_KEY = "boson.request.drafts.v1"

type RequestDraft = {
  method: string
  url: string
}

type RequestPreviewCardProps = {
  selectedRoute?: RouteDefinition
  isRunning: boolean
  onRun: () => void
}

export function RequestPreviewCard(props: RequestPreviewCardProps) {
  const { selectedRoute, isRunning, onRun } = props
  const [draftMethod, setDraftMethod] = useState("")
  const [draftUrl, setDraftUrl] = useState("")
  const [draftsByRoute, setDraftsByRoute] = useState<
    Record<string, RequestDraft>
  >(() => {
    if (typeof window === "undefined") return {}
    try {
      const raw = window.sessionStorage.getItem(REQUEST_DRAFTS_SESSION_KEY)
      if (!raw) return {}
      const parsed = JSON.parse(raw) as Record<string, RequestDraft>
      return parsed && typeof parsed === "object" ? parsed : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    if (!selectedRoute) {
      setDraftMethod("")
      setDraftUrl("")
      return
    }
    const storedDraft = draftsByRoute[selectedRoute.id]
    setDraftMethod(storedDraft?.method ?? selectedRoute.method.toUpperCase())
    setDraftUrl(storedDraft?.url ?? selectedRoute.path)
  }, [
    draftsByRoute,
    selectedRoute?.id,
    selectedRoute?.method,
    selectedRoute?.path,
  ])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.sessionStorage.setItem(
      REQUEST_DRAFTS_SESSION_KEY,
      JSON.stringify(draftsByRoute)
    )
  }, [draftsByRoute])

  const headers = Object.entries(selectedRoute?.headers ?? {})
  const bodyPreview = selectedRoute?.body
    ? JSON.stringify(selectedRoute.body, null, 2)
    : ""
  const hasDraftChanges = useMemo(() => {
    if (!selectedRoute) return false
    return (
      draftMethod.toUpperCase() !== selectedRoute.method.toUpperCase() ||
      draftUrl !== selectedRoute.path
    )
  }, [draftMethod, draftUrl, selectedRoute])
  const queryEntries = useMemo(
    () =>
      extractQueryEntries(draftUrl).filter(
        ([key, value]) => key.trim().length > 0 || value.trim().length > 0
      ),
    [draftUrl]
  )

  function updateRouteDraft(nextDraft: RequestDraft) {
    if (!selectedRoute) return
    setDraftMethod(nextDraft.method)
    setDraftUrl(nextDraft.url)
    setDraftsByRoute((current) => ({
      ...current,
      [selectedRoute.id]: nextDraft,
    }))
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 overflow-hidden pb-2">
      {!selectedRoute && (
        <p className="text-muted-foreground">Select a route to continue.</p>
      )}
      {selectedRoute && (
        <>
          <div className="px-4 pt-1 pl-2">
            <RequestBar
              requestMethod={draftMethod || selectedRoute.method.toUpperCase()}
              requestUrl={draftUrl}
              hasDraftChanges={hasDraftChanges}
              onMethodChange={(value) => {
                const method = value.toUpperCase()
                updateRouteDraft({
                  method,
                  url: draftUrl,
                })
              }}
              onUrlChange={(value) => {
                updateRouteDraft({
                  method: draftMethod || selectedRoute.method.toUpperCase(),
                  url: value,
                })
              }}
              onResetDraft={() => {
                setDraftMethod(selectedRoute.method.toUpperCase())
                setDraftUrl(selectedRoute.path)
                setDraftsByRoute((current) => {
                  const next = { ...current }
                  delete next[selectedRoute.id]
                  return next
                })
              }}
              isRunning={isRunning}
              onRun={onRun}
            />
          </div>

          <div className="px-2">
            <Tabs
              defaultValue="params"
              className="flex min-h-0 w-full flex-1 flex-col overflow-hidden"
            >
              <TabsList
                variant="line"
                className="mr-4 ml-1 h-auto w-fit justify-start border-none p-0"
              >
                <TabsTrigger value="params">Params</TabsTrigger>
                <TabsTrigger value="headers">
                  Headers ({headers.length})
                </TabsTrigger>
                <TabsTrigger value="body">Body</TabsTrigger>
                <TabsTrigger value="tests">
                  Tests ({selectedRoute.tests.length})
                </TabsTrigger>
                <TabsTrigger value="meta">Meta</TabsTrigger>
              </TabsList>
              <ParamsPanel
                queryEntries={queryEntries}
                onQueryEntriesChange={(nextEntries) => {
                  const nextUrl = updateQueryEntriesInPath(
                    draftUrl,
                    nextEntries
                  )
                  updateRouteDraft({
                    method: draftMethod || selectedRoute.method.toUpperCase(),
                    url: nextUrl,
                  })
                }}
              />
              <HeadersPanel headers={headers} />
              <BodyPanel bodyPreview={bodyPreview} />
              <TestsPanel tests={selectedRoute.tests} />
              <MetaPanel route={selectedRoute} />
            </Tabs>
          </div>
        </>
      )}
    </section>
  )
}
