import path from "path";
import fs from "fs";
import OpenAI from "openai";

export interface ExtractedFields {
  name: string | null;
  licenseNumber: string | null;
  vehicleNumber: string | null;
  expiryDate: string | null;
  dateOfBirth: string | null;
  dateOfIssue: string | null;
  rawText: string | null;
  confidence: {
    name?: number;
    licenseNumber?: number;
    vehicleNumber?: number;
    expiryDate?: number;
    dateOfBirth?: number;
  };
}

/**
 * Creates an OpenAI client using Replit AI Integrations env vars.
 */
function getOpenAIClient(): OpenAI | null {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({ 
    baseURL: baseURL || "https://api.openai.com/v1", 
    apiKey 
  });
}

/**
 * Uses GPT-4o vision to perform real OCR on the uploaded document image.
 * Returns structured fields extracted from the actual image content.
 */
async function extractWithVision(filePath: string, documentType: "DL" | "RC" | "IC"): Promise<ExtractedFields | null> {
  const client = getOpenAIClient();
  if (!client) return null;

  const ext = path.extname(filePath).toLowerCase();
  const isPdf = ext === ".pdf";
  if (isPdf) return null; // Vision only works on images

  let imageData: string;
  let mimeType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  try {
    const buffer = fs.readFileSync(filePath);
    imageData = buffer.toString("base64");
    if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
    else if (ext === ".webp") mimeType = "image/webp";
    else if (ext === ".gif") mimeType = "image/gif";
    else mimeType = "image/png";
  } catch {
    return null;
  }

  const systemPrompt = `You are an expert OCR and legal document analysis system for Indian motor vehicle documents. 
Extract all visible fields from the document image with high precision.
Return ONLY a valid JSON object with no markdown, no explanation.`;

  const userPrompt = `This is an Indian motor vehicle document: ${documentType === "DL" ? "Driving License (DL)" : documentType === "RC" ? "Registration Certificate (RC)" : "Insurance Certificate (IC)"}.

Extract every field you can read. Return a JSON object with exactly these keys:
{
  "name": "full name of license holder / owner / insured (string or null)",
  "licenseNumber": "driving license number if visible (string or null, DL only)",
  "vehicleNumber": "vehicle registration number if visible (string or null, RC/IC)",
  "expiryDate": "validity/expiry date in YYYY-MM-DD format (string or null)",
  "dateOfBirth": "date of birth in YYYY-MM-DD format (string or null, DL only)",
  "dateOfIssue": "date of issue / issue date in YYYY-MM-DD format (string or null)",
  "rawText": "ALL visible text from the document, verbatim, newline-separated",
  "confidence": {
    "name": 0.0-1.0,
    "licenseNumber": 0.0-1.0,
    "vehicleNumber": 0.0-1.0,
    "expiryDate": 0.0-1.0,
    "dateOfBirth": 0.0-1.0
  }
}

IMPORTANT date parsing rules:
- "Validity", "Valid Till", "Expiry", "Valid Upto" → use as expiryDate
- "DOB", "Date of Birth" → use as dateOfBirth  
- "Date of Issue", "Issue Date" → use as dateOfIssue
- Convert all dates to YYYY-MM-DD format (e.g., "08/02/2021" → "2021-02-08", "09/02/2010" → "2010-02-09")
- For Indian date format DD/MM/YYYY, treat first part as day, second as month`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${imageData}`,
                detail: "high",
              },
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return null;

    // Strip markdown code fences if present
    const jsonStr = content.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(jsonStr) as {
      name?: string | null;
      licenseNumber?: string | null;
      vehicleNumber?: string | null;
      expiryDate?: string | null;
      dateOfBirth?: string | null;
      dateOfIssue?: string | null;
      rawText?: string | null;
      confidence?: Record<string, number>;
    };

    return {
      name: parsed.name ?? null,
      licenseNumber: parsed.licenseNumber ?? null,
      vehicleNumber: parsed.vehicleNumber ?? null,
      expiryDate: parsed.expiryDate ?? null,
      dateOfBirth: parsed.dateOfBirth ?? null,
      dateOfIssue: parsed.dateOfIssue ?? null,
      rawText: parsed.rawText ?? null,
      confidence: {
        name: parsed.confidence?.name,
        licenseNumber: parsed.confidence?.licenseNumber,
        vehicleNumber: parsed.confidence?.vehicleNumber,
        expiryDate: parsed.confidence?.expiryDate,
        dateOfBirth: parsed.confidence?.dateOfBirth,
      },
    };
  } catch (err) {
    console.error("[OCR] Vision extraction failed:", err);
    return null;
  }
}

/**
 * Main OCR entry point.
 * Attempts AI vision first, falls back to simulation on failure.
 */
export async function extractFields(
  filePath: string,
  documentType: "DL" | "RC" | "IC",
  scenario?: string
): Promise<ExtractedFields> {
  // 1. Try AI vision OCR
  const visionResult = await extractWithVision(filePath, documentType);
  if (visionResult) {
    console.log(`[OCR] Vision extracted: name=${visionResult.name}, expiry=${visionResult.expiryDate}, dob=${visionResult.dateOfBirth}`);
    return visionResult;
  }

  // 2. Try calling an external OCR service if configured
  try {
    const ocrServiceUrl = process.env.OCR_SERVICE_URL;
    if (ocrServiceUrl) {
      const resp = await fetch(`${ocrServiceUrl}/extract`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: filePath }),
        signal: AbortSignal.timeout(10000),
      });
      if (resp.ok) {
        const data = await resp.json() as { raw_text?: string; fields?: Record<string, string>; confidence?: Record<string, number> };
        return {
          name: data.fields?.name ?? null,
          licenseNumber: data.fields?.license_number ?? null,
          vehicleNumber: data.fields?.vehicle_number ?? null,
          expiryDate: data.fields?.expiry_date ?? null,
          dateOfBirth: data.fields?.date_of_birth ?? null,
          dateOfIssue: data.fields?.date_of_issue ?? null,
          rawText: data.raw_text ?? null,
          confidence: {
            name: data.confidence?.name,
            licenseNumber: data.confidence?.license_number,
            vehicleNumber: data.confidence?.vehicle_number,
            expiryDate: data.confidence?.expiry_date,
            dateOfBirth: data.confidence?.date_of_birth,
          },
        };
      }
    }
  } catch {
    // Fall through to simulation
  }

  // 3. Filename-based simulation fallback
  const fileName = path.basename(filePath).toLowerCase();
  const isExpired = fileName.includes("expired") || scenario === "expired";
  const isMismatch = fileName.includes("mismatch") || scenario === "mismatch";
  const isMissing = fileName.includes("missing") || scenario === "missing";

  // Try to extract a name-like string from the filename if it's not a standard one
  const nameFromPath = path.basename(filePath, path.extname(filePath))
    .split(/[-_ ]/)
    .filter(p => p.length > 2 && !["expired", "mismatch", "missing", "dl", "rc", "ic"].includes(p.toLowerCase()))
    .join(" ")
    .toUpperCase();

  const mockName = nameFromPath || (isMismatch ? "RAHUL KUMAR SHARMA" : "RAJESH KUMAR SINGH");

  const today = new Date();
  const futureDate = new Date(today);
  futureDate.setFullYear(today.getFullYear() + 3);
  const pastDate = new Date(today);
  pastDate.setFullYear(today.getFullYear() - 1);

  const isoDate = (d: Date) => d.toISOString().split("T")[0];

  console.log(`[OCR] No API keys or service found. Falling back to simulation for: ${fileName}`);

  if (documentType === "DL") {
    const licenseNumber = isExpired ? "MH01-2019-0042358" : "MH01-2024-0042358";
    const expiry = isExpired ? isoDate(pastDate) : isoDate(futureDate);
    return {
      name: mockName,
      licenseNumber,
      vehicleNumber: null,
      expiryDate: expiry,
      dateOfBirth: "1985-06-15",
      dateOfIssue: "2019-03-01",
      rawText: `DRIVING LICENSE\nNAME: ${mockName}\nDL NO: ${licenseNumber}\nVALID TILL: ${expiry}\nDOB: 15/06/1985\n[SIMULATED EXTRACTION - NO API KEYS]`,
      confidence: { name: 0.85, licenseNumber: 0.82, expiryDate: 0.84, dateOfBirth: 0.80 },
    };
  }

  if (documentType === "RC") {
    const vehicleNum = "MH12AB" + Math.floor(1000 + Math.random() * 9000);
    return {
      name: mockName,
      licenseNumber: null,
      vehicleNumber: vehicleNum,
      expiryDate: isoDate(futureDate),
      dateOfBirth: null,
      dateOfIssue: null,
      rawText: `REGISTRATION CERTIFICATE\nOWNER: ${mockName}\nVEHICLE NO: ${vehicleNum}\nCLASS: LMV\nVALID: ${isoDate(futureDate)}\n[SIMULATED EXTRACTION - NO API KEYS]`,
      confidence: { name: 0.87, vehicleNumber: 0.89, expiryDate: 0.85 },
    };
  }

  if (documentType === "IC") {
    const vehicleNum = isMismatch ? "MH12XY9999" : "MH12AB1234";
    const expiry = isMissing ? null : (isExpired ? isoDate(pastDate) : isoDate(futureDate));
    return {
      name: mockName,
      licenseNumber: null,
      vehicleNumber: vehicleNum,
      expiryDate: expiry,
      dateOfBirth: null,
      dateOfIssue: null,
      rawText: isMissing
        ? `INSURANCE CERTIFICATE\nINSUREE: ${mockName}\nVEHICLE NO: ${vehicleNum}\nPOLICY: [UNABLE TO EXTRACT]\n[SIMULATED EXTRACTION]`
        : `INSURANCE CERTIFICATE\nINSUREE: ${mockName}\nVEHICLE NO: ${vehicleNum}\nVALID TILL: ${expiry}\n[SIMULATED EXTRACTION]`,
      confidence: { name: 0.83, vehicleNumber: 0.81, expiryDate: isMissing ? 0 : 0.79 },
    };
  }

  return { name: null, licenseNumber: null, vehicleNumber: null, expiryDate: null, dateOfBirth: null, dateOfIssue: null, rawText: "[UNSUPPORTED]", confidence: {} };
}
