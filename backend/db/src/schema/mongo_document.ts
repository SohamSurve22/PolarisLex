import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IViolation {
  type: string;
  field: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  section?: string | null;
  act?: string | null;
  explanation?: string | null;
}

export interface IMongoDocument extends Document {
  userId: string;
  documentType: "DL" | "RC" | "IC";
  fileName: string;
  uploadedAt: Date;
  raw_ocr_text: string | null;
  extracted_fields: Record<string, any>;
  field_confidences: Record<string, number>;
  bounding_boxes: Record<string, any>;
  violations: IViolation[];
  processing_status: "pending" | "processing" | "completed" | "failed";
  compliance_status: "compliant" | "review_required" | "flagged";
  overall_confidence: number;
  document_hash: string | null;
}

const ViolationSchema = new Schema<IViolation>({
  type: { type: String, required: true },
  field: { type: String, required: true },
  message: { type: String, required: true },
  severity: { type: String, enum: ["low", "medium", "high", "critical"], required: true },
  confidence: { type: Number, required: true },
  section: { type: String, default: null },
  act: { type: String, default: null },
  explanation: { type: String, default: null },
});

const MongoDocumentSchema = new Schema<IMongoDocument>({
  userId: { type: String, required: true, index: true },
  documentType: { type: String, enum: ["DL", "RC", "IC"], required: true },
  fileName: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now },
  raw_ocr_text: { type: String, default: null },
  extracted_fields: { type: Schema.Types.Mixed, default: {} },
  field_confidences: { type: Schema.Types.Mixed, default: {} },
  bounding_boxes: { type: Schema.Types.Mixed, default: {} },
  violations: { type: [ViolationSchema], default: [] },
  processing_status: { type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending" },
  compliance_status: { type: String, enum: ["compliant", "review_required", "flagged"], default: "compliant" },
  overall_confidence: { type: Number, default: 1.0 },
  document_hash: { type: String, default: null, index: true },
});

export const MongoDocumentModel: Model<IMongoDocument> = mongoose.models.Document || mongoose.model<IMongoDocument>("Document", MongoDocumentSchema, "documents");
