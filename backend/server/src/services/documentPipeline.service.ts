import crypto from "crypto";
import fs from "fs";
import pino from "pino";
import { runOCR, routeToParser, calculateOverallConfidence } from "@workspace/parser";
import { runRuleEngine } from "@workspace/rules";

const logger = pino({ level: "info" });

export interface PipelineResult {
  document_id?: string;
  type: "DL" | "RC" | "IC";
  status: "completed" | "failed";
  raw_ocr_text: string;
  extracted_fields: Record<string, string | null>;
  field_confidences: Record<string, any>;
  bounding_boxes: Record<string, any>;
  violations: any[];
  compliance_status: "compliant" | "review_required" | "flagged";
  overall_confidence: number;
  processing_time_ms: number;
  document_hash: string;
}

export async function processDocument(
  filePath: string,
  documentType: "DL" | "RC" | "IC"
): Promise<PipelineResult> {
  const startTime = Date.now();
  logger.info({ msg: 'Processing document', file: filePath, type: documentType });

  // 1. Hash the file buffer for deduplication
  const fileBuffer = fs.readFileSync(filePath);
  const document_hash = crypto.createHash("sha256").update(fileBuffer).digest("hex");

  // 2. Run OCR
  const ocrResult = await runOCR(filePath);
  const rawText = ocrResult.text;

  // 3. Route to correct parser
  const parseResult = await routeToParser(documentType, ocrResult);
  
  // 4. Build bounding boxes for fields (best-effort match to OCR words)
  const bounding_boxes: Record<string, any> = {};
  for (const [key, value] of Object.entries(parseResult.fields)) {
    if (!value) continue;
    // Simple heuristic to find bounding box from words
    const matched = ocrResult.words.find(w => 
      value.toLowerCase().includes(w.text.toLowerCase()) || 
      w.text.toLowerCase().includes(value.toLowerCase())
    );
    if (matched) {
      bounding_boxes[key] = matched.bbox;
    }
  }

  // 5. Run rule engine
  const ruleResult = runRuleEngine(parseResult.fields, documentType);

  // 6. Compute overall confidence
  const confidenceValues: Record<string, number> = {};
  Object.entries(parseResult.confidences).forEach(([key, conf]) => {
    confidenceValues[key] = conf.value;
  });
  const overall_confidence = calculateOverallConfidence(confidenceValues);

  const processing_time_ms = Date.now() - startTime;
  
  logger.info({ 
    msg: 'Processing complete', 
    type: documentType, 
    status: ruleResult.compliance_status,
    timeMs: processing_time_ms 
  });

  return {
    type: documentType,
    status: "completed",
    raw_ocr_text: rawText,
    extracted_fields: parseResult.fields,
    field_confidences: parseResult.confidences,
    bounding_boxes,
    violations: ruleResult.violations,
    compliance_status: ruleResult.compliance_status,
    overall_confidence,
    processing_time_ms,
    document_hash,
  };
}
