#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { ForgeAgent } from "./agent.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf-8"));

const program = new Command();

program
  .name("forge")
  .description("Forge — AI coding agent for your terminal (inspired by Gemini CLI)")
  .version(pkg.version)
  .option("-p, --prompt <text>", "Run a single prompt non-interactively")
  .option("-m, --model <name>", "Model to use", "gemini-3.8-flash")
  .option("-y, --yolo", "Skip confirmation warnings for mutating tools")
  .option("-v, --verbose", "Verbose logging")
  .option("--cwd <path>", "Working directory", process.cwd())
  .action(async (opts) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      console.error(
        chalk.red("Error: No API key found.\n") +
          "Set " +
          chalk.cyan("GEMINI_API_KEY") +
          " or " +
          chalk.cyan("GOOGLE_API_KEY") +
          " environment variable.\n\n" +
          "Get a free key at: " +
          chalk.underline("https://aistudio.google.com/apikey")
      );
      process.exit(1);
    }

    const agent = new ForgeAgent({
      apiKey,
      model: opts.model,
      cwd: path.resolve(opts.cwd),
      yolo: opts.yolo,
      verbose: opts.verbose,
    });

    await agent.loadContextFiles();

    console.log(
      chalk.bold.cyan("\n  ⚒️  Forge CLI") +
        chalk.dim(`  v${pkg.version}`) +
        "\n" +
        chalk.dim("  AI coding agent for your terminal\n")
    );

    if (opts.prompt) {
      await agent.run(opts.prompt);
      console.log();
      return;
    }

    const rl = readline.createInterface({ input, output });

    console.log(chalk.dim("Type your request, or /help for commands. Ctrl+C or /quit to exit.\n"));

    while (true) {
      let userInput: string;
      try {
        userInput = await rl.question(chalk.green("❯ "));
      } catch {
        break;
      }

      const trimmed = userInput.trim();
      if (!trimmed) continue;

      if (trimmed === "/quit" || trimmed === "/exit") {
        console.log(chalk.dim("Goodbye."));
        break;
      }

      if (trimmed === "/help") {
        console.log(`
${chalk.bold("Commands")}
  /help          Show this help
  /clear         Clear conversation history
  /cwd           Show current working directory
  /quit, /exit   Exit Forge

${chalk.bold("Tips")}
  • Ask to explore the codebase: "summarize this project"
  • Edit files: "add a README section about installation"
  • Run commands: "run the tests and fix any failures"
  • Create context: put project instructions in FORGE.md
`);
        continue;
      }

      if (trimmed === "/clear") {
        agent.clearHistory();
        console.log(chalk.dim("History cleared."));
        continue;
      }

      if (trimmed === "/cwd") {
        console.log(chalk.dim(opts.cwd));
        continue;
      }

      try {
        await agent.run(trimmed);
        console.log();
      } catch (err: any) {
        console.error(chalk.red(`\nError: ${err.message}\n`));
      }
    }

    rl.close();
  });

program.parse();
