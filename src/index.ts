export interface Env {
  GOOGLE_CLOUD_PROJECT_ID: string;
  GOOGLE_APPLICATION_CREDENTIALS_JSON: string;
  DEEPGRAM_API_KEY: string;
  ELEVENLABS_API_KEY: string;
  UPSTASH_REDIS_REST_URL: string;
  UPSTASH_REDIS_REST_TOKEN: string;
  POSTHOG_API_KEY: string;
  SENTRY_DSN: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,x-clicky-session-id,x-clicky-tenant-id,x-clicky-user-id",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      if (url.pathname === "/") {
        return jsonResponse({
          success: true,
          routes: {
            health: "/health",
            chat: "/ai/chat",
            stt: "/voice/stt",
            sttToken: "/voice/stt-token",
            sttStream: "/voice/stt-stream",
            tts: "/voice/tts",
            memorySave: "/memory/save",
            memoryLoad: "/memory/load",
            telemetry: "/telemetry/event",
          },
        });
      }

      if (url.pathname === "/health") {
        return jsonResponse({
          success: true,
          services: {
            vertex: !!env.GOOGLE_CLOUD_PROJECT_ID,
            deepgram: !!env.DEEPGRAM_API_KEY,
            elevenlabs: !!env.ELEVENLABS_API_KEY,
            redis: !!env.UPSTASH_REDIS_REST_URL,
            redisToken: !!env.UPSTASH_REDIS_REST_TOKEN,
            posthog: !!env.POSTHOG_API_KEY,
            sentry: !!env.SENTRY_DSN,
          },
        });
      }

      if (url.pathname === "/ai/chat") {
        if (request.method !== "POST") {
          return jsonResponse(
            {
              success: false,
              error: "Use POST with JSON body: { message: string }",
            },
            { status: 405 }
          );
        }

        const credentials = JSON.parse(
          env.GOOGLE_APPLICATION_CREDENTIALS_JSON
        );

        const jwt = await createJWT(credentials);

        const tokenResponse = await fetch(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
              assertion: jwt,
            }),
          }
        );

        const tokenData: any = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        const body: any = await request.json();

        const vertexResponse = await fetch(
          `https://us-central1-aiplatform.googleapis.com/v1/projects/${env.GOOGLE_CLOUD_PROJECT_ID}/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: body.message || "Hello",
                    },
                  ],
                },
              ],
            }),
          }
        );

        const result = await vertexResponse.json();

        return jsonResponse({
          success: true,
          result,
        });
      }

      if (url.pathname === "/voice/stt-token") {
        const deepgramTokenResponse = await fetch("https://api.deepgram.com/v1/auth/grant", {
          method: "POST",
          headers: {
            Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        if (!deepgramTokenResponse.ok) {
          const upstreamError = await deepgramTokenResponse.text().catch(() => "");
          const websocketProtocol = url.protocol === "https:" ? "wss:" : "ws:";
          return jsonResponse({
            success: true,
            provider: "deepgram-proxy",
            token: "",
            websocketUrl: `${websocketProtocol}//${url.host}/voice/stt-stream`,
            degraded: true,
            fallbackReason: "Deepgram temporary token grant unavailable; using Worker WebSocket proxy.",
            upstreamStatus: deepgramTokenResponse.status,
            upstreamError: upstreamError.slice(0, 300),
          });
        }

        const deepgramTokenData = (await deepgramTokenResponse.json()) as {
          access_token?: string;
          token?: string;
        };
        const temporaryToken = deepgramTokenData.access_token ?? deepgramTokenData.token;

        if (!temporaryToken) {
          return jsonResponse(
            {
              success: false,
              error: "Deepgram did not return a temporary token.",
            },
            { status: 502 }
          );
        }

        return jsonResponse({
          success: true,
          token: temporaryToken,
          provider: "deepgram",
          websocketUrl: "wss://api.deepgram.com/v1/listen"
        });
      }

      if (url.pathname === "/voice/stt-stream") {
        return handleDeepgramStreamingProxy(request, url, env);
      }

      if (url.pathname === "/voice/stt") {
        if (request.method !== "POST") {
          return methodNotAllowed("POST");
        }

        const body = await readJsonBody(request);
        const audioBase64 = body.audioBase64;
        const contentType = body.contentType || "audio/wav";

        if (!audioBase64) {
          return jsonResponse(
            {
              success: false,
              error: "Missing audioBase64 in request body.",
            },
            { status: 400 }
          );
        }

        const audioBuffer = base64ToArrayBuffer(audioBase64);

        const deepgramResponse = await fetch(
          "https://api.deepgram.com/v1/listen",
          {
            method: "POST",
            headers: {
              Authorization: `Token ${env.DEEPGRAM_API_KEY}`,
              "Content-Type": contentType,
            },
            body: audioBuffer,
          }
        );

        const deepgramResult = await deepgramResponse.json();

        return jsonResponse({
          success: true,
          result: deepgramResult,
        });
      }

      if (url.pathname === "/voice/tts") {
        if (request.method !== "POST") {
          return methodNotAllowed("POST");
        }

        const body = await readJsonBody(request);
        const text = body.text;
        const voiceId = body.voiceId;
        const modelId = body.modelId || "eleven_flash_v2_5";
        const googleLanguageCode = body.googleLanguageCode || "en-US";
        const googleVoiceName = body.googleVoiceName;

        if (!text) {
          return jsonResponse(
            {
              success: false,
              error: "Missing text in request body.",
            },
            { status: 400 }
          );
        }

        const googleTtsAudio = await synthesizeGoogleTts(
          text,
          googleLanguageCode,
          googleVoiceName,
          env
        );
        if (googleTtsAudio) {
          return new Response(googleTtsAudio, {
            status: 200,
            headers: {
              ...corsHeaders,
              "Content-Type": "audio/mpeg",
            },
          });
        }

        if (voiceId) {
          const elevenLabsAudio = await synthesizeElevenLabsTts(
            text,
            voiceId,
            modelId,
            env
          );
          if (elevenLabsAudio) {
            return new Response(elevenLabsAudio, {
              status: 200,
              headers: {
                ...corsHeaders,
                "Content-Type": "audio/mpeg",
              },
            });
          }
        }

        return jsonResponse(
          {
            success: false,
            error: "TTS failed for both Google and ElevenLabs.",
          },
          { status: 502 }
        );
      }

      if (url.pathname === "/memory/save") {
        if (request.method !== "POST") {
          return methodNotAllowed("POST");
        }

        const body = await readJsonBody(request);
        const key = body.key;
        const value =
          typeof body.value === "string"
            ? body.value
            : JSON.stringify(body.value ?? null);

        if (!key) {
          return jsonResponse(
            {
              success: false,
              error: "Missing key in request body.",
            },
            { status: 400 }
          );
        }

        const upstashUrl =
          `${env.UPSTASH_REDIS_REST_URL}/set/` +
          `${encodeURIComponent(key)}/` +
          `${encodeURIComponent(value)}`;

        const upstashResponse = await fetch(upstashUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
          },
        });

        const upstashResult = await upstashResponse.json();

        return jsonResponse({
          success: true,
          result: upstashResult,
        });
      }

      if (url.pathname === "/memory/load") {
        if (request.method !== "POST") {
          return methodNotAllowed("POST");
        }

        const body = await readJsonBody(request);
        const key = body.key;

        if (!key) {
          return jsonResponse(
            {
              success: false,
              error: "Missing key in request body.",
            },
            { status: 400 }
          );
        }

        const upstashUrl =
          `${env.UPSTASH_REDIS_REST_URL}/get/` +
          `${encodeURIComponent(key)}`;

        const upstashResponse = await fetch(upstashUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
          },
        });

        const upstashResult = await upstashResponse.json();

        return jsonResponse({
          success: true,
          result: upstashResult,
        });
      }

      if (url.pathname === "/telemetry/event") {
        if (request.method !== "POST") {
          return methodNotAllowed("POST");
        }

        const body = await readJsonBody(request);
        const posthogEvent = body.posthogEvent;
        const sentryEnvelope = body.sentryEnvelope;

        if (!posthogEvent && !sentryEnvelope) {
          return jsonResponse(
            {
              success: false,
              error: "Missing posthogEvent or sentryEnvelope in request body.",
            },
            { status: 400 }
          );
        }

        const results: Record<string, unknown> = {};

        if (posthogEvent) {
          const posthogResponse = await fetch(
            "https://app.posthog.com/capture/",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                api_key: env.POSTHOG_API_KEY,
                ...posthogEvent,
              }),
            }
          );

          results.posthogStatus = posthogResponse.status;
        }

        if (sentryEnvelope) {
          const sentryEnvelopeUrl = buildSentryEnvelopeUrl(
            env.SENTRY_DSN
          );

          const sentryResponse = await fetch(sentryEnvelopeUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-sentry-envelope",
            },
            body: sentryEnvelope,
          });

          results.sentryStatus = sentryResponse.status;
        }

        return jsonResponse({
          success: true,
          result: results,
        });
      }

      return new Response("Not Found", {
        status: 404,
        headers: corsHeaders,
      });
    } catch (error) {
      return jsonResponse({
        success: false,
        error: String(error),
      });
    }
  },
};

async function createJWT(credentials: any) {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const payload = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();

  const toBase64Url = (obj: any) =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const unsignedToken =
    `${toBase64Url(header)}.${toBase64Url(payload)}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(credentials.private_key),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(unsignedToken)
  );

  const signed = btoa(
    String.fromCharCode(...new Uint8Array(signature))
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return `${unsignedToken}.${signed}`;
}

function pemToArrayBuffer(pem: string) {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

function methodNotAllowed(expectedMethod: string) {
  return jsonResponse(
    {
      success: false,
      error: `Use ${expectedMethod} for this endpoint.`,
    },
    { status: 405 }
  );
}

function jsonResponse(
  body: unknown,
  init: ResponseInit = {}
): Response {
  return Response.json(body, {
    ...init,
    headers: {
      ...corsHeaders,
      ...(init.headers ?? {}),
    },
  });
}

function handleDeepgramStreamingProxy(
  request: Request,
  url: URL,
  env: Env
): Response {
  if (request.headers.get("Upgrade") !== "websocket") {
    return jsonResponse(
      {
        success: false,
        error: "Use a WebSocket connection for /voice/stt-stream.",
      },
      { status: 426 }
    );
  }

  const sampleRate = url.searchParams.get("sample_rate") || "16000";
  const deepgramUrl = new URL("wss://api.deepgram.com/v1/listen");
  deepgramUrl.searchParams.set("model", "nova-2");
  deepgramUrl.searchParams.set("encoding", "linear16");
  deepgramUrl.searchParams.set("sample_rate", sampleRate);
  deepgramUrl.searchParams.set("channels", "1");
  deepgramUrl.searchParams.set("interim_results", "true");
  deepgramUrl.searchParams.set("smart_format", "true");

  const webSocketPair = new WebSocketPair();
  const [clientSocket, workerSocket] = Object.values(webSocketPair);
  workerSocket.accept();

  const deepgramSocket = new WebSocket(deepgramUrl.toString(), [
    "token",
    env.DEEPGRAM_API_KEY,
  ]);
  const queuedAudioFrames: Array<string | ArrayBuffer> = [];

  workerSocket.addEventListener("message", (event) => {
    if (deepgramSocket.readyState === WebSocket.OPEN) {
      deepgramSocket.send(event.data);
      return;
    }

    if (event.data instanceof ArrayBuffer || typeof event.data === "string") {
      queuedAudioFrames.push(event.data);
    }
  });

  workerSocket.addEventListener("close", () => {
    if (
      deepgramSocket.readyState === WebSocket.OPEN ||
      deepgramSocket.readyState === WebSocket.CONNECTING
    ) {
      deepgramSocket.close();
    }
  });

  workerSocket.addEventListener("error", () => {
    if (
      deepgramSocket.readyState === WebSocket.OPEN ||
      deepgramSocket.readyState === WebSocket.CONNECTING
    ) {
      deepgramSocket.close();
    }
  });

  deepgramSocket.addEventListener("open", () => {
    while (queuedAudioFrames.length > 0) {
      const audioFrame = queuedAudioFrames.shift();
      if (audioFrame !== undefined) {
        deepgramSocket.send(audioFrame);
      }
    }
  });

  deepgramSocket.addEventListener("message", (event) => {
    if (workerSocket.readyState === WebSocket.OPEN) {
      workerSocket.send(event.data);
    }
  });

  deepgramSocket.addEventListener("close", () => {
    if (workerSocket.readyState === WebSocket.OPEN) {
      workerSocket.close();
    }
  });

  deepgramSocket.addEventListener("error", () => {
    if (workerSocket.readyState === WebSocket.OPEN) {
      workerSocket.close(1011, "Deepgram websocket error");
    }
  });

  return new Response(null, {
    status: 101,
    webSocket: clientSocket,
  });
}

async function readJsonBody(
  request: Request
): Promise<Record<string, any>> {
  try {
    return (await request.json()) as Record<string, any>;
  } catch {
    return {};
  }
}

function base64ToArrayBuffer(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

function buildSentryEnvelopeUrl(dsn: string) {
  const parsed = new URL(dsn);
  const projectId = parsed.pathname.replace("/", "");

  return `${parsed.protocol}//${parsed.host}/api/${projectId}/envelope/`;
}

async function synthesizeGoogleTts(
  text: string,
  languageCode: string,
  voiceName: string | undefined,
  env: Env
): Promise<ArrayBuffer | null> {
  try {
    const credentials = JSON.parse(
      env.GOOGLE_APPLICATION_CREDENTIALS_JSON
    );
    const jwt = await createJWT(credentials);

    const tokenResponse = await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: jwt,
        }),
      }
    );

    if (!tokenResponse.ok) {
      return null;
    }

    const tokenData: any = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const googleTtsResponse = await fetch(
      "https://texttospeech.googleapis.com/v1/text:synthesize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode,
            ...(voiceName ? { name: voiceName } : {}),
          },
          audioConfig: {
            audioEncoding: "MP3",
          },
        }),
      }
    );

    if (!googleTtsResponse.ok) {
      return null;
    }

    const googleTtsResult =
      (await googleTtsResponse.json()) as {
        audioContent: string;
      };
    return base64ToArrayBuffer(googleTtsResult.audioContent);
  } catch {
    return null;
  }
}

async function synthesizeElevenLabsTts(
  text: string,
  voiceId: string,
  modelId: string,
  env: Env
): Promise<ArrayBuffer | null> {
  try {
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
        }),
      }
    );

    if (!ttsResponse.ok) {
      return null;
    }

    return await ttsResponse.arrayBuffer();
  } catch {
    return null;
  }
}
