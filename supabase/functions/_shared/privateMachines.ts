// Owner routes are inventory, not market supply. The gateway owns live health and access checks.
export const isPrivateDeployment = (d: { model_name?: string | null; model_info?: { garage_tier?: string | null } }) =>
  d.model_name?.startsWith('mine/') === true || d.model_info?.garage_tier === 'private';
export const privateRoute = (garage: string, canonical: string) => `mine/${garage}/${canonical}`;
export const privateDeploymentId = (garage: string, runtime: string) => `${garage}__${runtime.replace(/[^A-Za-z0-9._-]/g, '-') }__private`;
export const hasPrivateMachine = (g: { operator_id?: string | null; connection_type?: string | null; disabled?: boolean }) =>
  !!g.operator_id && g.connection_type !== 'endpoint' && !g.disabled;
export const allowsMarket = (g: { visibility?: string | null }) => g.visibility !== 'private';