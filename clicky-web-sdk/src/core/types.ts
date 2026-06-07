export type ClickyState =
  | "idle"
  | "listening"
  | "transcribing"
  | "capturing-context"
  | "responding"
  | "speaking"
  | "awaiting-action-confirmation"
  | "executing-action"
  | "guide-planning"
  | "guide-step-active"
  | "guide-step-watching"
  | "guide-recovering"
  | "guide-completed"
  | "guide-blocked"
  | "error";

export type ClickyContextMode = "dom-first" | "dom-only" | "screenshot-first";
export type ClickyScreenshotMode = "off" | "user-triggered";
export type ClickyActionMode = "disabled" | "confirm-before-execute" | "execute-registered-actions";
export type ClickyEnvironment = "development" | "staging" | "production";
export type ClickyRealtimeMode = "user-triggered-task";
export type ClickyVoiceProvider = "google" | "deepgram" | "assemblyai";
export type ClickyChatProvider = "gemini" | "anthropic";
export type ClickyTtsProvider = "google" | "elevenlabs";

export type ClickyHotkey = {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  code?: string;
};

export type ClickyThemeOptions = {
  accentColor?: string;
  panelBackgroundColor?: string;
  textColor?: string;
  zIndex?: number;
};

export type ClickyPrivacyOptions = {
  privateSelectors?: string[];
  ignoredSelectors?: string[];
  includeInputValues?: boolean;
};

export type ClickyApiRoutes = {
  chat?: string;
  sttToken?: string;
  sttUpload?: string;
  tts?: string;
  memorySave?: string;
  memoryLoad?: string;
  telemetryEvent?: string;
  health?: string;
};

export type ClickyOptions = {
  workerBaseUrl: string;
  appName: string;
  tenantId?: string;
  userId?: string;
  sessionId?: string;
  environment?: ClickyEnvironment;
  mountElement?: HTMLElement;
  hotkey?: ClickyHotkey;
  enableVoice?: boolean;
  enableTTS?: boolean;
  enableScreenshots?: boolean;
  telemetryEnabled?: boolean;
  memoryEnabled?: boolean;
  voiceProvider?: ClickyVoiceProvider;
  chatProvider?: ClickyChatProvider;
  ttsProvider?: ClickyTtsProvider;
  model?: string;
  ttsVoice?: string;
  transientMode?: boolean;
  screenshotMode?: ClickyScreenshotMode;
  realtimeMode?: ClickyRealtimeMode;
  contextMode?: ClickyContextMode;
  actionMode?: ClickyActionMode;
  theme?: ClickyThemeOptions;
  systemPrompt?: string;
  privacy?: ClickyPrivacyOptions;
  apiRoutes?: ClickyApiRoutes;
  enableLocalFallback?: boolean;
};

export type NormalizedClickyOptions = Required<
  Pick<
    ClickyOptions,
    | "workerBaseUrl"
    | "appName"
    | "tenantId"
    | "userId"
    | "sessionId"
    | "environment"
    | "hotkey"
    | "enableVoice"
    | "enableTTS"
    | "enableScreenshots"
    | "telemetryEnabled"
    | "memoryEnabled"
    | "voiceProvider"
    | "chatProvider"
    | "ttsProvider"
    | "model"
    | "ttsVoice"
    | "transientMode"
    | "screenshotMode"
    | "realtimeMode"
    | "contextMode"
    | "actionMode"
  >
> & {
  mountElement: HTMLElement;
  theme: Required<ClickyThemeOptions>;
  systemPrompt?: string;
  privacy: Required<ClickyPrivacyOptions>;
  apiRoutes: Required<ClickyApiRoutes>;
  enableLocalFallback: boolean;
};

export type ClickyCapturedElement = {
  id: string;
  tagName: string;
  role?: string;
  label: string;
  text: string;
  selector: string;
  bounds: ClickyRect;
  isInteractive: boolean;
};

export type ClickySemanticNode = {
  stableId: string;
  role: string;
  name: string;
  state: {
    disabled: boolean;
    hidden: boolean;
    checked: boolean;
    expanded: boolean;
    selected: boolean;
    required: boolean;
  };
  region: string;
  formGroup: string | null;
  bounds: ClickyRect & { visible: boolean };
  tagName: string;
  interactable: boolean;
};

export type ClickyRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ClickyScreenshot = {
  mimeType: "image/png" | "image/jpeg";
  base64: string;
  width: number;
  height: number;
  label: string;
};

export type ClickyCapturedContext = {
  semanticMapVersion: number;
  appName: string;
  tenantId: string;
  userId: string;
  sessionId: string;
  url: string;
  title: string;
  viewport: {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
  };
  pageText: string;
  elements: ClickyCapturedElement[];
  semanticGraph: ClickySemanticNode[];
  screenshots: ClickyScreenshot[];
  capturedAt: string;
};

export type ClickyHealthReport = {
  ok: boolean;
  requestId?: string;
  timestamp?: string;
  providers?: Record<string, string>;
  error?: string;
};

export type ClickyDiagnostics = {
  state: ClickyState;
  health?: ClickyHealthReport;
  activeTaskId?: string;
  semanticMapVersion: number;
  lastError?: string;
  lastLatencyMs?: number;
  lastTarget?: ClickyPointCommand;
  degradedProviders: Record<string, string>;
  activeProviders: Record<string, string>;
  settings: {
    model: string;
    voiceProvider: ClickyVoiceProvider;
    ttsProvider: ClickyTtsProvider;
    ttsVoice: string;
  };
};

export type ClickyTaskOptions = {
  inputMode: "text" | "voice";
  initialText?: string;
};

export type ClickyRuntimeSettings = {
  model?: string;
  voiceProvider?: ClickyVoiceProvider;
  ttsProvider?: ClickyTtsProvider;
  ttsVoice?: string;
};

export type ClickyGuideStep = {
  stepId: string;
  instruction: string;
  targetHint: string;
  successCondition: string;
};

export type ClickySemanticProvider = {
  collect(context: ClickyCapturedContext): Record<string, unknown> | Promise<Record<string, unknown>>;
};

export type ClickyConversationMessage = {
  role: "user" | "assistant";
  text: string;
};

export type ClickyPointCommand =
  | { type: "none" }
  | { type: "element"; elementId: string; label?: string }
  | { type: "coordinate"; x: number; y: number; label?: string };

export type ClickyParsedPointResult = {
  spokenText: string;
  pointCommand: ClickyPointCommand;
};

export type ClickyActionDefinition = {
  id: string;
  name: string;
  description: string;
  parametersSchema: Record<string, unknown>;
  requiresConfirmation?: boolean;
  allowSensitiveFields?: boolean;
  execute(parameters: Record<string, unknown>, context: ClickyActionContext): Promise<ClickyActionResult>;
};

export type ClickyActionContext = {
  capturedContext: ClickyCapturedContext;
  elementRegistry: {
    getElementById(elementId: string): Element | undefined;
  };
};

export type ClickyActionResult = {
  ok: boolean;
  message?: string;
  data?: unknown;
};

export type ClickyProposedAction = {
  actionId: string;
  parameters: Record<string, unknown>;
  definition: ClickyActionDefinition;
};

export type ClickyParsedActionResult = {
  cleanedText: string;
  proposedAction?: {
    actionId: string;
    parameters: Record<string, unknown>;
  };
};

export type ClickyEventMap = {
  "state:changed": { previousState: ClickyState; nextState: ClickyState };
  "mic:start": undefined;
  "mic:stop": undefined;
  "mic:level": { level: number };
  "mic:silent": { durationMs: number };
  "mic:permission-denied": { error: Error };
  "transcript:partial": { text: string };
  "transcript:final": { text: string };
  "context:captured": { context: ClickyCapturedContext };
  "screenshot:captured": { screenshot: ClickyScreenshot };
  "screenshot:denied": { error: Error };
  "health:changed": { health: ClickyHealthReport };
  "task:started": { taskId: string; inputMode: "text" | "voice" };
  "task:ended": { taskId: string; reason: "completed" | "cancelled" | "error" };
  "guide:started": { goal: string };
  "guide:planned": { goal: string; steps: ClickyGuideStep[] };
  "guide:step-started": { step: ClickyGuideStep; stepIndex: number; totalSteps: number };
  "guide:step-completed": { step: ClickyGuideStep };
  "guide:recovery": { step: ClickyGuideStep; attempt: number };
  "guide:completed": { goal: string; steps: ClickyGuideStep[] };
  "guide:blocked": { goal: string; step?: ClickyGuideStep; reason: string };
  "dom:changed": { semanticMapVersion: number };
  "semantic-map:updated": { context: ClickyCapturedContext };
  "assistant:token": { token: string; fullText: string };
  "assistant:done": { text: string; spokenText: string };
  "tts:start": undefined;
  "tts:end": undefined;
  "overlay:point": { command: ClickyPointCommand };
  "cursor:targeted": { command: ClickyPointCommand };
  "cursor:missed": { command: ClickyPointCommand; reason: string };
  "cursor:target-lost": { reason: string; lastTarget?: ClickyPointCommand };
  "provider:degraded": { provider: string; reason: string };
  "provider:recovered": { provider: string };
  "provider:switched": { capability: string; provider: string; reason?: string };
  "memory:loaded": { value: unknown };
  "memory:saved": { ok: boolean };
  "telemetry:sent": { eventName: string };
  "action:proposed": { action: ClickyProposedAction };
  "action:confirmed": { action: ClickyProposedAction };
  "action:executed": { action: ClickyProposedAction; result: ClickyActionResult };
  "action:failed": { action?: ClickyProposedAction; error: Error };
  error: { error: Error };
};

export type ClickyEventName = keyof ClickyEventMap;
export type ClickyEventHandler<EventName extends ClickyEventName> = (payload: ClickyEventMap[EventName]) => void;

export type ClickyClientPublic = {
  open(): void;
  close(): void;
  showOnboarding(): void;
  captureScreenshotForNextRequest(): Promise<void>;
  destroy(): Promise<void>;
  startPushToTalk(): Promise<void>;
  stopPushToTalk(): Promise<void>;
  sendUserText(text: string): Promise<void>;
  healthCheck(): Promise<ClickyHealthReport>;
  startTask(options: ClickyTaskOptions): Promise<void>;
  startGuide(goal: string): Promise<void>;
  stepCompleted(): void;
  cancelGuide(): void;
  updateSettings(settings: ClickyRuntimeSettings): void;
  endTask(): void;
  getDiagnostics(): ClickyDiagnostics;
  captureContext(): Promise<ClickyCapturedContext>;
  registerAction(actionDefinition: ClickyActionDefinition): void;
  unregisterAction(actionId: string): void;
  registerSemanticProvider(provider: ClickySemanticProvider): void;
  on<EventName extends ClickyEventName>(eventName: EventName, handler: ClickyEventHandler<EventName>): () => void;
};
