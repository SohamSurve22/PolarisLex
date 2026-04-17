import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import pino from "pino";
import { connectToDatabase, MongoDocumentModel } from "@workspace/db";
import { processDocument } from "../services/documentPipeline.service.js";

const router: IRouter = Router();
const logger = pino({ level: "info" });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, "..", "..", "uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, _file, cb) => cb(null, true),
});

// DB connection middleware
router.use(async (_req, res, next) => {
  try {
    await connectToDatabase();
    next();
  } catch (err) {
    res.status(500).json({ error: "Database connection failed" });
  }
});

// GET /documents
router.get("/documents", async (req, res): Promise<void> => {
  const userId = typeof req.query.userId === "string" ? req.query.userId : undefined;
  try {
    const query = userId ? { userId } : {};
    const docs = await MongoDocumentModel.find(query).sort({ uploadedAt: -1 });
    res.json(docs.map(formatDoc));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch documents" });
  }
});

// POST /documents/upload — full pipeline
router.post("/documents/upload", upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const { documentType, userId } = req.body as { documentType?: string; userId?: string };

  if (!documentType || !["DL", "RC", "IC"].includes(documentType)) {
    res.status(400).json({ error: "Invalid or missing documentType. Must be DL, RC, or IC." });
    return;
  }

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const docType = documentType as "DL" | "RC" | "IC";
  logger.info({ file: req.file.filename, docType }, "[Upload] Starting document pipeline");

  try {
    // Check for duplicate by hash
    const result = await processDocument(req.file.path, docType);

    const existing = await MongoDocumentModel.findOne({ document_hash: result.document_hash });
    if (existing) {
      logger.warn({ document_hash: result.document_hash }, "[Upload] Duplicate document detected");
      res.status(409).json({
        error: "Duplicate document detected.",
        existing_document_id: String(existing._id),
      });
      return;
    }

    const newDoc = new MongoDocumentModel({
      userId,
      documentType: docType,
      fileName: req.file.originalname || req.file.filename,
      raw_ocr_text: result.raw_ocr_text,
      extracted_fields: result.extracted_fields,
      field_confidences: result.field_confidences,
      bounding_boxes: result.bounding_boxes,
      violations: result.violations,
      processing_status: "completed",
      compliance_status: result.compliance_status,
      overall_confidence: result.overall_confidence,
      document_hash: result.document_hash,
    });

    const inserted = await newDoc.save();

    res.status(201).json({
      document_id: String(inserted._id),
      type: docType,
      status: "completed",
      extracted_fields: result.extracted_fields,
      field_confidences: result.field_confidences,
      violations: result.violations,
      compliance_status: result.compliance_status,
      overall_confidence: result.overall_confidence,
      processing_time_ms: result.processing_time_ms,
    });
  } catch (err) {
    logger.error({ err }, "[Upload] Pipeline failed");
    res.status(500).json({ error: "Document processing failed", detail: String(err) });
  }
});

// GET /documents/:id
router.get("/documents/:id", async (req, res): Promise<void> => {
  try {
    const doc = await MongoDocumentModel.findById(req.params.id);
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.json(formatDoc(doc));
  } catch (err) {
    res.status(500).json({ error: "Invalid ID or database error" });
  }
});

// DELETE /documents/:id
router.delete("/documents/:id", async (req, res): Promise<void> => {
  try {
    const deleted = await MongoDocumentModel.findByIdAndDelete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.sendStatus(204);
  } catch (err) {
    res.status(500).json({ error: "Deletion failed" });
  }
});

function formatDoc(doc: any) {
  return {
    document_id: String(doc._id || doc.id),
    type: doc.documentType,
    status: doc.processing_status ?? "completed",
    fileName: doc.fileName,
    userId: doc.userId,
    uploadedAt: doc.uploadedAt instanceof Date ? doc.uploadedAt.toISOString() : new Date().toISOString(),
    extracted_fields: doc.extracted_fields ?? {},
    field_confidences: doc.field_confidences ?? {},
    bounding_boxes: doc.bounding_boxes ?? {},
    violations: doc.violations ?? [],
    compliance_status: doc.compliance_status ?? "compliant",
    overall_confidence: doc.overall_confidence ?? 1.0,
    document_hash: doc.document_hash ?? null,
  };
}

export default router;
