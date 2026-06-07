# Clicky Web SDK

Browser-native Clicky AI for SaaS platforms. The SDK embeds a small in-app companion
that can listen, understand the current page, stream an AI response, speak aloud, point
at UI, and execute host-registered actions with safeguards.

```ts
import { ClickySDK } from "@clicky/web-sdk";

const clicky = ClickySDK.init({
  workerBaseUrl: "https://your-worker.example.workers.dev",
  appName: "Acme CRM",
  enableScreenshots: false,
  apiRoutes: {
    chat: "/ai/chat",
    sttToken: "/voice/stt",
    tts: "/voice/tts"
  }
});

clicky.registerAction({
  id: "focusElement",
  name: "Focus element",
  description: "Focus a known element by Clicky element id.",
  parametersSchema: {
    type: "object",
    required: ["elementId"],
    properties: {
      elementId: { type: "string" }
    }
  },
  async execute(parameters, context) {
    const element = context.elementRegistry.getElementById(String(parameters.elementId));
    if (element instanceof HTMLElement) {
      element.focus();
      return { ok: true, message: "Focused element" };
    }
    return { ok: false, message: "Element not found" };
  }
});
```

## Browser Boundaries

Clicky Web SDK is web-native. It cannot listen outside the focused page, draw outside
the DOM, silently capture screens, or inspect other apps. It uses DOM context first and
optional user-triggered screenshots when visual context is needed.

## Development

```bash
npm install
npm run dev
npm run build
npm test
```

For the demo, point the SDK at your deployed Worker:

```bash
$env:VITE_CLICKY_WORKER_BASE_URL="https://your-worker.example.workers.dev"
npm run dev
```
