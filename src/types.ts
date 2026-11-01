/**
 * deployport types.
 *
 * A core subset of the Vercel MCP surface: projects, deployments,
 * domains, deployment events and project env vars against the Vercel
 * REST API. HTTP access is described by a minimal response surface so
 * tests can inject a fake fetch.
 */

export interface HttpResponse {
  ok: boolean;
  status: number;
  statusText?: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}

export type FetchFn = (
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    redirect?: string;
  },
) => Promise<HttpResponse>;

export interface ListProjectsOptions { limit?: number; }
export interface GetProjectOptions { project_id: string; }
export interface CreateProjectOptions { name: string; framework?: string; }
export interface DeleteProjectOptions { project_id: string; }
export interface ListDeploymentsOptions { project_id?: string; limit?: number; target?: string; }
export interface GetDeploymentOptions { deployment_id: string; }
export interface CreateDeploymentOptions { name: string; target?: string; project?: string; }
export interface CancelDeploymentOptions { deployment_id: string; }
export interface ListDomainsOptions { limit?: number; }
export interface GetDeploymentEventsOptions { deployment_id: string; }
export interface ListProjectEnvVarsOptions { project_id: string; }
