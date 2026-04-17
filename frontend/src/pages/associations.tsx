import { useState } from "react";
import { useGetAssociations, getGetAssociationsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, AlertCircle, ArrowRight, Shield, Network, Plus, X } from "lucide-react";
import { AssociationGraph } from "@/components/AssociationGraph";

const DEFAULT_USERS = ["demo-user", "user-mismatch", "user-expired", "user-missing-ic"];

const ISSUE_TYPE_COLORS: Record<string, string> = {
  name_mismatch:    "border-rose-500/40 bg-rose-500/5",
  vehicle_mismatch: "border-rose-500/40 bg-rose-500/5",
  name_missing:     "border-amber-500/40 bg-amber-500/5",
  vehicle_missing:  "border-amber-500/40 bg-amber-500/5",
  missing_document: "border-blue-500/40 bg-blue-500/5",
};

const DOC_LABELS: Record<string, string> = {
  dl: "Driving License",
  rc: "Registration Certificate",
  ic: "Insurance Certificate",
};

function DocCard({ docType, doc }: {
  docType: "dl" | "rc" | "ic";
  doc?: { documentType: string; complianceScore: number; status: string; extractedFields?: { name?: string | null; vehicleNumber?: string | null; expiryDate?: string | null } | null } | null
}) {
  const abbrev = docType.toUpperCase();
  if (!doc) {
    return (
      <Card className="border-dashed border-border bg-card/40">
        <CardContent className="p-3">
          <div className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-0.5">{abbrev}</div>
          <div className="text-xs text-muted-foreground mb-2">{DOC_LABELS[docType]}</div>
          <div className="text-xs text-amber-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Not uploaded
          </div>
        </CardContent>
      </Card>
    );
  }
  const c = doc.complianceScore >= 80 ? "text-emerald-400" : doc.complianceScore >= 50 ? "text-amber-400" : "text-rose-400";
  return (
    <Card className="border-border bg-card">
      <CardContent className="p-3">
        <div className="text-xs font-bold text-primary uppercase tracking-widest mb-0.5">{abbrev}</div>
        <div className="text-xs text-muted-foreground mb-2">{DOC_LABELS[docType]}</div>
        <div className="space-y-1 text-xs">
          {doc.extractedFields?.name && <div><span className="text-muted-foreground">Name: </span><span className="font-medium text-foreground" data-testid={`assoc-name-${docType}`}>{doc.extractedFields.name}</span></div>}
          {doc.extractedFields?.vehicleNumber && <div><span className="text-muted-foreground">Vehicle: </span><span className="font-mono font-medium text-foreground" data-testid={`assoc-vehicle-${docType}`}>{doc.extractedFields.vehicleNumber}</span></div>}
          {doc.extractedFields?.expiryDate && <div><span className="text-muted-foreground">Expiry: </span><span className="font-mono text-foreground">{doc.extractedFields.expiryDate}</span></div>}
          <div className="pt-1 border-t border-border">
            <span className="text-muted-foreground">Score: </span><span className={`font-bold tabular-nums ${c}`}>{doc.complianceScore}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UserDetail({ userId }: { userId: string }) {
  const { data, isLoading, error } = useGetAssociations(userId, {
    query: { queryKey: getGetAssociationsQueryKey(userId) },
  });

  if (isLoading) return <div className="h-20 rounded-lg bg-muted/30 animate-pulse" />;
  if (error || !data) return (
    <Card className="border-rose-500/30 bg-rose-500/5">
      <CardContent className="p-4 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
        <p className="text-sm text-muted-foreground">No documents found for <strong>{userId}</strong></p>
      </CardContent>
    </Card>
  );

  const confidencePct = Math.round(data.confidenceScore * 100);
  const confidenceColor = confidencePct >= 80 ? "text-emerald-400" : confidencePct >= 50 ? "text-amber-400" : "text-rose-400";

  return (
    <div className="space-y-4">
      <Card data-testid="assoc-result-banner" className={`border-2 ${data.associated ? "border-emerald-500/40 bg-emerald-500/5" : "border-rose-500/40 bg-rose-500/5"}`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`rounded-full p-1.5 ${data.associated ? "bg-emerald-500/20" : "bg-rose-500/20"}`}>
              {data.associated ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <XCircle className="w-5 h-5 text-rose-400" />}
            </div>
            <div className="flex-1">
              <p className={`text-base font-bold ${data.associated ? "text-emerald-400" : "text-rose-400"}`} data-testid="assoc-result-text">
                {data.associated ? "All documents belong to the same entity" : "Association FAILED — mismatch detected"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{data.summary}</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-muted-foreground"><Shield className="w-3 h-3" /> Confidence</span>
              <span className={`font-bold tabular-nums ${confidenceColor}`} data-testid="assoc-confidence-score">{confidencePct}%</span>
            </div>
            <Progress value={confidencePct} className="h-1.5" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        {(["dl", "rc", "ic"] as const).map((t) => (
          <DocCard key={t} docType={t} doc={data.documents?.[t] ?? null} />
        ))}
      </div>

      {data.issues && data.issues.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Issues</h3>
          <div className="space-y-2">
            {data.issues.map((issue, i) => (
              <Card key={i} data-testid={`assoc-issue-${i}`} className={`border ${ISSUE_TYPE_COLORS[issue.type] ?? "border-border bg-card"}`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <XCircle className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">{issue.description}</p>
                      <p className="text-xs text-muted-foreground font-mono">Field: {issue.field}</p>
                    </div>
                    <Badge variant="outline" className="text-xs border-border text-muted-foreground shrink-0">
                      {issue.type.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  {(issue.dlValue || issue.rcValue || issue.icValue) && (
                    <div className="flex items-center gap-3 text-xs bg-background/50 rounded p-2 border border-border">
                      {issue.dlValue && <div><div className="text-muted-foreground">DL</div><div className="font-mono font-medium text-foreground">{issue.dlValue}</div></div>}
                      {issue.dlValue && (issue.rcValue || issue.icValue) && <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                      {issue.rcValue && <div><div className="text-muted-foreground">RC</div><div className="font-mono font-medium text-foreground">{issue.rcValue}</div></div>}
                      {issue.rcValue && issue.icValue && <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />}
                      {issue.icValue && <div><div className="text-muted-foreground">IC</div><div className="font-mono font-medium text-foreground">{issue.icValue}</div></div>}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AssociationsPage() {
  const [graphUsers, setGraphUsers] = useState<string[]>(DEFAULT_USERS);
  const [inputValue, setInputValue] = useState("");
  const [detailUserId, setDetailUserId] = useState<string>("demo-user");
  const [activeTab, setActiveTab] = useState<"graph" | "detail">("graph");
  const [addError, setAddError] = useState<string | null>(null);

  const handleAddUser = () => {
    const uid = inputValue.trim();
    if (!uid) return;
    if (graphUsers.includes(uid)) {
      setAddError(`"${uid}" is already in the graph`);
      return;
    }
    setGraphUsers(prev => [...prev, uid]);
    setAddError(null);
    setInputValue("");
  };

  const handleRemoveUser = (uid: string) => {
    // Don't allow removing if only 1 left
    if (graphUsers.length <= 1) return;
    setGraphUsers(prev => prev.filter(u => u !== uid));
  };

  const handleViewDetail = (uid: string) => {
    setDetailUserId(uid);
    setActiveTab("detail");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6" data-testid="associations-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Association Engine</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live graph — add any user ID to see their document cluster appear instantly
          </p>
        </div>
        <Network className="w-6 h-6 text-primary opacity-60" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {[
          { id: "graph" as const, label: "Graph View — All Users" },
          { id: "detail" as const, label: "Per-User Detail" },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === id ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Graph Tab ── */}
      {activeTab === "graph" && (
        <div className="space-y-4">
          {/* Add user control */}
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">
                    Add User to Graph
                  </label>
                  <input
                    data-testid="input-assoc-userId"
                    type="text"
                    value={inputValue}
                    placeholder="Type a user ID and press Add…"
                    onChange={(e) => { setInputValue(e.target.value); setAddError(null); }}
                    onKeyDown={(e) => e.key === "Enter" && handleAddUser()}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  {addError && <p className="text-xs text-amber-400 mt-1">{addError}</p>}
                </div>
                <Button data-testid="button-check-assoc" onClick={handleAddUser} className="gap-1.5 shrink-0">
                  <Plus className="w-4 h-4" /> Add to Graph
                </Button>
              </div>

              {/* Active user pills */}
              <div className="mt-3">
                <span className="text-xs text-muted-foreground mr-2">In graph:</span>
                <div className="inline-flex flex-wrap gap-1.5 mt-1">
                  {graphUsers.map((uid) => (
                    <span key={uid}
                      className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10 text-primary"
                    >
                      {uid}
                      {graphUsers.length > 1 && (
                        <button
                          onClick={() => handleRemoveUser(uid)}
                          className="ml-0.5 text-primary/60 hover:text-rose-400 transition-colors"
                          title={`Remove ${uid} from graph`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              </div>

              {/* Quick demo buttons */}
              <div className="mt-3 flex flex-wrap gap-2 items-center">
                <span className="text-xs text-muted-foreground">Quick add:</span>
                {DEFAULT_USERS.filter(u => !graphUsers.includes(u)).map((u) => (
                  <button key={u}
                    onClick={() => { setGraphUsers(prev => [...prev, u]); setAddError(null); }}
                    className="text-xs px-2 py-0.5 rounded-full border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors"
                  >
                    + {u}
                  </button>
                ))}
                {DEFAULT_USERS.every(u => graphUsers.includes(u)) && (
                  <span className="text-xs text-muted-foreground italic">All demo users added</span>
                )}
              </div>
            </CardContent>
          </Card>

          <AssociationGraph users={graphUsers} />

          <p className="text-xs text-center text-muted-foreground">
            Hover nodes for details · Click to inspect · New clusters animate in automatically
          </p>
        </div>
      )}

      {/* ── Detail Tab ── */}
      {activeTab === "detail" && (
        <div className="space-y-6">
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-1 block">User ID</label>
                  <input
                    type="text"
                    value={detailUserId}
                    onChange={(e) => setDetailUserId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && setDetailUserId(e.currentTarget.value.trim())}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground">Quick:</span>
                {graphUsers.map((u) => (
                  <button key={u}
                    onClick={() => setDetailUserId(u)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      detailUserId === u ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
          <UserDetail userId={detailUserId} />
        </div>
      )}
    </div>
  );
}
