// memoryStorageMiddleware.ts
import path from "path";
import { IMiddleware } from '../middlewareManager';
import { SeraphCore } from '../seraphCore';
import { z } from "zod";
import {
  MemoryStore,
  MemoryType,
} from '../cognitive_functions/memory/memory_store';

const MEMORY_INDEX_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "cognitive_functions",
  "memory",
  "memory_index"
);

class MemoryStorageMiddleware implements IMiddleware {
  name = "memoryStorage";
  private store: MemoryStore | null = null;
  private seraph: SeraphCore;
  private memoryPath: string;

  constructor(seraph: SeraphCore) {
    this.seraph = seraph;
    this.memoryPath = seraph.options.memoryPath;
  }

  private async getStore() {
    if (!this.store) {
      this.store = await MemoryStore.getInstance(
        this.seraph.options.openAIApiKey,
        this.memoryPath
      );
    }
    return this.store;
  }

  schema = z.object({
    content: z.string(),
    query: z.string(),
    type: z.nativeEnum(MemoryType),
    metadata: z.record(z.any()).optional(),
  });

  async run(response: string): Promise<string> {
    const store = await this.getStore();
    const parsedResponse = JSON.parse(response);
    const {
      content,
      query,
      type,
      metadata = {},
    } = this.schema.parse(parsedResponse);

    const item = await store.store({
      content,
      query,
      type,
      metadata,
    });

    this.seraph.emit("info", "Information stored in memory", item.metadata);
    return `Stored memory ${type} with content "${content}" and metadata ${JSON.stringify(
      item.metadata
    )}`;
  }

  async getPrompt(): Promise<string> {
    const store = await this.getStore();
    const schemas = store.getRegisteredMetadataSchemas();
    const metadataDescriptions = schemas
      .map(({ key, description }) => `- ${key}: ${description}`)
      .join("\n");

    return `
      You can store information in memory as a background process. This won't block your main processing.
      
      The content is what you want to store, and the query is how you'll find it later (make it descriptive).
      
      Available memory types:
      ${Object.entries(MemoryType)
        .map(
          ([key, value]) =>
            `- ${value}: Store ${key.toLowerCase()} related information`
        )
        .join("\n")}

      Available metadata fields:
      ${metadataDescriptions}
    `;
  }
}

export { MemoryStorageMiddleware };
