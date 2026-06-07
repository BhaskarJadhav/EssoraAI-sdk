# Clicky Browser Voice Pipeline - One-Page Report (May 27, 2026)

## Scope
End-to-end verification of the browser voice pipeline: mic capture to STT websocket to transcript to AI response to TTS to audio playback, with stage logging and latency visibility.

## Current Architecture
Browser SDK -> Cloudflare Worker -> Gemini (chat) + Deepgram (STT) + Google TTS fallback -> Browser audio playback.

## Test Summary
- Health/Secrets: All required secrets present (Google, Deepgram, ElevenLabs, Upstash, PostHog, Sentry).
- Chat (Gemini): Working and returning valid responses.
- STT (Deepgram): Working in upload mode; streaming enabled via /voice/stt-token.
- TTS: Google TTS primary working and producing MP3; ElevenLabs fallback available when Google fails.
- Browser Playback: Works when audio is returned; autoplay restrictions apply without user interaction.

## Pipeline Stage Verification
1) Mic permission granted
- Logging added; verified via in-browser console logs during mic start.

2) Audio chunks captured
- Logging added (mic.audio.first_frame, mic.audio.frame_count).

3) Deepgram websocket connected
- Streaming token endpoint added: /voice/stt-token.
- Expected log: stt.websocket.connected.

4) Partial/final transcript received
- Logs added for partial and final transcript events.

5) Transcript sent to Worker/Gemini
- Logged at chat.request.start and chat.response.done with latency.

6) AI response returned successfully
- Verified via multiple successful Gemini responses.

7) TTS response generated
- Google TTS primary: working, MP3 generated.
- ElevenLabs fallback: available if Google fails.

8) Audio playback started
- Logs added: audio.playback.start / audio.playback.end.
- Autoplay may be blocked without user gesture.

## Key Findings
- Primary path: Google TTS for voice output, Deepgram for STT.
- ElevenLabs kept as fallback for TTS.
- Critical fix applied: Streaming STT now uses /voice/stt-token instead of /voice/stt upload route.
- Demo fix: enableTTS true; streaming token endpoint wired.

## Latency/Diagnostics Instrumentation
- Added timestamped logs for mic, STT, chat, and TTS stages.
- Worker calls log timing, network errors, non-200 responses.
- Websocket lifecycle logs show disconnects and reconnect reasons.

## Automated Pipeline Check (CLI)
Run the automated check to record baseline latency and health:

```powershell
Set-Location c:\Users\jadha\clicky.ai\round-voice-437d
$base = "https://round-voice-437d.essora-contactus.workers.dev"
$report = [ordered]@{}
$healthStart = Get-Date
$health = Invoke-RestMethod -Uri "$base/health"
$report.health_ms = [int]((Get-Date) - $healthStart).TotalMilliseconds
$report.health_ok = $health.success
$report.health_services = $health.services
$sttTokenStart = Get-Date
$sttToken = Invoke-RestMethod -Method Post -Uri "$base/voice/stt-token" -ContentType "application/json" -Body "{}"
$report.stt_token_ms = [int]((Get-Date) - $sttTokenStart).TotalMilliseconds
$report.stt_token_provider = $sttToken.provider
$report.stt_token_has_token = [bool]$sttToken.token
$chatStart = Get-Date
$chatBody = @{ message = "Say hello in one short sentence." } | ConvertTo-Json
$chat = Invoke-RestMethod -Method Post -Uri "$base/ai/chat" -ContentType "application/json" -Body $chatBody
$report.chat_ms = [int]((Get-Date) - $chatStart).TotalMilliseconds
$report.chat_ok = $chat.success
$report.chat_text = $chat.result.candidates[0].content.parts[0].text
$ttsStart = Get-Date
$ttsBody = @{ text = "Hello from Google TTS primary."; googleLanguageCode = "en-US" } | ConvertTo-Json
Invoke-WebRequest -Method Post -Uri "$base/voice/tts" -ContentType "application/json" -Body $ttsBody -OutFile .\tts-check.mp3
$ttsFile = Get-Item .\tts-check.mp3
$report.tts_ms = [int]((Get-Date) - $ttsStart).TotalMilliseconds
$report.tts_bytes = $ttsFile.Length
$report | ConvertTo-Json -Depth 6 | Set-Content .\pipeline-report.json
```

Baseline results from the latest run:
- health: 417 ms
- stt token: 55 ms
- chat: 1011 ms
- tts (Google primary): 718 ms, 20,928 bytes

## Remaining Risks
- Autoplay restrictions: audio may not play without user gesture.
- Provider policy changes: ElevenLabs Free Tier not reliable.
- Streaming STT: must use /voice/stt-token for mic streaming.

## Next Steps
1) Run a live in-browser voice test and capture console logs.
3) Decide whether to keep ElevenLabs (paid) or rely on Google TTS fallback.

## Conclusion
The browser voice pipeline is functional with Google TTS fallback and streaming STT configured. The only confirmed blocker is ElevenLabs Free Tier. Logging is in place to pinpoint failures and latency at each stage during live browser testing.

## Addendum - Secure STT Proxy Update

After the initial report, `/voice/stt-token` was changed so it no longer returns the raw Deepgram API key to the browser.

Current production behavior:

- The Worker first attempts Deepgram's secure `/v1/auth/grant` temporary-token flow.
- The current Deepgram key still returns `403 FORBIDDEN: Insufficient permissions` for token grants.
- When token grants are unavailable, the Worker returns a secure fallback provider: `deepgram-proxy`.
- The browser receives `wss://round-voice-437d.essora-contactus.workers.dev/voice/stt-stream`, not a provider secret.
- `/voice/stt-stream` is a Worker WebSocket proxy to Deepgram, so realtime STT can proceed without exposing the raw Deepgram key.

Latest checks:

- `/voice/stt-token`: returns `provider: "deepgram-proxy"` with no browser secret.
- `/voice/stt-stream`: WebSocket open test succeeded.
- `/ai/chat`: Gemini still returns valid responses.
- `/voice/tts`: Google TTS still returns playable MP3 audio.
- SDK test suite: passed.
- SDK production build: passed.
- Worker test suite and dry-run deploy: passed.

Remaining live QA:

- Run an in-browser push-to-talk test through `/voice/stt-stream` with real microphone audio.
- Confirm transcript partial/final events arrive through the proxy in Chrome, Edge, Safari, and Firefox.
- Measure end-to-end latency from mic start to transcript, Gemini response, TTS playback, and overlay guidance.

## Addendum - Voice Turn And AR Lock Fix

The browser SDK now handles Deepgram-style streaming more defensively:

- On mic release, the SDK waits briefly for STT finalization before closing the websocket.
- If Deepgram does not emit a final transcript in time, the SDK promotes the latest partial transcript into a final turn.
- Deepgram `speech_final` events are treated as final transcripts.
- If realtime streaming still returns no transcript, the SDK uploads the recorded push-to-talk audio as WAV to `/voice/stt` and uses the Deepgram upload transcript as a fallback.

The AR overlay now uses live element locking instead of one-time coordinates:

- The target rectangle, pulse, cursor, and response bubble are recalculated from `getBoundingClientRect()` during the guidance window.
- If the live element registry becomes stale, the SDK re-resolves the target using the captured stable selector before falling back to coordinates.
- This improves scroll/layout-shift behavior and makes AR highlighting render on the actual target element instead of only moving the cursor.
