import { Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "./CopyButton";
import { Link } from "react-router-dom";
import { t } from "@/i18n";

export const ConnectSection = ({ defaultModel, baseUrl }: { defaultModel: string; baseUrl: string }) => (
  <Card className="border-border/50 bg-card/60">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-lg">
        <Terminal className="w-5 h-5 text-primary" />
        Connect to the API
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Point any OpenAI-compatible client at the base URL below and use your API key.
        Pass a model ID as the <code className="text-primary font-mono text-xs">model</code> parameter. <Link to="/models" className="text-primary hover:underline">{t("Browse models →")}</Link>
      </p>

      <div className="space-y-3">
        <div className="bg-secondary/50 rounded-lg p-4 font-mono text-xs sm:text-sm space-y-1 overflow-x-auto">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="text-muted-foreground"># Base URL</p>
              <p>{baseUrl}/v1</p>
            </div>
            <CopyButton text={`${baseUrl}/v1`} />
          </div>
        </div>

        <div className="bg-secondary/50 rounded-lg p-4 font-mono text-xs sm:text-sm space-y-1 overflow-x-auto">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <p className="text-muted-foreground"># Example curl request</p>
              <p>curl {baseUrl}/v1/chat/completions \</p>
              <p className="ml-4">-H "Authorization: Bearer YOUR_API_KEY" \</p>
              <p className="ml-4">-H "Content-Type: application/json" \</p>
              <p className="ml-4">-d '{"{"}"model": "{defaultModel}", "messages": [{"{"}"role": "user", "content": "Hello"{"}"}]{"}"}'</p>
            </div>
            <CopyButton text={`curl ${baseUrl}/v1/chat/completions \\\n  -H "Authorization: Bearer YOUR_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"model": "${defaultModel}", "messages": [{"role": "user", "content": "Hello"}]}'`} />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);
