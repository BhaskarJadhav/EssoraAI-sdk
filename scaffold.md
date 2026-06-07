# Clicky Web SDK Scaffold

This scaffold is the implementation handoff for building a browser-native Clicky SDK.
It is not a literal port of the macOS app. It translates the browser-relevant Clicky
behaviors into web APIs so any webapp can embed a voice-first companion that sees the
current app, talks back, points at UI, and can safely execute host-approved actions.

## Product Goal

Build a framework-agnostic TypeScript SDK that gives a host webapp Clicky-like speed
and capability:

- voice-first push-to-talk assistance
- manual text input fallback
- DOM and accessibility-aware app context
- optional user-triggered screenshot context
- Claude streaming responses through the existing Cloudflare Worker
- ElevenLabs text-to-speech playback through the Worker
- in-app blue cursor overlay for pointing and guidance
- conversation memory scoped to one SDK instance
- optional autonomous actions through host-registered action hooks

The SDK should optimize for webapp productivity and speed, not literal macOS UI
parity.

## Browser-Native Translation Rules

The macOS app has OS-level privileges that browsers cannot provide. The SDK must be
honest about these constraints and provide web-native replacements.

| Mac Clicky behavior | Web SDK behavior |
| --- | --- |
| Menu bar companion panel | Floating in-app launcher and compact panel |
| Global `ctrl + option` push-to-talk | Focused-page hotkey plus visible mic button |
| ScreenCaptureKit multi-screen capture | DOM context by default, optional `getDisplayMedia` screenshot |
| System-wide transparent overlay | Overlay mounted inside the host page DOM |
| Multi-monitor cursor pointing | DOM element, viewport, page, or screenshot-relative pointing |
| AppKit permissions | Browser permission prompts and host consent hooks |
| Background app presence | SDK lifecycle owned by host page |

The SDK cannot:

- receive hotkeys while the browser tab or host app is not focused
- draw outside the host page DOM
- silently capture the user's screen
- inspect other apps or browser tabs without browser capture permission
- live in the macOS menu bar
- execute arbitrary app actions without host-registered capabilities

## Public SDK Interface

### Entry Point

```ts
import { ClickySDK } from "@clicky/web-sdk";

const clicky = ClickySDK.init({
  workerBaseUrl: "https://your-worker.example.workers.dev",
  appName: "Acme CRM",
});
```

`ClickySDK.init(options)` creates one SDK instance, mounts the launcher/panel, sets up
listeners, and returns a `ClickyClient`.

### Required Options

```ts
type RequiredClickyOptions = {
  workerBaseUrl: string;
  appName: string;
};
```

### Optional Options

```ts
type ClickyOptions = RequiredClickyOptions & {
  mountElement?: HTMLElement;
  hotkey?: ClickyHotkey;
  enableVoice?: boolean;
  enableTTS?: boolean;
  enableScreenshots?: boolean;
  contextMode?: "dom-first" | "dom-only" | "screenshot-first";
  actionMode?: "disabled" | "confirm-before-execute" | "execute-registered-actions";
  theme?: ClickyThemeOptions;
  systemPrompt?: string;
  privacy?: ClickyPrivacyOptions;
};
```

Defaults:

- `mountElement`: `document.body`
- `hotkey`: focused-page `ctrl + option`
- `enableVoice`: `true`
- `enableTTS`: `true`
- `enableScreenshots`: `false`
- `contextMode`: `"dom-first"`
- `actionMode`: `"confirm-before-execute"`

### Instance Methods

```ts
type ClickyClient = {
  open(): void;
  close(): void;
  destroy(): Promise<void>;

  startPushToTalk(): Promise<void>;
  stopPushToTalk(): Promise<void>;
  sendUserText(text: string): Promise<void>;
  captureContext(): Promise<ClickyCapturedContext>;

  registerAction(actionDefinition: ClickyActionDefinition): void;
  unregisterAction(actionId: string): void;

  on<EventName extends ClickyEventName>(
    eventName: EventName,
    handler: ClickyEventHandler<EventName>
  ): () => void;
};
```

### Events

The SDK emits typed events through the client event bus:

- `state:changed`
- `mic:start`
- `mic:stop`
- `transcript:partial`
- `transcript:final`
- `context:captured`
- `assistant:token`
- `assistant:done`
- `tts:start`
- `tts:end`
- `overlay:point`
- `action:proposed`
- `action:confirmed`
- `action:executed`
- `action:failed`
- `error`

## Project Root

```text
clicky-web-sdk/
  package.json
  tsconfig.json
  vite.config.ts
  README.md
  scaffold.md
  src/
    index.ts
    core/
      ClickyClient.ts
      StateMachine.ts
      EventBus.ts
      Config.ts
      Lifecycle.ts
      types.ts
    context/
      ContextCollector.ts
      DomSnapshot.ts
      AccessibilitySnapshot.ts
      ElementRegistry.ts
      ScreenshotCapture.ts
      Redaction.ts
      selectors.ts
    api/
      WorkerProxy.ts
      ClaudeClient.ts
      AssemblyAIClient.ts
      ElevenLabsClient.ts
      SseParser.ts
    audio/
      MicCapture.ts
      AudioWorkletProcessor.ts
      PcmEncoder.ts
      AudioPlayer.ts
      VoiceActivityMeter.ts
    actions/
      ActionRegistry.ts
      ActionPlanner.ts
      ConfirmationPolicy.ts
      ActionExecutor.ts
      actionTypes.ts
    overlay/
      OverlayRoot.ts
      CursorOverlay.ts
      CursorAnimator.ts
      ElementHighlighter.ts
      ResponseBubble.ts
      overlayStyles.ts
    panel/
      PanelRoot.ts
      LauncherButton.ts
      CompanionPanel.ts
      MicButton.ts
      PermissionStatus.ts
      panelStyles.ts
    parsing/
      PointTagParser.ts
      ActionTagParser.ts
      ResponseCleaner.ts
    shared/
      DesignSystem.ts
      ShadowDom.ts
      browserSupport.ts
    utils/
      dom.ts
      time.ts
      uuid.ts
      logger.ts
  demo/
    index.html
    main.ts
    styles.css
```

## Architecture

The SDK has six layers:

1. UI layer: launcher, panel, mic controls, overlay, response bubble
2. Control layer: `ClickyClient`, state machine, lifecycle, event bus
3. Context layer: DOM snapshot, accessibility extraction, element registry, screenshot capture
4. Media layer: mic capture, PCM encoding, realtime transcription, TTS playback
5. AI layer: Worker proxy, Claude streaming, AssemblyAI websocket, ElevenLabs TTS
6. Action layer: host-registered actions, confirmation policy, execution results

All browser UI should be framework-agnostic and mounted in Shadow DOM to avoid leaking
styles into the host app or inheriting unsafe host styles. React, Vue, Svelte, and other
wrappers may be added later, but v1 must not require a framework dependency.

## Core Flow

### Voice Interaction

1. User holds the focused-page hotkey or presses the mic button.
2. `MicCapture` requests or uses mic permission and streams PCM16 frames.
3. `AssemblyAIClient` sends frames over websocket and emits partial/final transcripts.
4. `ClickyClient` captures DOM-first context and optional screenshot context.
5. `ClaudeClient` sends transcript, context, screenshot data, and conversation history.
6. Claude streams tokens through the Worker.
7. `ResponseCleaner` strips private control tags from visible/spoken text.
8. `PointTagParser` and `ActionTagParser` extract point/action instructions.
9. Overlay points at relevant UI.
10. If enabled, `ElevenLabsClient` synthesizes the spoken response.
11. If actions are proposed, `ActionPlanner` routes them through the host action policy.

### Text Interaction

1. User types into the panel input.
2. `sendUserText(text)` follows the same context, Claude, pointing, TTS, and action flow.
3. Text input must work even when microphone permission is denied.

### Context Capture

`contextMode: "dom-first"` is the default:

1. Collect DOM/accessibility context every interaction.
2. Include optional screenshot only when `enableScreenshots` is true and capture is user-triggered.
3. Prefer DOM element IDs for pointing and actions.
4. Fall back to viewport coordinates only when no stable element target exists.

## DOM-First Context

`ContextCollector` must collect enough app context for Claude to answer questions and
identify UI targets without requiring screenshots on every request.

Collect:

- visible text
- headings
- buttons
- links
- inputs and textareas
- labels
- ARIA labels and roles
- selected values where safe
- element bounds
- scroll offsets
- stable selectors
- generated `clickyElementId` values
- page title and URL path

Do not collect:

- password values
- hidden input values
- fields matching configured private selectors
- elements with `data-clicky-private`
- content inside `[aria-hidden="true"]` unless needed for visible UI structure

Supported host annotations:

```html
<button data-clicky-label="Create invoice">New</button>
<section data-clicky-context="Billing dashboard"></section>
<input data-clicky-private />
<div data-clicky-ignore></div>
```

`ElementRegistry` maps DOM nodes to stable SDK-generated element IDs for the current
capture. These IDs are valid for the current page state only and should be refreshed on
each interaction.

## Screenshot Capture

Screenshots are optional and user-triggered.

Use:

- `navigator.mediaDevices.getDisplayMedia`
- video frame capture into canvas
- PNG or JPEG base64 encoding
- immediate media track cleanup after capture

The SDK should support three screenshot modes:

- disabled: never request capture
- manual: user presses a capture button
- interaction: SDK may request capture during a user-initiated voice/text interaction

The scaffold must not claim silent or background screenshot capture. Browsers may show
permission prompts every time, depending on browser and user settings.

## Pointing Protocol

Claude should prefer element-based pointing because DOM element IDs survive layout
differences better than screenshot pixels.

Supported tags:

```text
[POINT:elementId:label]
[POINT:x,y:label]
[POINT:none]
```

Rules:

- Tags appear at the end of the assistant response.
- `elementId` refers to a `clickyElementId` from the latest context capture.
- `x,y` are viewport CSS pixels with top-left origin unless explicitly tied to a screenshot.
- `label` is a short 1-3 word target description.
- The SDK strips point tags before TTS and normal panel rendering.
- If pointing is not useful, Claude must append `[POINT:none]`.

Overlay behavior:

- mount inside Shadow DOM
- use `pointer-events: none` except confirmation UI
- animate the blue cursor to the element center or viewport coordinate
- account for scroll offsets
- clamp targets to the visible viewport
- optionally highlight the target element briefly
- never block host app interaction after animation

## Autonomous Actions

The browser SDK may support autonomous actions, but only through host-registered action
hooks. Claude must not directly mutate the DOM or submit forms outside the action system.

### Action Definition

```ts
type ClickyActionDefinition = {
  id: string;
  name: string;
  description: string;
  parametersSchema: Record<string, unknown>;
  requiresConfirmation?: boolean;
  allowSensitiveFields?: boolean;
  execute(parameters: Record<string, unknown>, context: ClickyActionContext): Promise<ClickyActionResult>;
};
```

Example host actions:

- `navigate`
- `focusElement`
- `clickElement`
- `fillInput`
- `openModal`
- `submitSearch`
- app-specific commands such as `createInvoice` or `assignTicket`

### Action Policy

Default: `actionMode: "confirm-before-execute"`.

Rules:

- Execute only registered actions.
- Show a confirmation UI before execution by default.
- Reject actions not present in `ActionRegistry`.
- Reject credential or sensitive-field entry unless the action explicitly allows it.
- Emit `action:proposed`, `action:confirmed`, `action:executed`, or `action:failed`.
- Surface action failures in the panel and keep the SDK usable.

Supported response action protocol:

```text
[ACTION:actionId:jsonPayload]
[ACTION:none]
```

The JSON payload must match the registered action's parameter schema.

## API Layer

The existing Cloudflare Worker proxy pattern remains the backend contract. Browser code
must never require raw Anthropic, AssemblyAI, or ElevenLabs keys.

Routes:

| Route | Purpose |
| --- | --- |
| `POST /chat` | Claude streaming messages |
| `POST /tts` | ElevenLabs audio synthesis |
| `POST /transcribe-token` | Short-lived AssemblyAI websocket token |

`WorkerProxy` owns:

- base URL normalization
- JSON requests
- streaming requests
- timeout support
- retry for safe transient failures
- normalized error objects

`ClaudeClient` owns:

- prompt construction
- conversation history serialization
- DOM context serialization
- optional screenshot attachment
- SSE parsing
- token and done events

`AssemblyAIClient` owns:

- token fetching
- websocket lifecycle
- PCM16 frame sending
- partial/final transcript events
- reconnect handling for recoverable disconnects

`ElevenLabsClient` owns:

- text cleanup before synthesis
- audio blob fetching
- playback handoff to `AudioPlayer`
- `tts:start` and `tts:end` events

## Prompting Requirements

The system prompt should describe Clicky as an in-app web companion, not a menu bar app.

It must tell Claude:

- the user is interacting inside a webapp
- DOM context is the primary source of truth
- screenshots may be present but are optional
- answers should be concise because they may be spoken aloud
- point tags must use the current pointing protocol
- action tags may only use registered actions
- if no point or action is useful, use `[POINT:none]` and `[ACTION:none]`
- never claim to see outside the current webapp unless screenshot context was explicitly provided

## File Responsibilities

### `src/index.ts`

- Export `ClickySDK`, `ClickyClient`, public types, and `init`.
- Attach `window.ClickySDK` for UMD builds.
- Register the optional custom element if enabled by build config.

### `src/core/ClickyClient.ts`

- Central coordinator for UI, context, audio, API clients, overlay, and actions.
- Maintains scoped conversation history.
- Owns public methods and event subscriptions.
- Ensures `destroy()` fully tears down listeners, media tracks, websockets, audio, and DOM nodes.

### `src/core/StateMachine.ts`

States:

- `idle`
- `listening`
- `transcribing`
- `capturing-context`
- `responding`
- `speaking`
- `awaiting-action-confirmation`
- `executing-action`
- `error`

Enforce valid transitions and emit `state:changed`.

### `src/context/*`

- Build DOM-first context.
- Generate element IDs and stable selectors.
- Redact sensitive content.
- Capture optional screenshots.
- Return a single `ClickyCapturedContext` object.

### `src/audio/*`

- Request mic permission only from user gestures.
- Use Web Audio API and AudioWorklet where available.
- Convert Float32 mic frames to PCM16.
- Provide visible audio level updates for the mic button/waveform.
- Decode and play TTS audio while respecting browser autoplay policies.

### `src/api/*`

- Use the Cloudflare Worker for all AI vendor calls.
- Parse Claude SSE robustly across chunk boundaries.
- Keep provider-specific code out of UI and core components.

### `src/actions/*`

- Store host-registered actions.
- Validate proposed action IDs and payloads.
- Apply confirmation policy.
- Execute actions and emit results.

### `src/overlay/*`

- Create the Shadow DOM overlay root.
- Draw and animate the blue cursor.
- Position response bubbles near the cursor when useful.
- Highlight pointed elements without altering host layout.

### `src/panel/*`

- Render the launcher and compact panel in vanilla DOM.
- Show state, transcript, response, mic button, text input, permissions, and action confirmations.
- Provide hover and focus states for all interactive controls.

### `src/parsing/*`

- Parse point tags.
- Parse action tags.
- Strip internal tags before TTS and visible response rendering.
- Handle missing or malformed tags gracefully.

### `demo/*`

- Plain HTML demo with no React.
- Demonstrate SDK initialization, voice input, manual text, DOM context, pointing, screenshot opt-in, and registered actions.

## Phased Implementation Checklist

### 1. Bootstrap

Goal: working TypeScript library build.

Steps:

- Create package, Vite, TypeScript, Vitest, and demo setup.
- Build ESM and UMD outputs.
- Export `ClickySDK.init`.
- Confirm demo loads the SDK in plain HTML.

Output: `npm run build` and demo page both work.

### 2. Core Runtime

Goal: stable SDK lifecycle.

Steps:

- Implement typed EventBus.
- Implement StateMachine.
- Implement Config defaults and validation.
- Implement `ClickyClient.open`, `close`, `destroy`, and `sendUserText`.

Output: SDK can mount, open, close, and unmount cleanly.

### 3. Shadow DOM UI

Goal: framework-agnostic in-app UI.

Steps:

- Implement launcher and compact panel.
- Implement overlay root.
- Add design tokens and isolated styles.
- Verify host styles do not leak in or out.

Output: visible panel and overlay in the demo app.

### 4. DOM Context

Goal: Clicky understands the host webapp without screenshots.

Steps:

- Implement visible DOM/accessibility snapshot.
- Add element ID registry.
- Add redaction rules.
- Serialize context for Claude.

Output: Claude can reference visible app UI from DOM context.

### 5. Voice And Transcription

Goal: voice-first interaction.

Steps:

- Implement mic permission flow.
- Implement AudioWorklet capture and PCM16 conversion.
- Fetch AssemblyAI token through Worker.
- Stream mic frames and emit transcripts.

Output: holding hotkey or pressing mic button yields final transcript.

### 6. Claude Streaming

Goal: realtime assistant response.

Steps:

- Build prompt and message payload.
- Include conversation history and captured context.
- Stream `/chat` response through Worker.
- Render tokens as they arrive.

Output: assistant response streams into panel.

### 7. Pointing Overlay

Goal: Clicky points at app UI.

Steps:

- Parse `[POINT:...]` tags.
- Resolve element IDs to DOM bounds.
- Animate cursor to target.
- Fall back to viewport coordinates.
- Strip tags before TTS.

Output: Clicky visually points at relevant elements.

### 8. TTS Playback

Goal: spoken assistant responses.

Steps:

- Send cleaned text to `/tts`.
- Decode and play audio.
- Emit TTS lifecycle events.
- Handle autoplay restrictions gracefully.

Output: assistant response is spoken after a user-initiated interaction.

### 9. Optional Screenshot Context

Goal: add visual context when DOM is insufficient.

Steps:

- Add capture button and enabled interaction flow.
- Use `getDisplayMedia`.
- Capture a frame to canvas.
- Stop media tracks immediately.
- Attach encoded image to Claude request.

Output: Claude can answer about visual/canvas/image-heavy UI when user grants capture.

### 10. Autonomous Actions

Goal: safe host-app control.

Steps:

- Implement action registry.
- Parse action tags.
- Validate payloads.
- Show confirmation UI by default.
- Execute registered actions and emit result events.

Output: Clicky can perform host-approved actions without arbitrary DOM mutation.

### 11. QA And Hardening

Goal: reliable SDK behavior across realistic host apps.

Steps:

- Add unit tests.
- Add browser tests.
- Test permission-denied flows.
- Test long pages and scroll offsets.
- Test high z-index host modals.
- Test cleanup on `destroy()`.

Output: SDK is ready for embedding in real webapps.

## Test Plan

### Unit Tests

- State transitions
- EventBus subscriptions and unsubscriptions
- Config validation and defaults
- PCM16 conversion
- SSE chunk parsing
- POINT tag parsing
- ACTION tag parsing
- DOM context redaction
- Element registry lookup
- Action registry permission policy

### Browser Tests

- SDK mounts in plain HTML without React.
- Shadow DOM styles do not leak into host app.
- Focused-page hotkey works only while page is focused.
- Mic button starts and stops transcription.
- Manual text input works without mic permission.
- Claude response streams into the panel.
- TTS starts only after an allowed user interaction.
- Overlay points at DOM elements without blocking host clicks.
- Registered actions require confirmation by default.
- `destroy()` removes listeners, media tracks, DOM nodes, audio playback, and websocket connections.

### Manual QA

- Chrome
- Edge
- Safari where APIs are available
- Firefox where APIs are available
- Mic permission denied
- Screenshot permission denied
- Long scrolling pages
- Host pages with high z-index modals
- Sensitive forms and redaction
- Canvas/image-heavy pages with screenshot opt-in

## Implementation Constraints

- Do not add React as a required runtime dependency.
- Do not require host apps to expose API keys.
- Do not promise cross-tab, cross-app, or system-wide behavior.
- Do not collect private field values by default.
- Do not execute unregistered actions.
- Do not perform credential entry unless the host explicitly opts into it.
- Do not leave media tracks, websocket connections, audio playback, or DOM nodes alive after `destroy()`.

## Success Criteria

The SDK is successful when a plain HTML webapp can embed Clicky with a few lines of
code and get:

- a floating companion launcher/panel
- voice and text input
- DOM-aware answers
- streamed assistant responses
- optional spoken replies
- in-app pointing at relevant UI
- optional screenshot context
- optional confirmed host actions
- clean teardown

The result should feel like Clicky adapted to the browser: fast, contextual, voice-led,
and concrete, while respecting browser security boundaries.
