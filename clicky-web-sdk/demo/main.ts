import { ClickySDK } from "../src";

const urlSearchParams = new URLSearchParams(window.location.search);
const screenshotMode = urlSearchParams.get("screenshotMode") === "user-triggered" ? "user-triggered" : "off";
const enableTTS = urlSearchParams.get("tts") !== "0";

const clicky = ClickySDK.init({
  workerBaseUrl: import.meta.env.VITE_CLICKY_WORKER_BASE_URL ?? "http://localhost:8787",
  appName: "Acme CRM Demo",
  enableScreenshots: screenshotMode === "user-triggered",
  screenshotMode,
  enableTTS,
  transientMode: urlSearchParams.get("transient") === "1",
  enableLocalFallback: true,
  apiRoutes: {
    chat: "/ai/chat",
    sttToken: "/voice/stt-token",
    tts: "/voice/tts"
  }
});

type ClickyDemoEvent = {
  eventName: string;
  payload: unknown;
  timestamp: number;
};

type ClickyDemoWindow = Window & {
  clickyDemo: typeof clicky;
  __clicky: typeof clicky & {
    getContext(): ReturnType<typeof clicky.captureContext>;
    startListening(): ReturnType<typeof clicky.startPushToTalk>;
    stopListening(): ReturnType<typeof clicky.stopPushToTalk>;
    triggerScreenshot(): ReturnType<typeof clicky.captureScreenshotForNextRequest>;
  };
  __clickyEvents: ClickyDemoEvent[];
  __clickyTest: {
    events: ClickyDemoEvent[];
    getTargetRect(elementId: string): Promise<{ left: number; top: number; width: number; height: number } | null>;
    getOnboardingVisible(): boolean;
    getOnboardingText(): string;
  };
};

const demoWindow = window as unknown as ClickyDemoWindow;
demoWindow.clickyDemo = clicky;
demoWindow.__clickyEvents = [];
demoWindow.__clicky = Object.assign(clicky, {
  getContext: () => clicky.captureContext(),
  startListening: () => clicky.startPushToTalk(),
  stopListening: () => clicky.stopPushToTalk(),
  triggerScreenshot: () => clicky.captureScreenshotForNextRequest()
});

const diagnosticsElement = document.getElementById("clicky-diagnostics");

function renderDiagnostics(eventName: string) {
  if (!diagnosticsElement) {
    return;
  }

  diagnosticsElement.textContent = JSON.stringify(
    {
      eventName,
      diagnostics: clicky.getDiagnostics(),
      updatedAt: new Date().toISOString()
    },
    null,
    2
  );
}

function normalizeEventPayload(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "error" in payload) {
    const errorPayload = payload as { error?: unknown };
    if (errorPayload.error instanceof Error) {
      return {
        ...payload,
        error: {
          name: errorPayload.error.name,
          message: errorPayload.error.message
        }
      };
    }
  }

  if (payload && typeof payload === "object" && "screenshot" in payload) {
    const screenshotPayload = payload as {
      screenshot?: { mimeType: string; base64: string; width: number; height: number; label: string };
    };
    if (screenshotPayload.screenshot) {
      return {
        ...payload,
        screenshot: {
          ...screenshotPayload.screenshot,
          dataUrl: `data:${screenshotPayload.screenshot.mimeType};base64,${screenshotPayload.screenshot.base64}`
        }
      };
    }
  }

  return payload;
}

function recordDemoEvent(eventName: string, payload: unknown): void {
  const event = {
    eventName,
    payload: normalizeEventPayload(payload),
    timestamp: performance.now()
  };
  demoWindow.__clickyEvents.push(event);
  window.dispatchEvent(new CustomEvent("clicky:event", { detail: event }));
}

function recordAliasEvent(aliasEventName: string, payload: unknown): void {
  recordDemoEvent(aliasEventName, payload);
}

for (const eventName of [
  "health:changed",
  "task:started",
  "task:ended",
  "dom:changed",
  "semantic-map:updated",
  "cursor:targeted",
  "cursor:missed",
  "cursor:target-lost",
  "mic:start",
  "mic:stop",
  "mic:level",
  "mic:silent",
  "mic:permission-denied",
  "screenshot:captured",
  "screenshot:denied",
  "guide:started",
  "guide:planned",
  "guide:step-started",
  "guide:step-completed",
  "guide:recovery",
  "guide:completed",
  "guide:blocked",
  "tts:start",
  "tts:end",
  "provider:degraded",
  "provider:recovered",
  "memory:loaded",
  "memory:saved",
  "telemetry:sent",
  "error"
] as const) {
  clicky.on(eventName, (payload) => {
    recordDemoEvent(eventName, payload);
    if (eventName === "cursor:targeted") {
      recordAliasEvent("cursor:pointing", payload);
    }
    if (eventName === "guide:planned") {
      recordAliasEvent("guide:plan-ready", payload);
    }
    if (eventName === "guide:step-started") {
      recordAliasEvent("guide:step-active", payload);
    }
    if (eventName === "guide:recovery") {
      recordAliasEvent("guide:recovering", payload);
    }
    if (eventName === "error") {
      const normalizedPayload = normalizeEventPayload(payload) as { error?: { name?: string; message?: string } };
      const errorName = normalizedPayload.error?.name ?? "";
      const errorMessage = normalizedPayload.error?.message ?? "";
      if (errorName === "NotAllowedError" || /permission|microphone/i.test(errorMessage)) {
        recordAliasEvent("mic:permission-denied", normalizedPayload);
      }
      if (/screenshot|capture|display/i.test(errorMessage)) {
        recordAliasEvent("screenshot:denied", normalizedPayload);
      }
    }
    renderDiagnostics(eventName);
  });
}

renderDiagnostics("demo-loaded");

clicky.registerAction({
  id: "focusElement",
  name: "Focus element",
  description: "Focus a currently visible element by Clicky element id.",
  parametersSchema: {
    type: "object",
    required: ["elementId"],
    properties: {
      elementId: { type: "string" }
    }
  },
  async execute(parameters, context) {
    const targetElement = context.elementRegistry.getElementById(String(parameters.elementId));
    if (targetElement instanceof HTMLElement) {
      targetElement.focus();
      return { ok: true, message: "Focused element" };
    }
    return { ok: false, message: "Element not found" };
  }
});

async function getTargetRect(elementId: string): Promise<{ left: number; top: number; width: number; height: number } | null> {
  const escapedElementId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(elementId) : elementId.replace(/["\\]/g, "\\$&");
  const registeredElement = document.querySelector(`[data-clicky-id="${escapedElementId}"]`);
  if (registeredElement) {
    const rect = registeredElement.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }

  const context = await clicky.captureContext();
  const capturedElement = context.elements.find((element) => element.id === elementId);
  if (capturedElement?.selector) {
    try {
      const element = document.querySelector(capturedElement.selector);
      if (element) {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      }
    } catch {
      // Fall back to the captured bounds below.
    }
  }

  const semanticNode = context.semanticGraph.find((node) => node.stableId === elementId);
  const bounds = semanticNode?.bounds ?? capturedElement?.bounds;
  if (!bounds) {
    return null;
  }

  return {
    left: bounds.x,
    top: bounds.y,
    width: bounds.width,
    height: bounds.height
  };
}

function getPanelShadowRoot(): ShadowRoot | null {
  return document.querySelector<HTMLElement>(".clicky-panel-host")?.shadowRoot ?? null;
}

demoWindow.__clickyTest = {
  events: demoWindow.__clickyEvents,
  getTargetRect,
  getOnboardingVisible: () => !!getPanelShadowRoot()?.querySelector(".clicky-onboarding.is-visible"),
  getOnboardingText: () => getPanelShadowRoot()?.textContent ?? ""
};

recordDemoEvent("demo:loaded", { screenshotMode, enableTTS });
window.dispatchEvent(new CustomEvent("clicky:ready"));

clicky.registerAction({
  id: "clickElement",
  name: "Click element",
  description: "Click a currently visible safe element by Clicky element id.",
  parametersSchema: {
    type: "object",
    required: ["elementId"],
    properties: {
      elementId: { type: "string" }
    }
  },
  async execute(parameters, context) {
    const targetElement = context.elementRegistry.getElementById(String(parameters.elementId));
    if (targetElement instanceof HTMLElement) {
      targetElement.click();
      return { ok: true, message: "Clicked element" };
    }
    return { ok: false, message: "Element not found" };
  }
});
