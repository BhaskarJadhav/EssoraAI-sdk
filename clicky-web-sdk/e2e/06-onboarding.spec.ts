import { expect, test } from "./fixtures/sdk-fixture";

async function clickOnboardingButton(page: import("@playwright/test").Page, label: string): Promise<void> {
  await page.evaluate((buttonLabel) => {
    const root = document.querySelector<HTMLElement>(".clicky-panel-host")?.shadowRoot;
    const buttons = Array.from(root?.querySelectorAll<HTMLButtonElement>(".clicky-onboarding button") ?? []);
    const button = buttons.find((candidateButton) => candidateButton.textContent?.trim() === buttonLabel);
    if (!button) {
      throw new Error(`missing onboarding button: ${buttonLabel}`);
    }
    button.click();
  }, label);
}

async function getChecklistStates(page: import("@playwright/test").Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".clicky-panel-host")?.shadowRoot;
    return Array.from(root?.querySelectorAll<HTMLElement>(".clicky-onboarding-check [data-state]") ?? []).map(
      (element) => element.dataset.state ?? ""
    );
  });
}

test.describe("onboarding", () => {
  test("onboarding shows on first load", async ({ page, sdk }) => {
    await page.goto("/demo/?tts=0");
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await sdk.waitForReady();

    await expect.poll(() => sdk.getOnboardingVisible()).toBeTruthy();
    const onboardingText = await sdk.getOnboardingText();
    expect(onboardingText).toContain("Microphone permission");
    expect(onboardingText).toContain("Worker health");
    expect(onboardingText).toContain("AI response");
    expect(onboardingText).toContain("Voice playback");
  });

  test("checklist items complete or fail without hanging", async ({ page, sdk }) => {
    await sdk.showOnboarding();
    await clickOnboardingButton(page, "Run checks");
    await page.waitForTimeout(8_000);

    const states = await getChecklistStates(page);
    expect(states).toHaveLength(4);
    expect(states.every((state) => state === "pass" || state === "fail")).toBeTruthy();
    expect(states[1]).toBe("pass");
  });

  test("dismiss persists across reload", async ({ page, sdk }) => {
    await sdk.showOnboarding();
    await clickOnboardingButton(page, "Dismiss");
    await expect.poll(() => sdk.getOnboardingVisible()).toBeFalsy();

    await page.reload();
    await sdk.waitForReady();
    await expect.poll(() => sdk.getOnboardingVisible()).toBeFalsy();
  });

  test("showOnboarding reopens dismissed onboarding", async ({ sdk }) => {
    await sdk.showOnboarding();
    await expect.poll(() => sdk.getOnboardingVisible()).toBeTruthy();
  });
});
