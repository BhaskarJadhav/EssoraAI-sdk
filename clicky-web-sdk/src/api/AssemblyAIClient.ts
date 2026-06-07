import { EventBus } from "../core/EventBus";
import type { NormalizedClickyOptions } from "../core/types";
import { WorkerProxy } from "./WorkerProxy";
import { Logger } from "../utils/logger";

type AssemblyAITokenResponse = {
  token: string;
  provider?: "assemblyai" | "deepgram" | "deepgram-proxy";
  websocketUrl?: string;
};

export class AssemblyAIClient {
  private websocket?: WebSocket;
  private readonly logger = new Logger("ClickySTT", "info");
  private partialCount = 0;
  private finalCount = 0;
  private latestTranscript = "";
  private latestFinalTranscript = "";
  private provider: AssemblyAITokenResponse["provider"];
  private providerChangedHandler?: (provider: string) => void;

  constructor(
    private readonly workerProxy: WorkerProxy,
    private readonly eventBus: EventBus,
    private readonly options: NormalizedClickyOptions
  ) {}

  async connect(sampleRate: number): Promise<void> {
    this.logger.info("stt.connect.start", { sampleRate });
    const tokenResponse = await this.workerProxy.postJson<AssemblyAITokenResponse>(this.options.apiRoutes.sttToken, {});
    this.provider = tokenResponse.provider;
    this.providerChangedHandler?.(tokenResponse.provider ?? "assemblyai");
    this.latestTranscript = "";
    this.latestFinalTranscript = "";
    this.partialCount = 0;
    this.finalCount = 0;
    const websocketUrl =
      tokenResponse.provider === "deepgram" || tokenResponse.provider === "deepgram-proxy"
        ? this.createDeepgramWebsocketUrl(tokenResponse, sampleRate)
        : this.createAssemblyAIWebsocketUrl(tokenResponse, sampleRate);

    this.websocket = new WebSocket(websocketUrl);
    this.websocket.binaryType = "arraybuffer";
    this.websocket.onmessage = (event) => this.handleMessage(event);
    this.websocket.onerror = () => {
      this.logger.error("stt.websocket.error");
      this.eventBus.emit("error", { error: new Error("Speech websocket error") });
    };
    this.websocket.onclose = (event) => {
      this.logger.warn("stt.websocket.closed", { code: event.code, reason: event.reason || "unknown" });
    };

    await new Promise<void>((resolve, reject) => {
      if (!this.websocket) {
        reject(new Error("Speech websocket was not created"));
        return;
      }

      let didOpen = false;
      this.websocket.addEventListener("open", () => {
        didOpen = true;
        this.logger.info("stt.websocket.connected", { provider: tokenResponse.provider ?? "assemblyai" });
        resolve();
      });
      this.websocket.addEventListener("close", () => {
        if (!didOpen) {
          reject(new Error("Speech websocket closed before opening"));
        }
      });
    });
  }

  onProviderChanged(handler: (provider: string) => void): void {
    this.providerChangedHandler = handler;
  }

  sendAudioFrame(pcm16: Int16Array): void {
    if (this.websocket?.readyState !== WebSocket.OPEN) {
      return;
    }

    this.websocket.send(pcm16.buffer.slice(pcm16.byteOffset, pcm16.byteOffset + pcm16.byteLength));
  }

  close(): void {
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(JSON.stringify({ type: this.provider === "assemblyai" ? "Terminate" : "CloseStream" }));
    }
    this.websocket?.close();
    this.websocket = undefined;
    this.logger.info("stt.websocket.terminated");
  }

  async finishTurn(): Promise<void> {
    if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
      this.emitLatestTranscriptAsFinal("websocket not open");
      this.close();
      return;
    }

    this.websocket.send(JSON.stringify({ type: this.provider === "assemblyai" ? "Terminate" : "CloseStream" }));
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    this.emitLatestTranscriptAsFinal("finish timeout");
    this.websocket.close();
    this.websocket = undefined;
    this.logger.info("stt.websocket.finished");
  }

  private handleMessage(event: MessageEvent): void {
    if (typeof event.data !== "string") {
      return;
    }

    try {
      const message = JSON.parse(event.data) as {
        type?: string;
        transcript?: string;
        channel?: { alternatives?: Array<{ transcript?: string }> };
        is_final?: boolean;
        speech_final?: boolean;
      };

      const transcript = message.transcript ?? message.channel?.alternatives?.[0]?.transcript ?? "";
      if (!transcript) {
        return;
      }

      this.latestTranscript = transcript;
      if (message.type === "Turn" || message.type === "FinalTranscript" || message.is_final || message.speech_final) {
        this.latestFinalTranscript = transcript;
        this.finalCount += 1;
        this.logger.info("stt.transcript.final", { length: transcript.length, count: this.finalCount });
        this.eventBus.emit("transcript:final", { text: transcript });
      } else {
        this.partialCount += 1;
        if (this.partialCount % 5 === 0) {
          this.logger.info("stt.transcript.partial", { length: transcript.length, count: this.partialCount });
        }
        this.eventBus.emit("transcript:partial", { text: transcript });
      }
    } catch {
      this.logger.error("stt.message.parse_failed");
      this.eventBus.emit("error", { error: new Error("Could not parse AssemblyAI message") });
    }
  }

  private createAssemblyAIWebsocketUrl(tokenResponse: AssemblyAITokenResponse, sampleRate: number): URL {
    const websocketUrl = new URL("wss://streaming.assemblyai.com/v3/ws");
    websocketUrl.searchParams.set("sample_rate", String(sampleRate));
    websocketUrl.searchParams.set("formatted_finals", "true");
    websocketUrl.searchParams.set("token", tokenResponse.token);
    return websocketUrl;
  }

  private createDeepgramWebsocketUrl(tokenResponse: AssemblyAITokenResponse, sampleRate: number): URL {
    const websocketUrl = new URL(tokenResponse.websocketUrl ?? "wss://api.deepgram.com/v1/listen");
    websocketUrl.searchParams.set("sample_rate", String(sampleRate));
    if (tokenResponse.token) {
      websocketUrl.searchParams.set("token", tokenResponse.token);
    }
    return websocketUrl;
  }

  private emitLatestTranscriptAsFinal(reason: string): void {
    const transcript = (this.latestFinalTranscript || this.latestTranscript).trim();
    if (!transcript) {
      this.logger.warn("stt.transcript.flush_empty", { reason });
      return;
    }

    if (transcript === this.latestFinalTranscript && this.finalCount > 0) {
      return;
    }

    this.latestFinalTranscript = transcript;
    this.finalCount += 1;
    this.logger.info("stt.transcript.final.flush", { length: transcript.length, count: this.finalCount, reason });
    this.eventBus.emit("transcript:final", { text: transcript });
  }
}
