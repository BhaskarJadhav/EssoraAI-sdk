import { describe, expect, it, vi } from "vitest";
import { EventBus } from "../core/EventBus";
import { StateMachine } from "../core/StateMachine";
import { normalizeOptions } from "../core/Config";

describe("core runtime", () => {
  it("normalizes required options with stable defaults", () => {
    const options = normalizeOptions({
      workerBaseUrl: "https://example.com/",
      appName: "Demo"
    });

    expect(options.workerBaseUrl).toBe("https://example.com");
    expect(options.enableVoice).toBe(true);
    expect(options.contextMode).toBe("dom-first");
  });

  it("emits typed events and unsubscribes", () => {
    const eventBus = new EventBus();
    const handler = vi.fn();
    const unsubscribe = eventBus.on("mic:start", handler);
    eventBus.emit("mic:start", undefined);
    unsubscribe();
    eventBus.emit("mic:start", undefined);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("guards invalid state transitions", () => {
    const stateMachine = new StateMachine(new EventBus());
    expect(() => stateMachine.setState("speaking")).toThrow();
    stateMachine.setState("listening");
    stateMachine.setState("transcribing");
    stateMachine.setState("capturing-context");
    expect(stateMachine.getState()).toBe("capturing-context");
  });
});
