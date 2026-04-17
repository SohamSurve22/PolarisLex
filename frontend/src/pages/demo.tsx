import { useGetDemoCases, getGetDemoCasesQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Clock, FileText, ArrowRight } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  compliant: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  review_required: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  flagged: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  compliant: <CheckCircle className="w-3.5 h-3.5" />,
  review_required: <Clock className="w-3.5 h-3.5" />,
  flagged: <AlertCircle className="w-3.5 h-3.5" />,
};

const DOC_TYPE_LABELS: Record<string, string> = {
  DL: "Driving License",
  RC: "Registration Certificate",
  IC: "Insurance Certificate",
};

const DEMO_USER_MAP: Record<string, string> = {
  "demo-1": "demo-user",
  "demo-2": "user-expired",
  "demo-3": "user-missing-ic",
  "demo-4": "user-mismatch",
};

export default function DemoPage() {
  const [, setLocation] = useLocation();

  const { data: cases, isLoading } = useGetDemoCases({
    query: { queryKey: getGetDemoCasesQueryKey() },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-40 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6" data-testid="demo-page">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Demo Scenarios</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pre-loaded test cases demonstrating the platform's compliance detection and association engine capabilities
        </p>
      </div>

      {/* How it Works */}
      <Card className="border-border bg-card">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">How the Demo Works</h3>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              { step: "1", label: "Upload Document", icon: <FileText className="w-4 h-4" /> },
              { step: "2", label: "OCR Extraction", icon: <span className="text-sm font-mono">OCR</span> },
              { step: "3", label: "Rule Engine", icon: <span className="text-sm">⚖️</span> },
              { step: "4", label: "Compliance Report", icon: <CheckCircle className="w-4 h-4" /> },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <div className="w-8 h-8 rounded-full border border-border bg-muted/30 flex items-center justify-center text-primary">
                  {s.icon}
                </div>
                <span className="text-xs text-muted-foreground">{s.label}</span>
                {i < 3 && <ArrowRight className="w-3 h-3 text-muted-foreground hidden lg:block absolute" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Demo Cases Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {cases?.map((c) => {
          const demoUser = DEMO_USER_MAP[c.id];

          return (
            <Card
              key={c.id}
              data-testid={`card-demo-${c.id}`}
              className="border-border bg-card hover:bg-muted/10 transition-colors"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base font-semibold text-foreground">{c.title}</CardTitle>
                    <CardDescription className="text-xs mt-0.5">{c.description}</CardDescription>
                  </div>
                  <Badge
                    variant="outline"
                    data-testid={`badge-demo-status-${c.id}`}
                    className={`text-xs gap-1 shrink-0 ${STATUS_COLORS[c.expectedStatus] ?? ""}`}
                  >
                    {STATUS_ICONS[c.expectedStatus]}
                    {c.expectedStatus.replace("_", " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="rounded-md border border-border bg-background/50 p-3">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Scenario</div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{c.scenario}</p>
                </div>

                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs border-border text-muted-foreground">
                    {DOC_TYPE_LABELS[c.documentType] ?? c.documentType}
                  </Badge>

                  {demoUser && (
                    <div className="flex gap-2">
                      <Button
                        data-testid={`button-demo-results-${c.id}`}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={() => {
                          sessionStorage.setItem("polarislex-demo-user", demoUser);
                          setLocation("/results");
                        }}
                      >
                        Results
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                      {(c.id === "demo-1" || c.id === "demo-4") && (
                        <Button
                          data-testid={`button-demo-assoc-${c.id}`}
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 gap-1"
                          onClick={() => {
                            sessionStorage.setItem("polarislex-demo-user", demoUser);
                            setLocation("/associations");
                          }}
                        >
                          Associations
                          <ArrowRight className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <Card className="border-border bg-card">
        <CardContent className="p-5">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Compliance Status Legend</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-sm font-medium text-foreground">Compliant</div>
                <div className="text-xs text-muted-foreground">Score &ge; 80 · No critical violations</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-sm font-medium text-foreground">Review Required</div>
                <div className="text-xs text-muted-foreground">Score 50-79 · Minor violations detected</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <div>
                <div className="text-sm font-medium text-foreground">Flagged</div>
                <div className="text-xs text-muted-foreground">Score &lt; 50 · Critical violations detected</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
