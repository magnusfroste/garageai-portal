import type { ChatMessage, Conversation } from "@/views/Chat/types";

// Local-first chat history: conversations live in this browser, per user id.
// Nothing is written to the account unless the user turns on sync.
const keyFor = (userId: string) => `garageai:chat:convs:${userId}`;
const MAX_CONVERSATIONS = 1000;

interface StoredConversation {
  id: string;
  title: string;
  model: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const readAll = (userId: string): StoredConversation[] => {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeAll = (userId: string, convs: StoredConversation[]): boolean => {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(convs.slice(0, MAX_CONVERSATIONS)));
    return true;
  } catch { return false; /* storage full — keep going in memory */ }
};

export const chatLocalStore = {
  list(userId: string): Conversation[] {
    return readAll(userId).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  create(userId: string, model: string, title: string): Conversation {
    const ts = Date.now();
    const conv: StoredConversation = {
      id: crypto.randomUUID(),
      title, model, messages: [], createdAt: ts, updatedAt: ts,
    };
    writeAll(userId, [conv, ...readAll(userId)]);
    return conv;
  },

  update(userId: string, id: string, patch: { title?: string; messages?: ChatMessage[]; model?: string }): void {
    writeAll(userId, readAll(userId).map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)));
  },

  remove(userId: string, id: string): void {
    writeAll(userId, readAll(userId).filter((c) => c.id !== id));
  },

  /** Bulk-import conversations (used when moving account chats to this device). */
  /** Returns false when the browser refused to store them (e.g. storage full). */
  importAll(userId: string, convs: Conversation[]): boolean {
    const existing = readAll(userId);
    const known = new Set(existing.map((c) => c.id));
    const incoming = convs.filter((c) => !known.has(c.id)).map((c) => ({ ...c }));
    return writeAll(userId, [...incoming, ...existing]);
  },

  /** Ids actually stored on this device right now (re-read from storage). */
  storedIds(userId: string): Set<string> {
    return new Set(readAll(userId).map((c) => c.id));
  },
};
