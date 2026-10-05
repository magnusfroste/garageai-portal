import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopyButton } from "./CopyButton";

const snippets = (base: string, model: string) => ({
  curl: `curl ${base}/chat/completions \\
  -H "Authorization: Bearer $GARAGE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "${model}", "messages": [{"role": "user", "content": "Hej!"}]}'`,
  python: `from openai import OpenAI

client = OpenAI(base_url="${base}", api_key="DIN_API_NYCKEL")
response = client.chat.completions.create(
    model="${model}",
    messages=[{"role": "user", "content": "Hej!"}],
)
print(response.choices[0].message.content)`,
  javascript: `import OpenAI from "openai";

const client = new OpenAI({ baseURL: "${base}", apiKey: process.env.GARAGE_API_KEY });
const response = await client.chat.completions.create({
  model: "${model}",
  messages: [{ role: "user", content: "Hej!" }],
});
console.log(response.choices[0].message.content);`,
});

export const ModelSnippets = ({ baseUrl, model }: { baseUrl: string; model: string }) => {
  const s = snippets(baseUrl, model);
  return (
    <Tabs defaultValue="curl">
      <TabsList>
        <TabsTrigger value="curl">curl</TabsTrigger>
        <TabsTrigger value="python">Python</TabsTrigger>
        <TabsTrigger value="javascript">JavaScript</TabsTrigger>
      </TabsList>
      {(Object.keys(s) as (keyof typeof s)[]).map((k) => (
        <TabsContent key={k} value={k}>
          <div className="relative bg-secondary/50 rounded-lg p-4">
            <div className="absolute right-2 top-2"><CopyButton text={s[k]} /></div>
            <pre className="font-mono text-xs overflow-x-auto pr-10">{s[k]}</pre>
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
};
