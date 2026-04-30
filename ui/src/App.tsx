import { AppSidebar } from "@/components/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Card, CardContent } from "@/components/ui/card"
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
        <section className="mx-auto w-full max-w-6xl space-y-5 p-6">
          {error && (
            <Card className="border-destructive/40">
              <CardContent className="pt-6 text-sm text-destructive">
                {error}
              </CardContent>
            </Card>
          )}
          <RequestPreviewCard
            selectedRoute={selectedRoute}
            isRunning={isRunning}
            onRun={() => void runSelectedRoute()}
          />
          <ResponseCard result={result} isRunning={isRunning} />
        </section>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
