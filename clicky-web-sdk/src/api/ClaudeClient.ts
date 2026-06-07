import type { ClickyCapturedContext, ClickyConversationMessage, ClickyGuideStep, NormalizedClickyOptions } from "../core/types";
import { WorkerProxy } from "./WorkerProxy";
import { SseParser } from "./SseParser";

export type StreamChatOptions = {
  userText: string;
  capturedContext: ClickyCapturedContext;
  conversationHistory: ClickyConversationMessage[];
  registeredActions: Array<{ id: string; name: string; description: string; parametersSchema: Record<string, unknown> }>;
  onToken(token: string, fullText: string): void;
};

export class ClaudeClient {
  constructor(
    private readonly workerProxy: WorkerProxy,
    private readonly options: NormalizedClickyOptions
  ) {}

  async streamChat(streamChatOptions: StreamChatOptions): Promise<string> {
    const stream = await this.workerProxy.fetchStream(this.options.apiRoutes.chat, this.createRequestBody(streamChatOptions));
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    let fullText = "";
    let rawStreamText = "";

    while (true) {
      const readResult = await reader.read();
      if (readResult.done) {
        break;
      }

      const chunkText = decoder.decode(readResult.value, { stream: true });
      rawStreamText += chunkText;
      for (const event of parser.push(chunkText)) {
        const token = this.extractTextToken(event.data);
        if (token) {
          fullText += token;
          streamChatOptions.onToken(token, fullText);
        }
      }
    }

    for (const event of parser.flush()) {
      const token = this.extractTextToken(event.data);
      if (token) {
        fullText += token;
        streamChatOptions.onToken(token, fullText);
      }
    }

    return fullText || this.extractJsonResponseText(rawStreamText);
  }

  async planGuide(goal: string, capturedContext: ClickyCapturedContext): Promise<ClickyGuideStep[]> {
    const prompt = `
You are planning an outcome-driven browser guidance flow.
Return only valid JSON with this exact shape:
{"steps":[{"stepId":"step-1","instruction":"...","targetHint":"...","successCondition":"..."}]}

Goal:
${goal}

Current URL: ${capturedContext.url}
Page title: ${capturedContext.title}
Semantic graph:
${JSON.stringify(capturedContext.semanticGraph.slice(0, 80), null, 2)}
`.trim();

    const rawText = await this.completeText(prompt, 1200);
    return this.parseGuideSteps(rawText, goal);
  }

  async createGuideStepResponse(options: {
    goal: string;
    step: ClickyGuideStep;
    stepIndex: number;
    totalSteps: number;
    capturedContext: ClickyCapturedContext;
    isRecovery: boolean;
  }): Promise<string> {
    const prompt = `
You are Clicky, guiding a user step by step inside a SaaS webapp.
Speak naturally, one sentence max. Write for the ear, not the eye. All lowercase.
Never say "just" or "simply".
Always end with exactly one point tag:
[POINT:elementId:label] for a semanticGraph stableId or captured element id, [POINT:x,y:label] for viewport CSS pixels, or [POINT:none].
Do not invent element IDs.

Goal: ${options.goal}
Step ${options.stepIndex + 1} of ${options.totalSteps}: ${options.step.instruction}
Target hint: ${options.step.targetHint}
Success condition: ${options.step.successCondition}
Recovery mode: ${options.isRecovery ? "yes" : "no"}

Current URL: ${options.capturedContext.url}
Page title: ${options.capturedContext.title}
Semantic graph:
${JSON.stringify(options.capturedContext.semanticGraph.slice(0, 100), null, 2)}

Captured elements:
${JSON.stringify(options.capturedContext.elements.slice(0, 80), null, 2)}
`.trim();

    return this.completeText(prompt, 900);
  }

  private createRequestBody(streamChatOptions: StreamChatOptions): Record<string, unknown> {
    const systemPrompt = this.options.systemPrompt ?? this.createDefaultSystemPrompt(streamChatOptions);
    const userPrompt = this.createUserPrompt(streamChatOptions);
    const conversationHistoryText = streamChatOptions.conversationHistory
      .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.text}`)
      .join("\n");
    const flattenedPrompt = `${systemPrompt}

Recent conversation:
${conversationHistoryText || "None yet."}

${userPrompt}`.trim();

    return {
      model: this.options.model,
      max_tokens: 1400,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: flattenedPrompt }],
      prompt: flattenedPrompt,
      message: flattenedPrompt
    };
  }

  private async completeText(prompt: string, maxTokens: number): Promise<string> {
    const stream = await this.workerProxy.fetchStream(this.options.apiRoutes.chat, {
      model: this.options.model,
      max_tokens: maxTokens,
      stream: true,
      messages: [{ role: "user", content: prompt }],
      prompt,
      message: prompt
    });
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    let fullText = "";
    let rawStreamText = "";

    while (true) {
      const readResult = await reader.read();
      if (readResult.done) {
        break;
      }

      const chunkText = decoder.decode(readResult.value, { stream: true });
      rawStreamText += chunkText;
      for (const event of parser.push(chunkText)) {
        fullText += this.extractTextToken(event.data);
      }
    }

    for (const event of parser.flush()) {
      fullText += this.extractTextToken(event.data);
    }

    return fullText || this.extractJsonResponseText(rawStreamText);
  }

  private parseGuideSteps(rawText: string, goal: string): ClickyGuideStep[] {
    const jsonText = this.extractFirstJsonObject(rawText);
    try {
      const parsed = JSON.parse(jsonText) as { steps?: Array<Partial<ClickyGuideStep>> };
      const parsedSteps = parsed.steps ?? [];
      const guideSteps = parsedSteps
        .map((step, index): ClickyGuideStep => ({
          stepId: step.stepId || `step-${index + 1}`,
          instruction: step.instruction || `continue working toward: ${goal}`,
          targetHint: step.targetHint || "",
          successCondition: step.successCondition || "the user indicates this step is complete"
        }))
        .slice(0, 8);
      if (guideSteps.length > 0) {
        return guideSteps;
      }
    } catch {
      // The fallback below keeps Guide Mode usable when the model returns prose.
    }

    return [
      {
        stepId: "step-1",
        instruction: goal,
        targetHint: goal,
        successCondition: "the user completes the requested action"
      }
    ];
  }

  private extractFirstJsonObject(rawText: string): string {
    const firstBraceIndex = rawText.indexOf("{");
    const lastBraceIndex = rawText.lastIndexOf("}");
    if (firstBraceIndex === -1 || lastBraceIndex <= firstBraceIndex) {
      return rawText;
    }
    return rawText.slice(firstBraceIndex, lastBraceIndex + 1);
  }

  private createDefaultSystemPrompt(streamChatOptions: StreamChatOptions): string {
    const registeredActionInstructions =
      streamChatOptions.registeredActions.length > 0
        ? streamChatOptions.registeredActions
            .map(
              (action) =>
                `- ${action.id}: ${action.description}. Parameters schema: ${JSON.stringify(action.parametersSchema)}`
            )
            .join("\n")
        : "- none";

    return `
You are Clicky, a browser-native AI companion embedded inside the user's current webapp.
You help quickly, concretely, and conversationally. The response may be spoken aloud, so keep it concise.

The DOM/accessibility context and semanticGraph are your primary sources of truth. Screenshots may be attached, but only when the user granted browser capture.
Never claim to see outside the current webapp unless screenshot context explicitly shows it.
Prefer semanticGraph stableId values for point tags because they are stable across DOM refreshes.
If screenshots are present, use them only to verify visual position and layout against the DOM context.

When pointing helps, append exactly one point tag at the very end:
[POINT:elementId:label] for known DOM element IDs, [POINT:x,y:label] for viewport CSS pixels, or [POINT:none].

Available registered actions:
${registeredActionInstructions}

If an action would help and is registered, append exactly one action tag after the point tag:
[ACTION:actionId:jsonPayload]
If no action is useful, append [ACTION:none].

Do not invent element IDs. Do not invent actions. Do not include private reasoning.
`.trim();
  }

  private createUserPrompt(streamChatOptions: StreamChatOptions): string {
    return `
User request:
${streamChatOptions.userText}

Current webapp context:
${JSON.stringify(streamChatOptions.capturedContext, null, 2)}
`.trim();
  }

  private extractTextToken(data: string): string {
    if (data === "[DONE]") {
      return "";
    }

    try {
      const parsed = JSON.parse(data) as {
        type?: string;
        delta?: { type?: string; text?: string };
        content_block?: { type?: string; text?: string };
      };

      if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
        return parsed.delta.text ?? "";
      }

      if (parsed.type === "content_block_start" && parsed.content_block?.type === "text") {
        return parsed.content_block.text ?? "";
      }
    } catch {
      return "";
    }

    return "";
  }

  private extractJsonResponseText(rawStreamText: string): string {
    try {
      const parsed = JSON.parse(rawStreamText) as {
        success?: boolean;
        result?: {
          candidates?: Array<{
            content?: {
              parts?: Array<{ text?: string }>;
            };
          }>;
        };
        content?: Array<{ type?: string; text?: string }>;
      };

      const geminiText =
        parsed.result?.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
      if (geminiText) {
        return geminiText;
      }

      return parsed.content?.map((part) => (part.type === "text" ? part.text ?? "" : "")).join("") ?? "";
    } catch {
      return "";
    }
  }
}
