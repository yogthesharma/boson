import { useState, useEffect } from "react";
import {
  IconChevronDown,
  IconCheck,
  IconExternalLink,
} from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/stores/settingsStore";
import { cn } from "@/lib/utils";

const PERSONALITY_OPTIONS = [
  { value: "pragmatic", label: "Pragmatic" },
  { value: "friendly", label: "Friendly" },
  { value: "concise", label: "Concise" },
];

export function PersonalizationSettings() {
  const personalization = useSettingsStore((s) => s.personalization);
  const setPersonalization = useSettingsStore((s) => s.setPersonalization);

  const [personality, setPersonality] = useState(
    personalization?.personality ?? "pragmatic",
  );
  const [customInstructions, setCustomInstructions] = useState(
    personalization?.customInstructions ?? "",
  );
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPersonality(personalization?.personality ?? "pragmatic");
    setCustomInstructions(personalization?.customInstructions ?? "");
  }, [personalization?.personality, personalization?.customInstructions]);

  const handleSave = () => {
    setPersonalization({
      personality,
      customInstructions: customInstructions.trim(),
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const personalityLabel =
    PERSONALITY_OPTIONS.find((o) => o.value === personality)?.label ??
    "Pragmatic";

  return (
    <div className="space-y-8">
      <h1 className="text-lg font-semibold text-foreground">Personalization</h1>

      <Card className="border-0">
        <CardContent className="pb-3 px-4">
          <div className="flex flex-row items-center justify-between gap-2">
            <div className="flex flex-col items-start items-center">
              <p>Personality</p>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">
                  Choose a default tone for Codex responses
                </p>
              </div>
            </div>
            <div className="shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex min-w-[10rem] items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm text-foreground hover:bg-muted/50"
                  >
                    <span className="truncate">{personalityLabel}</span>
                    <IconChevronDown
                      size={16}
                      className="shrink-0 text-muted-foreground"
                    />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="min-w-[var(--radix-dropdown-menu-trigger-width)]"
                >
                  {PERSONALITY_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => setPersonality(opt.value)}
                      className="flex items-center justify-between gap-2"
                    >
                      {opt.label}
                      {personality === opt.value && (
                        <IconCheck size={14} className="text-primary" />
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 py-3">
        <div>
          <div>Custom instructions</div>
          <p className="text-sm text-muted-foreground">
            Edit instructions that tailor Codex to you.{" "}
            <a
              href="#"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
              onClick={(e) => e.preventDefault()}
            >
              Learn more
              <IconExternalLink size={12} className="shrink-0" />
            </a>
          </p>
        </div>
        <textarea
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          placeholder="Add your custom instructions..."
          rows={6}
          className="w-full resize-y bg-muted/50 rounded-md bg-background !resize-none px-3 py-2 text-sm text-foreground !font-sans placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            className={cn(saved && "bg-green-600 hover:bg-green-600")}
          >
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
