import { describe, expect, it } from "vitest";
import { ActionExecutor } from "../actions/ActionExecutor";
import { ElementRegistry } from "../context/ElementRegistry";

describe("action execution safeguards", () => {
  it("rejects missing required parameters", () => {
    const executor = new ActionExecutor(new ElementRegistry());
    expect(() =>
      executor.createProposedAction(
        {
          id: "focusElement",
          name: "Focus element",
          description: "Focus element",
          parametersSchema: {
            type: "object",
            required: ["elementId"]
          },
          async execute() {
            return { ok: true };
          }
        },
        {}
      )
    ).toThrow("missing required");
  });

  it("rejects sensitive parameters by default", () => {
    const executor = new ActionExecutor(new ElementRegistry());
    expect(() =>
      executor.createProposedAction(
        {
          id: "fillInput",
          name: "Fill input",
          description: "Fill input",
          parametersSchema: {
            type: "object"
          },
          async execute() {
            return { ok: true };
          }
        },
        { password: "secret" }
      )
    ).toThrow("sensitive");
  });
});
