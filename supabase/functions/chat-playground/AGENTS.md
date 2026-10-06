# chat-playground rules

- Run chat web search server-side in `chat-playground/webSearch.ts` (SearXNG, max 3 tool rounds) and stream `garageai` status events alongside OpenAI chunks; never log queries, results or prompts.
- Chat answer footer data (garage, usage) comes only from chat-playground `garageai` meta events (garage = LiteLLM deployment-id prefix) plus `include_usage` chunks; cost/tok/s are computed client-side in `chatService` from catalogue prices.
