# deployport

Vercel projects and deployments as MCP tools, talking to the
Vercel REST API. deployport is a clean-room rebuild of the core
surface of the Vercel MCP server, under a new name: fresh code, no
copied branding. The original is Vercel's official remote MCP
(hosted OAuth); hosted OAuth is NOT reproduced — this rebuild is a
token REST client for the same API.

## Tools (core subset, 12)

`list_projects`, `get_project`, `create_project`, `delete_project`,
`list_deployments`, `get_deployment`, `create_deployment`,
`cancel_deployment`, `list_domains`, `get_deployment_events`,
`list_project_env_vars`, `get_current_user`.

Not in this subset: deployment creation from git/files depth
(gitSource payloads, file uploads), env var create/update/delete
writes, domains create/delete and DNS records, project settings
depth (framework/build overrides, protection, aliases assignment),
deployment promote/rollback, checks, integrations/marketplace, edge
config, blob/firewall/observability products, team/member admin,
billing.

## Setup

Create an API token in Vercel and set it:

```bash
export VERCEL_TOKEN=...
```

Optionally override the API base with `VERCEL_API_BASE_URL`
(default `https://api.vercel.com`). Optionally scope every request
to a team with `VERCEL_TEAM_ID`; when set, a `teamId` query
parameter is appended to every request after the tool's own params.
Without the token, every tool call fails with an error naming the
missing variable.

## CLI

```bash
npx @reneturcios/deployport list_projects '{"limit":10}'
npx @reneturcios/deployport mcp        # stdio MCP server
```

Each tool name is a subcommand taking one JSON object argument.

## MCP client config

```json
{
  "mcpServers": {
    "deployport": {
      "command": "npx",
      "args": ["-y", "@reneturcios/deployport", "mcp"],
      "env": { "VERCEL_TOKEN": "..." }
    }
  }
}
```

## Docker

```bash
docker run -i -e VERCEL_TOKEN ghcr.io/cloudcorprecords/deployport
```

## Development

```bash
npm install
npm run build
npm test
```

## License

MIT
