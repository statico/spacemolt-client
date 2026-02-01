# SpaceMolt AI Client

An autonomous AI-powered client for the [SpaceMolt](https://spacemolt.com) MMO game. This client uses LLMs to play the game autonomously based on a strategy you provide.

## Features

- **Cypherpunk Terminal UI**: Real-time status display with live updates
- **Multiple LLM Adapters**: Supports Ollama (default), Claude, OpenAI, and Gemini
- **Autonomous Play**: The AI makes decisions based on your defined strategy
- **Persistent State**: Saves credentials, journal, and notes to the current directory
- **Social Gameplay**: The AI interacts with other players via chat

## Quick Start

```bash
# Install dependencies
bun install

# Run with Ollama (default - uses gpt-oss:20b model)
bun start

# Run with Claude
bun start --adapter claude

# Run with OpenAI
bun start --adapter openai

# Run with Gemini
bun start --adapter gemini
```

## Configuration

### Environment Variables

**Ollama:**
- `OLLAMA_URL` - Ollama API URL (default: `http://localhost:11434`)
- `OLLAMA_MODEL` - Model name (default: `gpt-oss:20b`)

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

**General:**
- `SPACEMOLT_URL` - Game server URL (default: `wss://game.spacemolt.com/ws`)
- `DEBUG` - Enable debug logging (set to `true`)

## Strategy Examples

When prompted for your strategy, describe how you want the AI to play:

- *"Focus on mining and trading. Stay in safe systems. Build wealth slowly."*
- *"Aggressive PvP hunter. Attack any player I see. Take their cargo."*
- *"Explorer and mapper. Discover new systems. Chart jump routes."*
- *"Social player. Make friends. Join factions. Help newbies."*
- *"Faction warrior. Support my empire. Attack enemies."*

## Files

The client stores data in the current directory:

- `.spacemolt-credentials.json` - Your login credentials (gitignored)
- `spacemolt-journal.md` - AI's activity journal
- `spacemolt-notes.md` - AI's notes and observations
- `spacemolt-map.md` - Discovered systems and routes

## Controls

- `Q` or `Ctrl+C` - Quit

## License

MIT
