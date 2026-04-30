import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent } from "@/components/ui/card"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { MainHeader } from "@/app/main-header"
import { RequestPreviewCard } from "@/app/request-preview-card"
import { ResponseCard } from "@/app/response-card"
import { useWorkspace } from "@/app/use-workspace"

export function App() {
  const {
    routes,
    selectedRoute,
    setSelectedRouteId,
    activeEnvironment,
    isLoading,
    isRunning,
    error,
    result,
    lastRunByRoute,
    syncToken,
    sseConnected,
    timeline,
    clearTimeline,
    runSelectedRoute,
  } = useWorkspace()

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        routes={routes}
        selectedRouteId={selectedRoute?.id}
        onSelectRoute={setSelectedRouteId}
        lastRunByRoute={lastRunByRoute}
        activeEnvironment={activeEnvironment}
        isLoading={isLoading}
        syncToken={syncToken}
      />
      <SidebarInset>
        <MainHeader
          selectedRoute={selectedRoute}
          activeEnvironment={activeEnvironment}
          sseConnected={sseConnected}
        />
        <section className="h-[calc(99vh-var(--header-height))]">
          {error && (
            <Card className="mb-3 border-destructive/40">
              <CardContent className="pt-4 text-sm text-destructive">
                {error}
              </CardContent>
            </Card>
          )}

          <div className="h-full overflow-hidden rounded-md bg-background">
            <ResizablePanelGroup orientation="vertical">
              <ResizablePanel defaultSize={54} minSize={25}>
                <RequestPreviewCard
                  selectedRoute={selectedRoute}
                  isRunning={isRunning}
                  onRun={() => void runSelectedRoute()}
                />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={46} minSize={25}>
                <ResponseCard
                  result={result}
                  isRunning={isRunning}
                  selectedRoute={selectedRoute}
                  timeline={timeline}
                  onClearTimeline={clearTimeline}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </section>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
