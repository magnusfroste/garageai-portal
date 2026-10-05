export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
  search?: ChatSearchInfo;
}

export interface ChatSearchInfo {
  queries: string[];
  sources: Array<{ n: number; title: string; url: string }>;
  /** Live status while streaming, e.g. "Söker: …". Not meaningful after completion. */
  status?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: number;
}
