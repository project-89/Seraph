// memory.ts
import path from "path";
import { BaseCognitiveFunction } from '../../base_cognitive_function';
import { SeraphCore } from '../../seraphCore';
import { MemoryStore, MemoryType } from './memory_store';

const MEMORY_INDEX_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "cognitive_functions",
  "memory",
  "memory_index"
);

const functionDefinition = {
  name: "memoryStorage",
  description:
    "Stores information in memory with semantic search capabilities. You can store any type of information and retrieve it later using natural language queries.",
  parameters: {
    content: {
      type: "string",
      description: "The actual content to be stored in memory",
    },
    query: {
      type: "string",
      description:
        "A semantic search query that best describes how to find this content later",
    },
    type: {
      type: "string",
      description: "Type of memory (code, context, reflection, facts, system)",
    },
    metadata: {
      type: "object",
      description:
        "Additional metadata tags and their values (category, importance, source, etc.)",
    },
  },
  examples: [
    `<invoke>
    <tool_name>memoryStorage</tool_name>
    <parameters>
      <content>The sky is blue because of Rayleigh scattering</content>
      <query>why is the sky blue explanation</query>
      <type>facts</type>
      <metadata>
        <category>science</category>
        <importance>7</importance>
      </metadata>
    </parameters>
  </invoke>`,
  ],
};

class MemoryStorage extends BaseCognitiveFunction {
  private store: MemoryStore | null = null;
  private seraph: SeraphCore;
  private memoryPath: string;

  constructor(seraph: SeraphCore, memoryPath: string) {
    super(functionDefinition);
    this.seraph = seraph;
    this.memoryPath = memoryPath;
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

  async getPromptInjection(): Promise<string> {
    const store = await this.getStore();
    const schemas = store.getRegisteredMetadataSchemas();

    const metadataDescriptions = schemas
      .map(({ key, description }) => `- ${key}: ${description}`)
      .join("\n");

    return `
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

  async execute(args: Record<string, any>): Promise<string> {
    const { content, query, type, metadata = {} } = args;

    if (!Object.values(MemoryType).includes(type)) {
      throw new Error(
        `Invalid memory type: ${type}. Must be one of: ${Object.values(
          MemoryType
        ).join(", ")}`
      );
    }

    const store = await this.getStore();
    const item = await store.store({
      content,
      query,
      type: type as MemoryType,
      metadata,
    });

    this.seraph.emit("info", "Information stored in memory", item.metadata);
    return "Information stored in memory";
  }
}

class MemoryRetrieval extends BaseCognitiveFunction {
  private store: MemoryStore | null = null;
  private seraph: SeraphCore;
  private memoryPath: string;

  constructor(seraph: SeraphCore, memoryPath: string) {
    super({
      name: "memoryRetrieval",
      description: "Retrieves information from memory using semantic search.",
      parameters: {
        query: {
          type: "string",
          description: "Natural language query to search memory",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return",
        },
        type: {
          type: "string",
          description: "Optional: Type of memory to retrieve",
        },
        metadata: {
          type: "object",
          description: "Optional: Metadata filters to apply",
        },
      },
      examples: [
        `<invoke>
        <tool_name>memoryRetrieval</tool_name>
        <parameters>
          <query>why is the sky blue</query>
          <limit>3</limit>
          <type>facts</type>
          <metadata>
            <category>science</category>
          </metadata>
        </parameters>
      </invoke>`,
      ],
    });
    this.seraph = seraph;
    this.memoryPath = memoryPath;
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

  async getPromptInjection(): Promise<string> {
    const store = await this.getStore();
    return store
      .getRegisteredMetadataSchemas()
      .map(({ key, description }) => `- ${key}: ${description}`)
      .join("\n");
  }

  async execute(args: Record<string, any>): Promise<string> {
    const { query, limit = 5, type, metadata = {} } = args;

    if (type && !Object.values(MemoryType).includes(type)) {
      throw new Error(
        `Invalid memory type: ${type}. Must be one of: ${Object.values(
          MemoryType
        ).join(", ")}`
      );
    }

    const store = await this.getStore();
    const results = await store.retrieve({
      query,
      limit,
      type: type as MemoryType | undefined,
      metadata,
    });

    if (results.length > 0) {
      const memories = results.map((result) => {
        const metadataString = Object.entries(result.metadata)
          .map(([key, value]) => `${key}: ${value}`)
          .join(", ");
        return `Type: ${result.type}\nContent: ${
          result.content
        }\nMetadata: ${metadataString}\nSimilarity: ${result.similarity.toFixed(
          2
        )}`;
      });
      const response = `Found ${
        results.length
      } relevant memories:\n\n${memories.join("\n\n")}`;
      this.seraph.emit("info", response);
      return response;
    }

    return "No relevant memories found.";
  }
}

export { MemoryStorage, MemoryRetrieval };
