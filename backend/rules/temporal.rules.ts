export interface Violation {
  type: string;
  field: string;
  message: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  section?: string | null;
  act?: string | null;
  explanation?: string | null;
}

export function checkTemporalRules(fields: Record<string, string | null>, docType: string): Violation[] {
  const violations: Violation[] = [];
  const today = new Date();
  
  // 1. Expiry Check
  const expiryField = docType === 'DL' ? 'expiry_date' : docType === 'RC' ? 'registration_date' : 'expiry_date';
  const expiryValue = fields[expiryField];

  if (expiryValue) {
    const expiry = new Date(expiryValue);
    if (expiry < today) {
      violations.push({
        type: 'DOC_EXPIRED',
        field: expiryField,
        message: 'Document has expired.',
        severity: 'critical',
        confidence: 1.0,
        section: docType === 'DL' ? 'Section 3' : docType === 'IC' ? 'Section 146' : 'Section 39',
        act: 'Motor Vehicles Act, 1988',
        explanation: `The ${docType} expired on ${expiryValue}. Driving with an expired document is a violation of the Motor Vehicles Act.`
      });
    }
  }

  // 2. Age Check (DL Only)
  if (docType === 'DL' && fields.dob) {
    const dob = new Date(fields.dob);
    const age = (today.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    
    if (age < 18) {
      violations.push({
        type: 'UNDERAGE',
        field: 'dob',
        message: 'Holder is underage (below 18).',
        severity: 'critical',
        confidence: 1.0,
        section: 'Section 4(1)',
        act: 'Motor Vehicles Act, 1988',
        explanation: `Holder age: ${Math.floor(age)} years. Section 4(1) states no driving license shall be granted to any person under 18.`
      });
    }

    if (fields.issue_date) {
      const issue = new Date(fields.issue_date);
      const ageAtIssue = (issue.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
      if (ageAtIssue < 18) {
        violations.push({
          type: 'UNDERAGE_AT_ISSUE',
          field: 'issue_date',
          message: 'Document issued before legal age.',
          severity: 'critical',
          confidence: 1.0,
          section: 'Section 4(1)',
          act: 'Motor Vehicles Act, 1988',
          explanation: `License was issued when holder was ${Math.floor(ageAtIssue)} years old, which is below the legal limit of 18.`
        });
      }
    }
  }

  return violations;
}
