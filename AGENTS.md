# Clicky - Agent Instructions

<!-- This is the single source of truth for all AI coding agents. CLAUDE.md is a symlink to this file. -->
<!-- AGENTS.md spec: https://github.com/agentsmd/agents.md — supported by Claude Code, Cursor, Copilot, Gemini CLI, and others. -->

## Overview

macOS menu bar companion app. Lives entirely in the macOS status bar (no dock icon, no main window). Clicking the menu bar icon opens a custom floating panel with companion voice controls. Uses push-to-talk (ctrl+option) to capture voice input, transcribes it via AssemblyAI streaming, and sends the transcript + a screenshot of the user's screen to Claude. Claude responds with text (streamed via SSE) and voice (ElevenLabs TTS). A blue cursor overlay can fly to and point at UI elements Claude references on any connected monitor.

The repo also includes `clicky-web-sdk/`, a browser-native TypeScript SDK for embedding Clicky-like behavior inside SaaS webapps. The SDK is framework-agnostic, mounts isolated Shadow DOM UI, uses DOM/accessibility context by default, supports optional browser screenshot capture, streams Claude responses through the same Worker proxy, plays ElevenLabs TTS, points inside the host page, and executes only host-registered actions.

For the browser SDK, the long-term product direction is now Essora AI SDK: an outcome-driven realtime guidance and execution layer for SaaS/CRM workflows. Future agents must treat [ESSORA_PRODUCT_VISION.md](ESSORA_PRODUCT_VISION.md) as the product north star. Essora is not a chatbot; it is a browser-native outcome delivery system that guides or executes workflows until users complete business goals.

All API keys live on a Cloudflare Worker proxy — nothing sensitive ships in the app.

## Architecture

- **App Type**: Menu bar-only (`LSUIElement=true`), no dock icon or main window
- **Framework**: SwiftUI (macOS native) with AppKit bridging for menu bar panel and cursor overlay
- **Pattern**: MVVM with `@StateObject` / `@Published` state management
- **AI Chat**: Claude (Sonnet 4.6 default, Opus 4.6 optional) via Cloudflare Worker proxy with SSE streaming
- **Speech-to-Text**: AssemblyAI real-time streaming (`u3-rt-pro` model) via websocket, with OpenAI and Apple Speech as fallbacks
- **Text-to-Speech**: ElevenLabs (`eleven_flash_v2_5` model) via Cloudflare Worker proxy
- **Screen Capture**: ScreenCaptureKit (macOS 14.2+), multi-monitor support
- **Voice Input**: Push-to-talk via `AVAudioEngine` + pluggable transcription-provider layer. System-wide keyboard shortcut via listen-only CGEvent tap.
- **Element Pointing**: Claude embeds `[POINT:x,y:label:screenN]` tags in responses. The overlay parses these, maps coordinates to the correct monitor, and animates the blue cursor along a bezier arc to the target.
- **Concurrency**: `@MainActor` isolation, async/await throughout
- **Analytics**: PostHog via `ClickyAnalytics.swift`

### Browser SDK Architecture

- **Package**: `clicky-web-sdk/` TypeScript library built with Vite
- **Framework stance**: Framework-agnostic vanilla DOM; no required React dependency
- **UI isolation**: Shadow DOM launcher, panel, and overlay roots
- **Context**: DOM/accessibility snapshot with stable element IDs, bounds, labels, selectors, redaction, MutationObserver-driven semantic map updates during user-triggered tasks, and optional `getDisplayMedia` screenshot capture
- **Voice Input**: Focused-page hotkey plus visible mic button using browser mic permission and PCM16 streaming
- **AI Chat**: Gemini/Vertex through Worker `/ai/chat`, with old `/chat` compatibility alias and Anthropic fallback when configured
- **Speech-to-Text**: Deepgram via `/voice/stt-token`; when Deepgram temporary-token grants are unavailable, the Worker returns a secure `/voice/stt-stream` WebSocket proxy so the browser never receives the raw provider key. Old AssemblyAI `/transcribe-token` compatibility remains in the legacy Worker.
- **Text-to-Speech**: Google TTS primary through Worker `/voice/tts`, with ElevenLabs fallback when a voice ID is supplied or Google synthesis fails.
- **Memory/Observability**: Upstash Redis routes `/memory/save` and `/memory/load`, PostHog `/telemetry/event`, Sentry Worker error reporting, and SDK diagnostics via `getDiagnostics()`
- **Pointing**: `[POINT:elementId:label]`, `[POINT:x,y:label]`, and `[POINT:none]` tags drive in-page blue cursor animation
- **Actions**: Claude can propose `[ACTION:actionId:jsonPayload]`, but execution is limited to host-registered action hooks with confirmation by default
- **Browser limits**: No system-wide hotkeys, no cross-app overlay, no silent screen capture, and no arbitrary DOM mutation

### API Proxy (Cloudflare Worker)

The app never calls external APIs directly. All requests go through a Cloudflare Worker (`worker/src/index.ts`) that holds the real API keys as secrets.

| Route | Upstream | Purpose |
|-------|----------|---------|
| `POST /chat` | `api.anthropic.com/v1/messages` | Claude vision + streaming chat |
| `POST /tts` | `api.elevenlabs.io/v1/text-to-speech/{voiceId}` | ElevenLabs TTS audio |
| `POST /transcribe-token` | `streaming.assemblyai.com/v3/token` | Fetches a short-lived (480s) AssemblyAI websocket token |

Worker secrets: `ANTHROPIC_API_KEY`, `ASSEMBLYAI_API_KEY`, `ELEVENLABS_API_KEY`
Worker vars: `ELEVENLABS_VOICE_ID`

### Key Architecture Decisions

**Menu Bar Panel Pattern**: The companion panel uses `NSStatusItem` for the menu bar icon and a custom borderless `NSPanel` for the floating control panel. This gives full control over appearance (dark, rounded corners, custom shadow) and avoids the standard macOS menu/popover chrome. The panel is non-activating so it doesn't steal focus. A global event monitor auto-dismisses it on outside clicks.

**Cursor Overlay**: A full-screen transparent `NSPanel` hosts the blue cursor companion. It's non-activating, joins all Spaces, and never steals focus. The cursor position, response text, waveform, and pointing animations all render in this overlay via SwiftUI through `NSHostingView`.

**Global Push-To-Talk Shortcut**: Background push-to-talk uses a listen-only `CGEvent` tap instead of an AppKit global monitor so modifier-based shortcuts like `ctrl + option` are detected more reliably while the app is running in the background.

**Shared URLSession for AssemblyAI**: A single long-lived `URLSession` is shared across all AssemblyAI streaming sessions (owned by the provider, not the session). Creating and invalidating a URLSession per session corrupts the OS connection pool and causes "Socket is not connected" errors after a few rapid reconnections.

**Transient Cursor Mode**: When "Show Clicky" is off, pressing the hotkey fades in the cursor overlay for the duration of the interaction (recording → response → TTS → optional pointing), then fades it out automatically after 1 second of inactivity.

## Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `ESSORA_PRODUCT_VISION.md` | ~70 | Product north-star for the browser SDK. Defines Essora as an outcome-driven SaaS/CRM guidance and execution SDK, with Guide Mode, Autonomous Mode, outcome completion metrics, and core engineering rules. |
| `leanring_buddyApp.swift` | ~89 | Menu bar app entry point. Uses `@NSApplicationDelegateAdaptor` with `CompanionAppDelegate` which creates `MenuBarPanelManager` and starts `CompanionManager`. No main window — the app lives entirely in the status bar. |
| `CompanionManager.swift` | ~1026 | Central state machine. Owns dictation, shortcut monitoring, screen capture, Claude API, ElevenLabs TTS, and overlay management. Tracks voice state (idle/listening/processing/responding), conversation history, model selection, and cursor visibility. Coordinates the full push-to-talk → screenshot → Claude → TTS → pointing pipeline. |
| `MenuBarPanelManager.swift` | ~243 | NSStatusItem + custom NSPanel lifecycle. Creates the menu bar icon, manages the floating companion panel (show/hide/position), installs click-outside-to-dismiss monitor. |
| `CompanionPanelView.swift` | ~761 | SwiftUI panel content for the menu bar dropdown. Shows companion status, push-to-talk instructions, model picker (Sonnet/Opus), permissions UI, DM feedback button, and quit button. Dark aesthetic using `DS` design system. |
| `OverlayWindow.swift` | ~881 | Full-screen transparent overlay hosting the blue cursor, response text, waveform, and spinner. Handles cursor animation, element pointing with bezier arcs, multi-monitor coordinate mapping, and fade-out transitions. |
| `CompanionResponseOverlay.swift` | ~217 | SwiftUI view for the response text bubble and waveform displayed next to the cursor in the overlay. |
| `CompanionScreenCaptureUtility.swift` | ~132 | Multi-monitor screenshot capture using ScreenCaptureKit. Returns labeled image data for each connected display. |
| `BuddyDictationManager.swift` | ~866 | Push-to-talk voice pipeline. Handles microphone capture via `AVAudioEngine`, provider-aware permission checks, keyboard/button dictation sessions, transcript finalization, shortcut parsing, contextual keyterms, and live audio-level reporting for waveform feedback. |
| `BuddyTranscriptionProvider.swift` | ~100 | Protocol surface and provider factory for voice transcription backends. Resolves provider based on `VoiceTranscriptionProvider` in Info.plist — AssemblyAI, OpenAI, or Apple Speech. |
| `AssemblyAIStreamingTranscriptionProvider.swift` | ~478 | Streaming transcription provider. Fetches temp tokens from the Cloudflare Worker, opens an AssemblyAI v3 websocket, streams PCM16 audio, tracks turn-based transcripts, and delivers finalized text on key-up. Shares a single URLSession across all sessions. |
| `OpenAIAudioTranscriptionProvider.swift` | ~317 | Upload-based transcription provider. Buffers push-to-talk audio locally, uploads as WAV on release, returns finalized transcript. |
| `AppleSpeechTranscriptionProvider.swift` | ~147 | Local fallback transcription provider backed by Apple's Speech framework. |
| `BuddyAudioConversionSupport.swift` | ~108 | Audio conversion helpers. Converts live mic buffers to PCM16 mono audio and builds WAV payloads for upload-based providers. |
| `GlobalPushToTalkShortcutMonitor.swift` | ~132 | System-wide push-to-talk monitor. Owns the listen-only `CGEvent` tap and publishes press/release transitions. |
| `ClaudeAPI.swift` | ~291 | Claude vision API client with streaming (SSE) and non-streaming modes. TLS warmup optimization, image MIME detection, conversation history support. |
| `OpenAIAPI.swift` | ~142 | OpenAI GPT vision API client. |
| `ElevenLabsTTSClient.swift` | ~81 | ElevenLabs TTS client. Sends text to the Worker proxy, plays back audio via `AVAudioPlayer`. Exposes `isPlaying` for transient cursor scheduling. |
| `ElementLocationDetector.swift` | ~335 | Detects UI element locations in screenshots for cursor pointing. |
| `DesignSystem.swift` | ~880 | Design system tokens — colors, corner radii, shared styles. All UI references `DS.Colors`, `DS.CornerRadius`, etc. |
| `ClickyAnalytics.swift` | ~121 | PostHog analytics integration for usage tracking. |
| `WindowPositionManager.swift` | ~262 | Window placement logic, Screen Recording permission flow, and accessibility permission helpers. |
| `AppBundleConfiguration.swift` | ~28 | Runtime configuration reader for keys stored in the app bundle Info.plist. |
| `round-voice-437d/src/index.ts` | ~653 | Production Cloudflare Worker for Essora browser SDK. Routes include `/health`, `/ai/chat`, `/voice/stt-token`, `/voice/stt-stream`, `/voice/stt`, `/voice/tts`, `/memory/save`, `/memory/load`, and `/telemetry/event`; proxies Gemini, Deepgram, Google TTS, ElevenLabs fallback, Upstash, PostHog, and Sentry. |
| `worker/src/index.ts` | ~142 | Legacy/local Cloudflare Worker proxy kept for compatibility during migration. |
| `clicky-web-sdk/src/core/ClickyClient.ts` | ~318 | Browser SDK coordinator. Owns lifecycle, hotkey handling, DOM context, voice/transcription, Claude streaming, TTS, overlay pointing, action planning, and public SDK methods. |
| `clicky-web-sdk/src/core/types.ts` | ~177 | Public browser SDK types: options, events, captured context, point commands, action definitions, and client interface. |
| `clicky-web-sdk/src/context/ContextCollector.ts` | ~52 | Browser context entry point. Captures DOM-first context and optional screenshots for Claude. |
| `clicky-web-sdk/src/context/DomSnapshot.ts` | ~148 | Extracts visible webapp UI, labels, roles, bounds, selectors, and interactive elements for reliable UI understanding. |
| `clicky-web-sdk/src/context/Redaction.ts` | ~77 | Redacts ignored/private elements and sensitive input values before context is sent to the Worker. |
| `clicky-web-sdk/src/api/ClaudeClient.ts` | ~144 | Browser Claude client. Builds SDK prompts, serializes context/screenshots/actions, and parses streaming SSE tokens. |
| `clicky-web-sdk/src/api/AssemblyAIClient.ts` | ~91 | Browser AssemblyAI websocket client using Worker-issued temp tokens. |
| `clicky-web-sdk/src/audio/MicCapture.ts` | ~82 | Browser mic capture with Web Audio, PCM16 conversion, and audio-level callbacks. |
| `clicky-web-sdk/src/overlay/OverlayRoot.ts` | ~32 | Shadow DOM overlay host for the in-page blue cursor. |
| `clicky-web-sdk/src/overlay/CursorOverlay.ts` | ~49 | Resolves point commands to DOM element bounds or viewport coordinates and animates the cursor. |
| `clicky-web-sdk/src/panel/PanelRoot.ts` | ~66 | Shadow DOM launcher/panel host with streaming response and action confirmation event wiring. |
| `clicky-web-sdk/src/actions/ActionPlanner.ts` | ~88 | Validates proposed actions, applies confirmation policy, and routes execution through host-registered actions. |
| `clicky-web-sdk/demo/index.html` | ~75 | Plain HTML SaaS demo app used to verify framework-agnostic SDK embedding. |
| `clicky-web-sdk/playwright.config.ts` | ~49 | Playwright browser validation config for the SDK demo. Runs Chromium against `http://127.0.0.1:5173/demo/`, captures trace/video/screenshots on failure, and writes JSON results for the evaluation report. |
| `clicky-web-sdk/e2e/fixtures/sdk-fixture.ts` | ~199 | Playwright SDK fixture. Loads the demo, waits for `clicky:ready`, reads Shadow DOM cursor/highlight geometry, captures SDK events, and exposes helpers for guide, voice, screenshot, diagnostics, scroll, and route-change validation. |
| `clicky-web-sdk/e2e/*.spec.ts` | ~424 | Browser evaluation specs for cursor animation, target lock, semantic graph, guide mode, voice waveform, onboarding, and screenshot/vision behavior. Live AI and display-capture checks are gated behind explicit environment flags. |
| `clicky-web-sdk/e2e/report.ts` | ~172 | Converts Playwright JSON output into `e2e/EVAL_REPORT.md`, summarizing animation quality, target lock accuracy, semantic graph coverage, voice, onboarding, screenshot vision, and known CI limitations. |

## Build & Run

```bash
# Open in Xcode
open leanring-buddy.xcodeproj

# Select the leanring-buddy scheme, set signing team, Cmd+R to build and run

# Known non-blocking warnings: Swift 6 concurrency warnings,
# deprecated onChange warning in OverlayWindow.swift. Do NOT attempt to fix these.
```

**Do NOT run `xcodebuild` from the terminal** — it invalidates TCC (Transparency, Consent, and Control) permissions and the app will need to re-request screen recording, accessibility, etc.

## Cloudflare Worker

```bash
cd worker
npm install

# Add secrets
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put ASSEMBLYAI_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY

# Deploy
npx wrangler deploy

# Local dev (create worker/.dev.vars with your keys)
npx wrangler dev
```

## Browser SDK

```bash
cd clicky-web-sdk
npm install
npm run dev
npm test
npm run test:e2e
npm run test:e2e:report
npm run build
```

The demo runs with Vite and initializes the SDK against `http://localhost:8787` by default, so run `worker` locally or change `workerBaseUrl` in `clicky-web-sdk/demo/main.ts`. The SDK build emits ESM, UMD, and declaration files into `clicky-web-sdk/dist/`.
Live AI Guide Mode e2e checks are skipped by default; run with `RUN_LIVE_AI_E2E=1` when the deployed Worker/model should be exercised. Browser display-capture checks are skipped by default; run with `RUN_DISPLAY_CAPTURE_E2E=1` when the local browser environment supports `getDisplayMedia` automation.

## Code Style & Conventions

### Terminal Logging

- Before running terminal commands for debugging, testing, builds, deploys, or inspections, create/use `logs/` at the repository root and write a timestamped transcript or command output log there.
- Log filenames should describe the command purpose, for example `20260528-013901-sdk-tests.log`.
- Keep logs out of the app runtime path; they are for debugging handoff and root-cause analysis.

### Variable and Method Naming

IMPORTANT: Follow these naming rules strictly. Clarity is the top priority.

- Be as clear and specific with variable and method names as possible
- **Optimize for clarity over concision.** A developer with zero context on the codebase should immediately understand what a variable or method does just from reading its name
- Use longer names when it improves clarity. Do NOT use single-character variable names
- Example: use `originalQuestionLastAnsweredDate` instead of `originalAnswered`
- When passing props or arguments to functions, keep the same names as the original variable. Do not shorten or abbreviate parameter names. If you have `currentCardData`, pass it as `currentCardData`, not `card` or `cardData`

### Code Clarity

- **Clear is better than clever.** Do not write functionality in fewer lines if it makes the code harder to understand
- Write more lines of code if additional lines improve readability and comprehension
- Make things so clear that someone with zero context would completely understand the variable names, method names, what things do, and why they exist
- When a variable or method name alone cannot fully explain something, add a comment explaining what is happening and why

### Swift/SwiftUI Conventions

- Use SwiftUI for all UI unless a feature is only supported in AppKit (e.g., `NSPanel` for floating windows)
- All UI state updates must be on `@MainActor`
- Use async/await for all asynchronous operations
- Comments should explain "why" not just "what", especially for non-obvious AppKit bridging
- AppKit `NSPanel`/`NSWindow` bridged into SwiftUI via `NSHostingView`
- All buttons must show a pointer cursor on hover
- For any interactive element, explicitly think through its hover behavior (cursor, visual feedback, and whether hover should communicate clickability)

### Do NOT

- Do not add features, refactor code, or make "improvements" beyond what was asked
- Do not add docstrings, comments, or type annotations to code you did not change
- Do not try to fix the known non-blocking warnings (Swift 6 concurrency, deprecated onChange)
- Do not rename the project directory or scheme (the "leanring" typo is intentional/legacy)
- Do not run `xcodebuild` from the terminal — it invalidates TCC permissions

## Git Workflow

- Branch naming: `feature/description` or `fix/description`
- Commit messages: imperative mood, concise, explain the "why" not the "what"
- Do not force-push to main

## Self-Update Instructions

<!-- AI agents: follow these instructions to keep this file accurate. -->

When you make changes to this project that affect the information in this file, update this file to reflect those changes. Specifically:

1. **New files**: Add new source files to the "Key Files" table with their purpose and approximate line count
2. **Deleted files**: Remove entries for files that no longer exist
3. **Architecture changes**: Update the architecture section if you introduce new patterns, frameworks, or significant structural changes
4. **Build changes**: Update build commands if the build process changes
5. **New conventions**: If the user establishes a new coding convention during a session, add it to the appropriate conventions section
6. **Line count drift**: If a file's line count changes significantly (>50 lines), update the approximate count in the Key Files table

Do NOT update this file for minor edits, bug fixes, or changes that don't affect the documented architecture or conventions.
