#!/usr/bin/env node

import { SeraphCore } from './seraphCore';
import * as dotenv from "dotenv";
import { MemoryRetrieval } from './cognitive_functions/memory/memory';
import SeraphCLI from './seraphCLI';
import { MemoryStorageMiddleware } from './middleware/memory_storage_middleware';
import { BashExecutor } from './cognitive_functions/bash_executor';
import { importPrivatePrompts } from './utils';
import path from "path";
import os from "os";
import fs from "fs";

// Setup Seraph's home directory
const SERAPH_HOME =
  process.env.SERAPH_HOME || path.join(os.homedir(), ".seraph");
const CONFIG_PATH = path.join(SERAPH_HOME, "config");
const MEMORY_PATH = path.join(SERAPH_HOME, "memory");
const CONVERSATIONS_PATH = path.join(SERAPH_HOME, "conversations");

// Ensure Seraph directories exist
[SERAPH_HOME, CONFIG_PATH, MEMORY_PATH, CONVERSATIONS_PATH].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Load environment from user's home directory
const envPath = path.join(SERAPH_HOME, ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  // Create default .env if it doesn't exist
  const defaultEnv = `# Seraph Configuration
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
`;
  fs.writeFileSync(envPath, defaultEnv);
  console.log(`Created default configuration at ${envPath}`);
  console.log("Please add your API keys to continue.");
  process.exit(1);
}

// Validate API keys
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not defined. Please add to ~/.seraph/.env");
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error(
    "ANTHROPIC_API_KEY is not defined. Please add to ~/.seraph/.env"
  );
  process.exit(1);
}

async function main() {
  try {
    const prompt =
      (await importPrivatePrompts()) || "You are seraph, a helpful AI angel.";

    const seraph = new SeraphCore({
      prompt,
      openAIApiKey: process.env.OPENAI_API_KEY as string,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY as string,
      conversationsPath: CONVERSATIONS_PATH,
      memoryPath: MEMORY_PATH,
      configPath: CONFIG_PATH,
    });

    // Register middleware and cognitive functions
    seraph.registerMiddleware(new MemoryStorageMiddleware(seraph));
    seraph.registerCognitiveFunction(new MemoryRetrieval(seraph, MEMORY_PATH));
    seraph.registerCognitiveFunction(new BashExecutor(seraph));

    // Start CLI
    new SeraphCLI(seraph);
  } catch (error) {
    console.error("Failed to start Seraph:", error);
    process.exit(1);
  }
}

main();
