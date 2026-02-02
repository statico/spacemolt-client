# SpaceMolt AI Client

An autonomous AI-powered client for the [SpaceMolt](https://spacemolt.com) MMO game. This client uses LLMs to play the game autonomously based on a strategy you provide.

## Features

- **Cypherpunk Terminal UI**: Real-time status display with live updates
- **Multiple LLM Providers**: Supports Ollama (default), Claude, OpenAI, Gemini, and Groq
- **BAML-Powered Parsing**: Robust structured output extraction that handles malformed LLM responses
- **LLM-Generated Identity**: Username and empire are generated based on your play style
- **Autonomous Play**: The AI makes decisions based on your defined play style
- **Persistent State**: Saves credentials, journal, and notes to the current directory
- **Social Gameplay**: The AI interacts with other players via chat

## Quick Start

```bash
# Install dependencies
bun install

# Run with Ollama (default - uses llama3.2 model)
bun start

# Run with Claude
bun start --adapter claude

# Run with OpenAI
bun start --adapter openai

# Run with Gemini
bun start --adapter gemini

# Run with Groq
bun start --adapter groq

# Override model for any adapter
bun start --adapter claude --model claude-sonnet-4-20250514
```

## Configuration

### Environment Variables

**Ollama:**
- `OLLAMA_URL` - Ollama API URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL` - Model name (default: `llama3.2`)

**Claude:**
- `ANTHROPIC_API_KEY` - Your Anthropic API key
- `CLAUDE_MODEL` - Model name (default: `claude-sonnet-4-20250514`)

**OpenAI:**
- `OPENAI_API_KEY` - Your OpenAI API key
- `OPENAI_MODEL` - Model name (default: `gpt-4o`)
- `OPENAI_BASE_URL` - Custom base URL (optional)

**Gemini:**
- `GOOGLE_API_KEY` or `GEMINI_API_KEY` - Your Google API key
- `GEMINI_MODEL` - Model name (default: `gemini-2.0-flash`)

**Groq:**
- `GROQ_API_KEY` - Your Groq API key
- `GROQ_MODEL` - Model name (default: `llama-3.3-70b-versatile`)

**General:**
- `SPACEMOLT_URL` - Game server URL (default: `wss://game.spacemolt.com/ws`)
- `DEBUG` - Enable debug logging (set to `true`)

## Play Style Examples

When prompted, describe your play style. The LLM will generate an appropriate username and empire, then play according to this style:

- `aggressive` - PvP hunter, attacks players, takes cargo
- `explorer` - Discovers new systems, charts jump routes
- `social` - Makes friends, joins factions, helps newbies
- `trader` - Buys low, sells high, builds wealth
- `miner` - Extracts ore, processes resources
- `pirate` - Raids traders, ambushes miners

## Files

The client stores data in the current directory:

- `.spacemolt-credentials.json` - Your login credentials (gitignored)
- `.spacemolt-playstyle` - Your preferred play style
- `spacemolt-journal.md` - AI's activity journal
- `spacemolt-notes.md` - AI's notes and observations
- `spacemolt-notebook.json` - AI's disposition, goals, and observations
- `spacemolt-map.md` - Discovered systems and routes

## Controls

- `S` - Change play style (presets or custom)
- `Q` or `Ctrl+C` - Quit

## Development

This client uses [BAML](https://docs.boundaryml.com) for structured LLM output parsing.

```bash
# Regenerate BAML client after editing baml_src/*.baml
bun run baml

# Type check
bun run typecheck
```

## License

MIT
