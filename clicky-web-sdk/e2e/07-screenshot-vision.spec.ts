import { expect, test } from "./fixtures/sdk-fixture";

const displayCaptureEnabled = process.env.RUN_DISPLAY_CAPTURE_E2E === "1";

test.describe("screenshot vision", () => {
  test("screenshot capture succeeds", async ({ sdk }) => {
    test.skip(!displayCaptureEnabled, "set RUN_DISPLAY_CAPTURE_E2E=1 to run browser display-capture validation");
    await sdk.gotoDemo("tts=0&screenshotMode=user-triggered");

    const capturedEventPromise = sdk.waitForEvent("screenshot:captured", 8_000);
    void sdk.triggerScreenshot();
    const event = await capturedEventPromise;
    expect(event.payload.screenshot.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(event.payload.screenshot.width).toBeLessThanOrEqual(1280);
  });

  test("screenshot attaches to the next chat request when enabled", async ({ page, sdk }) => {
    test.skip(!displayCaptureEnabled, "set RUN_DISPLAY_CAPTURE_E2E=1 to run browser display-capture validation");
    await sdk.gotoDemo("tts=0&screenshotMode=user-triggered");

    const capturedEventPromise = sdk.waitForEvent("screenshot:captured", 8_000);
    void sdk.triggerScreenshot();
    await capturedEventPromise;

    let requestBody = "";
    await page.route("**/ai/chat", async (route) => {
      requestBody = route.request().postData() ?? "";
      await route.abort("failed");
    });

    void sdk.sendText("what do you see on my screen");
    await sdk.waitForEvent("provider:degraded", 10_000);
    expect(requestBody).toContain("\"screenshots\":[{");
    expect(requestBody).toContain("\"mimeType\":\"image/jpeg\"");
  });

  test("screenshot is off by default", async ({ page, sdk }) => {
    let requestBody = "";
    await page.route("**/ai/chat", async (route) => {
      requestBody = route.request().postData() ?? "";
      await route.abort("failed");
    });

    const degradedEventPromise = sdk.waitForEvent("provider:degraded", 10_000);
    void sdk.sendText("help me find the search bar");
    await degradedEventPromise;
    expect(requestBody).toMatch(/\\?"screenshots\\?"\s*:\s*\[\]/);
    expect(requestBody).not.toMatch(/\\?"screenshots\\?"\s*:\s*\[\s*\{/);
  });

  test("denied capture degrades gracefully", async ({ page, sdk }) => {
    await sdk.gotoDemo("tts=0&screenshotMode=user-triggered");
    await page.evaluate(() => {
      navigator.mediaDevices.getDisplayMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    });

    const deniedEventPromise = sdk.waitForEvent("screenshot:denied", 3_000);
    void sdk.triggerScreenshot();
    const deniedEvent = await deniedEventPromise;
    expect(deniedEvent.payload.error.message).toContain("denied");
  });
});
