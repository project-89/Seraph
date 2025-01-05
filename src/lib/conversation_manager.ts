// conversation_manager.ts
import fs from "fs/promises";
import path from "path";

/**
 * The ConversationManager class manages conversation context.
 */
export type Message = {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
};

export type APIMessage = {
  role: "user" | "assistant";
  content: string;
};

class ConversationManager {
  private conversations: Record<string, Message[]> = {};
  private storagePath: string;

  constructor() {
    this.storagePath = path.join(process.cwd(), "data", "conversations");
    this.initStorage();
  }

  private async initStorage() {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
      await this.loadConversations();
    } catch (error) {
      console.error("Failed to initialize conversation storage:", error);
    }
  }

  private async loadConversations() {
    try {
      const files = await fs.readdir(this.storagePath);
      for (const file of files) {
        if (file.endsWith(".json")) {
          const conversationId = file.replace(".json", "");
          const content = await fs.readFile(
            path.join(this.storagePath, file),
            "utf-8"
          );
          this.conversations[conversationId] = JSON.parse(content);
        }
      }
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  }

  private async saveConversation(conversationId: string) {
    try {
      const filePath = path.join(this.storagePath, `${conversationId}.json`);
      await fs.writeFile(
        filePath,
        JSON.stringify(this.conversations[conversationId], null, 2),
        "utf-8"
      );
    } catch (error) {
      console.error(`Failed to save conversation ${conversationId}:`, error);
    }
  }

  /**
   * Updates the context of a conversation.
   * @param conversationId The identifier of the conversation.
   * @param message The message to add to the context.
   */
  public async updateContext(
    conversationId: string,
    _message: string,
    role: "user" | "assistant"
  ): Promise<void> {
    const message: Message = {
      role,
      content: _message,
      timestamp: new Date().toISOString(),
    };

    if (!this.conversations[conversationId]) {
      this.conversations[conversationId] = [];
    }

    // Check if the message already exists in the array
    const existingMessage = this.conversations[conversationId].find(
      (m) => m.role === message.role && m.content === message.content
    );

    if (!existingMessage) {
      this.conversations[conversationId].push(message);
      await this.saveConversation(conversationId);
    }
  }

  public async removeLastMessage(conversationId: string): Promise<void> {
    if (this.conversations[conversationId]?.length > 0) {
      this.conversations[conversationId].pop();
      await this.saveConversation(conversationId);
    }
  }

  /**
   * Retrieves the context of a conversation.
   * @param conversationId The identifier of the conversation.
   * @returns The context of the conversation.
   */
  public getMessages(
    conversationId: string,
    includeMetadata: boolean = false
  ): APIMessage[] | Message[] {
    const messages = this.conversations[conversationId] || [];
    if (includeMetadata) {
      return messages;
    }
    // Strip metadata for API calls
    return messages.map(({ role, content }) => ({ role, content }));
  }

  public async clearConversation(conversationId: string): Promise<void> {
    try {
      const filePath = path.join(this.storagePath, `${conversationId}.json`);
      await fs.unlink(filePath);
      delete this.conversations[conversationId];
    } catch (error) {
      console.error(`Failed to clear conversation ${conversationId}:`, error);
    }
  }

  public async listConversations(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.storagePath);
      return files
        .filter((file) => file.endsWith(".json"))
        .map((file) => file.replace(".json", ""));
    } catch (error) {
      console.error("Failed to list conversations:", error);
      return [];
    }
  }
}

export { ConversationManager };
