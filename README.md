# Seraph AI System

Seraph is an advanced AI assistant system designed to provide intelligent, context-aware interactions through a CLI interface. It features a sophisticated cognitive architecture with memory persistence, function execution capabilities, and middleware support.

## Features

- **Persistent Memory**: Long-term storage and retrieval of information using semantic search
- **Cognitive Functions**: Extensible system of tools and functions that Seraph can use to help users
- **Middleware System**: Pluggable middleware architecture for customizing behavior and adding capabilities
- **CLI Interface**: Clean, user-friendly command-line interface with formatted output
- **Conversation History**: Maintains context across sessions with conversation persistence

## Installation

1. Clone the repository:

```bash
git clone https://github.com/oneirocom/seraph.git
cd seraph
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env
```

Add your API keys to the `.env` file:

```
OPENAI_API_KEY=your_openai_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
```

4. Build the project:

```bash
npm run build
```

## Usage

Start Seraph:

```bash
npm start
```

### Available Commands

- `!help` - Display available commands
- `!vim` - Open text editor for multi-line input
- `!prompt` - Display current system prompt
- `!messages` - Show conversation history
- `!clearLastMessage` - Remove last message
- `!memory-diagnostics` - Run diagnostics on memory system

Type `exit` to end the conversation.

## Architecture

Seraph is built with a modular architecture consisting of several key components:

### Core Components

- **SeraphCore**: Main system orchestrator
- **ConversationManager**: Handles conversation state and persistence
- **CognitiveFunctionExecutor**: Manages execution of cognitive functions
- **MiddlewareManager**: Handles middleware registration and execution
- **ResponseParser**: Processes and parses AI responses
- **MemoryStore**: Manages semantic memory storage and retrieval

### Memory System

Seraph uses a sophisticated memory system with different types:

- `code`: Stores generated code and related information
- `context`: Stores contextual information
- `reflection`: Stores self-reflection and performance metrics
- `facts`: Stores facts and general knowledge
- `system`: Stores system-related information

### Cognitive Functions

Seraph comes with built-in cognitive functions:

- Memory Storage and Retrieval
- Bash Command Execution
- Custom function support

## Development

### Project Structure

```
src/
├── lib/
│   ├── cognitive_functions/    # Cognitive function implementations
│   ├── middleware/            # Middleware implementations
│   ├── seraphCore.ts         # Core system implementation
│   ├── conversation_manager.ts # Conversation handling
│   ├── response_parser.ts    # Response parsing logic
│   └── seraphCLI.ts         # CLI interface
```

### Adding New Functions

1. Create a new class extending `BaseCognitiveFunction`
2. Implement the required methods
3. Register the function in `src/lib/cli.ts`

Example:

```typescript
class NewFunction extends BaseCognitiveFunction {
  constructor(seraph: SeraphCore) {
    super({
      name: "newFunction",
      description: "Description of the function",
      parameters: {
        param1: {
          type: "string",
          description: "Parameter description",
        },
      },
    });
  }

  async execute(args: Record<string, any>): Promise<string> {
    // Implementation
  }
}
```

### Adding New Middleware

1. Create a new class implementing `IMiddleware`
2. Implement the required methods
3. Register the middleware in `src/lib/cli.ts`

Example:

```typescript
class NewMiddleware implements IMiddleware {
  name = "newMiddleware";
  schema = z.object({
    // Schema definition
  });

  async run(response: string): Promise<string> {
    // Implementation
  }
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License - See LICENSE file for details
