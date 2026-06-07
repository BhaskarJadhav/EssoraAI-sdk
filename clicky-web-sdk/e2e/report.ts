import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type PlaywrightResult = {
  status: string;
  duration: number;
  error?: { message?: string };
};

type PlaywrightTestCase = {
  title: string;
  status?: string;
  outcome?: string;
  results: PlaywrightResult[];
};

type PlaywrightSuite = {
  title: string;
  file?: string;
  suites?: PlaywrightSuite[];
  specs?: Array<{
    title: string;
    tests: PlaywrightTestCase[];
  }>;
};

type PlaywrightJsonReport = {
  stats?: {
    expected?: number;
    unexpected?: number;
    skipped?: number;
  };
  suites: PlaywrightSuite[];
};

type FlattenedTest = {
  file: string;
  title: string;
  status: string;
  duration: number;
  error?: string;
};

const resultsPath = resolve("e2e/results.json");
const outputPath = resolve("e2e/EVAL_REPORT.md");

function flattenSuites(suites: PlaywrightSuite[], inheritedFile = ""): FlattenedTest[] {
  const flattenedTests: FlattenedTest[] = [];
  for (const suite of suites) {
    const suiteFile = suite.file ?? inheritedFile;
    for (const spec of suite.specs ?? []) {
      for (const testCase of spec.tests) {
        const latestResult = testCase.results[testCase.results.length - 1];
        flattenedTests.push({
          file: suiteFile,
          title: `${suite.title ? `${suite.title} ` : ""}${spec.title}`.trim(),
          status: testCase.outcome ?? testCase.status ?? latestResult?.status ?? "unknown",
          duration: latestResult?.duration ?? 0,
          error: latestResult?.error?.message
        });
      }
    }
    flattenedTests.push(...flattenSuites(suite.suites ?? [], suiteFile));
  }
  return flattenedTests;
}

function statusFor(tests: FlattenedTest[], titlePattern: RegExp): string {
  const matchingTest = tests.find((test) => titlePattern.test(test.title));
  if (!matchingTest) {
    return "not run";
  }
  if (matchingTest.status === "expected") {
    return "pass";
  }
  if (matchingTest.status === "skipped") {
    return "skipped";
  }
  return "fail";
}

function countStatus(tests: FlattenedTest[], status: string): number {
  return tests.filter((test) => test.status === status).length;
}

function createKnownLimitations(tests: FlattenedTest[]): string[] {
  const limitations = new Set<string>();
  if (tests.some((test) => test.file.includes("04-guide-mode") && test.status === "skipped")) {
    limitations.add("Live Guide Mode and multi-step model evaluation require RUN_LIVE_AI_E2E=1.");
  }
  if (tests.some((test) => test.file.includes("07-screenshot-vision") && test.status === "skipped")) {
    limitations.add("Browser display-capture success/attachment checks require RUN_DISPLAY_CAPTURE_E2E=1.");
  }
  if (tests.some((test) => test.file.includes("05-voice-waveform"))) {
    limitations.add("Voice validation uses Chromium fake media and does not measure physical microphone quality.");
  }
  return Array.from(limitations);
}

if (!existsSync(resultsPath)) {
  throw new Error(`Playwright results not found at ${resultsPath}. Run npm run test:e2e first.`);
}

const report = JSON.parse(readFileSync(resultsPath, "utf8")) as PlaywrightJsonReport;
const tests = flattenSuites(report.suites);
const totalTests = tests.length;
const passedTests = countStatus(tests, "expected");
const failedTests = countStatus(tests, "unexpected") + countStatus(tests, "flaky");
const skippedTests = countStatus(tests, "skipped");
const knownLimitations = createKnownLimitations(tests);

const markdown = `# Essora Web SDK Browser Evaluation

Generated: ${new Date().toISOString()}

## Animation quality
- Cursor flight: ${statusFor(tests, /cursor flies to target/i)}
- Arrival bob: ${statusFor(tests, /arrival bob/i)}
- Reduced-motion skip: ${statusFor(tests, /reduced motion/i)}
- Fade after inactivity: ${statusFor(tests, /fades after transient inactivity/i)}

## Target lock accuracy
- Max observed drift during scroll (px): asserted < 4px by \`highlight follows element on scroll\`
- Max observed drift during resize (px): asserted < 4px by \`highlight survives resize\`
- Route re-lock: ${statusFor(tests, /route change keeps lock/i)}
- target-lost event: ${statusFor(tests, /target-lost event/i)}

## Semantic graph
- Element count on demo page: validated by \`graph contains interactive elements\`
- stableId consistency: ${statusFor(tests, /stableId is deterministic/i)}
- Redaction: ${statusFor(tests, /password fields are redacted/i)}
- 120-node cap: ${statusFor(tests, /capped at 120 nodes/i)}

## Guide mode
- Steps generated per goal (count): ${statusFor(tests, /guide produces multiple steps/i)}
- Step advance on stepCompleted: ${statusFor(tests, /advances on stepCompleted/i)}
- Recovery after timeout: ${statusFor(tests, /recovery fires after timeout/i)}
- Cancel stops loop: ${statusFor(tests, /cancelGuide stops/i)}

## Voice
- mic:level events per second (rate): asserted by \`mic:level event fires during recording\`
- Silent detection latency (ms): asserted >= 3000ms by \`mic:silent fires\`
- Permission denied handling: ${statusFor(tests, /permission denied state/i)}

## Onboarding
- First-run auto-show: ${statusFor(tests, /shows on first load/i)}
- All checks complete: ${statusFor(tests, /checklist items complete/i)}
- Dismiss persistence: ${statusFor(tests, /dismiss persists/i)}

## Screenshot vision
- Capture success: ${statusFor(tests, /screenshot capture succeeds/i)}
- Attaches to request: ${statusFor(tests, /attaches to the next chat request/i)}
- Off by default: ${statusFor(tests, /off by default/i)}
- Graceful denial: ${statusFor(tests, /denied capture degrades gracefully/i)}

## Overall
- Total tests: ${totalTests}
- Passed: ${passedTests}
- Failed: ${failedTests}
- Skipped: ${skippedTests}
- Known CI limitations:
${knownLimitations.length ? knownLimitations.map((limitation) => `  - ${limitation}`).join("\n") : "  - none"}

## Failed Tests
${tests
  .filter((test) => test.status !== "expected" && test.status !== "skipped")
  .map((test) => `- ${test.file}: ${test.title}\n  - ${test.error ?? "no error message"}`)
  .join("\n") || "- none"}
`;

writeFileSync(outputPath, markdown);
console.log(`Wrote ${outputPath}`);
