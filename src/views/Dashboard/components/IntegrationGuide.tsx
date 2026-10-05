import { Copy } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useCuratedModels } from "@/hooks/useCuratedModels";

interface IntegrationGuideProps {
  onCopy: (text: string) => void;
}

export const IntegrationGuide = ({ onCopy }: IntegrationGuideProps) => {
  const { settings } = useSiteSettings();
  const { models } = useCuratedModels(true);
  const baseUrl = settings?.api_base_url || "https://llm.garageai.eu";
  const defaultModel = models.find((m) => m.is_default && m.garage_tier === "pool")?.model_name || models.find((m) => m.garage_tier === "pool")?.model_name || "";
  return (
    <div className="container mx-auto px-4 pb-8">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Integration Guide</CardTitle>
          <CardDescription>
            Connect to the API using your preferred method
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="openai" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="openai">OpenAI API</TabsTrigger>
              <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
            </TabsList>

            <TabsContent value="openai" className="space-y-4">
              <div className="space-y-2">
                <Label>Endpoint URL</Label>
                <div className="flex gap-2">
                  <Input
                    value={`${baseUrl}/v1`}
                    readOnly
                    className="font-mono"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => onCopy(`${baseUrl}/v1`)}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-secondary/50 rounded-lg p-4 font-mono text-sm space-y-2">
                <p className="text-muted-foreground"># Example usage with curl:</p>
                <p>curl {baseUrl}/v1/chat/completions \</p>
                <p className="ml-4">-H "Authorization: Bearer YOUR_API_KEY" \</p>
                <p className="ml-4">-H "Content-Type: application/json" \</p>
                <p className="ml-4">
                  -d '{"{"}
                  "model": "{defaultModel}", "messages": [...]
                  {"}"}'
                </p>
              </div>

              <p className="text-sm text-muted-foreground">
                For more information, visit the{" "}
                <a
                  href="https://docs.litellm.ai/docs/providers/github"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  LiteLLM documentation
                </a>
              </p>
            </TabsContent>

            <TabsContent value="claude-code" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Claude Code works directly with the proxy. The proxy automatically translates
                Anthropic Messages API calls to the backend format — no extra steps required.
              </p>

              <div className="space-y-2">
                <Label>1. Set environment variables</Label>
                <div className="bg-secondary/50 rounded-lg p-4 font-mono text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span>export ANTHROPIC_BASE_URL={baseUrl}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => onCopy(`export ANTHROPIC_BASE_URL=${baseUrl}`)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>export ANTHROPIC_API_KEY=&lt;your-api-key&gt;</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => onCopy("export ANTHROPIC_API_KEY=")}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>2. Start Claude Code</Label>
                <div className="bg-secondary/50 rounded-lg p-4 font-mono text-sm">
                  <div className="flex items-center justify-between">
                    <span>claude</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => onCopy("claude")}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Replace <code className="text-accent">&lt;your-api-key&gt;</code> with
                an API key from <Link to="/dashboard/api-keys" className="text-accent hover:underline">API keys</Link>. Claude Code will then use
                the proxy for all API calls.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
