import type { ClickyConversationMessage, NormalizedClickyOptions } from "../core/types";
import { WorkerProxy } from "./WorkerProxy";

type MemoryPayload = {
  tenantId: string;
  userId: string;
  sessionId: string;
  conversationHistory: ClickyConversationMessage[];
};

export class MemoryClient {
  constructor(
    private readonly workerProxy: WorkerProxy,
    private readonly options: NormalizedClickyOptions
  ) {}

  async load(): Promise<MemoryPayload | null> {
    if (!this.options.memoryEnabled) {
      return null;
    }

    const response = await this.workerProxy.postJson<{ value: MemoryPayload | null }>(this.options.apiRoutes.memoryLoad, {
      key: this.createMemoryKey(),
      tenantId: this.options.tenantId,
      userId: this.options.userId,
      sessionId: this.options.sessionId
    });

    return response.value;
  }

  async save(conversationHistory: ClickyConversationMessage[]): Promise<void> {
    if (!this.options.memoryEnabled) {
      return;
    }

    await this.workerProxy.postJson(this.options.apiRoutes.memorySave, {
      key: this.createMemoryKey(),
      value: {
        tenantId: this.options.tenantId,
        userId: this.options.userId,
        sessionId: this.options.sessionId,
        conversationHistory
      },
      tenantId: this.options.tenantId,
      userId: this.options.userId,
      sessionId: this.options.sessionId,
      conversationHistory
    });
  }

  private createMemoryKey(): string {
    return `clicky:${this.options.tenantId}:${this.options.userId}:${this.options.sessionId}`;
  }
}
