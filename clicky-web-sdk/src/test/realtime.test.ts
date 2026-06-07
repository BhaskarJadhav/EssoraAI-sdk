import { describe, expect, it, vi } from "vitest";
import { LocalGuidanceEngine } from "../core/LocalGuidanceEngine";
import type { ClickyCapturedContext } from "../core/types";
import { SemanticMapObserver } from "../context/SemanticMapObserver";

function createContext(): ClickyCapturedContext {
  return {
    semanticMapVersion: 1,
    appName: "Demo",
    tenantId: "tenant",
    userId: "user",
    sessionId: "session",
    url: "https://example.com",
    title: "Demo",
    viewport: { width: 1000, height: 800, scrollX: 0, scrollY: 0 },
    pageText: "Dashboard Create invoice Search",
    capturedAt: new Date().toISOString(),
    screenshots: [],
    semanticGraph: [],
    elements: [
      {
        id: "dashboard-id",
        tagName: "button",
        label: "Dashboard",
        text: "Dashboard",
        selector: "button:nth-of-type(1)",
        bounds: { x: 10, y: 10, width: 100, height: 40 },
        isInteractive: true
      }
    ]
  };
}

describe("realtime guidance", () => {
  it("creates a local fallback response with a point target", () => {
    const response = new LocalGuidanceEngine().createFallbackResponse(
      "where is the dashboard",
      createContext(),
      new Error("backend down")
    );

    expect(response).toContain("[POINT:dashboard-id:Dashboard]");
  });

  it("emits semantic changes from DOM mutations", async () => {
    document.body.innerHTML = "<main><button>Dashboard</button></main>";
    const onChanged = vi.fn();
    const observer = new SemanticMapObserver(onChanged);
    observer.start();
    document.body.querySelector("button")!.setAttribute("aria-label", "Main dashboard");
    await new Promise((resolve) => setTimeout(resolve, 180));
    observer.stop();
    expect(onChanged).toHaveBeenCalled();
  });
});
