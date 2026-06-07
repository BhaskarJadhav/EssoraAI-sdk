import { expect, getPointElementId, rectDrift, test } from "./fixtures/sdk-fixture";

async function forceLocalGuidance(page: import("@playwright/test").Page): Promise<void> {
  await page.route("**/ai/chat", (route) => route.abort("failed"));
}

async function waitOneAnimationFrame(page: import("@playwright/test").Page): Promise<void> {
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
}

test.describe("target lock", () => {
  test("highlight follows element on scroll with under 4px drift", async ({ page, sdk }) => {
    await forceLocalGuidance(page);

    const cursorPointingPromise = sdk.waitForEvent("cursor:pointing", 10_000);
    void sdk.sendText("find the search button");
    const event = await cursorPointingPromise;
    const targetId = getPointElementId(event);
    await waitOneAnimationFrame(page);

    await sdk.scrollPage(120);

    await expect
      .poll(async () => {
        const highlightRect = await sdk.getHighlightRect();
        const targetRect = await sdk.getTargetRect(targetId);
        return Math.max(Math.abs(highlightRect.top - targetRect.top), Math.abs(highlightRect.left - targetRect.left));
      })
      .toBeLessThan(4);
  });

  test("highlight survives resize with under 4px drift", async ({ page, sdk }) => {
    await forceLocalGuidance(page);

    const cursorPointingPromise = sdk.waitForEvent("cursor:pointing", 10_000);
    void sdk.sendText("find the dashboard navigation");
    const event = await cursorPointingPromise;
    const targetId = getPointElementId(event);
    await page.setViewportSize({ width: 800, height: 600 });

    await expect
      .poll(async () => {
        const highlightRect = await sdk.getHighlightRect();
        const targetRect = await sdk.getTargetRect(targetId);
        return rectDrift(highlightRect, targetRect);
      })
      .toBeLessThan(4);
  });

  test("route change keeps lock when the target still exists", async ({ page, sdk }) => {
    await forceLocalGuidance(page);

    const cursorPointingPromise = sdk.waitForEvent("cursor:pointing", 10_000);
    void sdk.sendText("find the search button");
    const event = await cursorPointingPromise;
    const targetId = getPointElementId(event);
    await sdk.triggerRouteChange("/other-page");
    await page.waitForTimeout(600);

    const highlightRect = await sdk.getHighlightRect();
    const targetRect = await sdk.getTargetRect(targetId);
    expect(rectDrift(highlightRect, targetRect)).toBeLessThan(4);
  });

  test("target-lost event fires on element removal", async ({ page, sdk }) => {
    await forceLocalGuidance(page);

    const cursorPointingPromise = sdk.waitForEvent("cursor:pointing", 10_000);
    void sdk.sendText("find the create invoice button");
    await cursorPointingPromise;
    const targetLostPromise = sdk.waitForEvent("cursor:target-lost", 2_000);
    await page.evaluate(() => document.querySelector("[data-target='create-invoice']")?.remove());
    await targetLostPromise;
  });
});
