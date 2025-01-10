import Anthropic from "@anthropic-ai/sdk";
import { Message } from "./conversation_manager";
import { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream";

const MODEL = "claude-3-5-sonnet-20241022";

type AnthropicMessage = {
  role: "assistant" | "user";
  content: string;
};

class LLMManager {
  private anthropic: Anthropic;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey, maxRetries: 5 });
  }

  streamResponse(
    systemPrompt: string,
    messages: Message[],
    maxTokens: number
  ): MessageStream {
    const formattedMessages: AnthropicMessage[] = messages.map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    }));

    const stream = this.anthropic.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: formattedMessages,
    });

    return stream;
  }

  async generateResponse(
    systemPrompt: string,
    messages: Message[],
    maxTokens: number
  ): Promise<string> {
    const formattedMessages: AnthropicMessage[] = messages.map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    }));

    const msg = await this.anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: formattedMessages,
    });

    return msg?.content[0]?.text || "";
  }
}

export { LLMManager };
