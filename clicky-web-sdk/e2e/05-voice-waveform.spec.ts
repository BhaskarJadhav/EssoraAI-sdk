import { expect, test } from "./fixtures/sdk-fixture";

test.describe("voice waveform", () => {
  test("mic:level event fires during recording", async ({ sdk }) => {
    await sdk.startListening();
    await expect.poll(async () => (await sdk.getEvents("mic:level")).length, { timeout: 4_000 }).toBeGreaterThanOrEqual(5);
    await sdk.stopListening();

    const levelEvents = await sdk.getEvents("mic:level");
    expect(levelEvents.length).toBeGreaterThanOrEqual(5);
    for (const event of levelEvents) {
      expect(event.payload.level).toBeGreaterThanOrEqual(0);
      expect(event.payload.level).toBeLessThanOrEqual(1);
    }
  });

  test("mic:silent fires after sustained silent input", async ({ page, sdk }) => {
    await page.evaluate(() => {
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      (window as any).__originalGetUserMedia = originalGetUserMedia;
      navigator.mediaDevices.getUserMedia = async () => {
        const audioContext = new AudioContext();
        const destination = audioContext.createMediaStreamDestination();
        return destination.stream;
      };
    });

    await sdk.startListening();
    const silentEvent = await sdk.waitForEvent("mic:silent", 4_500);
    await sdk.stopListening();
    expect(silentEvent.payload.durationMs).toBeGreaterThanOrEqual(3_000);
  });

  test("permission denied state is emitted", async ({ page, sdk }) => {
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    });

    const deniedEventPromise = sdk.waitForEvent("mic:permission-denied", 3_000);
    void sdk.startListening();
    const deniedEvent = await deniedEventPromise;
    expect(deniedEvent.payload.error.message).toContain("Microphone permission");
  });
});
