import { Logger } from "../utils/logger";

export class WorkerProxy {
  private readonly logger = new Logger("ClickyWorkerProxy", "info");

  constructor(
    private readonly workerBaseUrl: string,
    private readonly timeoutMilliseconds = 15000
  ) {}

  async getJson<ResponseBody>(path: string, init: RequestInit = {}): Promise<ResponseBody> {
    const requestUrl = this.createUrl(path);
    const startedAt = performance.now();
    let response: Response;
    try {
      response = await fetch(requestUrl, {
        ...init,
        method: "GET",
        signal: this.createTimeoutSignal(init.signal),
        headers: {
          ...init.headers
        }
      });
    } catch (error) {
      this.logger.error("GET failed", { url: requestUrl, error: String(error) });
      throw this.createNetworkError(requestUrl, error);
    }

    if (!response.ok) {
      this.logger.warn("GET non-200", { url: requestUrl, status: response.status });
      throw await this.createError(response);
    }

    this.logger.info("GET ok", { url: requestUrl, ms: Math.round(performance.now() - startedAt) });

    return (await response.json()) as ResponseBody;
  }

  async postJson<ResponseBody>(path: string, body: unknown, init: RequestInit = {}): Promise<ResponseBody> {
    const requestUrl = this.createUrl(path);
    const startedAt = performance.now();
    let response: Response;
    try {
      response = await fetch(requestUrl, {
        ...init,
        method: "POST",
        signal: this.createTimeoutSignal(init.signal),
        headers: {
          "content-type": "application/json",
          ...init.headers
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      this.logger.error("POST failed", { url: requestUrl, error: String(error) });
      throw this.createNetworkError(requestUrl, error);
    }

    if (!response.ok) {
      this.logger.warn("POST non-200", { url: requestUrl, status: response.status });
      throw await this.createError(response);
    }

    this.logger.info("POST ok", { url: requestUrl, ms: Math.round(performance.now() - startedAt) });

    return (await response.json()) as ResponseBody;
  }

  async postBinary(path: string, body: unknown, init: RequestInit = {}): Promise<ArrayBuffer> {
    const requestUrl = this.createUrl(path);
    const startedAt = performance.now();
    let response: Response;
    try {
      response = await fetch(requestUrl, {
        ...init,
        method: "POST",
        signal: this.createTimeoutSignal(init.signal),
        headers: {
          "content-type": "application/json",
          ...init.headers
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      this.logger.error("POST binary failed", { url: requestUrl, error: String(error) });
      throw this.createNetworkError(requestUrl, error);
    }

    if (!response.ok) {
      this.logger.warn("POST binary non-200", { url: requestUrl, status: response.status });
      throw await this.createError(response);
    }

    this.logger.info("POST binary ok", { url: requestUrl, ms: Math.round(performance.now() - startedAt) });

    return await response.arrayBuffer();
  }

  async fetchStream(path: string, body: unknown, init: RequestInit = {}): Promise<ReadableStream<Uint8Array>> {
    const requestUrl = this.createUrl(path);
    const startedAt = performance.now();
    let response: Response;
    try {
      response = await fetch(requestUrl, {
        ...init,
        method: "POST",
        signal: this.createTimeoutSignal(init.signal),
        headers: {
          "content-type": "application/json",
          ...init.headers
        },
        body: JSON.stringify(body)
      });
    } catch (error) {
      this.logger.error("POST stream failed", { url: requestUrl, error: String(error) });
      throw this.createNetworkError(requestUrl, error);
    }

    if (!response.ok) {
      this.logger.warn("POST stream non-200", { url: requestUrl, status: response.status });
      throw await this.createError(response);
    }

    if (!response.body) {
      throw new Error("Worker response did not include a stream body");
    }

    this.logger.info("POST stream ok", { url: requestUrl, ms: Math.round(performance.now() - startedAt) });
    return response.body;
  }

  private createUrl(path: string): string {
    return `${this.workerBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  }

  private async createError(response: Response): Promise<Error> {
    const errorText = await response.text().catch(() => "");
    return new Error(`Worker request failed with ${response.status}: ${errorText || response.statusText}`);
  }

  private createNetworkError(requestUrl: string, error: unknown): Error {
    const reason = error instanceof Error ? error.message : String(error);
    return new Error(`Could not reach Clicky Worker at ${requestUrl}. ${reason}`);
  }

  private createTimeoutSignal(existingSignal: AbortSignal | null | undefined): AbortSignal {
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      abortController.abort(new Error(`Request timed out after ${this.timeoutMilliseconds}ms`));
    }, this.timeoutMilliseconds);

    const cleanupTimeout = () => window.clearTimeout(timeoutId);
    abortController.signal.addEventListener("abort", cleanupTimeout, { once: true });

    if (existingSignal) {
      if (existingSignal.aborted) {
        abortController.abort(existingSignal.reason);
      } else {
        existingSignal.addEventListener("abort", () => abortController.abort(existingSignal.reason), { once: true });
      }
    }

    return abortController.signal;
  }
}
