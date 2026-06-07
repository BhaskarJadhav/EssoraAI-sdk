import { describe, expect, it } from "vitest";
import { parseActionTag } from "../parsing/ActionTagParser";
import { parsePointTag } from "../parsing/PointTagParser";
import { cleanAssistantResponse } from "../parsing/ResponseCleaner";

describe("response parsing", () => {
  it("parses element point tags", () => {
    const result = parsePointTag("Click the save button. [POINT:clicky-element-1:save]");
    expect(result.spokenText).toBe("Click the save button.");
    expect(result.pointCommand).toEqual({ type: "element", elementId: "clicky-element-1", label: "save" });
  });

  it("parses element point tags without labels", () => {
    const result = parsePointTag("Click the save button. [POINT:clicky-element-1]");
    expect(result.spokenText).toBe("Click the save button.");
    expect(result.pointCommand).toEqual({ type: "element", elementId: "clicky-element-1", label: undefined });
  });

  it("parses coordinate point tags", () => {
    const result = parsePointTag("It's over here. [POINT:120,240:search]");
    expect(result.pointCommand).toEqual({ type: "coordinate", x: 120, y: 240, label: "search" });
  });

  it("parses coordinate point tags without labels", () => {
    const result = parsePointTag("It's over here. [POINT:120,240]");
    expect(result.spokenText).toBe("It's over here.");
    expect(result.pointCommand).toEqual({ type: "coordinate", x: 120, y: 240, label: undefined });
  });

  it("parses action tags after point tags", () => {
    const result = cleanAssistantResponse('Done. [POINT:none] [ACTION:focusElement:{"elementId":"abc"}]');
    expect(result.spokenText).toBe("Done.");
    expect(result.pointCommand).toEqual({ type: "none" });
    expect(result.proposedAction).toEqual({ actionId: "focusElement", parameters: { elementId: "abc" } });
  });

  it("ignores malformed action payloads", () => {
    const result = parseActionTag("Nope [ACTION:focusElement:{bad]");
    expect(result.cleanedText).toBe("Nope");
    expect(result.proposedAction).toBeUndefined();
  });
});
