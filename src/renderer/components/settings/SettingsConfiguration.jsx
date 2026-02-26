import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconCheck,
  IconChevronDown,
  IconKey,
  IconPencil,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    description: "Best default for most users",
    preset: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    needsApiKey: true,
    keyPlaceholder: "sk-...",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Access many models with one key",
    preset: "openrouter-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    needsApiKey: true,
    keyPlaceholder: "sk-or-...",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    description: "Strong and affordable models",
    preset: "custom",
    baseUrl: "https://api.deepseek.com/v1",
    needsApiKey: true,
    keyPlaceholder: "sk-...",
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    description: "Kimi and Moonshot models, good value",
    preset: "custom",
    baseUrl: "https://api.moonshot.ai/v1",
    needsApiKey: true,
    keyPlaceholder: "sk-...",
  },
  {
    id: "mistral",
    name: "Mistral",
    description: "Mistral AI models, OpenAI-compatible",
    preset: "custom",
    baseUrl: "https://api.mistral.ai/v1",
    needsApiKey: true,
    keyPlaceholder: "...",
  },
  {
    id: "groq",
    name: "Groq",
    description: "Fast OpenAI-compatible inference",
    preset: "custom",
    baseUrl: "https://api.groq.com/openai/v1",
    needsApiKey: true,
    keyPlaceholder: "gsk_...",
  },
  {
    id: "together",
    name: "Together",
    description: "OpenAI-compatible endpoint",
    preset: "custom",
    baseUrl: "https://api.together.xyz/v1",
    needsApiKey: true,
    keyPlaceholder: "...",
  },
  {
    id: "fireworks",
    name: "Fireworks",
    description: "OpenAI-compatible endpoint",
    preset: "custom",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    needsApiKey: true,
    keyPlaceholder: "...",
  },
  {
    id: "ollama",
    name: "Ollama (Local)",
    description: "Local models, no cloud key",
    preset: "custom",
    baseUrl: "http://localhost:11434/v1",
    needsApiKey: false,
    keyPlaceholder: "",
  },
  {
    id: "litellm",
    name: "LiteLLM",
    description: "Single gateway for multiple model providers",
    preset: "litellm",
    baseUrl: "http://localhost:4000",
    needsApiKey: false,
    apiKeyOptional: true,
    keyPlaceholder: "Optional unless proxy requires auth",
  },
  {
    id: "custom",
    name: "Custom",
    description: "Bring your own OpenAI-compatible endpoint",
    preset: "custom",
    baseUrl: "",
    needsApiKey: true,
    keyPlaceholder: "...",
  },
];

function providerById(id) {
  return PROVIDERS.find((p) => p.id === id) || PROVIDERS[0];
}

function inferProvider(endpoint) {
  const hit = PROVIDERS.find(
    (p) =>
      endpoint.baseUrl === p.baseUrl &&
      endpoint.preset === p.preset &&
      p.id !== "custom",
  );
  return hit ? hit.name : "Custom";
}

/** Infer model purpose from model ID or label for smart defaults. */
function inferPurpose(modelId, label = "") {
  const s = `${(modelId || "").toLowerCase()} ${(label || "").toLowerCase()}`;
  if (/\b(whisper|speech|tts|voice|bark|realtime|audio)\b/.test(s))
    return "voice";
  if (
    /\b(dall-e|dall-e-3|stable-diffusion|imagen|sdxl|flux|midjourney|image-gen)\b/.test(
      s,
    )
  )
    return "image";
  return "chat";
}

/** True if model is suitable for the given purpose (for filtering add-model dropdown). */
function modelSupportsPurpose(modelId, label, purpose) {
  const s = `${(modelId || "").toLowerCase()} ${(label || "").toLowerCase()}`;
  const isVoice =
    /\b(whisper|speech|tts|voice|bark|realtime|audio)\b/.test(s);
  const isImageGen =
    /\b(dall-e|dall-e-3|stable-diffusion|imagen|sdxl|flux|midjourney|image-gen)\b/.test(
      s,
    );
  const isVision =
    /\b(vision|gpt-4o|gpt-4-vision|gpt-4o-mini|o1|claude-3|multimodal)\b/.test(
      s,
    );

  if (purpose === "chat") return !isVoice && !isImageGen;
  if (purpose === "voice") return isVoice;
  if (purpose === "image") return isVision && !isImageGen; // image = recognition (vision), not generation
  return true;
}

export function SettingsConfiguration() {
  const [endpoints, setEndpoints] = useState([]);
  const [models, setModels] = useState([]);
  const [modelSelection, setModelSelection] = useState({
    voiceModelId: null,
    imageModelId: null,
  });
  const [loading, setLoading] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(true);
  const [wizardStep, setWizardStep] = useState(1);
  const [providerId, setProviderId] = useState("openai");
  const [endpointName, setEndpointName] = useState("OpenAI");
  const [baseUrlOverride, setBaseUrlOverride] = useState(
    "https://api.openai.com/v1",
  );
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [wizardEndpointId, setWizardEndpointId] = useState(null);
  const [doneSummary, setDoneSummary] = useState(null);
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [editingLabelValue, setEditingLabelValue] = useState("");
  const [addModelPurpose, setAddModelPurpose] = useState(null);
  const [addModelEndpointId, setAddModelEndpointId] = useState("");
  const [addModelFetchedList, setAddModelFetchedList] = useState([]);
  const [addModelSelectedId, setAddModelSelectedId] = useState("");
  const [addModelFetching, setAddModelFetching] = useState(false);
  const [addModelFetchError, setAddModelFetchError] = useState(null);
  const [addModelManualId, setAddModelManualId] = useState("");
  const [addModelManualLabel, setAddModelManualLabel] = useState("");
  const connectingRef = useRef(false);

  const provider = useMemo(() => providerById(providerId), [providerId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const getSelection =
        window.api.settings.getModelSelection != null
          ? () =>
              window.api.settings
                .getModelSelection()
                .catch(() => ({ voiceModelId: null, imageModelId: null }))
          : () => Promise.resolve({ voiceModelId: null, imageModelId: null });
      const [ep, mo, sel] = await Promise.all([
        window.api.settings.listEndpoints(),
        window.api.settings.listModels(),
        getSelection(),
      ]);
      setEndpoints(ep || []);
      setModels(mo || []);
      setModelSelection(sel || { voiceModelId: null, imageModelId: null });
    } catch (e) {
      toast.error(e.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const next = providerById(providerId);
    setEndpointName(next.name);
    setBaseUrlOverride(next.baseUrl);
    setApiKeyInput("");
  }, [providerId]);

  useEffect(() => {
    if (!addModelPurpose || !addModelEndpointId) {
      setAddModelFetchedList([]);
      setAddModelSelectedId("");
      setAddModelFetchError(null);
      setAddModelManualId("");
      setAddModelManualLabel("");
      return;
    }
    setAddModelFetching(true);
    setAddModelFetchError(null);
    window.api.settings
      .fetchModels(addModelEndpointId)
      .then((list) => {
        const arr = list || [];
        const filtered = arr.filter((m) =>
          modelSupportsPurpose(m.id, m.label, addModelPurpose),
        );
        setAddModelFetchedList(filtered);
        setAddModelSelectedId(filtered[0]?.id || "");
      })
      .catch((e) => {
        setAddModelFetchedList([]);
        setAddModelSelectedId("");
        const msg = e?.message || "Could not load models";
        setAddModelFetchError(msg);
        toast.error(msg);
      })
      .finally(() => setAddModelFetching(false));
  }, [addModelPurpose, addModelEndpointId]);

  const resetWizard = useCallback(() => {
    setWizardOpen(false);
    setWizardStep(1);
    setProviderId("openai");
    setEndpointName("OpenAI");
    setBaseUrlOverride("https://api.openai.com/v1");
    setApiKeyInput("");
    connectingRef.current = false;
    setConnecting(false);
    setWizardEndpointId(null);
    setDoneSummary(null);
  }, []);

  // Always creates a new endpoint (duplicate URLs allowed for different names/keys)
  const ensureEndpoint = async () => {
    const baseUrl = (baseUrlOverride || provider.baseUrl || "")
      .trim()
      .replace(/\/$/, "");
    if (!baseUrl) {
      throw new Error("Base URL is required");
    }

    return window.api.settings.createEndpoint({
      name: (endpointName || provider.name).trim(),
      preset: provider.preset,
      baseUrl,
    });
  };

  const handleConnect = async () => {
    if (connectingRef.current) return;
    connectingRef.current = true;
    setConnecting(true);

    try {
      const endpoint = await ensureEndpoint();
      setWizardEndpointId(endpoint.id);

      if (provider.needsApiKey && !apiKeyInput.trim()) {
        throw new Error("API key is required");
      }
      if (apiKeyInput.trim()) {
        await window.api.settings.saveApiKey(endpoint.id, apiKeyInput.trim());
      }
      const test = await window.api.settings.testConnection(endpoint.id);
      if (!test.ok) {
        toast.warning(
          test.message || "Connection test failed. You can still add models manually below.",
        );
      } else {
        toast.success(
          "Connected! Add and select models in the Chat, Voice, and Image sections below.",
        );
      }

      await load();
      setDoneSummary({
        provider: provider.name,
        endpoint: endpointName || provider.name,
      });
      setWizardStep(2);
    } catch (e) {
      toast.error(e.message || "Failed to connect provider");
    } finally {
      connectingRef.current = false;
      setConnecting(false);
    }
  };

  const handleSetDefault = async (modelId) => {
    try {
      await window.api.settings.setDefaultModel(modelId);
      toast.success("Default model updated");
      await load();
    } catch (e) {
      toast.error(e.message || "Failed to set default model");
    }
  };

  const handleDeleteModel = async (modelId) => {
    if (!window.confirm("Remove this model? This cannot be undone.")) return;
    try {
      await window.api.settings.deleteModel(modelId);
      toast.success("Model removed");
      await load();
    } catch (e) {
      toast.error(e.message || "Failed to delete model");
    }
  };

  const handleDeleteEndpoint = async (endpointId) => {
    if (
      !window.confirm(
        "Remove this provider and all its models? The API key will be cleared. This cannot be undone.",
      )
    )
      return;
    try {
      await window.api.settings.deleteEndpoint(endpointId);
      toast.success("Endpoint deleted");
      await load();
    } catch (e) {
      toast.error(e.message || "Failed to delete endpoint");
    }
  };

  const handleSetVoiceModel = async (modelId) => {
    try {
      await window.api.settings.setVoiceModelId(modelId || null);
      await load();
      toast.success("Voice model updated");
    } catch (e) {
      toast.error(e.message || "Failed to set voice model");
    }
  };

  const handleSetImageModel = async (modelId) => {
    try {
      await window.api.settings.setImageModelId(modelId || null);
      await load();
      toast.success("Image model updated");
    } catch (e) {
      toast.error(e.message || "Failed to set image model");
    }
  };

  const handleRenameModel = async (modelId, newLabel) => {
    if (!newLabel?.trim()) return;
    try {
      await window.api.settings.updateModel(modelId, {
        label: newLabel.trim(),
      });
      setEditingLabelId(null);
      setEditingLabelValue("");
      await load();
      toast.success("Model renamed");
    } catch (e) {
      toast.error(e.message || "Failed to rename");
    }
  };

  const handleAddModelFromSection = async () => {
    if (!addModelPurpose || !addModelEndpointId) return;
    const fetched = addModelFetchedList.find(
      (m) => m.id === addModelSelectedId,
    );
    const manualId = (addModelManualId || "").trim();
    const chosenModelId = (fetched?.id || manualId || "").trim();
    const chosenLabel = (fetched?.label || (addModelManualLabel || "").trim() || chosenModelId).trim();
    if (!chosenModelId) {
      toast.error("Select a model from the dropdown or enter a model ID");
      return;
    }
    try {
      const currentModels = await window.api.settings.listModels();
      let profile = (currentModels || []).find(
        (m) =>
          m.endpointProfileId === addModelEndpointId &&
          m.modelId === chosenModelId,
      );
      if (!profile) {
        profile = await window.api.settings.addModel({
          endpointProfileId: addModelEndpointId,
          modelId: chosenModelId,
          label: chosenLabel,
          purpose: addModelPurpose,
        });
      } else if ((profile.purpose || "chat") !== addModelPurpose) {
        await window.api.settings.updateModel(profile.id, {
          purpose: addModelPurpose,
        });
        profile = { ...profile, purpose: addModelPurpose };
      }
      if (addModelPurpose === "chat") {
        await window.api.settings.setDefaultModel(profile.id);
      } else if (
        addModelPurpose === "voice" &&
        window.api.settings.setVoiceModelId
      ) {
        await window.api.settings.setVoiceModelId(profile.id);
      } else if (
        addModelPurpose === "image" &&
        window.api.settings.setImageModelId
      ) {
        await window.api.settings.setImageModelId(profile.id);
      }
      await load();
      setAddModelPurpose(null);
      setAddModelEndpointId("");
      toast.success(
        addModelPurpose === "chat"
          ? "Chat model added"
          : addModelPurpose === "voice"
            ? "Voice model added"
            : "Image model added",
      );
    } catch (e) {
      toast.error(e.message || "Failed to add model");
    }
  };

  const chatModels = useMemo(
    () => models.filter((m) => (m.purpose || "chat") === "chat"),
    [models],
  );
  const voiceModels = useMemo(
    () => models.filter((m) => m.purpose === "voice"),
    [models],
  );
  const imageModels = useMemo(
    () => models.filter((m) => m.purpose === "image"),
    [models],
  );
  const providerLabel = provider.name;

  return (
    <div className="w-full space-y-8">
      <h1 className="text-lg font-semibold text-foreground">Models & API</h1>

      <div className="pb-2">
        <div className="text-base font-semibold text-foreground">Add model</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Add any OpenAI-compatible provider. You can connect multiple providers
          and many models.
        </p>
      </div>
      {wizardOpen ? (
        <Card className="border-0">
          <CardContent className="space-y-1 pt-4 pb-4">
            {wizardStep === 1 && (
              <>
                <div className="divide-y divide-border">
                  <div className="flex flex-row items-center gap-6 py-3 first:pt-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Provider
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {provider.description}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex min-w-[12rem] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <span className="truncate">{providerLabel}</span>
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
                          {PROVIDERS.map((p) => (
                            <DropdownMenuItem
                              key={p.id}
                              onClick={() => setProviderId(p.id)}
                              className="flex items-center justify-between gap-2"
                            >
                              <span>{p.name}</span>
                              {providerId === p.id && (
                                <IconCheck size={14} className="text-primary" />
                              )}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="flex flex-row items-center gap-6 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Connection name
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Label for this provider (e.g. “Work OpenAI”)
                      </p>
                    </div>
                    <div className="w-full min-w-[12rem] max-w-xs shrink-0">
                      <input
                        type="text"
                        value={endpointName}
                        onChange={(e) => setEndpointName(e.target.value)}
                        placeholder={provider.name}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>

                  {provider.needsApiKey || provider.apiKeyOptional ? (
                    <div className="flex flex-row items-center gap-6 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          API key
                        </p>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {provider.apiKeyOptional
                            ? "Optional unless your LiteLLM proxy requires auth"
                            : "Stored securely; never sent to us"}
                        </p>
                      </div>
                      <div className="w-full min-w-[12rem] max-w-xs shrink-0">
                        <input
                          type="password"
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          placeholder={provider.keyPlaceholder || "Paste key…"}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="py-3">
                      <p className="text-sm font-medium text-foreground">
                        API key
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {provider.name} runs locally; no key needed.
                      </p>
                    </div>
                  )}

                  <div className="flex flex-row items-center gap-6 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Base URL
                      </p>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Override base URL for this connection
                      </p>
                    </div>
                    <div className="w-full min-w-[12rem] max-w-xs shrink-0">
                      <input
                        type="url"
                        value={baseUrlOverride}
                        onChange={(e) => setBaseUrlOverride(e.target.value)}
                        placeholder="https://.../v1"
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex w-full justify-end pt-2">
                  <Button
                    type="button"
                    onClick={handleConnect}
                    disabled={connecting}
                    className="w-full"
                  >
                    <IconKey size={14} className="mr-1" />
                    {connecting ? "Connecting…" : "Connect & continue"}
                  </Button>
                </div>
              </>
            )}

            {wizardStep === 2 && doneSummary && (
              <>
                <div className="rounded-lg border border-green-500/40 bg-green-500/10 p-4">
                  <p className="text-sm font-medium text-foreground">
                    {doneSummary.provider} connected
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add and select models in the Chat, Voice, and Image sections
                    below. Use the dropdowns to pick or add models.
                  </p>
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="button" onClick={resetWizard}>
                    <IconCheck size={14} className="mr-1" />
                    Done
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex justify-end">
          <Button type="button" onClick={() => setWizardOpen(true)}>
            <IconPlus size={16} className="mr-1" />
            Add provider
          </Button>
        </div>
      )}

      <Card className="border-0">
        <CardHeader>
          <CardTitle className="text-base">Chat models</CardTitle>
          <p className="text-sm text-muted-foreground">
            For coding, use a powerful model with a large context window. You
            can add multiple chat models and choose one on the main screen.
          </p>
        </CardHeader>
        <CardContent>
          {loading && chatModels.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : chatModels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No chat models yet. Add a model using the button below.
            </p>
          ) : (
            <ul className="space-y-2">
              {chatModels.map((m) => {
                const endpoint = endpoints.find(
                  (e) => e.id === m.endpointProfileId,
                );
                const isEditing = editingLabelId === m.id;
                return (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editingLabelValue}
                            onChange={(e) =>
                              setEditingLabelValue(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter")
                                handleRenameModel(m.id, editingLabelValue);
                              if (e.key === "Escape") setEditingLabelId(null);
                            }}
                            className="flex-1 rounded border border-input bg-background px-2 py-1 text-sm"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() =>
                              handleRenameModel(m.id, editingLabelValue)
                            }
                          >
                            Save
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="font-medium text-foreground">
                            {m.label}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {m.modelId} · {endpoint?.name || "Unknown"}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!isEditing && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            onClick={() => {
                              setEditingLabelId(m.id);
                              setEditingLabelValue(m.label || "");
                            }}
                            title="Rename"
                          >
                            <IconPencil size={14} />
                          </Button>
                          {m.isDefault ? (
                            <span className="text-xs font-medium text-primary">
                              Default
                            </span>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => handleSetDefault(m.id)}
                            >
                              Set default
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteModel(m.id)}
                            type="button"
                          >
                            <IconTrash size={14} />
                          </Button>
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {!loading && (
            <div className="mt-3">
              {addModelPurpose === "chat" ? (
                <div className="space-y-3">
                  <div className="flex flex-row items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Provider
                      </p>
                    </div>
                    <div className="shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex min-w-[12rem] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground hover:bg-muted/50"
                          >
                            <span className="truncate">
                              {endpoints.find(
                                (e) => e.id === addModelEndpointId,
                              )?.name || "Select provider"}
                            </span>
                            <IconChevronDown
                              size={16}
                              className="shrink-0 text-muted-foreground"
                            />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {endpoints.map((ep) => (
                            <DropdownMenuItem
                              key={ep.id}
                              onClick={() => setAddModelEndpointId(ep.id)}
                            >
                              {ep.name}
                            </DropdownMenuItem>
                          ))}
                          {endpoints.length === 0 && (
                            <DropdownMenuItem disabled>
                              No providers connected
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {addModelEndpointId && (
                    <>
                      {addModelFetching ? (
                        <p className="text-sm text-muted-foreground">
                          Loading models…
                        </p>
                      ) : addModelFetchedList.length > 0 ? (
                        <div className="flex flex-row items-center gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">
                              Model
                            </p>
                          </div>
                          <div className="shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="flex min-w-[12rem] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground hover:bg-muted/50"
                                >
                                  <span className="truncate">
                                    {addModelFetchedList.find(
                                      (m) => m.id === addModelSelectedId,
                                    )?.label ||
                                      addModelSelectedId ||
                                      "Select model"}
                                  </span>
                                  <IconChevronDown
                                    size={16}
                                    className="shrink-0 text-muted-foreground"
                                  />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {addModelFetchedList.map((m) => (
                                  <DropdownMenuItem
                                    key={m.id}
                                    onClick={() => setAddModelSelectedId(m.id)}
                                  >
                                    {m.label || m.id}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ) : addModelFetchedList.length === 0 &&
                        !addModelFetching ? (
                        <p className="text-sm text-muted-foreground">
                          No models found for this provider.
                        </p>
                      ) : null}
                    </>
                  )}
                  {addModelFetchError && (
                    <p className="text-sm text-destructive">
                      {addModelFetchError}
                    </p>
                  )}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Or enter model ID manually
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={addModelManualId}
                        onChange={(e) => setAddModelManualId(e.target.value)}
                        placeholder="e.g. gpt-4o-mini"
                        className="min-w-[10rem] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="text"
                        value={addModelManualLabel}
                        onChange={(e) => setAddModelManualLabel(e.target.value)}
                        placeholder="Label (optional)"
                        className="min-w-[8rem] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAddModelPurpose(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddModelFromSection}
                      disabled={
                        !addModelEndpointId ||
                        (!addModelSelectedId && !(addModelManualId || "").trim())
                      }
                    >
                      Add as Chat model
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddModelPurpose("chat")}
                >
                  <IconPlus size={14} className="mr-1" />
                  Add chat model
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0">
        <CardHeader>
          <CardTitle className="text-base">Voice model</CardTitle>
          <p className="text-sm text-muted-foreground">
            Single model for voice or interpreter. Add a model above and set
            “Use as” to Voice.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : voiceModels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No voice models added yet.
            </p>
          ) : (
            <div className="flex flex-row items-center gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Selected</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  One voice model for the app
                </p>
              </div>
              <div className="shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex min-w-[12rem] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground hover:bg-muted/50"
                    >
                      <span className="truncate">
                        {voiceModels.find(
                          (x) => x.id === modelSelection.voiceModelId,
                        )?.label || "Select voice model"}
                      </span>
                      <IconChevronDown
                        size={16}
                        className="shrink-0 text-muted-foreground"
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleSetVoiceModel(null)}>
                      None
                    </DropdownMenuItem>
                    {voiceModels.map((vm) => (
                      <DropdownMenuItem
                        key={vm.id}
                        onClick={() => handleSetVoiceModel(vm.id)}
                      >
                        {vm.label}
                        {modelSelection.voiceModelId === vm.id && (
                          <IconCheck size={14} className="ml-2 text-primary" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
          {!loading && (
            <div className="mt-3">
              {addModelPurpose === "voice" ? (
                <div className="space-y-3 p-3">
                  <div className="flex flex-row items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Provider
                      </p>
                    </div>
                    <div className="shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex min-w-[12rem] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground hover:bg-muted/50"
                          >
                            <span className="truncate">
                              {endpoints.find(
                                (e) => e.id === addModelEndpointId,
                              )?.name || "Select provider"}
                            </span>
                            <IconChevronDown
                              size={16}
                              className="shrink-0 text-muted-foreground"
                            />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {endpoints.map((ep) => (
                            <DropdownMenuItem
                              key={ep.id}
                              onClick={() => setAddModelEndpointId(ep.id)}
                            >
                              {ep.name}
                            </DropdownMenuItem>
                          ))}
                          {endpoints.length === 0 && (
                            <DropdownMenuItem disabled>
                              No providers connected
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {addModelEndpointId && (
                    <>
                      {addModelFetching ? (
                        <p className="text-sm text-muted-foreground">
                          Loading models…
                        </p>
                      ) : addModelFetchedList.length > 0 ? (
                        <div className="flex flex-row items-center gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">
                              Model
                            </p>
                          </div>
                          <div className="shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="flex min-w-[12rem] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground hover:bg-muted/50"
                                >
                                  <span className="truncate">
                                    {addModelFetchedList.find(
                                      (m) => m.id === addModelSelectedId,
                                    )?.label ||
                                      addModelSelectedId ||
                                      "Select model"}
                                  </span>
                                  <IconChevronDown
                                    size={16}
                                    className="shrink-0 text-muted-foreground"
                                  />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {addModelFetchedList.map((m) => (
                                  <DropdownMenuItem
                                    key={m.id}
                                    onClick={() => setAddModelSelectedId(m.id)}
                                  >
                                    {m.label || m.id}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ) : addModelFetchedList.length === 0 &&
                        !addModelFetching ? (
                        <p className="text-sm text-muted-foreground">
                          No models found for this provider.
                        </p>
                      ) : null}
                    </>
                  )}
                  {addModelFetchError && (
                    <p className="text-sm text-destructive">
                      {addModelFetchError}
                    </p>
                  )}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Or enter model ID manually
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={addModelManualId}
                        onChange={(e) => setAddModelManualId(e.target.value)}
                        placeholder="e.g. gpt-4o-mini"
                        className="min-w-[10rem] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="text"
                        value={addModelManualLabel}
                        onChange={(e) => setAddModelManualLabel(e.target.value)}
                        placeholder="Label (optional)"
                        className="min-w-[8rem] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAddModelPurpose(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddModelFromSection}
                      disabled={
                        !addModelEndpointId ||
                        (!addModelSelectedId && !(addModelManualId || "").trim())
                      }
                    >
                      Add as Voice model
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddModelPurpose("voice")}
                >
                  <IconPlus size={14} className="mr-1" />
                  Add voice model
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0">
        <CardHeader>
          <CardTitle className="text-base">Image model</CardTitle>
          <p className="text-sm text-muted-foreground">
            Single model for image recognition. Add a model above and set “Use
            as” to Image.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : imageModels.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No image models added yet.
            </p>
          ) : (
            <div className="flex flex-row items-center gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">Selected</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  One image model for the app
                </p>
              </div>
              <div className="shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex min-w-[12rem] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground hover:bg-muted/50"
                    >
                      <span className="truncate">
                        {imageModels.find(
                          (x) => x.id === modelSelection.imageModelId,
                        )?.label || "Select image model"}
                      </span>
                      <IconChevronDown
                        size={16}
                        className="shrink-0 text-muted-foreground"
                      />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleSetImageModel(null)}>
                      None
                    </DropdownMenuItem>
                    {imageModels.map((im) => (
                      <DropdownMenuItem
                        key={im.id}
                        onClick={() => handleSetImageModel(im.id)}
                      >
                        {im.label}
                        {modelSelection.imageModelId === im.id && (
                          <IconCheck size={14} className="ml-2 text-primary" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
          {!loading && (
            <div className="mt-3">
              {addModelPurpose === "image" ? (
                <div className="space-y-3 p-3">
                  <div className="flex flex-row items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        Provider
                      </p>
                    </div>
                    <div className="shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="flex min-w-[12rem] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground hover:bg-muted/50"
                          >
                            <span className="truncate">
                              {endpoints.find(
                                (e) => e.id === addModelEndpointId,
                              )?.name || "Select provider"}
                            </span>
                            <IconChevronDown
                              size={16}
                              className="shrink-0 text-muted-foreground"
                            />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {endpoints.map((ep) => (
                            <DropdownMenuItem
                              key={ep.id}
                              onClick={() => setAddModelEndpointId(ep.id)}
                            >
                              {ep.name}
                            </DropdownMenuItem>
                          ))}
                          {endpoints.length === 0 && (
                            <DropdownMenuItem disabled>
                              No providers connected
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {addModelEndpointId && (
                    <>
                      {addModelFetching ? (
                        <p className="text-sm text-muted-foreground">
                          Loading models…
                        </p>
                      ) : addModelFetchedList.length > 0 ? (
                        <div className="flex flex-row items-center gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">
                              Model
                            </p>
                          </div>
                          <div className="shrink-0">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="flex min-w-[12rem] items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground hover:bg-muted/50"
                                >
                                  <span className="truncate">
                                    {addModelFetchedList.find(
                                      (m) => m.id === addModelSelectedId,
                                    )?.label ||
                                      addModelSelectedId ||
                                      "Select model"}
                                  </span>
                                  <IconChevronDown
                                    size={16}
                                    className="shrink-0 text-muted-foreground"
                                  />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {addModelFetchedList.map((m) => (
                                  <DropdownMenuItem
                                    key={m.id}
                                    onClick={() => setAddModelSelectedId(m.id)}
                                  >
                                    {m.label || m.id}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      ) : addModelFetchedList.length === 0 &&
                        !addModelFetching ? (
                        <p className="text-sm text-muted-foreground">
                          No models found for this provider.
                        </p>
                      ) : null}
                    </>
                  )}
                  {addModelFetchError && (
                    <p className="text-sm text-destructive">
                      {addModelFetchError}
                    </p>
                  )}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Or enter model ID manually
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={addModelManualId}
                        onChange={(e) => setAddModelManualId(e.target.value)}
                        placeholder="e.g. gpt-4o-mini"
                        className="min-w-[10rem] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <input
                        type="text"
                        value={addModelManualLabel}
                        onChange={(e) => setAddModelManualLabel(e.target.value)}
                        placeholder="Label (optional)"
                        className="min-w-[8rem] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAddModelPurpose(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddModelFromSection}
                      disabled={
                        !addModelEndpointId ||
                        (!addModelSelectedId && !(addModelManualId || "").trim())
                      }
                    >
                      Add as Image model
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddModelPurpose("image")}
                >
                  <IconPlus size={14} className="mr-1" />
                  Add image model
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0">
        <CardHeader>
          <CardTitle className="text-base">Connected providers</CardTitle>
          <p className="text-sm text-muted-foreground">
            Providers you have added. Add models from the sections above.
          </p>
        </CardHeader>
        <CardContent>
          {loading && endpoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : endpoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No providers connected yet. Use &quot;Add provider&quot; above to
              connect an API key.
            </p>
          ) : (
            <ul className="space-y-2">
              {endpoints.map((e) => (
                <li
                  key={e.id}
                  className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground"
                >
                  <span className="truncate">{e.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => handleDeleteEndpoint(e.id)}
                  >
                    <IconTrash size={14} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
