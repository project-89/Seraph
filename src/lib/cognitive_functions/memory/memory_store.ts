import { IndexItem, LocalIndex } from "vectra";
import { OpenAI } from "openai";
import path from "path";
import { z } from "zod";
import fs from "fs/promises";

export enum MemoryType {
  Code = "code",
  Context = "context",
  Reflection = "reflection",
  Facts = "facts",
  System = "system",
}

export class MemoryStoreError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "MemoryStoreError";
  }
}

export const metadataSchemaRegistry = new Map<string, z.ZodType>();

// Register some default metadata schemas
metadataSchemaRegistry.set(
  "category",
  z.string().describe("Category of the memory")
);
metadataSchemaRegistry.set(
  "timestamp",
  z.string().datetime().describe("When the memory was created")
);
metadataSchemaRegistry.set(
  "importance",
  z.number().min(1).max(10).describe("Importance rating from 1-10")
);
metadataSchemaRegistry.set(
  "source",
  z.string().describe("Source of the memory")
);

export class MemoryStore {
  private index: LocalIndex;
  private openAIApi: OpenAI;
  private static instance: MemoryStore;
  private storagePath: string;

  private constructor(openAIApiKey: string, storagePath: string) {
    this.storagePath = storagePath;
    try {
      this.openAIApi = new OpenAI({
        apiKey: openAIApiKey,
      });
      this.index = new LocalIndex(storagePath);
    } catch (error) {
      throw new MemoryStoreError("Failed to initialize MemoryStore", error);
    }
  }

  static async getInstance(
    openAIApiKey: string,
    storagePath: string
  ): Promise<MemoryStore> {
    if (!MemoryStore.instance) {
      // Ensure storage directory exists
      try {
        await fs.mkdir(path.dirname(storagePath), { recursive: true });
      } catch (error) {
        throw new MemoryStoreError("Failed to create storage directory", error);
      }

      MemoryStore.instance = new MemoryStore(openAIApiKey, storagePath);

      try {
        if (!(await MemoryStore.instance.index.isIndexCreated())) {
          await MemoryStore.instance.index.createIndex();
        }
      } catch (error) {
        throw new MemoryStoreError("Failed to initialize vector index", error);
      }
    }
    return MemoryStore.instance;
  }

  async store(params: {
    content: string;
    query: string;
    type: MemoryType;
    metadata?: Record<string, any>;
  }): Promise<IndexItem<any>> {
    const { content, query, type, metadata = {} } = params;

    try {
      // Validate metadata against registered schemas
      const validatedMetadata: Record<string, any> = {};
      for (const [key, value] of Object.entries(metadata)) {
        const schema = metadataSchemaRegistry.get(key);
        if (schema) {
          validatedMetadata[key] = schema.parse(value);
        }
      }

      const vector = await this.getVector(query);
      const item = await this.index.insertItem({
        vector,
        metadata: {
          content,
          query,
          type,
          ...validatedMetadata,
          timestamp: new Date().toISOString(),
        },
      });

      // Verify storage
      const verifyItem = await this.index.getItem(item.id);
      if (!verifyItem) {
        throw new MemoryStoreError("Failed to verify stored item");
      }

      return item;
    } catch (error) {
      throw new MemoryStoreError("Failed to store memory", error);
    }
  }

  async retrieve(params: {
    query: string;
    limit?: number;
    type?: MemoryType;
    metadata?: Record<string, any>;
  }): Promise<
    Array<{
      content: string;
      query: string;
      type: MemoryType;
      metadata: Record<string, any>;
      similarity: number;
    }>
  > {
    try {
      const { query, limit = 5, type, metadata = {} } = params;
      const vector = await this.getVector(query);

      const filter = {
        ...(type && { type }),
        ...metadata,
      };

      const results = await this.index.queryItems(vector, limit, filter);

      if (!results.length) {
        console.log("No results found for query:", { query, type, metadata });
      }

      return results.map((result) => ({
        content: result.item.metadata.content as string,
        query: result.item.metadata.query as string,
        type: result.item.metadata.type as MemoryType,
        metadata: Object.fromEntries(
          Object.entries(result.item.metadata).filter(
            ([key]) => !["content", "query", "type"].includes(key)
          )
        ),
        similarity: result.score,
      }));
    } catch (error) {
      throw new MemoryStoreError("Failed to retrieve memories", error);
    }
  }

  async getVector(text: string): Promise<number[]> {
    try {
      const response = await this.openAIApi.embeddings.create({
        model: "text-embedding-ada-002",
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      throw new MemoryStoreError("Failed to generate embedding vector", error);
    }
  }

  async diagnostics(): Promise<{
    status: "ok" | "error";
    details: Record<string, any>;
  }> {
    try {
      const indexExists = await this.index.isIndexCreated();
      const storageExists = await fs
        .access(this.storagePath)
        .then(() => true)
        .catch(() => false);

      // Test vector generation
      const testVector = await this.getVector("test");

      return {
        status: "ok",
        details: {
          indexExists,
          storageExists,
          storagePath: this.storagePath,
          vectorGeneration: testVector.length > 0 ? "ok" : "error",
        },
      };
    } catch (error) {
      return {
        status: "error",
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
          storagePath: this.storagePath,
        },
      };
    }
  }

  async registerMetadataSchema(key: string, schema: z.ZodType) {
    metadataSchemaRegistry.set(key, schema);
  }

  getRegisteredMetadataSchemas(): Array<{ key: string; description: string }> {
    return Array.from(metadataSchemaRegistry.entries()).map(
      ([key, schema]) => ({
        key,
        description: schema.description || "No description available",
      })
    );
  }
}
