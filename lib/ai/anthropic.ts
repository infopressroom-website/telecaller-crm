import "server-only";
import { AIError, SYSTEM_PROMPT, parseModelJson, type AnalysisProvider, type CallAnalysisResult } from "./provider";

/** Calls Anthropic's Messages API. The model name comes from AI_MODEL (no default is assumed). Untested without a key. */
export class AnthropicProvider implements AnalysisProvider {
  readonly name = "anthropic";
  constructor(private readonly apiKey: string, readonly model: string) {}

  async analyse(transcript: string): Promise<CallAnalysisResult> {
    let res: Response;
    try {
      res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: this.model, max_tokens: 1200, system: SYSTEM_PROMPT, messages: [{ role: "user", content: `Transcript:\n"""\n${transcript}\n"""` }] }),
        signal: AbortSignal.timeout(45_000),
      });
    } catch {
      throw new AIError("The AI service could not be reached.");
    }
    if (!res.ok) throw new AIError(`The AI service returned an error (HTTP ${res.status}).`);
    const body = (await res.json().catch(() => null)) as { content?: { type: string; text?: string }[] } | null;
    const text = body?.content?.find((c) => c.type === "text")?.text;
    if (!text) throw new AIError("The AI service returned no text.");
    return parseModelJson(text);
  }
}
