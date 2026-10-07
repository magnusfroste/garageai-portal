import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "neutral";

export const StatusBadge = ({ label, tone, compact = false, className }: {
  label: string;
  tone: StatusTone;
  compact?: boolean;
  className?: string;
}) => (
  <Badge variant={tone} className={cn("gap-1.5 whitespace-nowrap font-medium", compact && "px-1.5 py-0 text-[10px]", className)}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
    {label}
  </Badge>
);