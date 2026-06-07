import type { ClickyEventHandler, ClickyEventMap, ClickyEventName } from "./types";

export class EventBus {
  private readonly handlersByEventName = new Map<ClickyEventName, Set<ClickyEventHandler<ClickyEventName>>>();

  on<EventName extends ClickyEventName>(eventName: EventName, handler: ClickyEventHandler<EventName>): () => void {
    const handlers = this.handlersByEventName.get(eventName) ?? new Set();
    handlers.add(handler as ClickyEventHandler<ClickyEventName>);
    this.handlersByEventName.set(eventName, handlers);

    return () => {
      this.off(eventName, handler);
    };
  }

  off<EventName extends ClickyEventName>(eventName: EventName, handler: ClickyEventHandler<EventName>): void {
    const handlers = this.handlersByEventName.get(eventName);
    if (!handlers) {
      return;
    }
    handlers.delete(handler as ClickyEventHandler<ClickyEventName>);
    if (handlers.size === 0) {
      this.handlersByEventName.delete(eventName);
    }
  }

  emit<EventName extends ClickyEventName>(eventName: EventName, payload: ClickyEventMap[EventName]): void {
    const handlers = this.handlersByEventName.get(eventName);
    if (!handlers) {
      return;
    }

    for (const handler of Array.from(handlers)) {
      handler(payload as ClickyEventMap[ClickyEventName]);
    }
  }

  clear(): void {
    this.handlersByEventName.clear();
  }
}
