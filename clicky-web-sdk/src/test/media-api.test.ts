import { describe, expect, it } from "vitest";
import { floatToPcm16 } from "../audio/PcmEncoder";
import { SseParser } from "../api/SseParser";

describe("media and API helpers", () => {
  it("converts float audio to clamped PCM16", () => {
    const result = floatToPcm16(new Float32Array([-2, -1, 0, 0.5, 1, 2]));
    expect(Array.from(result)).toEqual([-32768, -32768, 0, 16383, 32767, 32767]);
  });

  it("parses SSE across chunk boundaries", () => {
    const parser = new SseParser();
    expect(parser.push('event: content_block_delta\ndata: {"type":"content')).toEqual([]);
    const events = parser.push('_block_delta"}\n\n');
    expect(events).toEqual([
      {
        event: "content_block_delta",
        data: '{"type":"content_block_delta"}'
      }
    ]);
  });
});
