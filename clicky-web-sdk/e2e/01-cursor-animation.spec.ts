import { expect, getPointElementId, rectCenter, test } from "./fixtures/sdk-fixture";

async function forceLocalGuidance(page: import("@playwright/test").Page): Promise<void> {
  await page.route("**/ai/chat", (route) => route.abort("failed"));
}

test.describe("cursor animation", () => {
  test("cursor flies to target and lands near the target center", async ({ page, sdk }) => {
    await forceLocalGuidance(page);
    const before = await sdk.getCursorPosition();

    const cursorPointingPromise = sdk.waitForEvent("cursor:pointing", 10_000);
    void sdk.sendText("find the search button");
    const event = await cursorPointingPromise;
    const targetRect = await sdk.getTargetRect(getPointElementId(event));
    await page.waitForTimeout(1_500);

    const after = await sdk.getCursorPosition();
    const targetCenter = rectCenter(targetRect);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(20);
    expect(Math.hypot(after.x - targetCenter.x, after.y - targetCenter.y)).toBeLessThanOrEqual(20);
  });

  test("cursor fades after transient inactivity", async ({ page, sdk }) => {
    await sdk.gotoDemo("tts=0&transient=1");
    await forceLocalGuidance(page);

    const cursorPointingPromise = sdk.waitForEvent("cursor:pointing", 10_000);
    const taskEndedPromise = sdk.waitForEvent("task:ended", 10_000);
    void sdk.sendText("find the dashboard navigation");
    await cursorPointingPromise;
    await taskEndedPromise;
    await page.waitForTimeout(1_250);

    const cursor = await sdk.getCursorPosition();
    expect(Number(cursor.opacity)).toBeLessThanOrEqual(0.01);
  });

  test("reduced motion reaches target without a visible flight delay", async ({ page, sdk }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await forceLocalGuidance(page);

    const cursorPointingPromise = sdk.waitForEvent("cursor:pointing", 10_000);
    void sdk.sendText("find the create invoice button");
    const event = await cursorPointingPromise;
    const targetRect = await sdk.getTargetRect(getPointElementId(event));
    const cursor = await sdk.getCursorPosition();
    const targetCenter = rectCenter(targetRect);

    expect(Math.hypot(cursor.x - targetCenter.x, cursor.y - targetCenter.y)).toBeLessThanOrEqual(20);
  });

  test("cursor has an arrival bob while pointing", async ({ page, sdk }) => {
    await forceLocalGuidance(page);

    const cursorPointingPromise = sdk.waitForEvent("cursor:pointing", 10_000);
    void sdk.sendText("find the billing navigation");
    await cursorPointingPromise;
    await page.waitForTimeout(100);
    const firstPosition = await sdk.getCursorPosition();
    await page.waitForTimeout(700);
    const secondPosition = await sdk.getCursorPosition();

    const yDelta = Math.abs(secondPosition.y - firstPosition.y);
    expect(yDelta).toBeGreaterThanOrEqual(1);
    expect(yDelta).toBeLessThanOrEqual(8);
  });
});
