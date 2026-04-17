import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import {
  useUploadDocument,
  useSubmitManualDocument,
  useListDocuments,
  useDeleteDocument,
  getListDocumentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Upload, FileText, AlertCircle, CheckCircle, Clock, Shield, Pencil } from "lucide-react";

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

type DocType = "DL" | "RC" | "IC";
type InputTab = "file" | "manual";

function FieldInput({
  label,
  id,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
        {label}
      </label>
      <input
        id={id}
        data-testid={`input-manual-${id}`}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [userId, setUserId] = useState("demo-user");
  const [documentType, setDocumentType] = useState<DocType>("DL");
  const [inputTab, setInputTab] = useState<InputTab>("file");

  // File upload state
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Manual entry state
  const [manualName, setManualName] = useState("");
  const [manualLicense, setManualLicense] = useState("");
  const [manualVehicle, setManualVehicle] = useState("");
  const [manualExpiry, setManualExpiry] = useState("");

  const uploadMutation = useUploadDocument();
  const manualMutation = useSubmitManualDocument();
  const deleteMutation = useDeleteDocument();

  const { data: documents, isLoading } = useListDocuments(
    { userId },
    { query: { queryKey: getListDocumentsQueryKey({ userId }) } }
  );

  const handleFileSelect = (file: File) => setSelectedFile(file);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const invalidateDocs = () =>
    queryClient.invalidateQueries({ queryKey: getListDocumentsQueryKey({ userId }) });

  const handleFileUpload = () => {
    if (!selectedFile) {
      toast({ title: "No file selected", description: "Please select a document to upload.", variant: "destructive" });
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("documentType", documentType);
    formData.append("userId", userId);

    uploadMutation.mutate(
      { data: formData as any },
      {
        onSuccess: () => {
          toast({ title: "Document analyzed", description: `${DOC_TYPE_LABELS[documentType]} processed successfully.` });
          setSelectedFile(null);
          invalidateDocs();
        },
        onError: () => {
          toast({ title: "Upload failed", description: "Could not process the document.", variant: "destructive" });
        },
      }
    );
  };

  const handleManualSubmit = () => {
    if (!manualName && !manualLicense && !manualVehicle && !manualExpiry) {
      toast({ title: "No fields entered", description: "Fill in at least one field to analyze.", variant: "destructive" });
      return;
    }

    manualMutation.mutate(
      {
        data: {
          userId,
          documentType,
          ...(manualName && { name: manualName }),
          ...(manualLicense && { licenseNumber: manualLicense }),
          ...(manualVehicle && { vehicleNumber: manualVehicle }),
          ...(manualExpiry && { expiryDate: manualExpiry }),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Document analyzed", description: `${DOC_TYPE_LABELS[documentType]} submitted and analyzed.` });
          setManualName("");
          setManualLicense("");
          setManualVehicle("");
          setManualExpiry("");
          invalidateDocs();
        },
        onError: () => {
          toast({ title: "Submission failed", description: "Could not analyze the document.", variant: "destructive" });
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Document deleted" });
          invalidateDocs();
        },
      }
    );
  };

  const isPending = uploadMutation.isPending || manualMutation.isPending;
  const scoreColor = (score: number) =>
    score >= 80 ? "text-emerald-400" : score >= 50 ? "text-amber-400" : "text-rose-400";

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6" data-testid="upload-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Document Upload</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload or manually enter DL, RC, or IC document details for automated compliance analysis
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Card */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">Add Document</CardTitle>
            <CardDescription className="text-xs">
              Rule engine analysis runs automatically on submission
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* User ID */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                User / Entity ID
              </label>
              <input
                data-testid="input-userId"
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. demo-user"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Document Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                Document Type
              </label>
              <Select value={documentType} onValueChange={(v) => setDocumentType(v as DocType)}>
                <SelectTrigger data-testid="select-documentType" className="bg-background border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DL">Driving License (DL)</SelectItem>
                  <SelectItem value="RC">Registration Certificate (RC)</SelectItem>
                  <SelectItem value="IC">Insurance Certificate (IC)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mode Tabs */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button
                data-testid="tab-file"
                onClick={() => setInputTab("file")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium transition-colors
                  ${inputTab === "file"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}
              >
                <Upload className="w-3.5 h-3.5" />
                File Upload
              </button>
              <button
                data-testid="tab-manual"
                onClick={() => setInputTab("manual")}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium transition-colors border-l border-border
                  ${inputTab === "manual"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}
              >
                <Pencil className="w-3.5 h-3.5" />
                Manual Entry
              </button>
            </div>

            {/* --- FILE UPLOAD TAB --- */}
            {inputTab === "file" && (
              <>
                <div
                  data-testid="dropzone-upload"
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => document.getElementById("file-input")?.click()}
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all duration-200
                    ${dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 hover:bg-muted/30"}
                    ${selectedFile ? "border-emerald-500/50 bg-emerald-500/5" : ""}`}
                >
                  <input
                    id="file-input"
                    data-testid="input-file"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  />
                  <div className="flex flex-col items-center gap-2">
                    {selectedFile ? (
                      <>
                        <FileText className="w-8 h-8 text-emerald-400" />
                        <span className="text-sm font-medium text-emerald-400">{selectedFile.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024).toFixed(1)} KB
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                          className="text-xs text-muted-foreground hover:text-rose-400 underline"
                        >
                          Remove
                        </button>
                      </>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">Drop file here or click to browse</span>
                        <span className="text-xs text-muted-foreground">JPG, PNG, PDF up to 10MB</span>
                      </>
                    )}
                  </div>
                </div>

                <Button
                  data-testid="button-upload"
                  onClick={handleFileUpload}
                  disabled={!selectedFile || isPending}
                  className="w-full"
                >
                  {uploadMutation.isPending ? (
                    <><span className="animate-spin mr-2">⟳</span> Analyzing...</>
                  ) : (
                    <><Upload className="w-4 h-4 mr-2" /> Upload & Analyze</>
                  )}
                </Button>
              </>
            )}

            {/* --- MANUAL ENTRY TAB --- */}
            {inputTab === "manual" && (
              <>
                <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-4">
                  <FieldInput
                    label="Full Name"
                    id="name"
                    value={manualName}
                    onChange={setManualName}
                    placeholder="e.g. RAJESH KUMAR SINGH"
                  />

                  {documentType === "DL" && (
                    <FieldInput
                      label="License Number"
                      id="licenseNumber"
                      value={manualLicense}
                      onChange={setManualLicense}
                      placeholder="e.g. MH01-2024-0042358"
                      hint="Format: State-Year-Number"
                    />
                  )}

                  {(documentType === "RC" || documentType === "IC") && (
                    <FieldInput
                      label="Vehicle Number"
                      id="vehicleNumber"
                      value={manualVehicle}
                      onChange={setManualVehicle}
                      placeholder="e.g. MH12AB1234"
                    />
                  )}

                  <FieldInput
                    label="Expiry Date"
                    id="expiryDate"
                    type="date"
                    value={manualExpiry}
                    onChange={setManualExpiry}
                    hint="Leave blank if not applicable"
                  />
                </div>

                <Button
                  data-testid="button-manual-submit"
                  onClick={handleManualSubmit}
                  disabled={isPending}
                  className="w-full"
                >
                  {manualMutation.isPending ? (
                    <><span className="animate-spin mr-2">⟳</span> Analyzing...</>
                  ) : (
                    <><Pencil className="w-4 h-4 mr-2" /> Submit & Analyze</>
                  )}
                </Button>
              </>
            )}

            {isPending && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Running rule engine analysis...</p>
                <Progress value={66} className="h-1.5" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {(["DL", "RC", "IC"] as const).map((type) => {
              const count = documents?.filter((d) => d.documentType === type).length ?? 0;
              return (
                <Card key={type} className="border-border bg-card">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-foreground">{count}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{DOC_TYPE_LABELS[type]}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex gap-2">
            <Button
              data-testid="button-view-results"
              variant="outline"
              className="flex-1 text-sm"
              onClick={() => setLocation("/results")}
            >
              View Results Dashboard
            </Button>
            <Button
              data-testid="button-view-associations"
              variant="outline"
              className="flex-1 text-sm"
              onClick={() => setLocation("/associations")}
            >
              Check Associations
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">System Status</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Rule Engine</span>
                <span className="text-emerald-400 font-medium">Active</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">OCR Service</span>
                <span className="text-emerald-400 font-medium">Ready</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Manual Entry</span>
                <span className="text-emerald-400 font-medium">Enabled</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Motor Vehicles Act 1988</span>
                <span className="text-emerald-400 font-medium">Loaded</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Uploaded Documents */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground mb-3">
          Documents{userId && <span className="normal-case font-normal"> for {userId}</span>}
        </h2>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : documents?.length === 0 ? (
          <Card className="border-dashed border-border bg-card/50">
            <CardContent className="py-12 text-center">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No documents yet for <strong>{userId}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload a file or use Manual Entry above
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {documents?.map((doc) => (
              <Card
                key={doc.id}
                data-testid={`card-document-${doc.id}`}
                className="border-border bg-card hover:bg-card/80 transition-colors"
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-primary uppercase tracking-wider">
                        {doc.documentType}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs gap-1 ${STATUS_COLORS[doc.status] ?? ""}`}
                        data-testid={`status-doc-${doc.id}`}
                      >
                        {STATUS_ICONS[doc.status]}
                        {doc.status.replace("_", " ")}
                      </Badge>
                      {doc.fileName.startsWith("manual_") && (
                        <Badge variant="outline" className="text-xs border-border text-muted-foreground gap-1">
                          <Pencil className="w-2.5 h-2.5" />
                          manual
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.uploadedAt).toLocaleDateString()} ·{" "}
                      {doc.violations?.length ?? 0} violation{doc.violations?.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div
                      className={`text-xl font-bold tabular-nums ${scoreColor(doc.complianceScore)}`}
                      data-testid={`score-doc-${doc.id}`}
                    >
                      {doc.complianceScore}
                    </div>
                    <div className="text-xs text-muted-foreground">score</div>
                  </div>
                  <Button
                    data-testid={`button-delete-${doc.id}`}
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                    onClick={() => handleDelete(doc.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
