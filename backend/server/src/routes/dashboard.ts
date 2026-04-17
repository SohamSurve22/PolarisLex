import { Router, type IRouter } from "express";
import { connectToDatabase, MongoDocumentModel } from "@workspace/db";

const router: IRouter = Router();

// Helper to connect to DB before each request (or handled globally)
router.use(async (req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    res.status(500).json({ error: "Database connection failed" });
  }
});

// GET /dashboard/summary
router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const userId = req.query.userId as string | undefined;

  let docs;
  if (userId) {
    docs = await MongoDocumentModel.find({ userId }).sort({ uploadedAt: -1 });
  } else {
    docs = await MongoDocumentModel.find().sort({ uploadedAt: -1 });
  }

  const compliantCount = docs.filter((d) => d.compliance_status === "compliant").length;
  const reviewRequiredCount = docs.filter((d) => d.compliance_status === "review_required").length;
  const flaggedCount = docs.filter((d) => d.compliance_status === "flagged").length;

  const avgScore =
    docs.length > 0
      ? Math.round(docs.reduce((sum, d: any) => sum + (d.overall_confidence * 100 || 100), 0) / docs.length)
      : 100;

  // Violation breakdown by severity
  const violationCounts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  for (const doc of docs) {
    for (const v of (doc.violations as Array<{ severity: string }>) ?? []) {
      if (v.severity in violationCounts) {
        violationCounts[v.severity]++;
      }
    }
  }

  const violationBreakdown = Object.entries(violationCounts).map(([severity, count]) => ({
    severity,
    count,
  }));

  const recentUploads = docs.slice(0, 5).map((doc: any) => ({
    id: String(doc._id || doc.id),
    userId: doc.userId,
    documentType: doc.documentType,
    fileName: doc.fileName,
    uploadedAt: doc.uploadedAt instanceof Date ? doc.uploadedAt.toISOString() : new Date().toISOString(),
    extractedFields: doc.extracted_fields ?? {},
    complianceScore: doc.compliance_status === 'compliant' ? 100 : doc.compliance_status === 'review_required' ? 70 : 40,
    status: doc.compliance_status,
    violations: doc.violations ?? [],
    confidenceScore: doc.overall_confidence ?? 1.0,
  }));

  res.json({
    totalDocuments: docs.length,
    compliantCount,
    reviewRequiredCount,
    flaggedCount,
    averageComplianceScore: avgScore,
    recentUploads,
    violationBreakdown,
  });
});

// GET /dashboard/demo-cases
router.get("/dashboard/demo-cases", async (_req, res): Promise<void> => {
  res.json([
    {
      id: "demo-1",
      title: "Valid Document Set",
      description: "Upload a DL, RC, and IC that are all valid and belong to the same owner.",
      documentType: "DL",
      expectedStatus: "compliant",
      scenario: "All three documents are current, not expired, and match the same owner and vehicle.",
    },
    {
      id: "demo-2",
      title: "Expired Driving License",
      description: "Upload a DL with an expired date. The rule engine flags it immediately.",
      documentType: "DL",
      expectedStatus: "flagged",
      scenario: "License expired over a year ago. Violates Motor Vehicles Act Section 3. Compliance score drops below 50.",
    },
    {
      id: "demo-3",
      title: "Missing Insurance",
      description: "Upload a vehicle without valid insurance certificate fields.",
      documentType: "IC",
      expectedStatus: "flagged",
      scenario: "Insurance certificate either expired or critical fields missing. Violates Motor Vehicles Act Section 146.",
    },
    {
      id: "demo-4",
      title: "Cross-Document Mismatch",
      description: "Upload DL and RC with different owner names, or RC and IC with different vehicle numbers.",
      documentType: "RC",
      expectedStatus: "review_required",
      scenario: "Name on DL does not match RC owner. Or vehicle number on RC does not match IC. Association check fails, flagging potential fraud or document tampering.",
    },
  ]);
});

export default router;
