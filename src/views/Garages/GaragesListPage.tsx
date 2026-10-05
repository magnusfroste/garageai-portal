import { Link } from "react-router-dom";
import { Warehouse } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useGarageReliability } from "@/hooks/useGarageReliability";
import { formatPct } from "@/models/services/reliabilityService";
import { GradeBadge, HONEST_NOTE } from "./components/Reliability";

const GaragesListPage = () => {
  const { reliability, isLoading } = useGarageReliability();
  const list = [...reliability.values()].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Warehouse className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Garage</h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">{HONEST_NOTE}</p>
      </div>
      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground">Inga garage att visa ännu.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((g) => (
            <Link key={g.garage_name} to={`/garages/${encodeURIComponent(g.garage_name)}`}>
              <Card className="glass-card hover:border-primary/50 transition-colors">
                <CardContent className="pt-5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold truncate">{g.garage_name}</span>
                    <GradeBadge grade={g.grade} />
                  </div>
                  <div className="text-xs text-muted-foreground flex gap-4">
                    <span>Tillgänglighet 7 d: {formatPct(g.windows["7d"]?.availability ?? null)}</span>
                    {g.score != null && <span>{String(g.score).replace(".", ",")} / 100</span>}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default GaragesListPage;
