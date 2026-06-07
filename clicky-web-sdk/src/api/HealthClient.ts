import type { ClickyHealthReport, NormalizedClickyOptions } from "../core/types";
import { WorkerProxy } from "./WorkerProxy";

export class HealthClient {
  constructor(
    private readonly workerProxy: WorkerProxy,
    private readonly options: NormalizedClickyOptions
  ) {}

  async check(): Promise<ClickyHealthReport> {
    try {
      const rawHealth = await this.workerProxy.getJson<
        ClickyHealthReport | { success?: boolean; services?: Record<string, boolean>; error?: string }
      >(this.options.apiRoutes.health);

      if (isProductionHealthReport(rawHealth)) {
        const services = rawHealth.services ?? {};
        return {
          ok: rawHealth.success ?? Object.values(services).every(Boolean),
          providers: Object.fromEntries(
            Object.entries(services).map(([serviceName, isConfigured]) => [serviceName, isConfigured ? "configured" : "missing"])
          ),
          error: rawHealth.error
        };
      }

      return rawHealth as ClickyHealthReport;
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

function isProductionHealthReport(
  healthReport: ClickyHealthReport | { success?: boolean; services?: Record<string, boolean>; error?: string }
): healthReport is { success?: boolean; services?: Record<string, boolean>; error?: string } {
  return "success" in healthReport || "services" in healthReport;
}
