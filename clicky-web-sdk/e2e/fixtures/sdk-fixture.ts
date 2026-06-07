import { expect, test as base, type Page } from "@playwright/test";

export type ClickyE2EEvent = {
  eventName: string;
  payload: any;
  timestamp: number;
};

export type RectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export class SdkFixture {
  constructor(readonly page: Page) {}

  async gotoDemo(query = "tts=0"): Promise<void> {
    await this.page.goto(`/demo/${query ? `?${query}` : ""}`);
    await this.waitForReady();
  }

  async waitForReady(): Promise<void> {
    await this.page.waitForFunction(() => !!(window as any).__clickyTest && !!(window as any).__clicky);
  }

  async startGuide(goal: string): Promise<void> {
    await this.page.evaluate((guideGoal) => {
      void (window as any).__clicky.startGuide(guideGoal);
    }, goal);
  }

  async sendText(text: string): Promise<void> {
    await this.page.evaluate((userText) => {
      void (window as any).__clicky.sendUserText(userText);
    }, text);
  }

  async stepCompleted(): Promise<void> {
    await this.page.evaluate(() => (window as any).__clicky.stepCompleted());
  }

  async cancelGuide(): Promise<void> {
    await this.page.evaluate(() => (window as any).__clicky.cancelGuide());
  }

  async startListening(): Promise<void> {
    await this.page.evaluate(() => {
      void (window as any).__clicky.startListening();
    });
  }

  async stopListening(): Promise<void> {
    await this.page.evaluate(() => (window as any).__clicky.stopListening());
  }

  async triggerScreenshot(): Promise<void> {
    await this.page.evaluate(() => (window as any).__clicky.triggerScreenshot());
  }

  async showOnboarding(): Promise<void> {
    await this.page.evaluate(() => (window as any).__clicky.showOnboarding());
  }

  async waitForEvent(eventName: string, timeout = 5_000): Promise<ClickyE2EEvent> {
    const startingEventCount = await this.eventCount();
    await this.page.waitForFunction(
      ({ expectedEventName, startIndex }) =>
        ((window as any).__clickyTest?.events ?? [])
          .slice(startIndex)
          .some((event: ClickyE2EEvent) => event.eventName === expectedEventName),
      { expectedEventName: eventName, startIndex: startingEventCount },
      { timeout }
    );
    const matchingEvent = await this.page.evaluate(
      ({ expectedEventName, startIndex }) =>
        ((window as any).__clickyTest.events as ClickyE2EEvent[])
          .slice(startIndex)
          .find((event) => event.eventName === expectedEventName),
      { expectedEventName: eventName, startIndex: startingEventCount }
    );
    expect(matchingEvent, `event ${eventName} should be recorded`).toBeTruthy();
    return matchingEvent!;
  }

  async eventCount(): Promise<number> {
    return this.page.evaluate(() => ((window as any).__clickyTest?.events ?? []).length);
  }

  async getEvents(eventName?: string): Promise<ClickyE2EEvent[]> {
    return this.page.evaluate(
      (name) => {
        const events = ((window as any).__clickyTest?.events ?? []) as ClickyE2EEvent[];
        return name ? events.filter((event) => event.eventName === name) : events;
      },
      eventName
    );
  }

  async getCursorPosition(): Promise<{ x: number; y: number; opacity: string; visibility: string }> {
    return this.page.evaluate(() => {
      const cursorElement = document
        .querySelector<HTMLElement>(".clicky-overlay-host")
        ?.shadowRoot?.querySelector<HTMLElement>(".clicky-cursor");
      if (!cursorElement) {
        throw new Error("cursor element missing");
      }
      const rect = cursorElement.getBoundingClientRect();
      const computedStyle = window.getComputedStyle(cursorElement);
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        opacity: computedStyle.opacity,
        visibility: computedStyle.visibility
      };
    });
  }

  async getHighlightRect(): Promise<RectLike & { opacity: string }> {
    return this.page.evaluate(() => {
      const highlightElement = document
        .querySelector<HTMLElement>(".clicky-overlay-host")
        ?.shadowRoot?.querySelector<HTMLElement>(".clicky-element-highlight");
      if (!highlightElement) {
        throw new Error("highlight element missing");
      }
      const rect = highlightElement.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        opacity: window.getComputedStyle(highlightElement).opacity
      };
    });
  }

  async getTargetRect(stableId: string): Promise<RectLike> {
    const rect = await this.page.evaluate((elementId) => (window as any).__clickyTest.getTargetRect(elementId), stableId);
    expect(rect, `target rect for ${stableId}`).toBeTruthy();
    return rect;
  }

  async scrollPage(px: number): Promise<void> {
    await this.page.evaluate((scrollDelta) => window.scrollBy(0, scrollDelta), px);
  }

  async triggerRouteChange(path: string): Promise<void> {
    await this.page.evaluate((routePath) => history.pushState({}, "", routePath), path);
  }

  async getDiagnostics(): Promise<any> {
    return this.page.evaluate(() => (window as any).__clicky.getDiagnostics());
  }

  async captureContext(): Promise<any> {
    return this.page.evaluate(() => (window as any).__clicky.getContext());
  }

  async getOnboardingVisible(): Promise<boolean> {
    return this.page.evaluate(() => (window as any).__clickyTest.getOnboardingVisible());
  }

  async getOnboardingText(): Promise<string> {
    return this.page.evaluate(() => (window as any).__clickyTest.getOnboardingText());
  }
}

export function getPointElementId(event: ClickyE2EEvent): string {
  const command = event.payload?.command;
  if (command?.type !== "element" || !command.elementId) {
    throw new Error(`event did not contain an element point command: ${JSON.stringify(event.payload)}`);
  }
  return command.elementId;
}

export function rectCenter(rect: RectLike): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

export function rectDrift(rectA: RectLike, rectB: RectLike): number {
  return Math.max(Math.abs(rectA.left - rectB.left), Math.abs(rectA.top - rectB.top));
}

export const liveAiEnabled = process.env.RUN_LIVE_AI_E2E === "1";

export const test = base.extend<{ sdk: SdkFixture }>({
  sdk: async ({ page }, use) => {
    const fixture = new SdkFixture(page);
    await fixture.gotoDemo();
    await use(fixture);
  }
});

export { expect };
