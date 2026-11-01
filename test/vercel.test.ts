import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  apiBaseFromEnv,
  cancelDeployment,
  createDeployment,
  createProject,
  deleteProject,
  getCurrentUser,
  getDeployment,
  getDeploymentEvents,
  getProject,
  listDeployments,
  listDomains,
  listProjectEnvVars,
  listProjects,
  teamIdFromEnv,
  tokenFromEnv,
} from "../src/vercel.js";
import type { FetchFn, HttpResponse } from "../src/types.js";

interface Recorded { url: string; method: string; headers: Record<string, string>; body: unknown; }

function fakeFetch(steps: Array<{ match: string; payload: unknown; status?: number; rawText?: string }>) {
  const calls: Recorded[] = [];
  const fn: FetchFn = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    calls.push({ url, method: init?.method ?? "GET", headers: init?.headers ?? {}, body });
    const step = steps.find((s) => url.includes(s.match)) ?? { match: "", payload: {} };
    const res: HttpResponse = {
      ok: (step.status ?? 200) < 300,
      status: step.status ?? 200,
      headers: { get: () => null },
      text: async () => step.rawText ?? JSON.stringify(step.payload),
    };
    return res;
  };
  return { fn, calls };
}

const BASE = "https://api.vercel.com";
const TOKEN = "tok123";

describe("deployport core", () => {
  it("names the env var when the token is missing and resolves base/team helpers", () => {
    assert.throws(() => tokenFromEnv({}), /VERCEL_TOKEN environment variable is required/);
    assert.equal(tokenFromEnv({ VERCEL_TOKEN: " x " }), "x");
    assert.equal(apiBaseFromEnv({}), "https://api.vercel.com");
    assert.equal(apiBaseFromEnv({ VERCEL_API_BASE_URL: "https://example.test/" }), "https://example.test");
    assert.equal(teamIdFromEnv({}), undefined);
    assert.equal(teamIdFromEnv({ VERCEL_TEAM_ID: " team_1 " }), "team_1");
    assert.equal(teamIdFromEnv({ VERCEL_TEAM_ID: "  " }), undefined);
  });

  it("list_projects gets /v9/projects with Bearer and accept headers", async () => {
    const { fn, calls } = fakeFetch([{ match: "/v9/projects", payload: { projects: [] } }]);
    await listProjects(fn, TOKEN, BASE, undefined, { limit: 10 });
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.vercel.com/v9/projects?limit=10");
    assert.equal(calls[0].headers.Authorization, "Bearer tok123");
    assert.equal(calls[0].headers.Accept, "application/json");
    await listProjects(fn, TOKEN, BASE, undefined, {});
    assert.equal(calls[1].url, "https://api.vercel.com/v9/projects");
  });

  it("appends teamId after the tool params when set and omits it when unset", async () => {
    const { fn, calls } = fakeFetch([{ match: "/v9/projects", payload: { projects: [] } }]);
    await listProjects(fn, TOKEN, BASE, "team_42", { limit: 5 });
    assert.equal(calls[0].url, "https://api.vercel.com/v9/projects?limit=5&teamId=team_42");
    await getProject(fn, TOKEN, BASE, "team_42", { project_id: "prj_1" });
    assert.equal(calls[1].url, "https://api.vercel.com/v9/projects/prj_1?teamId=team_42");
    await getCurrentUser(fn, TOKEN, BASE, "team_42");
    assert.equal(calls[2].url, "https://api.vercel.com/v2/user?teamId=team_42");
    await getCurrentUser(fn, TOKEN, BASE, undefined);
    assert.equal(calls[3].url, "https://api.vercel.com/v2/user");
  });

  it("get_project gets /v9/projects/{id}", async () => {
    const { fn, calls } = fakeFetch([{ match: "/v9/projects/prj_1", payload: { id: "prj_1" } }]);
    await getProject(fn, TOKEN, BASE, undefined, { project_id: "prj_1" });
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.vercel.com/v9/projects/prj_1");
  });

  it("create_project posts only provided fields", async () => {
    const { fn, calls } = fakeFetch([{ match: "/v9/projects", payload: { id: "prj_2" } }]);
    await createProject(fn, TOKEN, BASE, undefined, { name: "site" });
    assert.equal(calls[0].method, "POST");
    assert.deepEqual(calls[0].body, { name: "site" });
    await createProject(fn, TOKEN, BASE, undefined, { name: "app", framework: "nextjs" });
    assert.deepEqual(calls[1].body, { name: "app", framework: "nextjs" });
  });

  it("delete_project deletes and returns {status} for an empty body", async () => {
    const { fn, calls } = fakeFetch([{ match: "/v9/projects/prj_1", payload: null, rawText: "", status: 200 }]);
    const out = (await deleteProject(fn, TOKEN, BASE, undefined, { project_id: "prj_1" })) as Record<string, unknown>;
    assert.equal(calls[0].method, "DELETE");
    assert.equal(calls[0].url, "https://api.vercel.com/v9/projects/prj_1");
    assert.deepEqual(out, { status: 200 });
  });

  it("list_deployments gets /v6/deployments with projectId/limit/target params", async () => {
    const { fn, calls } = fakeFetch([{ match: "/v6/deployments", payload: { deployments: [] } }]);
    await listDeployments(fn, TOKEN, BASE, undefined, { project_id: "prj_1", limit: 10, target: "production" });
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.vercel.com/v6/deployments?projectId=prj_1&limit=10&target=production");
    await listDeployments(fn, TOKEN, BASE, undefined, {});
    assert.equal(calls[1].url, "https://api.vercel.com/v6/deployments");
  });

  it("get_deployment gets /v13/deployments/{id}", async () => {
    const { fn, calls } = fakeFetch([{ match: "/v13/deployments/dpl_1", payload: { id: "dpl_1" } }]);
    await getDeployment(fn, TOKEN, BASE, undefined, { deployment_id: "dpl_1" });
    assert.equal(calls[0].url, "https://api.vercel.com/v13/deployments/dpl_1");
  });

  it("create_deployment posts only provided fields to /v13/deployments", async () => {
    const { fn, calls } = fakeFetch([{ match: "/v13/deployments", payload: { id: "dpl_2" } }]);
    await createDeployment(fn, TOKEN, BASE, undefined, { name: "site" });
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].url, "https://api.vercel.com/v13/deployments");
    assert.deepEqual(calls[0].body, { name: "site" });
    await createDeployment(fn, TOKEN, BASE, undefined, { name: "site", target: "production", project: "prj_1" });
    assert.deepEqual(calls[1].body, { name: "site", target: "production", project: "prj_1" });
  });

  it("cancel_deployment patches /v12/deployments/{id}/cancel", async () => {
    const { fn, calls } = fakeFetch([{ match: "/cancel", payload: { id: "dpl_1" } }]);
    await cancelDeployment(fn, TOKEN, BASE, undefined, { deployment_id: "dpl_1" });
    assert.equal(calls[0].method, "PATCH");
    assert.equal(calls[0].url, "https://api.vercel.com/v12/deployments/dpl_1/cancel");
  });

  it("list_domains gets /v4/domains with optional limit", async () => {
    const { fn, calls } = fakeFetch([{ match: "/v4/domains", payload: { domains: [] } }]);
    await listDomains(fn, TOKEN, BASE, undefined, {});
    assert.equal(calls[0].url, "https://api.vercel.com/v4/domains");
    await listDomains(fn, TOKEN, BASE, undefined, { limit: 20 });
    assert.equal(calls[1].url, "https://api.vercel.com/v4/domains?limit=20");
  });

  it("get_deployment_events gets /v3/deployments/{id}/events", async () => {
    const { fn, calls } = fakeFetch([{ match: "/events", payload: [] }]);
    await getDeploymentEvents(fn, TOKEN, BASE, undefined, { deployment_id: "dpl_1" });
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.vercel.com/v3/deployments/dpl_1/events");
  });

  it("list_project_env_vars gets /v9/projects/{id}/env", async () => {
    const { fn, calls } = fakeFetch([{ match: "/env", payload: { envs: [] } }]);
    await listProjectEnvVars(fn, TOKEN, BASE, undefined, { project_id: "prj_1" });
    assert.equal(calls[0].url, "https://api.vercel.com/v9/projects/prj_1/env");
  });

  it("get_current_user gets /v2/user", async () => {
    const { fn, calls } = fakeFetch([{ match: "/v2/user", payload: { user: { username: "rene" } } }]);
    const out = (await getCurrentUser(fn, TOKEN, BASE, undefined)) as Record<string, unknown>;
    assert.equal(calls[0].method, "GET");
    assert.equal(calls[0].url, "https://api.vercel.com/v2/user");
    assert.deepEqual(out.user, { username: "rene" });
  });

  it("surfaces upstream error status and error message", async () => {
    const { fn } = fakeFetch([{ match: "/v9/projects", payload: { error: { code: "forbidden", message: "not allowed" } }, status: 403 }]);
    await assert.rejects(() => listProjects(fn, TOKEN, BASE, undefined, {}), /Vercel API error 403: not allowed/);
  });

  it("returns {status} for an empty successful body", async () => {
    const { fn } = fakeFetch([{ match: "/v2/user", payload: null, rawText: "", status: 200 }]);
    const out = (await getCurrentUser(fn, TOKEN, BASE, undefined)) as Record<string, unknown>;
    assert.deepEqual(out, { status: 200 });
  });
});
