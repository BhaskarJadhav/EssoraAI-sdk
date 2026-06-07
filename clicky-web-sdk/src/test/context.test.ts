import { describe, expect, it } from "vitest";
import { normalizeOptions } from "../core/Config";
import { ContextCollector } from "../context/ContextCollector";
import { ElementRegistry } from "../context/ElementRegistry";

describe("DOM context collection", () => {
  it("captures visible interactive elements and redacts private values", async () => {
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      return {
        x: 10,
        y: 10,
        width: 120,
        height: 32,
        top: 10,
        left: 10,
        right: 130,
        bottom: 42,
        toJSON: () => ({})
      };
    };

    document.body.innerHTML = `
      <main data-clicky-context="Billing page">
        <button data-clicky-label="Create invoice">New</button>
        <label for="search">Search</label>
        <input id="search" value="Northstar" />
        <input type="password" value="secret" />
        <div data-clicky-ignore><button>Ignore me</button></div>
      </main>
    `;

    const options = normalizeOptions({
      workerBaseUrl: "https://example.com",
      appName: "Demo"
    });
    const collector = new ContextCollector(options, new ElementRegistry());
    const context = await collector.capture();

    expect(context.elements.some((element) => element.label === "Create invoice")).toBe(true);
    expect(context.pageText).toContain("Billing page");
    expect(context.pageText).not.toContain("secret");
    expect(context.pageText).not.toContain("Ignore me");
  });
});
