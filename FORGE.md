# Forge CLI Project Context

This is **Forge CLI** – an open-source AI coding agent for the terminal, inspired by Gemini CLI.

## Tech Stack
- TypeScript (Node.js ≥ 18)
- @google/generative-ai for Gemini models
- commander for CLI parsing
- chalk + ora for terminal UX

## Conventions
- Keep the agent loop simple and reliable.
- Prefer clear error messages over silent failures.
- Tools should return useful, truncated output when large.
- Never hardcode secrets.

## Common tasks
- Adding a new tool: update `toolDefinitions` + `executeTool` in `src/tools.ts`
- Improving the system prompt: edit `SYSTEM_PROMPT` in `src/agent.ts`
