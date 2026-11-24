import { formatDistanceToNow } from 'date-fns';
import { creditsText, usdToCredits } from './credits';
export const compactTokens = (value: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value).replace('K', 'k');
export const activityCredits = (spend: number) => creditsText(new Intl.NumberFormat('en', { maximumFractionDigits: 6 }).format(usdToCredits(spend)));
export const lastUsedText = (date: string | null) => date ? formatDistanceToNow(new Date(date), { addSuffix: true }) : 'Never';
export const exactUtc = (date: string) => `${new Date(date).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '')} UTC`;