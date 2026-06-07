import { expect, getPointElementId, liveAiEnabled, test } from "./fixtures/sdk-fixture";

test.describe("guide mode", () => {
  test.skip(!liveAiEnabled, "set RUN_LIVE_AI_E2E=1 to run live Worker/model guide-mode validation");

  test("guide produces multiple steps", async ({ sdk }) => {
    void sdk.startGuide("fill out the customer search workflow");
    const event = await sdk.waitForEvent("guide:plan-ready", 15_000);

    expect(event.payload.steps.length).toBeGreaterThanOrEqual(2);
    for (const step of event.payload.steps) {
      expect(step.stepId).toBeTruthy();
      expect(step.instruction).toBeTruthy();
      expect(step.targetHint).toBeDefined();
    }
    await sdk.cancelGuide();
  });

  test("guide advances on stepCompleted", async ({ sdk }) => {
    void sdk.startGuide("review accounts and find the search field");
    const firstStepEvent = await sdk.waitForEvent("guide:step-active", 20_000);
    await sdk.stepCompleted();
    const secondStepEvent = await sdk.waitForEvent("guide:step-active", 20_000);

    expect(secondStepEvent.payload.step.stepId).not.toBe(firstStepEvent.payload.step.stepId);
    await sdk.cancelGuide();
  });

  test("guide points to a real target each step", async ({ sdk }) => {
    void sdk.startGuide("find the search field");
    await sdk.waitForEvent("guide:step-active", 20_000);
    const cursorEvent = await sdk.waitForEvent("cursor:pointing", 20_000);
    const targetId = getPointElementId(cursorEvent);

    const targetRect = await sdk.getTargetRect(targetId);
    expect(targetRect.width).toBeGreaterThan(0);
    await sdk.cancelGuide();
  });

  test("recovery fires after timeout", async ({ sdk }) => {
    void sdk.startGuide("complete checkout");
    await sdk.waitForEvent("guide:step-active", 20_000);
    const recoveryEvent = await sdk.waitForEvent("guide:recovering", 18_000);
    expect(recoveryEvent.payload.attempt).toBeGreaterThan(0);
    await sdk.cancelGuide();
  });

  test("cancelGuide stops the loop", async ({ sdk }) => {
    void sdk.startGuide("fill out the customer search workflow");
    await sdk.waitForEvent("guide:step-active", 20_000);
    await sdk.cancelGuide();
    await expect.poll(async () => (await sdk.getDiagnostics()).state).toBe("idle");
  });
});
