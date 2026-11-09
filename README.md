# ⚒️ Forge CLI

**An open-source AI terminal agent inspired by [Gemini CLI](https://github.com/google-gemini/gemini-cli).**

Bring powerful AI coding assistance directly into your terminal. Understand codebases, edit files, run commands, and automate workflows using natural language.

```bash
npx tsx src/index.ts
# or after build
npm run build && npm start
```

## Features

- **Interactive REPL** – Chat with the agent in your terminal
- **Non-interactive mode** – `forge -p "summarize this repo"` for scripts
- **Built-in tools**
  - `list_dir` / `read_file` / `write_file`
  - `run_shell` (with safety warnings)
  - `search_files`
- **Project context** – Automatically loads `FORGE.md`, `GEMINI.md`, or `AGENTS.md`
- **Gemini models** – Uses Google’s Gemini API (free tier available)
- **Clean terminal UX** – Colored output, tool call visualization, spinners

## Quick Start

### 1. Get an API key
Go to [Google AI Studio](https://aistudio.google.com/apikey) and create a free Gemini API key.

### 2. Set the key
```bash
export GEMINI_API_KEY="your-key-here"
```

### 3. Run
```bash
# From source
npm install
npm run dev

# One-shot
npm run dev -- -p "Explain the architecture of this project"

# YOLO mode (skip mutation warnings)
npm run dev -- --yolo
```

## Installation (from source)

```bash
git clone https://github.com/varshithpediredla-ctrl/forge-cli.git
cd forge-cli
npm install
npm run build
npm link          # optional – makes `forge` available globally
```

## Usage Examples

```bash
# Start interactive session
npm run dev

# Ask a question non-interactively
npm run dev -- -p "What does the main entry point do?"

# Use a different model
npm run dev -- -m gemini-2.0-flash

# Work in a specific directory
npm run dev -- --cwd ../my-other-project
```

### Inside the REPL

```
❯ summarize this project
❯ add error handling to the agent loop
❯ run npm test and fix any failures
❯ /help
❯ /clear
❯ /quit
```

## Project Context (`FORGE.md`)

Create a `FORGE.md` (or `GEMINI.md`) in your project root. Forge automatically loads it as persistent context.

## Configuration

| Flag / Env              | Description                          | Default              |
|-------------------------|--------------------------------------|----------------------|
| `GEMINI_API_KEY`        | Required API key                     | –                    |
| `-m, --model`           | Model name                           | `gemini-2.0-flash`   |
| `-p, --prompt`          | Non-interactive prompt               | –                    |
| `-y, --yolo`            | Skip mutation warnings               | false                |
| `-v, --verbose`         | Extra logging                        | false                |
| `--cwd`                 | Working directory                    | `process.cwd()`      |

## Architecture

```
src/
├── index.ts      # CLI entry + REPL
├── agent.ts      # Agent loop, Gemini integration, history
└── tools.ts      # Tool definitions + execution (fs, shell, search)
```

The agent follows a simple ReAct-style loop:
1. Send conversation + tools to the model
2. If the model returns function calls → execute them
3. Feed results back and repeat until the model is done

## Roadmap (inspired by Gemini CLI)

- [ ] MCP server support
- [ ] Custom slash commands
- [ ] Session checkpointing / resume
- [ ] Plan mode (read-only)
- [ ] Interactive confirmation prompts
- [ ] Streaming token display
- [ ] Multi-file atomic edits
- [ ] Sandboxed shell execution

## License

Apache-2.0

---

Inspired by [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli).  
Built for developers who live in the terminal.
