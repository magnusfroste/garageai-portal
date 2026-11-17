// Pause state reported to Door in node-heartbeat replies (Door v1.7.0 shows
// "Paused by GarageAI" in doctor, `garageai resume` and the menu-bar icon).
// Built from the garage row after this heartbeat's own changes, so a resume
// that just cleared an operator pause reports no pause.

export interface GaragePauseRow {
  paused_at?: string | null;
  paused_by_admin?: boolean | null;
  paused_reason?: string | null;
}

export interface GaragePauseInfo {
  by: "admin" | "operator";
  since: string;
  reason?: string;
}

export function garagePause(garage: GaragePauseRow): GaragePauseInfo | null {
  if (!garage.paused_at) return null;
  const info: GaragePauseInfo = {
    by: garage.paused_by_admin === true ? "admin" : "operator",
    since: new Date(garage.paused_at).toISOString(),
  };
  const reason = (garage.paused_reason ?? "").trim();
  if (reason) info.reason = reason.slice(0, 200);
  return info;
}
