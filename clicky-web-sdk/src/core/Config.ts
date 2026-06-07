import { createUuid } from "../utils/uuid";
import type { ClickyOptions, NormalizedClickyOptions } from "./types";

const settingsStorageKey = "clicky-sdk-settings";

export const availableModels = [
  { id: "gemini-2.5-flash", label: "Gemini Flash" },
  { id: "gemini-2.5-pro", label: "Gemini Pro" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet" }
];

export const availableTtsVoices = [
  { id: "en-US-Chirp3-HD-Zephyr", label: "Zephyr" },
  { id: "en-US-Chirp3-HD-Aoede", label: "Aoede" },
  { id: "elevenlabs-default", label: "ElevenLabs fallback" }
];

const defaultHotkey = {
  ctrl: true,
  alt: true,
  shift: false,
  meta: false
};

export function normalizeOptions(rawOptions: ClickyOptions): NormalizedClickyOptions {
  assertValidOptions(rawOptions);
  const storedSettings = readStoredSettings();

  return {
    workerBaseUrl: rawOptions.workerBaseUrl.replace(/\/+$/, ""),
    appName: rawOptions.appName.trim(),
    tenantId: rawOptions.tenantId ?? "default-tenant",
    userId: rawOptions.userId ?? "anonymous",
    sessionId: rawOptions.sessionId ?? createUuid("clicky-session"),
    environment: rawOptions.environment ?? "development",
    mountElement: rawOptions.mountElement ?? document.body,
    hotkey: { ...defaultHotkey, ...rawOptions.hotkey },
    enableVoice: rawOptions.enableVoice ?? true,
    enableTTS: rawOptions.enableTTS ?? true,
    enableScreenshots: rawOptions.enableScreenshots ?? false,
    telemetryEnabled: rawOptions.telemetryEnabled ?? true,
    memoryEnabled: rawOptions.memoryEnabled ?? true,
    voiceProvider: rawOptions.voiceProvider ?? storedSettings.voiceProvider ?? "google",
    chatProvider: rawOptions.chatProvider ?? "gemini",
    ttsProvider: rawOptions.ttsProvider ?? storedSettings.ttsProvider ?? "google",
    model: rawOptions.model ?? storedSettings.model ?? "gemini-2.5-flash",
    ttsVoice: rawOptions.ttsVoice ?? storedSettings.ttsVoice ?? "en-US-Chirp3-HD-Zephyr",
    transientMode: rawOptions.transientMode ?? false,
    screenshotMode: rawOptions.screenshotMode ?? "off",
    realtimeMode: rawOptions.realtimeMode ?? "user-triggered-task",
    contextMode: rawOptions.contextMode ?? "dom-first",
    actionMode: rawOptions.actionMode ?? "confirm-before-execute",
    theme: {
      accentColor: rawOptions.theme?.accentColor ?? "#1683ff",
      panelBackgroundColor: rawOptions.theme?.panelBackgroundColor ?? "#10151f",
      textColor: rawOptions.theme?.textColor ?? "#f8fbff",
      zIndex: rawOptions.theme?.zIndex ?? 2147483000
    },
    systemPrompt: rawOptions.systemPrompt,
    privacy: {
      privateSelectors: rawOptions.privacy?.privateSelectors ?? [],
      ignoredSelectors: rawOptions.privacy?.ignoredSelectors ?? [],
      includeInputValues: rawOptions.privacy?.includeInputValues ?? false
    },
    apiRoutes: {
      chat: rawOptions.apiRoutes?.chat ?? "/ai/chat",
      sttToken: rawOptions.apiRoutes?.sttToken ?? "/voice/stt-token",
      sttUpload: rawOptions.apiRoutes?.sttUpload ?? "/voice/stt",
      tts: rawOptions.apiRoutes?.tts ?? "/voice/tts",
      memorySave: rawOptions.apiRoutes?.memorySave ?? "/memory/save",
      memoryLoad: rawOptions.apiRoutes?.memoryLoad ?? "/memory/load",
      telemetryEvent: rawOptions.apiRoutes?.telemetryEvent ?? "/telemetry/event",
      health: rawOptions.apiRoutes?.health ?? "/health"
    },
    enableLocalFallback: rawOptions.enableLocalFallback ?? false
  };
}

export function persistRuntimeSettings(settings: Record<string, unknown>): void {
  try {
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
  } catch {
    // Storage can be unavailable in embedded contexts; runtime settings still apply for this session.
  }
}

function readStoredSettings(): Partial<Pick<ClickyOptions, "model" | "voiceProvider" | "ttsProvider" | "ttsVoice">> {
  try {
    return JSON.parse(window.localStorage.getItem(settingsStorageKey) ?? "{}") as Partial<
      Pick<ClickyOptions, "model" | "voiceProvider" | "ttsProvider" | "ttsVoice">
    >;
  } catch {
    return {};
  }
}

export function assertValidOptions(rawOptions: ClickyOptions): void {
  if (!rawOptions || typeof rawOptions !== "object") {
    throw new Error("ClickySDK.init requires an options object");
  }

  if (!rawOptions.workerBaseUrl || typeof rawOptions.workerBaseUrl !== "string") {
    throw new Error("ClickySDK.init requires workerBaseUrl");
  }

  if (!rawOptions.appName || typeof rawOptions.appName !== "string" || rawOptions.appName.trim().length === 0) {
    throw new Error("ClickySDK.init requires appName");
  }

  if (rawOptions.mountElement && !(rawOptions.mountElement instanceof HTMLElement)) {
    throw new Error("mountElement must be an HTMLElement");
  }
}
