import { z } from "zod";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execAsync = promisify(exec);

export const toolSchemas = {
  list_dir: z.object({
    path: z.string().describe("Directory path to list (relative or absolute)"),
  }),
  read_file: z.object({
    path: z.string().describe("File path to read"),
  }),
  write_file: z.object({
    path: z.string().describe("File path to write"),
    content: z.string().describe("Content to write to the file"),
  }),
  run_shell: z.object({
    command: z.string().describe("Shell command to execute"),
    cwd: z.string().optional().describe("Working directory for the command"),
  }),
  search_files: z.object({
    pattern: z.string().describe("Search pattern (glob or simple text)"),
    path: z.string().optional().describe("Directory to search in (default: current)"),
  }),
};

export type ToolName = keyof typeof toolSchemas;

export const toolDefinitions = [
  {
    name: "list_dir",
    description: "List files and directories in a given path.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path to list" },
      },
      required: ["path"],
    },
  },
  {
    name: "read_file",
    description: "Read the contents of a file.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to read" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write content to a file. Creates the file if it does not exist. Overwrites if it does.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to write" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "run_shell",
    description: "Execute a shell command and return stdout/stderr. Use with caution.",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Command to run" },
        cwd: { type: "string", description: "Optional working directory" },
      },
      required: ["command"],
    },
  },
  {
    name: "search_files",
    description: "Search for files matching a pattern in a directory.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Search pattern" },
        path: { type: "string", description: "Directory to search" },
      },
      required: ["pattern"],
    },
  },
];

export async function executeTool(
  name: ToolName,
  args: Record<string, unknown>,
  baseDir: string = process.cwd()
): Promise<string> {
  try {
    switch (name) {
      case "list_dir": {
        const dirPath = path.resolve(baseDir, String(args.path || "."));
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const items = entries.map((e) => ({
          name: e.name,
          type: e.isDirectory() ? "dir" : "file",
        }));
        return JSON.stringify(items, null, 2);
      }
      case "read_file": {
        const filePath = path.resolve(baseDir, String(args.path));
        const content = await fs.readFile(filePath, "utf-8");
        if (content.length > 50_000) {
          return content.slice(0, 50_000) + "\n\n... [truncated, file too large]";
        }
        return content;
      }
      case "write_file": {
        const filePath = path.resolve(baseDir, String(args.path));
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, String(args.content), "utf-8");
        return `Successfully wrote to ${args.path}`;
      }
      case "run_shell": {
        const { stdout, stderr } = await execAsync(String(args.command), {
          cwd: args.cwd ? path.resolve(baseDir, String(args.cwd)) : baseDir,
          timeout: 30_000,
          maxBuffer: 1024 * 1024,
        });
        let result = "";
        if (stdout) result += `stdout:\n${stdout}`;
        if (stderr) result += `\nstderr:\n${stderr}`;
        return result || "(no output)";
      }
      case "search_files": {
        const searchPath = path.resolve(baseDir, String(args.path || "."));
        const results: string[] = [];
        async function walk(dir: string, depth = 0) {
          if (depth > 5 || results.length > 50) return;
          try {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const e of entries) {
              if (e.name.startsWith(".") || e.name === "node_modules") continue;
              const full = path.join(dir, e.name);
              if (e.name.includes(String(args.pattern)) || e.name.match(new RegExp(String(args.pattern), "i"))) {
                results.push(path.relative(baseDir, full));
              }
              if (e.isDirectory()) await walk(full, depth + 1);
            }
          } catch {}
        }
        await walk(searchPath);
        return results.length ? results.join("\n") : "No matches found";
      }
      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err: any) {
    return `Error executing ${name}: ${err.message}`;
  }
}
