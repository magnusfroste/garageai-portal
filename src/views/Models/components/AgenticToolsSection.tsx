import { Bot, Terminal, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "./CopyButton";
import { t } from "@/i18n";
import { opencodeSetupCommand } from "@/models/services/opencodeSetup";
import { useModelCatalog } from "@/hooks/useModelCatalog";
import { useCuratedModels } from "@/hooks/useCuratedModels";

interface AgenticTool {
  name: string;
  badge: string;
  description: string;
  note?: string;
  features: string[];
  envVars: { key: string; value: string }[];
  configFile?: { path: string; content: string };
  commands?: { label: string; lines: string[] };
  pitfalls?: string[];
  link: { url: string; label: string };
}

const tools: AgenticTool[] = [
  {
    name: "Claude Code",
    badge: "Recommended",
    description:
      "Anthropic's premier agentic coding tool. Claude Code runs directly in your terminal and understands your entire codebase — editing files, running commands, and iterating autonomously.",
    note:
      "Anthropic does not officially support Claude Code with non-Claude models through a gateway; it works with GarageAI, but at your own risk.",
    features: [
      "Full codebase awareness with automatic context gathering",
      "Runs terminal commands, edits files, creates commits",
    ],
    envVars: [
      { key: "ANTHROPIC_BASE_URL", value: "{{baseUrl}}" },
      { key: "ANTHROPIC_AUTH_TOKEN", value: "$GARAGE_API_KEY" },
      { key: "ANTHROPIC_MODEL", value: "{{model}}" },
      { key: "ANTHROPIC_DEFAULT_HAIKU_MODEL", value: "{{model}}" },
      { key: "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS", value: "1" },
    ],
    pitfalls: [
      "Use ANTHROPIC_AUTH_TOKEN, not ANTHROPIC_API_KEY: the API-key variable asks for approval once and is silently ignored if you declined it, and it clashes with a saved claude.ai login (run /logout if Claude Code warns about two credentials).",
      "Set ANTHROPIC_DEFAULT_HAIKU_MODEL too: Claude Code runs background tasks such as session titles on a small Claude model name, which GarageAI does not serve, so those requests fail with \"Invalid model name\".",
      "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS=1 stops Claude Code from sending pre-release fields that open models reject with a 400.",
      "To keep the settings in every terminal, put the same variables in the env block of ~/.claude/settings.json (never in a project's .claude/settings.json, which is committed).",
      "Claude Code assumes a very large context window. Open models have less, so in long sessions run /compact when answers start failing.",
      "Run /status in Claude Code: the Anthropic base URL line should show the GarageAI address.",
    ],
    link: { url: "https://docs.anthropic.com/en/docs/claude-code", label: "Claude Code docs" },
  },
  {
    name: "OpenCode",
    badge: "Terminal",
    description:
      "Open-source coding agent for the terminal. OpenCode 2 needs GarageAI declared as a provider in opencode.json, and the API key must reach its background service (an export in your shell is not enough).",
    features: [],
    envVars: [],
    configFile: {
      path: "~/.config/opencode/opencode.json (or opencode.json in your project)",
      content: `{
  "$schema": "https://opencode.ai/config.json",
  "providers": {
    "garageai": {
      "name": "GarageAI",
      "env": ["GARAGE_API_KEY"],
      "package": "@opencode/ai/providers/openai-compatible",
      "settings": {
        "baseURL": "{{baseUrl}}"
      },
      "models": {
        "auto": {
          "modelID": "garageai/auto",
          "name": "GarageAI auto",
          "limit": { "context": 32768, "output": 4096 }
        }
      }
    }
  },
  "model": "garageai/auto"
}`,
    },
    commands: {
      label: "Give the key to OpenCode's background service, then test:",
      lines: [
        "opencode service set env GARAGE_API_KEY <your key>",
        "opencode service restart",
        'opencode run -m garageai/auto "hello"',
      ],
    },
    pitfalls: [
      "\"Authentication Error, No api key passed in\": OpenCode 2 runs a background service that does not see keys you export in your shell, and opencode reload does not pass them on. Use opencode service set env (above) and restart the service. For a one-off test, opencode run --standalone uses your shell's environment.",
      "OpenCode 2 uses \"providers\" (plural), \"package\" and \"settings\". The older \"provider\" / \"npm\" / \"options.apiKey\" format from OpenCode 1 guides is deprecated and drops the key.",
      "\"Unsupported package\": the package must be @opencode/ai/providers/openai-compatible.",
      "The base URL must end in /v1.",
      "To add another model, add an entry under models with a short key and modelID set to the exact GarageAI model id from the model list; you then pick it as garageai/<key>. Use auto or a model with the Tools badge: OpenCode is an agent and needs tool calling.",
      "Keep limit.context: without it OpenCode cannot compact the conversation, and its long system prompt overflows smaller models.",
    ],
    link: { url: "https://opencode.ai/v2/docs/providers/", label: "OpenCode provider docs" },
  },
  {
    name: "Codex",
    badge: "Terminal",
    description:
      "OpenAI's open-source coding agent for the terminal. It talks the Responses API, which GarageAI supports: declare GarageAI as a model provider in your Codex config.",
    features: [],
    envVars: [],
    configFile: {
      path: "~/.codex/config.toml (your user config; a project .codex/config.toml cannot add providers)",
      content: `model = "garageai/auto"
model_provider = "garageai"

[model_providers.garageai]
name = "GarageAI"
base_url = "{{baseUrl}}"
env_key = "GARAGE_API_KEY"
wire_api = "responses"`,
    },
    commands: {
      label: "Set the key in your shell, then start Codex:",
      lines: ["export GARAGE_API_KEY=<your key>", "codex"],
    },
    pitfalls: [
      "Put model and model_provider above every [section] in config.toml; below a section TOML reads them as part of that section and Codex ignores them.",
      "wire_api must be \"responses\": current Codex no longer speaks the older chat completions format.",
      "The provider ID cannot be a built-in one such as openai; use garageai.",
      "Codex reads the key from the shell it starts in, so export GARAGE_API_KEY in that terminal (or in ~/.zshrc / ~/.bashrc).",
      "Use auto or a model with the Tools badge: Codex is an agent and needs tool calling.",
    ],
    link: { url: "https://learn.chatgpt.com/docs/config-file/config-advanced", label: "Codex provider docs" },
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

export const AgenticToolsSection = ({ baseUrl }: { baseUrl: string }) => {
  const { models } = useModelCatalog();
  const { models: curated } = useCuratedModels(true);
  const model = curated.find((m) => m.is_default && m.garage_tier === "pool")?.model_name || models.find((m) => m.available && m.poolId)?.poolId || models.find((m) => m.poolId)?.poolId || "<pool-model-id>";
  // OpenCode and Codex need the versioned endpoint, so keep /v1 here (unlike the env vars above).
  const v1BaseUrl = (() => {
    const trimmed = baseUrl.replace(/\/+$/, "");
    return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
  })();
  return (
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
        {tools.map((tool) => {
          const configContent = tool.configFile?.content.replace("{{baseUrl}}", v1BaseUrl) ?? "";
          return (
            <div key={tool.name} className="rounded-lg border border-border/50 p-5 space-y-3">
              <div className="flex items-center gap-3">
                <Terminal className="w-5 h-5 text-primary shrink-0" />
                <h3 className="font-semibold text-foreground">{tool.name}</h3>
                <Badge variant="secondary" className="text-[10px]">{tool.badge}</Badge>
              </div>

              <p className="text-sm text-muted-foreground">{tool.description}</p>
              {tool.note && (
                <p className="text-xs text-muted-foreground/80">{tool.note}</p>
              )}

              <ul className="grid gap-1.5 text-sm text-muted-foreground">
                {tool.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    {f}
                  </li>
                ))}
              </ul>

              {tool.name === "OpenCode" && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Fastest: create a key, then paste the OpenCode line shown with it.</p>
                  <div className="bg-secondary/50 rounded-lg p-4 font-mono text-xs sm:text-sm flex items-start justify-between gap-2">
                    <span className="min-w-0 break-all">{opencodeSetupCommand("<your key>")}</span>
                    <CopyButton text={opencodeSetupCommand("<your key>")} />
                  </div>
                </div>
              )}

              {tool.configFile && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 break-words font-mono text-xs text-muted-foreground">
                      {tool.configFile.path}
                    </span>
                    <CopyButton text={configContent} />
                  </div>
                  <div className="bg-secondary/50 rounded-lg p-4 font-mono text-xs sm:text-sm whitespace-pre-wrap break-words">
                    {configContent}
                  </div>
                </div>
              )}

              {tool.commands && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{tool.commands.label}</p>
                  <div className="bg-secondary/50 rounded-lg p-4 font-mono text-xs sm:text-sm space-y-2">
                    {tool.commands.lines.map((line, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 break-all">{line}</span>
                        <CopyButton text={line} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tool.envVars.length > 0 && (
                <div className="bg-secondary/50 rounded-lg p-4 font-mono text-xs sm:text-sm space-y-2">
                  {tool.envVars.map((env) => {
                    const val = env.value.replace("{{baseUrl}}", baseUrl.replace(/\/v1\/?$/, "")).replace("{{model}}", model);
                    return (
                      <div key={env.key} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 break-all">
                          export {env.key}={val}
                        </span>
                        <CopyButton text={`export ${env.key}=${val}`} />
                      </div>
                    );
                  })}
                </div>
              )}

              {tool.pitfalls && tool.pitfalls.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Common pitfalls</p>
                  <ul className="grid gap-1 text-xs text-muted-foreground">
                    {tool.pitfalls.map((p, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-muted-foreground/60 mt-0.5">•</span>
                        {p}
                      </li>
                    ))}
                  </ul>
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
          );
        })}
      </CardContent>
    </Card>
  );
};
