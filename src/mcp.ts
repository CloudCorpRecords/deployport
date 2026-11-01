/**
 * deployport MCP server. Core subset: 12 tools.
 *
 * Low-level Server API with explicit inputSchema literals (the
 * McpServer+zod path injects $schema/additionalProperties and breaks
 * parity). Zod still validates call args. The literals match the
 * labelled core-subset fixture exactly.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { apiBaseFromEnv, callTool, teamIdFromEnv, tokenFromEnv, VERSION } from "./vercel.js";
import type { FetchFn } from "./types.js";

const ARG_SCHEMAS: Record<string, z.ZodTypeAny> = {
  list_projects: z.object({ limit: z.number().optional() }),
  get_project: z.object({ project_id: z.string() }),
  create_project: z.object({ name: z.string(), framework: z.string().optional() }),
  delete_project: z.object({ project_id: z.string() }),
  list_deployments: z.object({ project_id: z.string().optional(), limit: z.number().optional(), target: z.string().optional() }),
  get_deployment: z.object({ deployment_id: z.string() }),
  create_deployment: z.object({ name: z.string(), target: z.string().optional(), project: z.string().optional() }),
  cancel_deployment: z.object({ deployment_id: z.string() }),
  list_domains: z.object({ limit: z.number().optional() }),
  get_deployment_events: z.object({ deployment_id: z.string() }),
  list_project_env_vars: z.object({ project_id: z.string() }),
  get_current_user: z.object({}),
};

export const TOOLS = [
  {
    name: "list_projects",
    description: "List Vercel projects.",
    inputSchema: { type: "object" as const, properties: { limit: { type: "number", description: "Maximum number of projects to return." } }, required: [] as string[] },
  },
  {
    name: "get_project",
    description: "Retrieve a single Vercel project by ID.",
    inputSchema: { type: "object" as const, properties: { project_id: { type: "string", description: "ID of the Vercel project to retrieve." } }, required: ["project_id"] },
  },
  {
    name: "create_project",
    description: "Create a Vercel project.",
    inputSchema: { type: "object" as const, properties: { name: { type: "string", description: "Name of the Vercel project to create." }, framework: { type: "string", description: "Framework preset to configure for the new project (e.g. nextjs); omit to let Vercel detect it." } }, required: ["name"] },
  },
  {
    name: "delete_project",
    description: "Delete a Vercel project by ID.",
    inputSchema: { type: "object" as const, properties: { project_id: { type: "string", description: "ID of the Vercel project to delete." } }, required: ["project_id"] },
  },
  {
    name: "list_deployments",
    description: "List Vercel deployments.",
    inputSchema: { type: "object" as const, properties: { project_id: { type: "string", description: "Only return deployments for this Vercel project ID; omit to list deployments across projects." }, limit: { type: "number", description: "Maximum number of deployments to return." }, target: { type: "string", description: "Only return deployments with this target (e.g. production or preview); omit for all targets." } }, required: [] as string[] },
  },
  {
    name: "get_deployment",
    description: "Retrieve a single Vercel deployment by ID.",
    inputSchema: { type: "object" as const, properties: { deployment_id: { type: "string", description: "ID of the Vercel deployment to retrieve." } }, required: ["deployment_id"] },
  },
  {
    name: "create_deployment",
    description: "Create a Vercel deployment.",
    inputSchema: { type: "object" as const, properties: { name: { type: "string", description: "Name of the project to deploy." }, target: { type: "string", description: "Deployment target, such as production or preview; omit for the default target." }, project: { type: "string", description: "Identifier of the project to create the deployment for; omit to let Vercel resolve it from the name." } }, required: ["name"] },
  },
  {
    name: "cancel_deployment",
    description: "Cancel a Vercel deployment by ID.",
    inputSchema: { type: "object" as const, properties: { deployment_id: { type: "string", description: "ID of the Vercel deployment to cancel." } }, required: ["deployment_id"] },
  },
  {
    name: "list_domains",
    description: "List Vercel domains.",
    inputSchema: { type: "object" as const, properties: { limit: { type: "number", description: "Maximum number of domains to return." } }, required: [] as string[] },
  },
  {
    name: "get_deployment_events",
    description: "List events for a Vercel deployment.",
    inputSchema: { type: "object" as const, properties: { deployment_id: { type: "string", description: "ID of the Vercel deployment whose events to list." } }, required: ["deployment_id"] },
  },
  {
    name: "list_project_env_vars",
    description: "List environment variables for a Vercel project.",
    inputSchema: { type: "object" as const, properties: { project_id: { type: "string", description: "ID of the Vercel project whose environment variables to list." } }, required: ["project_id"] },
  },
  {
    name: "get_current_user",
    description: "Retrieve the current Vercel user.",
    inputSchema: { type: "object" as const, properties: {}, required: [] as string[] },
  },
];

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}
function errorResult(err: unknown) {
  return { content: [{ type: "text" as const, text: err instanceof Error ? err.message : String(err) }], isError: true };
}

const server = new Server({ name: "deployport", version: VERSION }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const schema = ARG_SCHEMAS[name];
  if (!schema) throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  try {
    const token = tokenFromEnv();
    const parsed = schema.parse(args ?? {}) as Record<string, unknown>;
    const fetchFn = globalThis.fetch as unknown as FetchFn;
    return textResult(await callTool(fetchFn, token, apiBaseFromEnv(), teamIdFromEnv(), name, parsed));
  } catch (err) {
    return errorResult(err);
  }
});

async function main(): Promise<void> {
  await server.connect(new StdioServerTransport());
}
void main();
