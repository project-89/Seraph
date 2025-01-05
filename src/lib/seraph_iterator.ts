import { SeraphCore } from "./seraphCore";
import { LLMManager } from "./llm_manager";
// import { ConsoleLogWriter } from 'drizzle-orm'

class SeraphIterator implements AsyncIterator<string> {
  private seraph: SeraphCore;
  private conversationId: string;
  private systemPrompt: string;
  private llmManager: LLMManager;
  private done: boolean = false;

  constructor(
    seraph: SeraphCore,
    conversationId: string,
    systemPrompt: string
  ) {
    this.seraph = seraph;
    this.conversationId = conversationId;
    this.systemPrompt = systemPrompt;
    this.llmManager = new LLMManager(seraph.options.anthropicApiKey);
  }

  public async next(): Promise<IteratorResult<string>> {
    if (this.done) {
      return { done: true, value: undefined };
    }

    const messages = this.seraph.conversationManager.getMessages(
      this.conversationId
    );

    let insideMessage = false;
    let currentMessage = "";

    const stream = this.llmManager.streamResponse(
      this.systemPrompt,
      messages,
      4000
    );

    // Handle streaming messages
    stream.on("text", (token) => {
      if (insideMessage) {
        if (token === "</message>") {
          insideMessage = false;
          this.seraph.emit("token", "<END>");
          // Only emit complete, valid messages
          const trimmedMessage = currentMessage.trim();
          if (trimmedMessage) {
            this.seraph.emit("message", trimmedMessage);
          }
          currentMessage = "";
        } else {
          currentMessage += token;
          this.seraph.emit("token", token);
        }
      } else {
        if (token === "<message>") {
          insideMessage = true;
          this.seraph.emit("token", "<START>");
        }
      }
    });

    const finalMessage = await stream.finalMessage();
    const llmResponse = finalMessage?.content[0]?.text || "";

    // Handle function calls
    const { functionName, functionArgs } =
      await this.seraph.responseParser.parseFunctionUsage(llmResponse);
    if (functionName && functionArgs) {
      await this.handleFunctionCall(functionName, functionArgs);
    }

    // Update conversation context with the complete response
    this.seraph.conversationManager.updateContext(
      this.conversationId,
      llmResponse,
      "assistant"
    );

    // Extract final message if not already handled in streaming
    const message = await this.seraph.responseParser.extractMessage(
      llmResponse
    );
    this.done = true;

    return {
      done: false,
      value: message || "",
    };
  }

  public [Symbol.asyncIterator](): AsyncIterator<string> {
    return this;
  }

  private async processResponse(response: string): Promise<void> {
    try {
      // Extract message first
      const message = await this.seraph.responseParser.extractMessage(response);
      if (message) {
        this.seraph.emit("message", message);
      }

      // Then handle function calls
      const { functionName, functionArgs } =
        await this.seraph.responseParser.parseFunctionUsage(response);
      if (functionName && functionArgs) {
        await this.handleFunctionCall(functionName, functionArgs);
      }
    } catch (error) {
      console.error("Error processing response:", error);
    }
  }

  private async handleFunctionCall(
    functionName: string,
    functionArgs: Record<string, any>
  ): Promise<void> {
    try {
      const functionOutput =
        await this.seraph.cognitiveFunctionExecutor.executeFunction(
          functionName,
          functionArgs
        );

      // Process function output and update response
      if (functionOutput) {
        const updatedResponse = this.seraph.processFunctionOutput(
          functionOutput,
          "",
          functionName
        );

        // Update conversation context with the function result
        await this.seraph.conversationManager.updateContext(
          this.conversationId,
          updatedResponse,
          "assistant"
        );
      }
    } catch (error) {
      console.error("Error executing cognitive function:", error);
      throw error;
    }
  }
}

export { SeraphIterator };
