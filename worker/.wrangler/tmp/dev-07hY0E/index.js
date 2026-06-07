var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-px94AZ/checked-fetch.js
var urls = /* @__PURE__ */ new Set();
function checkURL(request, init) {
  const url = request instanceof URL ? request : new URL(
    (typeof request === "string" ? new Request(request, init) : request).url
  );
  if (url.port && url.port !== "443" && url.protocol === "https:") {
    if (!urls.has(url.toString())) {
      urls.add(url.toString());
      console.warn(
        `WARNING: known issue with \`fetch()\` requests to custom HTTPS ports in published Workers:
 - ${url.toString()} - the custom port will be ignored when the Worker is published using the \`wrangler deploy\` command.
`
      );
    }
  }
}
__name(checkURL, "checkURL");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    const [request, init] = argArray;
    checkURL(request, init);
    return Reflect.apply(target, thisArg, argArray);
  }
});

// .wrangler/tmp/bundle-px94AZ/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/index.ts
var corsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type,authorization,x-clicky-session-id,x-clicky-tenant-id,x-clicky-user-id"
};
var src_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    const requestContext = {
      requestId: crypto.randomUUID(),
      route: url.pathname,
      startedAt: Date.now()
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
          route: requestContext.route
        },
        500
      );
    }
  }
};
function createHealthReport(env, requestContext) {
  return {
    ok: true,
    requestId: requestContext.requestId,
    route: requestContext.route,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    providers: {
      chat: env.GOOGLE_CLOUD_PROJECT_ID && env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? "configured" : "missing",
      fallbackChat: env.ANTHROPIC_API_KEY ? "configured" : "missing",
      stt: env.DEEPGRAM_API_KEY ? "configured" : env.ASSEMBLYAI_API_KEY ? "assemblyai-compat" : "missing",
      tts: env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID ? "configured" : "missing",
      memory: env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN ? "configured" : "missing",
      telemetry: env.POSTHOG_API_KEY ? "configured" : "missing",
      monitoring: env.SENTRY_DSN ? "configured" : "missing"
    }
  };
}
__name(createHealthReport, "createHealthReport");
async function handleChat(request, env, requestContext) {
  const requestBody = await request.json();
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
      requestId: requestContext.requestId
    },
    503
  );
}
__name(handleChat, "handleChat");
async function callGemini(requestBody, env) {
  const accessToken = await getGoogleAccessToken(env);
  const projectId = env.GOOGLE_CLOUD_PROJECT_ID;
  const location = "us-central1";
  const model = "gemini-1.5-flash-002";
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${model}:streamGenerateContent?alt=sse`;
  const geminiRequest = convertClickyChatToGemini(requestBody);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(geminiRequest)
  });
  if (!response.ok) {
    return proxyErrorResponse(response);
  }
  return new Response(convertGeminiSseToAnthropicSse(response.body), {
    status: 200,
    headers: {
      ...corsHeaders,
      "content-type": "text/event-stream",
      "cache-control": "no-cache"
    }
  });
}
__name(callGemini, "callGemini");
async function callAnthropic(requestBody, env) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify(requestBody)
  });
  if (!response.ok) {
    return proxyErrorResponse(response);
  }
  return new Response(response.body, {
    status: response.status,
    headers: {
      ...corsHeaders,
      "content-type": response.headers.get("content-type") || "text/event-stream",
      "cache-control": "no-cache"
    }
  });
}
__name(callAnthropic, "callAnthropic");
async function handleSpeechToTextToken(env, requestContext) {
  if (env.DEEPGRAM_API_KEY) {
    const tokenResponse = await fetch("https://api.deepgram.com/v1/auth/grant", {
      method: "POST",
      headers: {
        authorization: `Token ${env.DEEPGRAM_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ ttl_seconds: 300 })
    });
    if (!tokenResponse.ok) {
      return proxyErrorResponse(tokenResponse);
    }
    const tokenData = await tokenResponse.json();
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
      requestId: requestContext.requestId
    });
  }
  if (env.ASSEMBLYAI_API_KEY) {
    const response = await fetch("https://streaming.assemblyai.com/v3/token?expires_in_seconds=480", {
      method: "GET",
      headers: { authorization: env.ASSEMBLYAI_API_KEY }
    });
    if (!response.ok) {
      return proxyErrorResponse(response);
    }
    const data = await response.json();
    return jsonResponse({ ...data, provider: "assemblyai", requestId: requestContext.requestId });
  }
  return jsonResponse({ error: "No STT provider configured", requestId: requestContext.requestId }, 503);
}
__name(handleSpeechToTextToken, "handleSpeechToTextToken");
async function handleTextToSpeech(request, env, requestContext) {
  if (!env.ELEVENLABS_API_KEY || !env.ELEVENLABS_VOICE_ID) {
    return jsonResponse({ error: "ElevenLabs is not configured", requestId: requestContext.requestId }, 503);
  }
  const body = await request.text();
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${env.ELEVENLABS_VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": env.ELEVENLABS_API_KEY,
      "content-type": "application/json",
      accept: "audio/mpeg"
    },
    body
  });
  await captureTelemetry(env, "tts_requested", requestContext, { ok: response.ok });
  if (!response.ok) {
    return proxyErrorResponse(response);
  }
  return new Response(response.body, {
    status: response.status,
    headers: {
      ...corsHeaders,
      "content-type": response.headers.get("content-type") || "audio/mpeg"
    }
  });
}
__name(handleTextToSpeech, "handleTextToSpeech");
async function handleMemorySave(request, env, requestContext) {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return jsonResponse({ ok: false, degraded: true, error: "Upstash Redis is not configured", requestId: requestContext.requestId }, 503);
  }
  const body = await request.json();
  const memoryKey = createMemoryKey(body);
  await upstashRequest(env, ["SET", memoryKey, JSON.stringify(body), "EX", "604800"]);
  await captureTelemetry(env, "memory_saved", requestContext, { memoryKey });
  return jsonResponse({ ok: true, memoryKey, requestId: requestContext.requestId });
}
__name(handleMemorySave, "handleMemorySave");
async function handleMemoryLoad(request, env, requestContext) {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return jsonResponse({ ok: false, degraded: true, error: "Upstash Redis is not configured", value: null, requestId: requestContext.requestId }, 503);
  }
  const body = await request.json();
  const memoryKey = createMemoryKey(body);
  const value = await upstashRequest(env, ["GET", memoryKey]);
  await captureTelemetry(env, "memory_loaded", requestContext, { memoryKey, hit: Boolean(value?.result) });
  return jsonResponse({
    ok: true,
    memoryKey,
    value: typeof value?.result === "string" ? JSON.parse(value.result) : null,
    requestId: requestContext.requestId
  });
}
__name(handleMemoryLoad, "handleMemoryLoad");
async function handleTelemetryEvent(request, env, requestContext) {
  const body = await request.json();
  await captureTelemetry(env, String(body.eventName || "sdk_event"), requestContext, body.properties ?? {});
  return jsonResponse({ ok: true, requestId: requestContext.requestId });
}
__name(handleTelemetryEvent, "handleTelemetryEvent");
function convertClickyChatToGemini(requestBody) {
  const system = typeof requestBody.system === "string" ? requestBody.system : "";
  const messages = Array.isArray(requestBody.messages) ? requestBody.messages : [];
  const contents = messages.map((message) => {
    const messageRecord = message;
    const role = messageRecord.role === "assistant" ? "model" : "user";
    const content = messageRecord.content;
    const text = Array.isArray(content) ? content.map((part) => {
      const partRecord = part;
      return partRecord.type === "text" ? String(partRecord.text ?? "") : "[image omitted in MVP adapter]";
    }).join("\n") : String(content ?? "");
    return { role, parts: [{ text }] };
  });
  return {
    systemInstruction: system ? { parts: [{ text: system }] } : void 0,
    contents,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: Number(requestBody.max_tokens ?? 1400)
    }
  };
}
__name(convertClickyChatToGemini, "convertClickyChatToGemini");
function convertGeminiSseToAnthropicSse(body) {
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
          controller.enqueue(textEncoder.encode('event: message_stop\ndata: {"type":"message_stop"}\n\n'));
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
    }
  });
}
__name(convertGeminiSseToAnthropicSse, "convertGeminiSseToAnthropicSse");
function enqueueGeminiEvents(chunk, controller, textEncoder) {
  const dataLines = chunk.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice("data:".length).trim()).filter((line) => line && line !== "[DONE]");
  for (const dataLine of dataLines) {
    try {
      const parsed = JSON.parse(dataLine);
      const text = parsed.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
      if (text) {
        controller.enqueue(
          textEncoder.encode(
            `event: content_block_delta
data: ${JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text } })}

`
          )
        );
      }
    } catch {
    }
  }
}
__name(enqueueGeminiEvents, "enqueueGeminiEvents");
async function getGoogleAccessToken(env) {
  const credentials = JSON.parse(env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
  const now = Math.floor(Date.now() / 1e3);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: credentials.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: credentials.token_uri || "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now
    })
  );
  const signature = await signRs256(`${header}.${payload}`, credentials.private_key);
  const assertion = `${header}.${payload}.${signature}`;
  const response = await fetch(credentials.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    })
  });
  if (!response.ok) {
    throw new Error(`Google token request failed: ${await response.text()}`);
  }
  const data = await response.json();
  return data.access_token;
}
__name(getGoogleAccessToken, "getGoogleAccessToken");
async function signRs256(input, privateKeyPem) {
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
__name(signRs256, "signRs256");
function pemToArrayBuffer(pem) {
  const normalizedPem = pem.replace(/\\n/g, "\n");
  const base64 = normalizedPem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}
__name(pemToArrayBuffer, "pemToArrayBuffer");
function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
__name(base64UrlEncode, "base64UrlEncode");
async function upstashRequest(env, command) {
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Upstash Redis is not configured");
  }
  const response = await fetch(env.UPSTASH_REDIS_REST_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(command)
  });
  if (!response.ok) {
    throw new Error(`Upstash request failed: ${await response.text()}`);
  }
  return await response.json();
}
__name(upstashRequest, "upstashRequest");
async function captureTelemetry(env, eventName, requestContext, properties) {
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
        durationMs: Date.now() - requestContext.startedAt
      }
    })
  }).catch(() => void 0);
}
__name(captureTelemetry, "captureTelemetry");
async function reportSentryError(env, requestContext, error) {
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
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      platform: "javascript",
      level: "error",
      logger: "clicky-worker",
      message: error instanceof Error ? error.message : String(error),
      tags: { route: requestContext.route }
    })
  }).catch(() => void 0);
}
__name(reportSentryError, "reportSentryError");
function createSentryStoreUrl(dsn) {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace("/", "");
    return `${url.protocol}//${url.host}/api/${projectId}/store/?sentry_key=${url.username}`;
  } catch {
    return void 0;
  }
}
__name(createSentryStoreUrl, "createSentryStoreUrl");
function createMemoryKey(body) {
  const tenantId = String(body.tenantId || "default-tenant");
  const sessionId = String(body.sessionId || "default-session");
  const userId = String(body.userId || "anonymous");
  return `clicky:${tenantId}:${userId}:${sessionId}`;
}
__name(createMemoryKey, "createMemoryKey");
async function proxyErrorResponse(response) {
  const errorBody = await response.text();
  return jsonResponse({ error: errorBody || response.statusText }, response.status);
}
__name(proxyErrorResponse, "proxyErrorResponse");
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "content-type": "application/json"
    }
  });
}
__name(jsonResponse, "jsonResponse");

// node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-px94AZ/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-px94AZ/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
