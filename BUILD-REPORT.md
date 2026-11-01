# deployport — BUILD REPORT

Original: vercel (Vercel official remote MCP) → Rebuild: deployport
Tier C core subset. Local only, nothing pushed or published.

## Scope
12 tools against the Vercel REST API (https://api.vercel.com, base
overridable via VERCEL_API_BASE_URL), Authorization: Bearer
VERCEL_TOKEN with `Accept: application/json` on every request, all
HTTP behind an injectable FetchFn. When VERCEL_TEAM_ID is set, a
teamId query parameter is appended to every request after the
tool's own params (via teamIdFromEnv(), read by cli.ts/mcp.ts and
passed into callTool alongside the base):
list_projects (GET /v9/projects, limit query param),
get_project (GET /v9/projects/{id}), create_project
(POST /v9/projects, provided fields only), delete_project
(DELETE /v9/projects/{id}, empty body → {status}),
list_deployments (GET /v6/deployments, projectId/limit/target query
params), get_deployment (GET /v13/deployments/{id}),
create_deployment (POST /v13/deployments, provided fields only),
cancel_deployment (PATCH /v12/deployments/{id}/cancel),
list_domains (GET /v4/domains, limit query param),
get_deployment_events (GET /v3/deployments/{id}/events),
list_project_env_vars (GET /v9/projects/{id}/env),
get_current_user (GET /v2/user).

Omitted groups (fixture `_source` lists them): deployment creation
from git/files depth (gitSource payloads, file uploads), env var
create/update/delete writes, domains create/delete and DNS records,
project settings depth (framework/build overrides, protection,
aliases assignment), deployment promote/rollback, checks,
integrations/marketplace, edge config, blob/firewall/observability
products, team/member admin, billing.

Ground truth: schemas are docs-derived from the public Vercel REST
API documentation (vercel.com/docs/rest-api). Fixture:
harness/fixtures/vercel-tools-original.json (labelled core-subset).
The original is Vercel's official remote MCP (hosted OAuth); hosted
OAuth NOT reproduced — this is a token REST client for the same API.

## Verified (foreground, from disk)
- Tools: 12/12 — parity.json identical_tools = 12 = total.
- Unit tests: 16/16 pass (fake FetchFn; URL/method/Bearer + Accept
  headers/body shaping for every tool, versioned paths v9/v6/v13/
  v12/v4/v3/v2 asserted, teamId appended when set and absent when
  unset, provided-fields-only creates, empty-body {status} on
  delete, upstream error surfacing with error.message, missing-
  token error naming VERCEL_TOKEN, base override/trim).
- tsc: exit 0. dist/cli.js present; `node dist/cli.js --version`
  prints 0.1.0; unknown command exits 2 with Usage.
- Parity: harness/parity.py vs the fixture → PASS, parity_pct 100.0
  (parity-out/parity.json).
- Missing-env checks: CLI list_projects with VERCEL_TOKEN unset
  → "error: VERCEL_TOKEN environment variable is required",
  exit 1; stdio tools/call list_projects with the token unset
  returned isError "VERCEL_TOKEN environment variable is required".
- server.json description 64 chars (≤100); OCI entry has no version
  field; npm entry carries version 0.1.0; Dockerfile label
  io.github.CloudCorpRecords/deployport; full 19-file factory set
  present.

## Honest gaps
- No live Vercel call was made — request/response behaviour is
  fake-fetch proven only.
- create_deployment covers the minimal name/target/project shape
  only; git-source and file-upload deployments are outside this
  subset.
- Project env vars are read-only in this subset (no create, update
  or delete writes).
- Lockfile is a copied fleet lockfile with identity fields edited —
  clean lockfile regeneration is REQUIRED before publish.
- mcpaudit / mcpvet / shipcheck not yet run — pre-publish gate.
- Hosted OAuth surface of the original remote server is not
  reproduced (see Scope).
