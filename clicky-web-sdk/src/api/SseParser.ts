export type SseEvent = {
  event?: string;
  data: string;
};

export class SseParser {
  private bufferedText = "";

  push(chunkText: string): SseEvent[] {
    this.bufferedText += chunkText;
    const events: SseEvent[] = [];
    const rawEvents = this.bufferedText.split(/\n\n/);
    this.bufferedText = rawEvents.pop() ?? "";

    for (const rawEvent of rawEvents) {
      const event = this.parseRawEvent(rawEvent);
      if (event) {
        events.push(event);
      }
    }

    return events;
  }

  flush(): SseEvent[] {
    if (!this.bufferedText.trim()) {
      return [];
    }

    const event = this.parseRawEvent(this.bufferedText);
    this.bufferedText = "";
    return event ? [event] : [];
  }

  private parseRawEvent(rawEvent: string): SseEvent | undefined {
    const lines = rawEvent.split(/\r?\n/);
    const dataLines: string[] = [];
    let eventName: string | undefined;

    for (const line of lines) {
      if (line.startsWith("event:")) {
        eventName = line.slice("event:".length).trim();
      }

      if (line.startsWith("data:")) {
        dataLines.push(line.slice("data:".length).trimStart());
      }
    }

    if (dataLines.length === 0) {
      return undefined;
    }

    return {
      event: eventName,
      data: dataLines.join("\n")
    };
  }
}
