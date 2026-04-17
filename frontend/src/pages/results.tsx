import { useState } from "react";
import { useListDocuments, useGetDashboardSummary, getListDocumentsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle, CheckCircle, Clock, ChevronDown, ChevronRight,
  Shield, FileText, TriangleAlert, Scale, BookOpen, CalendarDays, User, Car, Hash
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  compliant: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
  review_required: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  flagged: "bg-rose-500/20 text-rose-400 border-rose-500/40",
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-rose-500/20 text-rose-400 border-rose-500/40",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  medium: "bg-amber-500/20 text-amber-400 border-amber-500/40",
  low: "bg-blue-500/20 text-blue-400 border-blue-500/40",
};

const SEVERITY_PENALTY: Record<string, number> = {
  critical: 50,
  high: 30,
  medium: 20,
  low: 10,
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  compliant: <CheckCircle className="w-4 h-4" />,
  review_required: <Clock className="w-4 h-4" />,
  flagged: <AlertCircle className="w-4 h-4" />,
};

const DOC_TYPE_LABELS: Record<string, string> = {
  DL: "Driving License",
  RC: "Registration Certificate",
  IC: "Insurance Certificate",
};

function scoreColor(score: number) {
  return score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-rose-400";
}

function scoreBg(score: number) {
  return score >= 80 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500";
}

function ComplianceRing({ score }: { score: number }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = score >= 80 ? "#34d399" : score >= 50 ? "#fbbf24" : "#f43f5e";

  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0">
      <circle cx="36" cy="36" r={r} fill="none" stroke="hsl(222 28% 16%)" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text x="36" y="40" textAnchor="middle" fontSize="14" fontWeight="700" fill={color} fontFamily="monospace">
        {score}
      </text>
    </svg>
  );
}

function LawCitation({ section, act, penalty }: { section: string | null; act: string | null; penalty?: number }) {
  if (!section && !act) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5">
      <Scale className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            {section && (
              <span className="text-xs font-bold text-primary font-mono">{section}</span>
            )}
            {section && act && <span className="text-xs text-muted-foreground mx-1.5">·</span>}
            {act && (
              <span className="text-xs font-semibold text-foreground/80">{act}</span>
            )}
          </div>
          {penalty !== undefined && (
            <span className="text-xs font-bold text-rose-400 shrink-0">−{penalty} pts</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const [userId] = useState("demo-user");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: documents, isLoading: docsLoading } = useListDocuments(
    { userId },
    { query: { queryKey: getListDocumentsQueryKey({ userId }) } }
  );

  const { data: summary } = useGetDashboardSummary(
    { userId },
    { query: { queryKey: getGetDashboardSummaryQueryKey({ userId }) } }
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 p-6" data-testid="results-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Compliance Results</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Legal analysis under the Motor Vehicles Act, 1988 · Entity:{" "}
            <span className="text-foreground font-medium">{userId}</span>
          </p>
        </div>
        <BookOpen className="w-6 h-6 text-primary opacity-60" />
      </div>

      {/* Summary Stats */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Documents", value: summary.totalDocuments, color: "text-foreground" },
            { label: "Compliant", value: summary.compliantCount, color: "text-emerald-400" },
            { label: "Review Required", value: summary.reviewRequiredCount, color: "text-amber-400" },
            { label: "Flagged", value: summary.flaggedCount, color: "text-rose-400" },
          ].map(({ label, value, color }) => (
            <Card key={label} className="border-border bg-card">
              <CardContent className="p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">{label}</div>
                <div className={`text-3xl font-bold tabular-nums ${color}`}>{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Avg Compliance Score */}
      {summary && (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <ComplianceRing score={Math.round(summary.averageComplianceScore)} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <Shield className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Average Compliance Score</span>
                </div>
                <Progress value={summary.averageComplianceScore} className="h-2 mb-1" />
                <p className="text-xs text-muted-foreground">
                  {summary.averageComplianceScore >= 80
                    ? "Overall portfolio is compliant."
                    : summary.averageComplianceScore >= 50
                    ? "Some documents require legal review."
                    : "Critical violations detected — immediate action required."}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document List */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Document Analysis</h2>

        {docsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-lg bg-muted/30 animate-pulse" />)}
          </div>
        ) : documents?.length === 0 ? (
          <Card className="border-dashed border-border bg-card/50">
            <CardContent className="py-12 text-center">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No documents to display</p>
              <p className="text-xs text-muted-foreground mt-1">Upload documents on the Upload page first</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {documents?.map((doc) => {
              const isExpanded = expandedId === doc.id;
              const violations = (doc.violations ?? []) as Array<{
                ruleId: string;
                message: string;
                severity: string;
                section: string | null;
                act: string | null;
                explanation: string;
                extractedValue: string | null;
                normalizedValue: string | null;
              }>;

              const criticalCount = violations.filter(v => v.severity === "critical").length;
              const highCount = violations.filter(v => v.severity === "high").length;

              return (
                <Card
                  key={doc.id}
                  data-testid={`card-result-${doc.id}`}
                  className="border-border bg-card overflow-hidden"
                >
                  {/* Main Row */}
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/20 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Score Ring */}
                      <ComplianceRing score={doc.complianceScore} />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                          <span className="text-xs font-bold text-primary uppercase tracking-widest">
                            {doc.documentType}
                          </span>
                          <span className="text-xs text-muted-foreground">{DOC_TYPE_LABELS[doc.documentType]}</span>
                          <Badge
                            variant="outline"
                            data-testid={`status-result-${doc.id}`}
                            className={`text-xs gap-1 ${STATUS_COLORS[doc.status] ?? ""}`}
                          >
                            {STATUS_ICONS[doc.status]}
                            {doc.status.replace("_", " ")}
                          </Badge>
                        </div>

                        {violations.length > 0 ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground">{violations.length} violation{violations.length !== 1 ? "s" : ""}</span>
                            {criticalCount > 0 && (
                              <span className="text-xs font-medium text-rose-400">{criticalCount} critical</span>
                            )}
                            {highCount > 0 && (
                              <span className="text-xs font-medium text-orange-400">{highCount} high</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-emerald-400 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Fully compliant
                          </span>
                        )}
                      </div>

                      <div className="shrink-0 text-muted-foreground">
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/5 p-4 space-y-5">

                      {/* Compliance Score Breakdown */}
                      <div className="rounded-lg border border-border bg-card p-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Compliance Score</span>
                          <span
                            className={`text-2xl font-bold tabular-nums ${scoreColor(doc.complianceScore)}`}
                            data-testid={`score-result-${doc.id}`}
                          >
                            {doc.complianceScore}/100
                          </span>
                        </div>
                        <div className="relative h-3 rounded-full bg-muted/40 overflow-hidden">
                          <div
                            className={`absolute left-0 top-0 h-full rounded-full transition-all ${scoreBg(doc.complianceScore)}`}
                            style={{ width: `${doc.complianceScore}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          {violations.length === 0
                            ? "No laws violated — document is fully compliant."
                            : `Score reduced by ${100 - doc.complianceScore} points due to ${violations.length} legal violation${violations.length !== 1 ? "s" : ""}.`}
                        </p>
                      </div>

                      {/* Extracted Fields */}
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Extracted Fields</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {doc.extractedFields?.name && (
                            <div className="flex items-center gap-2 rounded-md border border-border p-2.5">
                              <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <div>
                                <div className="text-xs text-muted-foreground">Name</div>
                                <div className="text-sm font-medium text-foreground" data-testid={`field-name-${doc.id}`}>{doc.extractedFields.name}</div>
                              </div>
                            </div>
                          )}
                          {doc.extractedFields?.licenseNumber && (
                            <div className="flex items-center gap-2 rounded-md border border-border p-2.5">
                              <Hash className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <div>
                                <div className="text-xs text-muted-foreground">License No.</div>
                                <div className="text-sm font-medium text-foreground font-mono">{doc.extractedFields.licenseNumber}</div>
                              </div>
                            </div>
                          )}
                          {doc.extractedFields?.vehicleNumber && (
                            <div className="flex items-center gap-2 rounded-md border border-border p-2.5">
                              <Car className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <div>
                                <div className="text-xs text-muted-foreground">Vehicle No.</div>
                                <div className="text-sm font-medium text-foreground font-mono">{doc.extractedFields.vehicleNumber}</div>
                              </div>
                            </div>
                          )}
                          {doc.extractedFields?.expiryDate && (
                            <div className="flex items-center gap-2 rounded-md border border-border p-2.5">
                              <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <div>
                                <div className="text-xs text-muted-foreground">Expiry Date</div>
                                <div className="text-sm font-medium text-foreground">{doc.extractedFields.expiryDate}</div>
                              </div>
                            </div>
                          )}
                          {(doc.extractedFields as { dateOfBirth?: string | null })?.dateOfBirth && (
                            <div className="flex items-center gap-2 rounded-md border border-border p-2.5">
                              <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <div>
                                <div className="text-xs text-muted-foreground">Date of Birth</div>
                                <div className="text-sm font-medium text-foreground">{(doc.extractedFields as { dateOfBirth?: string | null }).dateOfBirth}</div>
                              </div>
                            </div>
                          )}
                          {(doc.extractedFields as { dateOfIssue?: string | null })?.dateOfIssue && (
                            <div className="flex items-center gap-2 rounded-md border border-border p-2.5">
                              <CalendarDays className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <div>
                                <div className="text-xs text-muted-foreground">Date of Issue</div>
                                <div className="text-sm font-medium text-foreground">{(doc.extractedFields as { dateOfIssue?: string | null }).dateOfIssue}</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Laws Violated */}
                      {violations.length > 0 ? (
                        <div>
                          <div className="flex items-center gap-2 mb-3">
                            <Scale className="w-3.5 h-3.5 text-rose-400" />
                            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                              Laws Violated ({violations.length})
                            </h4>
                          </div>

                          <div className="space-y-3">
                            {violations.map((v, i) => {
                              const rulePenalty = SEVERITY_PENALTY[v.severity] ?? 20;
                              return (
                                <div
                                  key={i}
                                  data-testid={`violation-${doc.id}-${i}`}
                                  className="rounded-lg border border-border overflow-hidden"
                                >
                                  {/* Violation Header */}
                                  <div className="flex items-start justify-between gap-3 p-3 bg-rose-500/5 border-b border-border">
                                    <div className="flex items-start gap-2 min-w-0">
                                      <TriangleAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                      <span className="text-sm font-semibold text-foreground leading-tight">{v.message}</span>
                                    </div>
                                    <Badge variant="outline" className={`text-xs shrink-0 ${SEVERITY_COLORS[v.severity] ?? ""}`}>
                                      {v.severity}
                                    </Badge>
                                  </div>

                                  <div className="p-3 space-y-2.5">
                                    {/* Law Citation — the prominent block */}
                                    <LawCitation
                                      section={v.section}
                                      act={v.act}
                                      penalty={rulePenalty}
                                    />

                                    {/* Explanation */}
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                      {v.explanation}
                                    </p>

                                    {/* Extracted vs Normalized */}
                                    {(v.extractedValue || v.normalizedValue) && (
                                      <div className="flex flex-wrap gap-4 text-xs pt-0.5">
                                        {v.extractedValue && (
                                          <div>
                                            <span className="text-muted-foreground">Extracted: </span>
                                            <span className="font-mono text-foreground bg-muted/40 px-1 py-0.5 rounded">{v.extractedValue}</span>
                                          </div>
                                        )}
                                        {v.normalizedValue && v.normalizedValue !== v.extractedValue && (
                                          <div>
                                            <span className="text-muted-foreground">Normalized: </span>
                                            <span className="font-mono text-foreground bg-muted/40 px-1 py-0.5 rounded">{v.normalizedValue}</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-emerald-400 text-sm">
                          <CheckCircle className="w-4 h-4 shrink-0" />
                          <span>No laws violated. Document is fully compliant.</span>
                        </div>
                      )}

                      {/* Footer: confidence + filename */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border">
                        <span>OCR Confidence: <span className="font-mono text-foreground">{((doc.confidenceScore ?? 0) * 100).toFixed(0)}%</span></span>
                        <span className="font-mono truncate max-w-[200px]">{doc.fileName}</span>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
