export interface WelcomeProgress { createdAt: string; hasEverCreatedKey: boolean; hasLinkedGarage: boolean; sentAt: string | null }
export function welcomeEligible(progress: WelcomeProgress, now: number): boolean {
  const created = Date.parse(progress.createdAt);
  return Number.isFinite(created) && now - created >= 10 * 60_000 && !progress.hasEverCreatedKey && !progress.hasLinkedGarage && progress.sentAt === null;
}