/**
 * deployport core: a 12-tool core subset of the Vercel MCP server
 * surface, implemented clean-room against the public Vercel REST API
 * (https://api.vercel.com, base overridable via VERCEL_API_BASE_URL).
 *
 * Auth: VERCEL_TOKEN, sent as `Authorization: Bearer`, with
 * `Accept: application/json` on every request. A missing token is an
 * error naming the variable. When VERCEL_TEAM_ID is set, a teamId
 * query parameter is appended to every request after the tool's own
 * params. All HTTP goes through an injected FetchFn so the wire
 * behaviour is fully testable offline.
 *
 * Note: the original is Vercel's official remote MCP (hosted OAuth);
 * hosted OAuth NOT reproduced — this is a token REST client for the
 * same API.
 */
import type {
  CancelDeploymentOptions,
  CreateDeploymentOptions,
  CreateProjectOptions,
  DeleteProjectOptions,
  FetchFn,
  GetDeploymentEventsOptions,
  GetDeploymentOptions,
  GetProjectOptions,
  ListDeploymentsOptions,
  ListDomainsOptions,
  ListProjectEnvVarsOptions,
  ListProjectsOptions,
} from "./types.js";

export const VERSION = "0.1.0";
export const DEFAULT_API_BASE = "https://api.vercel.com";

export function tokenFromEnv(env: Record<string, string | undefined> = process.env): string {
  const raw = env.VERCEL_TOKEN;
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) throw new Error("VERCEL_TOKEN environment variable is required");
  return token;
}

export function apiBaseFromEnv(env: Record<string, string | undefined> = process.env): string {
  const raw = env.VERCEL_API_BASE_URL;
  const base = typeof raw === "string" ? raw.trim() : "";
  return (base || DEFAULT_API_BASE).replace(/\/+$/, "");
}

export function teamIdFromEnv(env: Record<string, string | undefined> = process.env): string | undefined {
  const raw = env.VERCEL_TEAM_ID;
  const teamId = typeof raw === "string" ? raw.trim() : "";
  return teamId || undefined;
}

interface RequestSpec { method: string; path: string; body?: unknown; }

async function apiRequest(fetchFn: FetchFn, token: string, base: string, teamId: string | undefined, spec: RequestSpec): Promise<unknown> {
  let path = spec.path;
  if (teamId) path += `${path.includes("?") ? "&" : "?"}teamId=${encodeURIComponent(teamId)}`;
  const res = await fetchFn(`${base}${path}`, {
    method: spec.method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text;
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      const message = parsed.error?.message;
      if (typeof message === "string") detail = message;
    } catch { /* keep raw */ }
    throw new Error(`Vercel API error ${res.status}: ${detail}`);
  }
  if (!text) return { status: res.status };
  try { return JSON.parse(text) as unknown; } catch { return text; }
}

function query(params: Record<string, string | number | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}
function clean<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) if (value !== undefined) out[key] = value;
  return out;
}
const enc = encodeURIComponent;

export async function listProjects(fetchFn: FetchFn, token: string, base: string, teamId: string | undefined, opts: ListProjectsOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, teamId, { method: "GET", path: `/v9/projects${query({ limit: opts.limit })}` });
}
export async function getProject(fetchFn: FetchFn, token: string, base: string, teamId: string | undefined, opts: GetProjectOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, teamId, { method: "GET", path: `/v9/projects/${enc(opts.project_id)}` });
}
export async function createProject(fetchFn: FetchFn, token: string, base: string, teamId: string | undefined, opts: CreateProjectOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, teamId, {
    method: "POST",
    path: "/v9/projects",
    body: clean({ name: opts.name, framework: opts.framework }),
  });
}
export async function deleteProject(fetchFn: FetchFn, token: string, base: string, teamId: string | undefined, opts: DeleteProjectOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, teamId, { method: "DELETE", path: `/v9/projects/${enc(opts.project_id)}` });
}
export async function listDeployments(fetchFn: FetchFn, token: string, base: string, teamId: string | undefined, opts: ListDeploymentsOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, teamId, { method: "GET", path: `/v6/deployments${query({ projectId: opts.project_id, limit: opts.limit, target: opts.target })}` });
}
export async function getDeployment(fetchFn: FetchFn, token: string, base: string, teamId: string | undefined, opts: GetDeploymentOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, teamId, { method: "GET", path: `/v13/deployments/${enc(opts.deployment_id)}` });
}
export async function createDeployment(fetchFn: FetchFn, token: string, base: string, teamId: string | undefined, opts: CreateDeploymentOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, teamId, {
    method: "POST",
    path: "/v13/deployments",
    body: clean({ name: opts.name, target: opts.target, project: opts.project }),
  });
}
export async function cancelDeployment(fetchFn: FetchFn, token: string, base: string, teamId: string | undefined, opts: CancelDeploymentOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, teamId, { method: "PATCH", path: `/v12/deployments/${enc(opts.deployment_id)}/cancel` });
}
export async function listDomains(fetchFn: FetchFn, token: string, base: string, teamId: string | undefined, opts: ListDomainsOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, teamId, { method: "GET", path: `/v4/domains${query({ limit: opts.limit })}` });
}
export async function getDeploymentEvents(fetchFn: FetchFn, token: string, base: string, teamId: string | undefined, opts: GetDeploymentEventsOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, teamId, { method: "GET", path: `/v3/deployments/${enc(opts.deployment_id)}/events` });
}
export async function listProjectEnvVars(fetchFn: FetchFn, token: string, base: string, teamId: string | undefined, opts: ListProjectEnvVarsOptions): Promise<unknown> {
  return apiRequest(fetchFn, token, base, teamId, { method: "GET", path: `/v9/projects/${enc(opts.project_id)}/env` });
}
export async function getCurrentUser(fetchFn: FetchFn, token: string, base: string, teamId: string | undefined): Promise<unknown> {
  return apiRequest(fetchFn, token, base, teamId, { method: "GET", path: "/v2/user" });
}

export async function callTool(fetchFn: FetchFn, token: string, base: string, teamId: string | undefined, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "list_projects": return listProjects(fetchFn, token, base, teamId, args as unknown as ListProjectsOptions);
    case "get_project": return getProject(fetchFn, token, base, teamId, args as unknown as GetProjectOptions);
    case "create_project": return createProject(fetchFn, token, base, teamId, args as unknown as CreateProjectOptions);
    case "delete_project": return deleteProject(fetchFn, token, base, teamId, args as unknown as DeleteProjectOptions);
    case "list_deployments": return listDeployments(fetchFn, token, base, teamId, args as unknown as ListDeploymentsOptions);
    case "get_deployment": return getDeployment(fetchFn, token, base, teamId, args as unknown as GetDeploymentOptions);
    case "create_deployment": return createDeployment(fetchFn, token, base, teamId, args as unknown as CreateDeploymentOptions);
    case "cancel_deployment": return cancelDeployment(fetchFn, token, base, teamId, args as unknown as CancelDeploymentOptions);
    case "list_domains": return listDomains(fetchFn, token, base, teamId, args as unknown as ListDomainsOptions);
    case "get_deployment_events": return getDeploymentEvents(fetchFn, token, base, teamId, args as unknown as GetDeploymentEventsOptions);
    case "list_project_env_vars": return listProjectEnvVars(fetchFn, token, base, teamId, args as unknown as ListProjectEnvVarsOptions);
    case "get_current_user": return getCurrentUser(fetchFn, token, base, teamId);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
