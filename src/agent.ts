import { GoogleGenerativeAI, SchemaType, type Content, type Part } from "@google/generative-ai";
import { toolDefinitions, executeTool, type ToolName } from "./tools.js";
import chalk from "chalk";
import ora from "ora";
import fs from "node:fs/promises";
import path from "node:path";

const SYSTEM_PROMPT = `You are Forge, a powerful AI coding agent that lives in the terminal.
You help users understand codebases, write and edit code, run commands, and automate tasks.

Guidelines:
- Be concise and practical.
- Prefer using tools over guessing file contents.
- When editing code, make precise, minimal changes.
- Explain what you are about to do before calling tools when helpful.
- After tool results, reason about them and continue until the task is complete.
- Never invent file paths or code that doesn't exist — always check with tools.
- For complex tasks, break them into steps.

You have access to tools for listing directories, reading/writing files, running shell commands, and searching files.
`;

export interface AgentOptions {
  apiKey: string;
  model?: string;
  cwd?: string;
  yolo?: boolean;
  verbose?: boolean;
}

export class ForgeAgent {
  private genAI: GoogleGenerativeAI;
  private modelName: string;
  private history: Content[] = [];
  private cwd: string;
  private yolo: boolean;
  private verbose: boolean;

  constructor(opts: AgentOptions) {
    this.genAI = new GoogleGenerativeAI(opts.apiKey);
    this.modelName = opts.model || "gemini-3.8-flash";
    this.cwd = opts.cwd || process.cwd();
    this.yolo = opts.yolo ?? false;
    this.verbose = opts.verbose ?? false;
  }

  async loadContextFiles() {
    const candidates = ["FORGE.md", "GEMINI.md", "AGENTS.md", "CLAUDE.md"];
    for (const name of candidates) {
      try {
        const content = await fs.readFile(path.join(this.cwd, name), "utf-8");
        this.history.push({
          role: "user",
          parts: [{ text: `Project context from ${name}:\n\n${content}` }],
        });
        this.history.push({
          role: "model",
          parts: [{ text: `Understood. I have loaded the project context from ${name}.` }],
        });
        if (this.verbose) console.log(chalk.dim(`Loaded context from ${name}`));
        break;
      } catch {
        // ignore
      }
    }
  }

  private getModel() {
    return this.genAI.getGenerativeModel({
      model: this.modelName,
      systemInstruction: SYSTEM_PROMPT,
      tools: [
        {
          functionDeclarations: toolDefinitions.map((t) => ({
            name: t.name,
            description: t.description,
            parameters: {
              type: SchemaType.OBJECT,
              properties: Object.fromEntries(
                Object.entries(t.parameters.properties).map(([k, v]: [string, any]) => [
                  k,
                  { type: SchemaType.STRING, description: v.description },
                ])
              ),
 required: t.parameters.required || [],
            },
          })),
        },
      ],
    });
  }

  async run(prompt: string, onToken?: (text: string) => void): Promise<string> {
    this.history.push({ role: "user", parts: [{ text: prompt }] });

    const model = this.getModel();
    let fullResponse = "";
    let iterations = 0;
    const maxIterations = 12;

    while (iterations < maxIterations) {
      iterations++;
      const spinner = ora({ text: chalk.dim("Thinking..."), color: "cyan" }).start();

      try {
        const result = await model.generateContent({
          contents: this.history,
        });

        spinner.stop();

        const response = result.response;
        const candidate = response.candidates?.[0];
        if (!candidate) {
          fullResponse += "\nNo response from model.";
          break;
        }

        const parts = candidate.content.parts || [];
        let textParts: string[] = [];
        let functionCalls: any[] = [];

        for (const part of parts) {
          if ("text" in part && part.text) {
            textParts.push(part.text);
          }
          if ("functionCall" in part && part.functionCall) {
            functionCalls.push(part.functionCall);
          }
        }

        if (textParts.length) {
          const text = textParts.join("");
          fullResponse += text;
          if (onToken) onToken(text);
          else process.stdout.write(text);
        }

        this.history.push({
          role: "model",
          parts: parts as Part[],
        });

        if (functionCalls.length === 0) {
          break;
        }

        const functionResponses: Part[] = [];
        for (const call of functionCalls) {
          const name = call.name as ToolName;
          const args = call.args || {};

          console.log(
            "\n" +
              chalk.bgCyan.black(" TOOL ") +
              " " +
              chalk.cyan(name) +
              chalk.dim(` ${JSON.stringify(args).slice(0, 120)}${JSON.stringify(args).length > 120 ? "..." : ""}`)
          );

          if (!this.yolo && (name === "write_file" || name === "run_shell")) {
            console.log(chalk.yellow("  ⚠  Executing potentially mutating tool (use --yolo to suppress warnings)"));
          }

          const toolResult = await executeTool(name, args, this.cwd);
          const preview =
            toolResult.length > 300 ? toolResult.slice(0, 300) + "\n... [truncated]" : toolResult;
          console.log(chalk.dim(preview));

          functionResponses.push({
            functionResponse: {
              name,
              response: { result: toolResult },
            },
          });
        }

        this.history.push({
          role: "user",
          parts: functionResponses,
        });
      } catch (err: any) {
        spinner.stop();
        const msg = `Error: ${err.message}`;
        console.error(chalk.red(msg));
        fullResponse += "\n" + msg;
        break;
      }
    }

    if (iterations >= maxIterations) {
      console.log(chalk.yellow("\nReached maximum tool iterations."));
    }

    return fullResponse;
  }

  clearHistory() {
    this.history = [];
  }
}
