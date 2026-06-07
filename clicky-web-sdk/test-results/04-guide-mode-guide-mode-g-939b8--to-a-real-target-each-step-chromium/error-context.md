# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: 04-guide-mode.spec.ts >> guide mode >> guide points to a real target each step
- Location: e2e\04-guide-mode.spec.ts:29:3

# Error details

```
TimeoutError: page.waitForFunction: Timeout 20000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - main [ref=e2]:
    - navigation "Primary" [ref=e3]:
      - strong [ref=e4]: Acme CRM
      - button "Dashboard" [ref=e5] [cursor=pointer]
      - button "Customers" [ref=e6] [cursor=pointer]
      - button "Billing" [ref=e7] [cursor=pointer]
      - link "Docs" [ref=e8] [cursor=pointer]:
        - /url: "#docs"
    - generic [ref=e9]:
      - generic [ref=e10]:
        - generic [ref=e11]:
          - heading "Pipeline Review" [level=1] [ref=e12]
          - paragraph [ref=e13]: Review high-value accounts and next steps.
        - button "Create invoice" [ref=e14] [cursor=pointer]
      - region "Pipeline metrics" [ref=e15]:
        - article [ref=e16]:
          - generic [ref=e17]: Open pipeline
          - strong [ref=e18]: $482K
        - article [ref=e19]:
          - generic [ref=e20]: At risk
          - strong [ref=e21]: 7 accounts
        - article [ref=e22]:
          - generic [ref=e23]: Due today
          - strong [ref=e24]: 14 tasks
      - search [ref=e25]:
        - generic [ref=e26]: Find a customer
        - textbox "Find a customer" [ref=e27]:
          - /placeholder: Search accounts
        - button "Search" [ref=e28] [cursor=pointer]
      - table "Accounts table" [ref=e29]:
        - rowgroup [ref=e30]:
          - row "Account Stage Owner Next step" [ref=e31]:
            - columnheader "Account" [ref=e32]
            - columnheader "Stage" [ref=e33]
            - columnheader "Owner" [ref=e34]
            - columnheader "Next step" [ref=e35]
        - rowgroup [ref=e36]:
          - row "Northstar Labs Security review Maya Schedule follow-up" [ref=e37]:
            - cell "Northstar Labs" [ref=e38]
            - cell "Security review" [ref=e39]
            - cell "Maya" [ref=e40]
            - cell "Schedule follow-up" [ref=e41]:
              - button "Schedule follow-up" [ref=e42] [cursor=pointer]
          - row "BrightBank Procurement Jules Open notes" [ref=e43]:
            - cell "BrightBank" [ref=e44]
            - cell "Procurement" [ref=e45]
            - cell "Jules" [ref=e46]
            - cell "Open notes" [ref=e47]:
              - button "Open notes" [ref=e48] [cursor=pointer]
      - region "Clicky diagnostics" [ref=e49]:
        - generic [ref=e50]:
          - heading "Clicky Diagnostics" [level=2] [ref=e51]
          - paragraph [ref=e52]: Realtime SDK health, latency, targeting, and provider status.
        - generic [ref=e53]: "{ \"eventName\": \"error\", \"diagnostics\": { \"state\": \"guide-recovering\", \"health\": { \"ok\": true, \"providers\": { \"vertex\": \"configured\", \"deepgram\": \"configured\", \"elevenlabs\": \"configured\", \"redis\": \"configured\", \"redisToken\": \"configured\", \"posthog\": \"configured\", \"sentry\": \"configured\" } }, \"semanticMapVersion\": 0, \"lastError\": \"Invalid Clicky state transition from guide-recovering to guide-step-watching\", \"degradedProviders\": {}, \"activeProviders\": { \"chat\": \"gemini\", \"stt-primary\": \"google-stt-upload\", \"stt-realtime\": \"deepgram-proxy\", \"tts\": \"google-tts-zephyr\" }, \"settings\": { \"model\": \"gemini-2.5-flash\", \"voiceProvider\": \"google\", \"ttsProvider\": \"google\", \"ttsVoice\": \"en-US-Chirp3-HD-Zephyr\" } }, \"updatedAt\": \"2026-06-07T11:38:53.462Z\" }"
  - generic:
    - generic:
      - generic: Find a customer
  - generic [ref=e54]:
    - generic [ref=e55]:
      - generic [ref=e56]:
        - generic [ref=e57]: Clicky
        - button "Settings" [ref=e58] [cursor=pointer]
        - generic [ref=e59]: idle
      - generic [ref=e60]:
        - strong [ref=e61]: Essora setup
        - paragraph [ref=e62]: Run a quick proof-of-life check before testing guidance.
        - generic [ref=e63]:
          - generic [ref=e64]:
            - generic [ref=e65]: Microphone permission
            - generic [ref=e66]: pending
          - generic [ref=e67]:
            - generic [ref=e68]: Worker health
            - generic [ref=e69]: pending
          - generic [ref=e70]:
            - generic [ref=e71]: AI response
            - generic [ref=e72]: pending
          - generic [ref=e73]:
            - generic [ref=e74]: Voice playback
            - generic [ref=e75]: pending
        - generic [ref=e76]:
          - button "Run checks" [ref=e77] [cursor=pointer]
          - button "Dismiss" [ref=e78] [cursor=pointer]
      - generic [ref=e79]:
        - paragraph [ref=e80]: Ask about this page, or hold ctrl + option while the page is focused.
        - paragraph [ref=e81]: "Clicky: click the search field labeled \"find a customer\"."
        - paragraph [ref=e82]: "Clicky: go ahead and click the search field that says \"find a customer\"."
        - paragraph [ref=e83]: "Clicky: Invalid Clicky state transition from guide-recovering to guide-step-watching"
      - generic [ref=e85]:
        - textbox "Ask Clicky" [ref=e86]
        - button "Mic" [ref=e87] [cursor=pointer]:
          - generic [ref=e88]: Mic
        - button "Send" [ref=e89] [cursor=pointer]
    - button "C" [ref=e90] [cursor=pointer]
```

# Test source

```ts
  1   | import { expect, test as base, type Page } from "@playwright/test";
  2   | 
  3   | export type ClickyE2EEvent = {
  4   |   eventName: string;
  5   |   payload: any;
  6   |   timestamp: number;
  7   | };
  8   | 
  9   | export type RectLike = {
  10  |   left: number;
  11  |   top: number;
  12  |   width: number;
  13  |   height: number;
  14  | };
  15  | 
  16  | export class SdkFixture {
  17  |   constructor(readonly page: Page) {}
  18  | 
  19  |   async gotoDemo(query = "tts=0"): Promise<void> {
  20  |     await this.page.goto(`/demo/${query ? `?${query}` : ""}`);
  21  |     await this.waitForReady();
  22  |   }
  23  | 
  24  |   async waitForReady(): Promise<void> {
  25  |     await this.page.waitForFunction(() => !!(window as any).__clickyTest && !!(window as any).__clicky);
  26  |   }
  27  | 
  28  |   async startGuide(goal: string): Promise<void> {
  29  |     await this.page.evaluate((guideGoal) => {
  30  |       void (window as any).__clicky.startGuide(guideGoal);
  31  |     }, goal);
  32  |   }
  33  | 
  34  |   async sendText(text: string): Promise<void> {
  35  |     await this.page.evaluate((userText) => {
  36  |       void (window as any).__clicky.sendUserText(userText);
  37  |     }, text);
  38  |   }
  39  | 
  40  |   async stepCompleted(): Promise<void> {
  41  |     await this.page.evaluate(() => (window as any).__clicky.stepCompleted());
  42  |   }
  43  | 
  44  |   async cancelGuide(): Promise<void> {
  45  |     await this.page.evaluate(() => (window as any).__clicky.cancelGuide());
  46  |   }
  47  | 
  48  |   async startListening(): Promise<void> {
  49  |     await this.page.evaluate(() => {
  50  |       void (window as any).__clicky.startListening();
  51  |     });
  52  |   }
  53  | 
  54  |   async stopListening(): Promise<void> {
  55  |     await this.page.evaluate(() => (window as any).__clicky.stopListening());
  56  |   }
  57  | 
  58  |   async triggerScreenshot(): Promise<void> {
  59  |     await this.page.evaluate(() => (window as any).__clicky.triggerScreenshot());
  60  |   }
  61  | 
  62  |   async showOnboarding(): Promise<void> {
  63  |     await this.page.evaluate(() => (window as any).__clicky.showOnboarding());
  64  |   }
  65  | 
  66  |   async waitForEvent(eventName: string, timeout = 5_000): Promise<ClickyE2EEvent> {
  67  |     const startingEventCount = await this.eventCount();
> 68  |     await this.page.waitForFunction(
      |                     ^ TimeoutError: page.waitForFunction: Timeout 20000ms exceeded.
  69  |       ({ expectedEventName, startIndex }) =>
  70  |         ((window as any).__clickyTest?.events ?? [])
  71  |           .slice(startIndex)
  72  |           .some((event: ClickyE2EEvent) => event.eventName === expectedEventName),
  73  |       { expectedEventName: eventName, startIndex: startingEventCount },
  74  |       { timeout }
  75  |     );
  76  |     const matchingEvent = await this.page.evaluate(
  77  |       ({ expectedEventName, startIndex }) =>
  78  |         ((window as any).__clickyTest.events as ClickyE2EEvent[])
  79  |           .slice(startIndex)
  80  |           .find((event) => event.eventName === expectedEventName),
  81  |       { expectedEventName: eventName, startIndex: startingEventCount }
  82  |     );
  83  |     expect(matchingEvent, `event ${eventName} should be recorded`).toBeTruthy();
  84  |     return matchingEvent!;
  85  |   }
  86  | 
  87  |   async eventCount(): Promise<number> {
  88  |     return this.page.evaluate(() => ((window as any).__clickyTest?.events ?? []).length);
  89  |   }
  90  | 
  91  |   async getEvents(eventName?: string): Promise<ClickyE2EEvent[]> {
  92  |     return this.page.evaluate(
  93  |       (name) => {
  94  |         const events = ((window as any).__clickyTest?.events ?? []) as ClickyE2EEvent[];
  95  |         return name ? events.filter((event) => event.eventName === name) : events;
  96  |       },
  97  |       eventName
  98  |     );
  99  |   }
  100 | 
  101 |   async getCursorPosition(): Promise<{ x: number; y: number; opacity: string; visibility: string }> {
  102 |     return this.page.evaluate(() => {
  103 |       const cursorElement = document
  104 |         .querySelector<HTMLElement>(".clicky-overlay-host")
  105 |         ?.shadowRoot?.querySelector<HTMLElement>(".clicky-cursor");
  106 |       if (!cursorElement) {
  107 |         throw new Error("cursor element missing");
  108 |       }
  109 |       const rect = cursorElement.getBoundingClientRect();
  110 |       const computedStyle = window.getComputedStyle(cursorElement);
  111 |       return {
  112 |         x: rect.left + rect.width / 2,
  113 |         y: rect.top + rect.height / 2,
  114 |         opacity: computedStyle.opacity,
  115 |         visibility: computedStyle.visibility
  116 |       };
  117 |     });
  118 |   }
  119 | 
  120 |   async getHighlightRect(): Promise<RectLike & { opacity: string }> {
  121 |     return this.page.evaluate(() => {
  122 |       const highlightElement = document
  123 |         .querySelector<HTMLElement>(".clicky-overlay-host")
  124 |         ?.shadowRoot?.querySelector<HTMLElement>(".clicky-element-highlight");
  125 |       if (!highlightElement) {
  126 |         throw new Error("highlight element missing");
  127 |       }
  128 |       const rect = highlightElement.getBoundingClientRect();
  129 |       return {
  130 |         left: rect.left,
  131 |         top: rect.top,
  132 |         width: rect.width,
  133 |         height: rect.height,
  134 |         opacity: window.getComputedStyle(highlightElement).opacity
  135 |       };
  136 |     });
  137 |   }
  138 | 
  139 |   async getTargetRect(stableId: string): Promise<RectLike> {
  140 |     const rect = await this.page.evaluate((elementId) => (window as any).__clickyTest.getTargetRect(elementId), stableId);
  141 |     expect(rect, `target rect for ${stableId}`).toBeTruthy();
  142 |     return rect;
  143 |   }
  144 | 
  145 |   async scrollPage(px: number): Promise<void> {
  146 |     await this.page.evaluate((scrollDelta) => window.scrollBy(0, scrollDelta), px);
  147 |   }
  148 | 
  149 |   async triggerRouteChange(path: string): Promise<void> {
  150 |     await this.page.evaluate((routePath) => history.pushState({}, "", routePath), path);
  151 |   }
  152 | 
  153 |   async getDiagnostics(): Promise<any> {
  154 |     return this.page.evaluate(() => (window as any).__clicky.getDiagnostics());
  155 |   }
  156 | 
  157 |   async captureContext(): Promise<any> {
  158 |     return this.page.evaluate(() => (window as any).__clicky.getContext());
  159 |   }
  160 | 
  161 |   async getOnboardingVisible(): Promise<boolean> {
  162 |     return this.page.evaluate(() => (window as any).__clickyTest.getOnboardingVisible());
  163 |   }
  164 | 
  165 |   async getOnboardingText(): Promise<string> {
  166 |     return this.page.evaluate(() => (window as any).__clickyTest.getOnboardingText());
  167 |   }
  168 | }
```