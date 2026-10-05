export interface ChatUsage {
  prompt: number;
  completion: number;
}

/** Per-answer trust footer data (which garage answered, tokens, cost, speed). */
export interface ChatAnswerMeta {
  /** Model id the request was sent with (pool name or garage/<g>/<m>). */
  model?: string;
  /** Garage that actually served the answer, from the deployment id. */
  garage?: string | null;
  usage?: ChatUsage;
  costUsd?: number | null;
  tokensPerSecond?: number | null;
  /** Milliseconds spent in the reasoning phase. */
  reasoningMs?: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  search?: ChatSearchInfo;
  meta?: ChatAnswerMeta;
}

export interface ChatSearchInfo {
  queries: string[];
  sources: Array<{ n: number; title: string; url: string }>;
  /** Live status while streaming. Not meaningful after completion. */
  status?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: number;
  updatedAt: number;
}
