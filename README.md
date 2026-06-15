# Essora AI Orchestration Worker

A Cloudflare Worker that provides a single edge API for conversational AI, voice processing, memory, and product telemetry.

Despite the repository name, the current codebase is the server-side orchestration layer used by an Essora client SDK. It keeps provider credentials off the client and exposes browser-friendly endpoints with CORS support.

## Capabilities

- AI chat through Google Vertex AI and Gemini
- Speech-to-text through Google Speech-to-Text with Deepgram fallback
- Streaming transcription through a Deepgram WebSocket proxy
- Text-to-speech through Google Cloud TTS with ElevenLabs fallback
- Key-value memory backed by Upstash Redis
- PostHog and Sentry telemetry forwarding
- Cloudflare Worker health and service-availability reporting

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/` | List available routes |
| `GET` | `/health` | Report configured provider integrations |
| `POST` | `/ai/chat` | Generate an AI response from a message |
| `POST` | `/voice/stt` | Transcribe base64-encoded audio |
| `GET` | `/voice/stt-token` | Request temporary or proxied streaming access |
| `WS` | `/voice/stt-stream` | Stream audio to Deepgram through the Worker |
| `POST` | `/voice/tts` | Synthesize speech as MP3 audio |
| `POST` | `/memory/save` | Store a value by key |
| `POST` | `/memory/load` | Retrieve a stored value |
| `POST` | `/telemetry/event` | Forward PostHog or Sentry events |

## Local development

```bash
npm install
npm run dev
```

Run the test suite with:

```bash
npm test
```

## Configuration

Create Worker secrets for the integrations you plan to use:

```text
GOOGLE_CLOUD_PROJECT_ID
GOOGLE_APPLICATION_CREDENTIALS_JSON
DEEPGRAM_API_KEY
ELEVENLABS_API_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
POSTHOG_API_KEY
SENTRY_DSN
```

Use `wrangler secret put <NAME>` for sensitive values. Never commit credentials to the repository.

## Deployment

```bash
npm run deploy
```

The Worker uses the configuration in `wrangler.jsonc`. Confirm the compatibility date and required Cloudflare account settings before deploying.

## Production checklist

Before exposing the API publicly, add request authentication, tenant-level authorization, rate limiting, input-size limits, and stricter production CORS rules.
