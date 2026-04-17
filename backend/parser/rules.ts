import { normalizeExtractedFields, isDateExpired } from "./normalizer.js";

export interface Violation {
  ruleId: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  section: string | null;
  act: string | null;
  explanation: string;
  extractedValue: string | null;
  normalizedValue: string | null;
}

export interface ComplianceResult {
  violations: Violation[];
  complianceScore: number;
  status: "compliant" | "review_required" | "flagged";
  normalizedFields: ReturnType<typeof normalizeExtractedFields>;
}

interface LegalRule {
  id: string;
  name: string;
  severity: "low" | "medium" | "high" | "critical";
  section: string;
  act: string;
  weight: number;
  check: (
    data: ReturnType<typeof normalizeExtractedFields> & { dateOfBirth?: string | null; dateOfIssue?: string | null },
    docType: "DL" | "RC" | "IC"
  ) => {
    violated: boolean;
    extractedValue: string | null;
    normalizedValue: string | null;
    explanation: string;
  };
}

/** Calculate age in years from a YYYY-MM-DD date string */
function ageFromDob(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/** Calculate age on a specific reference date */
function ageOnDate(dob: string, refDate: string): number {
  const birth = new Date(dob);
  const ref = new Date(refDate);
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age--;
  return age;
}

const LEGAL_RULES: LegalRule[] = [
  // ─── DRIVING LICENSE RULES ───────────────────────────────────────
  {
    id: "RULE_DL_EXPIRED",
    name: "Driving License Expired",
    severity: "critical",
    section: "Section 3",
    act: "Motor Vehicles Act, 1988",
    weight: 50,
    check: (data, docType) => {
      if (docType !== "DL") return { violated: false, extractedValue: null, normalizedValue: null, explanation: "" };
      const expired = isDateExpired(data.expiryDate);
      return {
        violated: expired,
        extractedValue: data.rawExpiryDate,
        normalizedValue: data.expiryDate,
        explanation: data.expiryDate
          ? `Validity/expiry date: ${data.rawExpiryDate} → normalized: ${data.expiryDate} → ${expired ? "EXPIRED. Motor Vehicles Act, 1988, Section 3: No person shall drive a motor vehicle in any public place unless he holds an effective driving licence." : "Valid."}`
          : "Expiry date could not be extracted from the driving license.",
      };
    },
  },
  {
    id: "RULE_DL_UNDERAGE",
    name: "Holder is Underage (Below 18 Years)",
    severity: "critical",
    section: "Section 4(1)",
    act: "Motor Vehicles Act, 1988",
    weight: 60,
    check: (data, docType) => {
      if (docType !== "DL") return { violated: false, extractedValue: null, normalizedValue: null, explanation: "" };
      const dob = (data as { dateOfBirth?: string | null }).dateOfBirth;
      if (!dob) return { violated: false, extractedValue: null, normalizedValue: null, explanation: "Date of birth not found on document; underage check skipped." };

      const currentAge = ageFromDob(dob);
      const isUnderage = currentAge < 18;

      // Also check age at time of issue if we have dateOfIssue
      const doi = (data as { dateOfIssue?: string | null }).dateOfIssue;
      const ageAtIssue = doi ? ageOnDate(dob, doi) : null;
      const wasUnderageAtIssue = ageAtIssue !== null && ageAtIssue < 18;

      const violated = isUnderage || wasUnderageAtIssue;

      let explanation = "";
      if (isUnderage) {
        explanation = `DOB: ${dob} → current age: ${currentAge} years. UNDERAGE — Motor Vehicles Act, 1988, Section 4(1): No driving licence shall be granted to any person under the age of 18 years.`;
      } else if (wasUnderageAtIssue) {
        explanation = `DOB: ${dob}, Date of Issue: ${doi} → age at issue: ${ageAtIssue} years. UNDERAGE AT TIME OF ISSUE — Motor Vehicles Act, 1988, Section 4(1): Licence must not be granted to persons under 18 years. This licence appears to have been issued illegally.`;
      } else {
        explanation = `DOB: ${dob} → current age: ${currentAge} years. Age requirement satisfied.`;
      }

      return {
        violated,
        extractedValue: dob,
        normalizedValue: `Age: ${currentAge} years${ageAtIssue !== null ? `, Age at issue: ${ageAtIssue} years` : ""}`,
        explanation,
      };
    },
  },
  {
    id: "RULE_DL_MISSING_LICENSE_NUMBER",
    name: "Missing License Number",
    severity: "critical",
    section: "Section 4",
    act: "Motor Vehicles Act, 1988",
    weight: 40,
    check: (data, docType) => {
      if (docType !== "DL") return { violated: false, extractedValue: null, normalizedValue: null, explanation: "" };
      return {
        violated: !data.licenseNumber,
        extractedValue: data.licenseNumber,
        normalizedValue: data.licenseNumber,
        explanation: data.licenseNumber
          ? `License number extracted: ${data.licenseNumber} — valid.`
          : "License number could not be extracted from DL. This is a critical missing field under Motor Vehicles Act, 1988, Section 4.",
      };
    },
  },
  {
    id: "RULE_DL_MISSING_NAME",
    name: "Missing Name on License",
    severity: "high",
    section: "Rule 14",
    act: "Central Motor Vehicles Rules, 1989",
    weight: 25,
    check: (data, docType) => {
      if (docType !== "DL") return { violated: false, extractedValue: null, normalizedValue: null, explanation: "" };
      return {
        violated: !data.name,
        extractedValue: data.name,
        normalizedValue: data.name,
        explanation: data.name
          ? `Holder name extracted: ${data.name} — present.`
          : "Holder name missing from driving license. Required under Central Motor Vehicles Rules, 1989, Rule 14.",
      };
    },
  },

  // ─── INSURANCE CERTIFICATE RULES ─────────────────────────────────
  {
    id: "RULE_IC_EXPIRED",
    name: "Insurance Certificate Expired",
    severity: "critical",
    section: "Section 146",
    act: "Motor Vehicles Act, 1988",
    weight: 50,
    check: (data, docType) => {
      if (docType !== "IC") return { violated: false, extractedValue: null, normalizedValue: null, explanation: "" };
      const expired = isDateExpired(data.expiryDate);
      return {
        violated: expired,
        extractedValue: data.rawExpiryDate,
        normalizedValue: data.expiryDate,
        explanation: data.expiryDate
          ? `Insurance expiry: ${data.rawExpiryDate} → ${data.expiryDate} → ${expired ? "EXPIRED — Motor Vehicles Act, 1988, Section 146: No person shall use a vehicle without valid third-party insurance." : "Valid."}`
          : "Insurance expiry date missing.",
      };
    },
  },
  {
    id: "RULE_IC_MISSING",
    name: "Insurance Certificate Not Readable",
    severity: "critical",
    section: "Section 146",
    act: "Motor Vehicles Act, 1988",
    weight: 50,
    check: (data, docType) => {
      if (docType !== "IC") return { violated: false, extractedValue: null, normalizedValue: null, explanation: "" };
      const missing = !data.expiryDate && !data.vehicleNumber;
      return {
        violated: missing,
        extractedValue: null,
        normalizedValue: null,
        explanation: missing
          ? "Insurance certificate could not be parsed. Critical fields (expiry date, vehicle number) are missing. Driving without valid insurance violates Motor Vehicles Act, 1988, Section 146."
          : "Insurance certificate fields extracted successfully.",
      };
    },
  },
  {
    id: "RULE_IC_MISSING_VEHICLE",
    name: "Vehicle Number Missing on Insurance",
    severity: "high",
    section: "Section 146",
    act: "Motor Vehicles Act, 1988",
    weight: 30,
    check: (data, docType) => {
      if (docType !== "IC") return { violated: false, extractedValue: null, normalizedValue: null, explanation: "" };
      return {
        violated: !data.vehicleNumber,
        extractedValue: data.vehicleNumber,
        normalizedValue: data.vehicleNumber,
        explanation: data.vehicleNumber
          ? `Vehicle number on insurance: ${data.vehicleNumber} — present.`
          : "Vehicle number not found on insurance certificate. Cannot verify vehicle coverage.",
      };
    },
  },

  // ─── REGISTRATION CERTIFICATE RULES ──────────────────────────────
  {
    id: "RULE_RC_EXPIRED",
    name: "Registration Certificate Expired",
    severity: "high",
    section: "Section 39",
    act: "Motor Vehicles Act, 1988",
    weight: 35,
    check: (data, docType) => {
      if (docType !== "RC") return { violated: false, extractedValue: null, normalizedValue: null, explanation: "" };
      if (!data.expiryDate) return { violated: false, extractedValue: null, normalizedValue: null, explanation: "Expiry date not applicable or not found on RC." };
      const expired = isDateExpired(data.expiryDate);
      return {
        violated: expired,
        extractedValue: data.rawExpiryDate,
        normalizedValue: data.expiryDate,
        explanation: expired
          ? `RC expiry: ${data.rawExpiryDate} → ${data.expiryDate} → EXPIRED — Motor Vehicles Act, 1988, Section 39: No person shall drive a vehicle that is not registered.`
          : `RC expiry: ${data.expiryDate} — valid.`,
      };
    },
  },
  {
    id: "RULE_RC_MISSING_VEHICLE",
    name: "Vehicle Number Missing on RC",
    severity: "critical",
    section: "Section 41",
    act: "Motor Vehicles Act, 1988",
    weight: 40,
    check: (data, docType) => {
      if (docType !== "RC") return { violated: false, extractedValue: null, normalizedValue: null, explanation: "" };
      return {
        violated: !data.vehicleNumber,
        extractedValue: data.vehicleNumber,
        normalizedValue: data.vehicleNumber,
        explanation: data.vehicleNumber
          ? `Vehicle number on RC: ${data.vehicleNumber} — present.`
          : "Vehicle number not found on registration certificate. Critical field missing under Motor Vehicles Act, 1988, Section 41.",
      };
    },
  },
];

export function runRuleEngine(
  extractedFields: {
    name?: string | null;
    licenseNumber?: string | null;
    vehicleNumber?: string | null;
    expiryDate?: string | null;
    rawText?: string | null;
    dateOfBirth?: string | null;
    dateOfIssue?: string | null;
  },
  documentType: "DL" | "RC" | "IC"
): ComplianceResult {
  const normalized = normalizeExtractedFields(extractedFields) as ReturnType<typeof normalizeExtractedFields> & {
    dateOfBirth?: string | null;
    dateOfIssue?: string | null;
  };

  // Pass-through DOB and DOI since normalizeExtractedFields doesn't handle them
  normalized.dateOfBirth = extractedFields.dateOfBirth ?? null;
  normalized.dateOfIssue = extractedFields.dateOfIssue ?? null;

  const violations: Violation[] = [];
  let totalRisk = 0;

  for (const rule of LEGAL_RULES) {
    const result = rule.check(normalized, documentType);
    if (result.violated) {
      violations.push({
        ruleId: rule.id,
        message: rule.name,
        severity: rule.severity,
        section: rule.section,
        act: rule.act,
        explanation: result.explanation,
        extractedValue: result.extractedValue,
        normalizedValue: result.normalizedValue,
      });
      totalRisk += rule.weight;
    }
  }

  const riskPct = Math.min(totalRisk, 100);
  const complianceScore = 100 - riskPct;

  let status: "compliant" | "review_required" | "flagged";
  if (complianceScore >= 80) status = "compliant";
  else if (complianceScore >= 50) status = "review_required";
  else status = "flagged";

  return { violations, complianceScore, status, normalizedFields: normalized };
}
