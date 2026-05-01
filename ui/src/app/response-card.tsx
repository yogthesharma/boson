import { useMemo, useState } from "react"
import { Tabs } from "@/components/ui/tabs"
import { ResponsePanels } from "@/app/response-card/response-panels"
import { ResponseToolbar } from "@/app/response-card/response-toolbar"
import type { ResponseCardProps } from "@/app/response-card/types"

export function ResponseCard({
  result,
  isRunning,
  selectedRoute,
  timeline,
  onClearTimeline,
}: ResponseCardProps) {
  const [activeTab, setActiveTab] = useState("response")
  const responseText = useMemo(() => {
    if (!result) return ""
    return JSON.stringify(result.response_body ?? {}, null, 2)
  }, [result])
  const responseSize = useMemo(() => {
    if (!responseText) return "0 B"
    const bytes = new TextEncoder().encode(responseText).length
    if (bytes < 1024) return `${bytes} B`
    return `${(bytes / 1024).toFixed(1)} KB`
  }, [responseText])

  const copyResponse = async () => {
    if (!responseText) return
    await navigator.clipboard.writeText(responseText)
  }

  const downloadResponse = () => {
    if (!responseText) return
    const blob = new Blob([responseText], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = "response.json"
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="h-full text-sm">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex h-full flex-col"
      >
        <ResponseToolbar
          result={result}
          responseSize={responseSize}
          onCopy={copyResponse}
          onDownload={downloadResponse}
        />
        <ResponsePanels
          result={result}
          isRunning={isRunning}
          responseText={responseText}
          timeline={timeline}
          selectedRoute={selectedRoute}
          onClearTimeline={onClearTimeline}
        />
      </Tabs>
    </section>
  )
}
