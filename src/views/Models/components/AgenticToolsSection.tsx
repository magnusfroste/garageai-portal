import { Bot, Shield, Terminal, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "./CopyButton";
import { t } from "@/i18n";

interface AgenticTool {
  name: string;
  badge: string;
  description: string;
  features: string[];
  envVars: { key: string; value: string }[];
  link: { url: string; label: string };
}

const tools: AgenticTool[] = [
  {
    name: "Claude Code",
    badge: "Recommended",
    description:
      "Anthropic's premier agentic coding tool. Claude Code runs directly in your terminal and understands your entire codebase — editing files, running commands, and iterating autonomously. Our top pick for agentic development.",
    features: [
      "Full codebase awareness with automatic context gathering",
      "Runs terminal commands, edits files, creates commits",
      "Supports extended thinking for complex multi-step tasks",
      "Works with any OpenAI-compatible proxy out of the box",
    ],
    envVars: [
      { key: "ANTHROPIC_BASE_URL", value: "{{baseUrl}}" },
      { key: "ANTHROPIC_API_KEY", value: "<your-api-key>" },
    ],
    link: { url: "https://docs.anthropic.com/en/docs/claude-code", label: "Claude Code docs" },
  },
  {
    name: "Roo Code",
    badge: "VS Code",
    description:
      "An autonomous AI coding agent inside VS Code. Roo can create and edit files, run terminal commands, use a browser, and orchestrate multi-step tasks with your chosen model endpoint.",
    features: [
      "Runs inside VS Code with your chosen model endpoint",
      "Multi-step task orchestration with tool use",
      "Supports custom API endpoints for full model control",
      "MCP (Model Context Protocol) support for extended capabilities",
    ],
    envVars: [],
    link: { url: "https://docs.roocode.com", label: "Roo Code docs" },
  },
  {
    name: "Cline",
    badge: "VS Code",
    description:
      "A powerful open-source AI coding assistant for VS Code. Cline operates as an autonomous agent that can edit your project, run commands, and interact with the browser — all with explicit user approval at every step.",
    features: [
      "Open-source and fully transparent",
      "Human-in-the-loop: approves every file change and command",
      "Supports any OpenAI-compatible API endpoint",
      "Browser interaction and visual debugging built in",
    ],
    envVars: [],
    link: { url: "https://github.com/cline/cline", label: "Cline on GitHub" },
  },
];

export const AgenticToolsSection = ({ baseUrl }: { baseUrl: string }) => (
  <Card className="border-border/50 bg-card/60">
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-lg">
        <Bot className="w-5 h-5 text-primary" />
        Agentic Coding Tools
      </CardTitle>
      <p className="text-sm text-muted-foreground mt-1">
        {t("Encrypted in transit: TLS to our EU gateway and WireGuard to the garage. The gateway does not store your prompts or responses. Your prompt is processed on the operator's machine, so don't send sensitive data to the public pool yet.")}
      </p>
    </CardHeader>
    <CardContent className="space-y-6">
      {tools.map((tool) => (
        <div key={tool.name} className="rounded-lg border border-border/50 p-5 space-y-3">
          <div className="flex items-center gap-3">
            <Terminal className="w-5 h-5 text-primary shrink-0" />
            <h3 className="font-semibold text-foreground">{tool.name}</h3>
            <Badge variant="secondary" className="text-[10px]">{tool.badge}</Badge>
            {tool.name === "Claude Code" && (
              <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">
                <Shield className="w-3 h-3 mr-1" />
                Our Pick
              </Badge>
            )}
          </div>

          <p className="text-sm text-muted-foreground">{tool.description}</p>

          <ul className="grid gap-1.5 text-sm text-muted-foreground">
            {tool.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                {f}
              </li>
            ))}
          </ul>

          {tool.envVars.length > 0 && (
            <div className="bg-secondary/50 rounded-lg p-4 font-mono text-xs sm:text-sm space-y-2">
              {tool.envVars.map((env) => {
                const val = env.value.replace("{{baseUrl}}", baseUrl);
                return (
                  <div key={env.key} className="flex items-center justify-between gap-2">
                    <span>
                      export {env.key}={val}
                    </span>
                    <CopyButton text={`export ${env.key}=${val}`} />
                  </div>
                );
              })}
            </div>
          )}

          <a
            href={tool.link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            {tool.link.label}
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      ))}
    </CardContent>
  </Card>
);
