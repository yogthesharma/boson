import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { RouteDefinition } from "@/api"
import { BodyPanel } from "@/app/request-card/body-panel"
import { HeadersPanel } from "@/app/request-card/headers-panel"
import { MetaPanel } from "@/app/request-card/meta-panel"
import { ParamsPanel } from "@/app/request-card/params-panel"
import { RequestBar } from "@/app/request-card/request-bar"
import { TestsPanel } from "@/app/request-card/tests-panel"

type RequestPreviewCardProps = {
  selectedRoute?: RouteDefinition
  isRunning: boolean
  onRun: () => void
}

export function RequestPreviewCard(props: RequestPreviewCardProps) {
  const { selectedRoute, isRunning, onRun } = props
  const headers = Object.entries(selectedRoute?.headers ?? {})
  const bodyPreview = selectedRoute?.body
    ? JSON.stringify(selectedRoute.body, null, 2)
    : ""

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 overflow-hidden pb-2">
      {!selectedRoute && (
        <p className="text-muted-foreground">Select a route to continue.</p>
      )}
      {selectedRoute && (
        <>
          <div className="px-4 pt-1 pl-2">
            <RequestBar
              selectedRoute={selectedRoute}
              isRunning={isRunning}
              onRun={onRun}
            />
          </div>

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
            <ParamsPanel path={selectedRoute.path} />
            <HeadersPanel headers={headers} />
            <BodyPanel bodyPreview={bodyPreview} />
            <TestsPanel tests={selectedRoute.tests} />
            <MetaPanel route={selectedRoute} />
          </Tabs>
        </>
      )}
    </section>
  )
}
