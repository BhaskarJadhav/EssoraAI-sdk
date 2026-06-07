import type { NormalizedClickyOptions } from "../core/types";
import { WorkerProxy } from "./WorkerProxy";

export class TelemetryClient {
  constructor(
    private readonly workerProxy: WorkerProxy,
    private readonly options: NormalizedClickyOptions
  ) {}

  async capture(eventName: string, properties: Record<string, unknown> = {}): Promise<void> {
    if (!this.options.telemetryEnabled) {
      return;
    }

    await this.workerProxy.postJson(this.options.apiRoutes.telemetryEvent, {
      eventName,
      posthogEvent: {
        event: eventName,
        distinctId: this.options.userId || this.options.sessionId,
        properties: {
          ...properties,
          tenantId: this.options.tenantId,
          userId: this.options.userId,
          sessionId: this.options.sessionId,
          appName: this.options.appName,
          environment: this.options.environment
        }
      },
      properties: {
        ...properties,
        tenantId: this.options.tenantId,
        userId: this.options.userId,
        sessionId: this.options.sessionId,
        appName: this.options.appName,
        environment: this.options.environment
      }
    });
  }
}
