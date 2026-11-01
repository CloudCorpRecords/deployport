#!/usr/bin/env node
/**
 * deployport CLI.
 *   deployport <tool-name> '<json args>'
 *   deployport mcp
 * Requires VERCEL_TOKEN. Exit codes: 0 success, 1 error, 2 usage.
 */
import { apiBaseFromEnv, callTool, teamIdFromEnv, tokenFromEnv, VERSION } from "./vercel.js";
import type { FetchFn } from "./types.js";

const TOOL_NAMES = [
  "list_projects", "get_project", "create_project", "delete_project",
  "list_deployments", "get_deployment", "create_deployment",
  "cancel_deployment", "list_domains", "get_deployment_events",
  "list_project_env_vars", "get_current_user",
];

function usage(): never {
  console.error(`Usage:
  deployport <tool> '<json args>'   tools: ${TOOL_NAMES.join(", ")}
  deployport mcp
  deployport --version`);
  process.exit(2);
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === "--version" || cmd === "-v") { console.log(VERSION); return; }
  if (cmd === "mcp") { await import("./mcp.js"); return; }
  if (!cmd || !TOOL_NAMES.includes(cmd)) usage();
  let args: Record<string, unknown> = {};
  const raw = rest.join(" ").trim();
  if (raw) {
    try {
      args = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      console.error("error: args must be a JSON object");
      process.exit(1);
    }
  }
  try {
    const fetchFn = globalThis.fetch as unknown as FetchFn;
    const out = await callTool(fetchFn, tokenFromEnv(), apiBaseFromEnv(), teamIdFromEnv(), cmd, args);
    console.log(typeof out === "string" ? out : JSON.stringify(out, null, 2));
  } catch (err) {
    console.error(`error: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
void main();
