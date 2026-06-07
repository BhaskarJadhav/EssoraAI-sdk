# Essora Web SDK Browser Evaluation

Generated: 2026-06-07T11:37:37.347Z

## Animation quality
- Cursor flight: pass
- Arrival bob: pass
- Reduced-motion skip: pass
- Fade after inactivity: pass

## Target lock accuracy
- Max observed drift during scroll (px): asserted < 4px by `highlight follows element on scroll`
- Max observed drift during resize (px): asserted < 4px by `highlight survives resize`
- Route re-lock: pass
- target-lost event: pass

## Semantic graph
- Element count on demo page: validated by `graph contains interactive elements`
- stableId consistency: pass
- Redaction: pass
- 120-node cap: pass

## Guide mode
- Steps generated per goal (count): skipped
- Step advance on stepCompleted: skipped
- Recovery after timeout: skipped
- Cancel stops loop: skipped

## Voice
- mic:level events per second (rate): asserted by `mic:level event fires during recording`
- Silent detection latency (ms): asserted >= 3000ms by `mic:silent fires`
- Permission denied handling: pass

## Onboarding
- First-run auto-show: pass
- All checks complete: pass
- Dismiss persistence: pass

## Screenshot vision
- Capture success: skipped
- Attaches to request: skipped
- Off by default: pass
- Graceful denial: pass

## Overall
- Total tests: 28
- Passed: 21
- Failed: 0
- Skipped: 7
- Known CI limitations:
  - Live Guide Mode and multi-step model evaluation require RUN_LIVE_AI_E2E=1.
  - Browser display-capture success/attachment checks require RUN_DISPLAY_CAPTURE_E2E=1.
  - Voice validation uses Chromium fake media and does not measure physical microphone quality.

## Failed Tests
- none
