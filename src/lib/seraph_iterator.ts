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

    let hasMoreFunctions = true;
    while (hasMoreFunctions) {
      const messages = this.seraph.conversationManager.getMessages(
        this.conversationId
      );

      const stream = this.llmManager.streamResponse(
        this.systemPrompt,
        messages,
        4000
      );

      let response = "";
      for await (const chunk of stream) {
        if (chunk.type === "content_block_delta") {
          const text = chunk.delta.text;
          this.seraph.emit("token", text);
          response += text;
        }
      }

      // Update conversation context with the response
      this.seraph.conversationManager.updateContext(
        this.conversationId,
        response,
        "assistant"
      );

      // Extract and emit message
      const message = await this.seraph.responseParser.extractMessage(response);
      if (message) {
        this.seraph.emit("message", message);
      }

      // Check for function calls
      const { functionName, functionArgs } =
        await this.seraph.responseParser.parseFunctionUsage(response);

      if (functionName && functionArgs) {
        this.seraph.emit("info", "Raw function call:", {
          name: functionName,
          args: functionArgs,
        });

        // Execute the function
        await this.handleFunctionCall(functionName, functionArgs);

        // Continue the loop to get another response
        hasMoreFunctions = true;
      } else {
        hasMoreFunctions = false;
      }
    }

    this.done = true;
    return {
      done: true,
      value: undefined,
    };
  }

  public [Symbol.asyncIterator](): AsyncIterator<string> {
    return this;
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
