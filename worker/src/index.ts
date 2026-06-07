/**
 * Clicky Edge Orchestration Worker
 *
 * Hybrid adapter for the browser-native SDK. It exposes the production route
 * contract while keeping the original Clicky routes alive during migration.
 */

interface Env {
  ANTHROPIC_API_KEY?: string;
  ASSEMBLYAI_API_KEY?: string;
  DEEPGRAM_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_VOICE_ID?: string;
  GOOGLE_CLOUD_PROJECT_ID?: string;
  GOOGLE_APPLICATION_CREDENTIALS_JSON?: string;
  UPSTASH_REDIS_REST_URL?: string;
  UPSTASH_REDIS_REST_TOKEN?: string;
  POSTHOG_API_KEY?: string;
  SENTRY_DSN?: string;
}

type ClickyRequestContext = {
  requestId: string;
  route: string;
  startedAt: number;
};

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

const corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization,x-clicky-session-id,x-clicky-tenant-id,x-clicky-user-id",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const requestContext: ClickyRequestContext = {
      requestId: crypto.randomUUID(),
      route: url.pathname,
      startedAt: Date.now(),
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (url.pathname === "/health") {
        return jsonResponse(createHealthReport(env, requestContext));
      }

      if (!["GET", "POST"].includes(request.method)) {
        return jsonResponse({ error: "Method not allowed", requestId: requestContext.requestId }, 405);
      }

      if (url.pathname === "/ai/chat" || url.pathname === "/chat") {
        return await handleChat(request, env, requestContext);
      }

      if (url.pathname === "/voice/stt" || url.pathname === "/transcribe-token") {
        return await handleSpeechToTextToken(env, requestContext);
      }

      if (url.pathname === "/voice/tts" || url.pathname === "/tts") {
        return await handleTextToSpeech(request, env, requestContext);
      }

      if (url.pathname === "/memory/save") {
        return await handleMemorySave(request, env, requestContext);
      }

      if (url.pathname === "/memory/load") {
        return await handleMemoryLoad(request, env, requestContext);
      }

      if (url.pathname === "/telemetry/event") {
        return await handleTelemetryEvent(request, env, requestContext);
      }

      return jsonResponse({ error: "Not found", requestId: requestContext.requestId }, 404);
    } catch (error) {
      await reportSentryError(env, requestContext, error);
      return jsonResponse(
        {
          error: error instanceof Error ? error.message : String(error),
          requestId: requestContext.requestId,
          route: requestContext.route,
        },
        500
      );
    }
  },
};

function createHealthReport(env: Env, requestContext: ClickyRequestContext) {
  return {
    ok: true,
    requestId: requestContext.requestId,
    route: requestContext.route,
    timestamp: new Date().toISOString(),
    providers: {
      chat: env.GOOGLE_CLOUD_PROJECT_ID && env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? "configured" : "missing",
      fallbackChat: env.ANTHROPIC_API_KEY ? "configured" : "missing",
      stt: env.DEEPGRAM_API_KEY ? "configured" : env.ASSEMBLYAI_API_KEY ? "assemblyai-compat" : "missing",
      tts: env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID ? "configured" : "missing",
      memory: env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN ? "configured" : "missing",
      telemetry: env.POSTHOG_API_KEY ? "configured" : "missing",
      monitoring: env.SENTRY_DSN ? "configured" : "missing",
    },
  };
}

async function handleChat(request: Request, env: Env, requestContext: ClickyRequestContext): Promise<Response> {
  const requestBody = await request.json<Record<string, unknown>>();

  if (env.GOOGLE_CLOUD_PROJECT_ID && env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const response = await callGemini(requestBody, env);
    await captureTelemetry(env, "ai_chat_completed", requestContext, { provider: "gemini", ok: response.ok });
    return response;
  }

  if (env.ANTHROPIC_API_KEY) {
    const response = await callAnthropic(requestBody, env);
    await captureTelemetry(env, "ai_chat_completed", requestContext, { provider: "anthropic", ok: response.ok });
    return response;
  }

  return jsonResponse(
    {
      error: "No chat provider configured. Add GOOGLE_CLOUD_PROJECT_ID + GOOGLE_APPLICATION_CREDENTIALS_JSON or ANTHROPIC_API_KEY.",
      requestId: requestContext.requestId,
    },
    503
  );
}

async function callGemini(requestBody: Record<string, unknown>, env: Env): Promise<Response> {
  const accessToken = await getGoogleAccessToken(env);
  const projectId = env.GOOGLE_CLOUD_PROJECT_ID!;
  const location = "us-central1";
  const model = "gemini-1.5-flash-002";
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:streamGenerateContent?alt=sse`;

  const geminiRequest = convertClickyChatToGemini(requestBody);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(geminiRequest),
  });

  if (!response.ok) {
    return proxyErrorResponse(response);
  }

  return new Response(convertGeminiSseToAnthropicSse(response.body), {
    status: 200,
    headers: {
      ...corsHeaders,
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}

async function callAnthropic(requestBody: Record<string, unknown>, env: Env): Promise<Response> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    return proxyErrorResponse(response);
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      ...corsHeaders,
      "content-type": response.headers.get("content-type") || "text/event-stream",
      "cache-control": "no-cache",
    },
  });
}

async function handleSpeechToTextToken(env: Env, requestContext: ClickyRequestContext): Promise<Response> {
  if (env.DEEPGRAM_API_KEY) {
    const tokenResponse = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        authorization: `Token ${env.DEEPGRAM_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ ttl_seconds: 300 }),
    });

    if (!tokenResponse.ok) {
      return proxyErrorResponse(tokenResponse);
    }

    const tokenData = await tokenResponse.json<{ access_token?: string; token?: string }>();
    const temporaryToken = tokenData.access_token ?? tokenData.token;
    if (!temporaryToken) {
      return jsonResponse({ error: "Deepgram token response did not include a temporary token" }, 502);
    }

    await captureTelemetry(env, "stt_token_created", requestContext, { provider: "deepgram" });
    return jsonResponse({
      provider: "deepgram",
      token: temporaryToken,
      websocketUrl: "wss://api.deepgram.com/v1/listen?model=nova-2&encoding=linear16&sample_rate=16000&channels=1&interim_results=true&smart_format=true",
      expiresInSeconds: 300,
      requestId: requestContext.requestId,
    });
  }

  if (env.ASSEMBLYAI_API_KEY) {
    const response = await fetch("https://streaming.assemblyai.com/v3/token?expires_in_seconds=480", {
      method: "GET",
      headers: { authorization: env.ASSEMBLYAI_API_KEY },
    });

    if (!response.ok) {
      return proxyErrorResponse(response);
    }

    const data = await response.json<Record<string, unknown>>();
    return jsonResponse({ ...data, provider: "assemblyai", requestId: requestContext.requestId });
  }

  return jsonResponse({ error: "No STT provider configured", requestId: requestContext.requestId }, 503);
}

async function handleTextToSpeech(request: Request, env: Env, requestContext: ClickyRequestContext): Promise<Response> {
  if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_VOICE_ID) {
    return jsonResponse({ error: "ElevenLabs is not configured", requestId: requestContext.requestId }, 503);
  }

  const body = await request.text();
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${env.ELEVENLABS_VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": env.ELEVENLABS_API_KEY,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body,
  });

  await captureTelemetry(env, "tts_requested", requestContext, { ok: response.ok });

  if (!response.ok) {
    return proxyErrorResponse(response);
  }

  return new Response(response.body, {
    status: response.status,
    headers: {
      ...corsHeaders,
      "content-type": response.headers.get("content-type") || "audio/mpeg",
    },
  });
}

async function handleMemorySave(request: Request, env: Env, requestContext: ClickyRequestContext): Promise<Response> {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return jsonResponse({ ok: false, degraded: true, error: "Upstash Redis is not configured", requestId: requestContext.requestId }, 503);
  }

  const body = await request.json<Record<string, unknown>>();
  const memoryKey = createMemoryKey(body);
  await upstashRequest(env, ["SET", memoryKey, JSON.stringify(body), "EX", "604800"]);
  await captureTelemetry(env, "memory_saved", requestContext, { memoryKey });
  return jsonResponse({ ok: true, memoryKey, requestId: requestContext.requestId });
}

async function handleMemoryLoad(request: Request, env: Env, requestContext: ClickyRequestContext): Promise<Response> {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return jsonResponse({ ok: false, degraded: true, error: "Upstash Redis is not configured", value: null, requestId: requestContext.requestId }, 503);
  }

  const body = await request.json<Record<string, unknown>>();
  const memoryKey = createMemoryKey(body);
  const value = await upstashRequest(env, ["GET", memoryKey]);
  await captureTelemetry(env, "memory_loaded", requestContext, { memoryKey, hit: Boolean(value?.result) });
  return jsonResponse({
    ok: true,
    memoryKey,
    value: typeof value?.result === "string" ? JSON.parse(value.result) : null,
    requestId: requestContext.requestId,
  });
}

async function handleTelemetryEvent(request: Request, env: Env, requestContext: ClickyRequestContext): Promise<Response> {
  const body = await request.json<Record<string, unknown>>();
  await captureTelemetry(env, String(body.eventName || "sdk_event"), requestContext, body.properties ?? {});
  return jsonResponse({ ok: true, requestId: requestContext.requestId });
}

function convertClickyChatToGemini(requestBody: Record<string, unknown>) {
  const system = typeof requestBody.system === "string" ? requestBody.system : "";
  const messages = Array.isArray(requestBody.messages) ? requestBody.messages : [];
  const contents = messages.map((message) => {
    const messageRecord = message as Record<string, unknown>;
    const role = messageRecord.role === "assistant" ? "model" : "user";
    const content = messageRecord.content;
    const text = Array.isArray(content)
      ? content
          .map((part) => {
            const partRecord = part as Record<string, unknown>;
            return partRecord.type === "text" ? String(partRecord.text ?? "") : "[image omitted in MVP adapter]";
          })
          .join("\n")
      : String(content ?? "");

    return { role, parts: [{ text }] };
  });

  return {
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: Number(requestBody.max_tokens ?? 1400),
    },
  };
}

function convertGeminiSseToAnthropicSse(body: ReadableStream<Uint8Array> | null): ReadableStream<Uint8Array> {
  const textEncoder = new TextEncoder();
  const textDecoder = new TextDecoder();
  const reader = body?.getReader();
  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      if (!reader) {
        controller.close();
        return;
      }

      while (true) {
        const readResult = await reader.read();
        if (readResult.done) {
          if (buffer.trim()) {
            enqueueGeminiEvents(buffer, controller, textEncoder);
          }
          controller.enqueue(textEncoder.encode("event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n"));
          controller.close();
          return;
        }

        buffer += textDecoder.decode(readResult.value, { stream: true });
        const chunks = buffer.split(/\n\n/);
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          enqueueGeminiEvents(chunk, controller, textEncoder);
        }

        return;
      }
    },
  });
}

function enqueueGeminiEvents(chunk: string, controller: ReadableStreamDefaultController<Uint8Array>, textEncoder: TextEncoder) {
  const dataLines = chunk
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .filter((line) => line && line !== "[DONE]");

  for (const dataLine of dataLines) {
    try {
      const parsed = JSON.parse(dataLine) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = parsed.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
      if (text) {
        controller.enqueue(
          textEncoder.encode(
            `event: content_block_delta\ndata: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text } })}\n\n`
          )
        );
      }
    } catch {
      // Skip malformed upstream chunks and keep the stream alive.
    }
  }
}

async function getGoogleAccessToken(env: Env): Promise<string> {
  const credentials = JSON.parse(env.GOOGLE_APPLICATION_CREDENTIALS_JSON!) as ServiceAccountCredentials;
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: credentials.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: credentials.token_uri || "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  );
  const signature = await signRs256(`${header}.${payload}`, credentials.private_key);
  const assertion = `${header}.${payload}.${signature}`;

  const response = await fetch(credentials.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token request failed: ${await response.text()}`);
  }

  const data = await response.json<{ access_token: string }>();
  return data.access_token;
}

async function signRs256(input: string, privateKeyPem: string): Promise<string> {
  const keyData = pemToArrayBuffer(privateKeyPem);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(input));
  return base64UrlEncode(signature);
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalizedPem = pem.replace(/\\n/g, "\n");
  const base64 = normalizedPem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function base64UrlEncode(value: string | ArrayBuffer): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function upstashRequest(env: Env, command: unknown[]): Promise<{ result?: string | null }> {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Upstash Redis is not configured");
  }

  const response = await fetch(env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    throw new Error(`Upstash request failed: ${await response.text()}`);
  }

  return await response.json<{ result?: string | null }>();
}

async function captureTelemetry(
  env: Env,
  eventName: string,
  requestContext: ClickyRequestContext,
  properties: Record<string, unknown>
): Promise<void> {
  if (!env.POSTHOG_API_KEY) {
    return;
  }

  await fetch("https://app.posthog.com/capture/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: env.POSTHOG_API_KEY,
      event: eventName,
      distinct_id: String(properties.userId || properties.sessionId || requestContext.requestId),
      properties: {
        ...properties,
        requestId: requestContext.requestId,
        route: requestContext.route,
        durationMs: Date.now() - requestContext.startedAt,
      },
    }),
  }).catch(() => undefined);
}

async function reportSentryError(env: Env, requestContext: ClickyRequestContext, error: unknown): Promise<void> {
  if (!env.SENTRY_DSN) {
    return;
  }

  const sentryUrl = createSentryStoreUrl(env.SENTRY_DSN);
  if (!sentryUrl) {
    return;
  }

  await fetch(sentryUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event_id: requestContext.requestId.replace(/-/g, "").slice(0, 32),
      timestamp: new Date().toISOString(),
      platform: "javascript",
      level: "error",
      logger: "clicky-worker",
      message: error instanceof Error ? error.message : String(error),
      tags: { route: requestContext.route },
    }),
  }).catch(() => undefined);
}

function createSentryStoreUrl(dsn: string): string | undefined {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace("/", "");
    return `${url.protocol}//${url.host}/api/${projectId}/store/?sentry_key=${url.username}`;
  } catch {
    return undefined;
  }
}

function createMemoryKey(body: Record<string, unknown>): string {
  const tenantId = String(body.tenantId || "default-tenant");
  const sessionId = String(body.sessionId || "default-session");
  const userId = String(body.userId || "anonymous");
  return `clicky:${tenantId}:${userId}:${sessionId}`;
}

async function proxyErrorResponse(response: Response): Promise<Response> {
  const errorBody = await response.text();
  return jsonResponse({ error: errorBody || response.statusText }, response.status);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json",
    },
  });
}
