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

// GET /associations/:userId
router.get("/associations/:userId", async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.userId) ? req.params.userId[0] : req.params.userId;
  const userId = rawId;

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const docs = await MongoDocumentModel.find({ userId }).sort({ uploadedAt: -1 });

  if (docs.length === 0) {
    res.status(404).json({ error: "No documents found for this user" });
    return;
  }

  // Pick most recent of each type
  const dl = docs.find((d) => d.documentType === "DL");
  const rc = docs.find((d) => d.documentType === "RC");
  const ic = docs.find((d) => d.documentType === "IC");

  const issues: Array<{
    type: string;
    field: string;
    dlValue: string | null;
    rcValue: string | null;
    icValue: string | null;
    description: string;
  }> = [];

  let confidencePenalty = 0;

  // Compare DL.name vs RC.name
  if (dl && rc) {
    const dlName = dl.extracted_fields?.name ?? null;
    const rcName = rc.extracted_fields?.owner_name ?? rc.extracted_fields?.name ?? null;

    if (dlName && rcName && dlName.toUpperCase() !== rcName.toUpperCase()) {
      issues.push({
        type: "name_mismatch",
        field: "name",
        dlValue: dlName,
        rcValue: rcName,
        icValue: null,
        description: `Name mismatch between Driving License ("${dlName}") and Registration Certificate ("${rcName}"). Documents may not belong to the same entity.`,
      });
      confidencePenalty += 35;
    } else if (!dlName || !rcName) {
      issues.push({
        type: "name_missing",
        field: "name",
        dlValue: dlName,
        rcValue: rcName,
        icValue: null,
        description: `Name field could not be extracted from ${!dlName ? "Driving License" : "Registration Certificate"}. Cannot verify entity match.`,
      });
      confidencePenalty += 20;
    }
  }

  // Compare RC.vehicleNumber vs IC.vehicleNumber
  if (rc && ic) {
    const rcVehicle = rc.extracted_fields?.registration_number ?? rc.extracted_fields?.vehicle_number ?? null;
    const icVehicle = ic.extracted_fields?.vehicle_number ?? ic.extracted_fields?.registration_number ?? null;

    if (rcVehicle && icVehicle && rcVehicle.toUpperCase() !== icVehicle.toUpperCase()) {
      issues.push({
        type: "vehicle_mismatch",
        field: "vehicleNumber",
        dlValue: null,
        rcValue: rcVehicle,
        icValue: icVehicle,
        description: `Vehicle number mismatch between RC ("${rcVehicle}") and Insurance Certificate ("${icVehicle}"). Insurance may not cover this vehicle.`,
      });
      confidencePenalty += 40;
    } else if (!rcVehicle || !icVehicle) {
      issues.push({
        type: "vehicle_missing",
        field: "vehicleNumber",
        dlValue: null,
        rcValue: rcVehicle,
        icValue: icVehicle,
        description: `Vehicle number missing on ${!rcVehicle ? "Registration Certificate" : "Insurance Certificate"}. Cannot verify vehicle coverage.`,
      });
      confidencePenalty += 15;
    }
  }

  // Check if all three documents exist
  const missingTypes: string[] = [];
  if (!dl) missingTypes.push("Driving License (DL)");
  if (!rc) missingTypes.push("Registration Certificate (RC)");
  if (!ic) missingTypes.push("Insurance Certificate (IC)");

  if (missingTypes.length > 0) {
    issues.push({
      type: "missing_document",
      field: "documentType",
      dlValue: dl ? "present" : null,
      rcValue: rc ? "present" : null,
      icValue: ic ? "present" : null,
      description: `Missing documents: ${missingTypes.join(", ")}. Full association check requires DL, RC, and IC.`,
    });
    confidencePenalty += missingTypes.length * 15;
  }

  const confidenceScore = Math.max(0, (100 - confidencePenalty) / 100);
  const associated = issues.filter((i) => ["name_mismatch", "vehicle_mismatch"].includes(i.type)).length === 0;

  const formatDoc = (doc: any) => {
    if (!doc) return undefined;
    return {
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
    };
  };

  let summary: string;
  if (issues.length === 0) {
    summary = "All uploaded documents belong to the same entity. No mismatches detected.";
  } else if (associated) {
    summary = `Documents are associated but have ${issues.length} warning(s). Review required.`;
  } else {
    summary = `Cross-document association check FAILED. ${issues.filter((i) => ["name_mismatch", "vehicle_mismatch"].includes(i.type)).length} mismatch(es) detected. These documents may not belong to the same entity.`;
  }

  res.json({
    userId,
    associated,
    confidenceScore,
    issues,
    documents: {
      dl: formatDoc(dl),
      rc: formatDoc(rc),
      ic: formatDoc(ic),
    },
    summary,
  });
});

export default router;
