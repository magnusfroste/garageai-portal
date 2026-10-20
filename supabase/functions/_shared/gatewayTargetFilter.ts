/** Only enabled, unpaused garages and providers are gateway targets; paused ones return on the next sync after resume. */
export const isGatewayTarget = (g: { disabled?: boolean | null; paused_at?: string | null; visibility?: string | null }) => !g.disabled && !g.paused_at && g.visibility !== 'private';
