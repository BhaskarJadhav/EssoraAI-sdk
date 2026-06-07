import { expect, test } from "./fixtures/sdk-fixture";

test.describe("semantic graph", () => {
  test("graph contains interactive elements with required fields", async ({ sdk }) => {
    const context = await sdk.captureContext();
    const graph = context.semanticGraph;

    expect(graph.some((node: any) => node.role === "button")).toBeTruthy();
    expect(graph.some((node: any) => node.role === "textbox")).toBeTruthy();
    expect(graph.some((node: any) => node.role === "link")).toBeTruthy();

    for (const node of graph.filter((candidateNode: any) => candidateNode.bounds.visible)) {
      expect(node.stableId).toBeTruthy();
      expect(node.role).toBeTruthy();
      expect(typeof node.name).toBe("string");
      expect(node.bounds.width).toBeGreaterThan(0);
      expect(node.bounds.height).toBeGreaterThan(0);
    }
  });

  test("stableId is deterministic across unchanged captures", async ({ sdk }) => {
    const firstContext = await sdk.captureContext();
    const secondContext = await sdk.captureContext();
    const secondStableIds = new Set(secondContext.semanticGraph.map((node: any) => node.stableId));

    for (const firstNode of firstContext.semanticGraph) {
      expect(secondStableIds.has(firstNode.stableId)).toBeTruthy();
    }
  });

  test("password fields are redacted from semantic graph", async ({ page, sdk }) => {
    await page.evaluate(() => {
      const passwordInput = document.createElement("input");
      passwordInput.type = "password";
      passwordInput.id = "test-password";
      passwordInput.value = "do-not-capture";
      document.body.appendChild(passwordInput);
    });

    const context = await sdk.captureContext();
    expect(JSON.stringify(context.semanticGraph)).not.toContain("test-password");
    expect(JSON.stringify(context)).not.toContain("do-not-capture");
  });

  test("semantic graph is capped at 120 nodes", async ({ page, sdk }) => {
    await page.evaluate(() => {
      for (let buttonIndex = 0; buttonIndex < 200; buttonIndex += 1) {
        const button = document.createElement("button");
        button.textContent = `stress button ${buttonIndex}`;
        document.body.appendChild(button);
      }
    });

    const context = await sdk.captureContext();
    expect(context.semanticGraph.length).toBeLessThanOrEqual(120);
  });
});
