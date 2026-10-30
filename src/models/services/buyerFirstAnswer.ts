export const FIRST_ANSWER_MODEL = "garageai/auto";
export const FIRST_ANSWER_PROMPT = "In one sentence, what can I do with an open AI model?";
export const buyerNeedsFirstAnswer = (intent: string | null | undefined, firstRequestAt: string | null | undefined) => intent === "buyer" && firstRequestAt === null;
export function firstAnswerExamples(key: string, prompt = FIRST_ANSWER_PROMPT) {
  const body = { model: FIRST_ANSWER_MODEL, messages: [{ role: "user", content: prompt }] };
  return {
    curl: [`curl https://api.garageai.eu/v1/chat/completions`, `  -H "Authorization: Bearer ${key}"`, `  -H "Content-Type: application/json"`, `  -d '${JSON.stringify(body).replace(/'/g, "'\\''")}'`].join(" \\\n"),
    Python: `from openai import OpenAI\n\nclient = OpenAI(api_key=${JSON.stringify(key)}, base_url="https://api.garageai.eu/v1")\nresponse = client.chat.completions.create(\n    model="garageai/auto",\n    messages=[{"role": "user", "content": ${JSON.stringify(prompt)}}],\n)\nprint(response.choices[0].message.content)`,
    JavaScript: `import OpenAI from "openai";\n\nconst client = new OpenAI({\n  apiKey: ${JSON.stringify(key)},\n  baseURL: "https://api.garageai.eu/v1",\n});\nconst response = await client.chat.completions.create(${JSON.stringify(body, null, 2)});\nconsole.log(response.choices[0].message.content);`,
  };
}
export async function ensureFirstAnswerKey(accepted: boolean, ensure: () => Promise<unknown>) {
  return accepted ? ensure() : null;
}