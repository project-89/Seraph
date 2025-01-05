import inquirer from "inquirer";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { Command } from "commander";
import { createLogUpdate } from "log-update";
import { SeraphCore } from "./seraphCore";
import { SeraphFunction } from "./types";
import {
  styles,
  formatResponse,
  formatSystemMessage,
  formatUserInput,
  formatError,
  formatInfo,
  formatFunction,
} from "./cli_styles";
import chalk from "chalk";

const logUpdate = createLogUpdate(process.stdout, {
  showCursor: true,
});

type CliCommand = {
  name: string;
  description: string;
  handler: () => void | Promise<void>;
};

class SeraphCLI {
  private seraph: SeraphCore;
  private conversationId: string;
  commands: CliCommand[] = [];

  constructor(seraph: SeraphCore) {
    this.seraph = seraph;
    this.conversationId = "cli_conversation";

    // Initialize conversation history
    this.initializeConversation();

    this.setupEventListeners();
    this.registerCommands();
    this.setupCommanderProgram();
  }

  private async initializeConversation() {
    try {
      // Wait for conversation manager to initialize and load conversations
      await new Promise((resolve) => setTimeout(resolve, 100));

      const messages = this.seraph.conversationManager.getMessages(
        this.conversationId
      );
      if (messages.length > 0) {
        console.log(
          formatSystemMessage("Loaded previous conversation history.")
        );
        // Load last few messages into context
        const recentMessages = messages.slice(-5);
        for (const msg of recentMessages) {
          await this.seraph.conversationManager.updateContext(
            this.conversationId,
            msg.content,
            msg.role
          );
        }
      }
    } catch (error) {
      console.error("Failed to initialize conversation:", error);
    }
  }

  registerCommand(command: CliCommand) {
    this.commands.push(command);
  }

  private setupEventListeners() {
    this.seraph.on(
      "info",
      (response: string, data?: Record<string, unknown>) => {
        console.log(formatInfo(response, data));
      }
    );

    this.seraph.on("functionExecution", (functionExecution: SeraphFunction) => {
      console.log(
        formatSystemMessage(`Executing function: ${functionExecution.name}`)
      );
    });

    this.seraph.on("functionResult", (functionResult: SeraphFunction) => {
      console.log(
        formatFunction(
          functionResult.name || "Unknown Function",
          functionResult.result || "No result"
        )
      );
    });

    this.seraph.on(
      "middlewareExecution",
      (middlewareExecution: SeraphFunction) => {
        console.log(
          formatSystemMessage(
            `Executing middleware: ${middlewareExecution.name}`
          )
        );
      }
    );

    this.seraph.on("middlewareResult", (middlewareResult: SeraphFunction) => {
      console.log(
        formatFunction(
          middlewareResult.name || "Unknown Middleware",
          middlewareResult.result || "No result"
        )
      );
    });

    this.seraph.on("message", (message: string) => {
      console.log(formatResponse(message));
    });
  }

  private registerCommands() {
    this.registerCommand({
      name: "!vim",
      description: "!vim - Opens text editor to input text",
      handler: this.handleVimCommand.bind(this),
    });

    this.registerCommand({
      name: "!test",
      description: "!test - Test command",
      handler: async () => {
        console.log("!test - Test command executed.");
      },
    });

    this.registerCommand({
      name: "!prompt",
      description: "!prompt - Display the latest current system prompt",
      handler: this.handleGetPrompt.bind(this),
    });

    this.registerCommand({
      name: "!messages",
      description: "!messages - Display the conversation messages",
      handler: this.handleGetMessages.bind(this),
    });

    this.registerCommand({
      name: "!clearLastMessage",
      description: "!clearLastMessage - Clear the last message",
      handler: this.handleClearLastMessage.bind(this),
    });

    this.registerCommand({
      name: "!memory-diagnostics",
      description: "!memory-diagnostics - Run diagnostics on the memory system",
      handler: this.handleMemoryDiagnostics.bind(this),
    });
  }

  private async handleClearLastMessage() {
    const messages = this.seraph.conversationManager.getMessages(
      this.conversationId
    );

    const lastMessage = messages[messages.length - 1];
    if (lastMessage) {
      this.seraph.conversationManager.removeLastMessage(this.conversationId);
      console.log("Last message removed.");
    } else {
      console.log("No messages to remove.");
    }
  }

  private async handleGetMessages() {
    const messages = this.seraph.conversationManager.getMessages(
      this.conversationId
    );

    console.log("Conversation messages:");
    console.log(messages);
  }

  private async handleGetPrompt() {
    console.log("Current system prompt:");
    console.log(await this.seraph.generateSystemPrompt());
  }

  private async handleVimCommand() {
    const userInput = await this.openExternalEditor();
    logUpdate(chalk.yellow("User input:") + "\n" + userInput);
    await this.sendMessage(userInput);
  }

  private async openExternalEditor(): Promise<string> {
    const tempFilePath = path.join(
      os.tmpdir(),
      `seraph_input_${Date.now()}.txt`
    );

    await new Promise<void>((resolve) => {
      const vim = spawn("vim", [tempFilePath], { stdio: "inherit" });
      vim.on("exit", () => {
        resolve();
      });
    });

    const userInput = fs.readFileSync(tempFilePath, "utf-8");
    fs.unlinkSync(tempFilePath);

    return userInput;
  }

  private setupCommanderProgram() {
    const program = new Command();

    program
      .version("1.0.0")
      .description("Seraph CLI - An AI assistant")
      .action(this.startConversation.bind(this));

    program.parseAsync(process.argv).catch((error) => {
      console.error("An error occurred:", error);
    });
  }

  private startConversation() {
    console.log(formatSystemMessage("Welcome to the Seraph CLI!"));
    console.log(formatSystemMessage('Type "exit" to end the conversation.\n'));
    this.conversationLoop();
  }

  // Display the command menu and handle user selection
  async displayCommandMenu() {
    const { selectedCommand } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedCommand",
        message: "Select a command:",
        choices: this.commands.map((command) => ({
          name: command.description,
          value: command,
        })),
      },
    ]);

    // Run the selected command's handler
    await selectedCommand.handler();
  }

  // Handle direct command execution
  async handleDirectCommand(commandName: string) {
    const command = this.commands.find((cmd) => cmd.name === commandName);

    if (command) {
      await command.handler();
    } else {
      console.log(`Unknown command: ${commandName}`);
    }
  }

  private async sendMessage(message: string) {
    try {
      await this.seraph.processInputSync(message, this.conversationId, false);
    } catch (error) {
      console.error("An error occurred:", error);
    }
  }

  private async conversationLoop() {
    if (!this.seraph.disableInput) {
      const { input } = await inquirer.prompt([
        {
          type: "input",
          name: "input",
          message: styles.user("You:"),
          prefix: "⟩",
        },
      ]);

      if (input.trim().toLowerCase() === "exit") {
        console.log(formatSystemMessage("Conversation ended."));
        return;
      }

      if (input.startsWith("!")) {
        if (input === "!help") {
          await this.displayCommandMenu();
        } else {
          await this.handleDirectCommand(input);
        }
      } else {
        if (!this.seraph.disableInput) this.sendMessage(input);
      }
    }

    if (this.seraph.disableInput) {
      setTimeout(() => {
        this.conversationLoop();
      }, 100);
    } else {
      this.conversationLoop();
    }
  }

  private async handleMemoryDiagnostics() {
    try {
      const memoryStorage = this.seraph.cognitiveFunctions.memoryStorage as any;
      const store = await memoryStorage.store;
      const diagnostics = await store.diagnostics();

      if (diagnostics.status === "ok") {
        console.log(
          formatInfo("Memory System Diagnostics", {
            status: "OK",
            ...diagnostics.details,
          })
        );
      } else {
        console.log(formatError("Memory System Diagnostics Failed"));
        console.log(formatInfo("Error Details", diagnostics.details));
      }
    } catch (error) {
      console.log(formatError("Failed to run memory diagnostics"));
      if (error instanceof Error) {
        console.log(
          formatInfo("Error Details", {
            message: error.message,
            name: error.name,
            stack: error.stack,
          })
        );
      }
    }
  }
}

export default SeraphCLI;
