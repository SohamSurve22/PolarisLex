import { Violation } from './temporal.rules.js';

export function checkLogicalRules(fields: Record<string, string | null>, docType: string): Violation[] {
  const violations: Violation[] = [];

  const requiredFields: Record<string, string[]> = {
    'DL': ['name', 'dl_number', 'expiry_date'],
    'RC': ['owner_name', 'registration_number', 'chassis_number'],
    'IC': ['policy_number', 'holder_name', 'vehicle_number', 'expiry_date']
  };

  const currentRequired = requiredFields[docType as keyof typeof requiredFields] || [];

  currentRequired.forEach(field => {
    if (!fields[field]) {
      violations.push({
        type: 'MISSING_REQUIRED_FIELD',
        field: field,
        message: `Required field ${field} is missing on ${docType}.`,
        severity: 'critical',
        confidence: 1.0,
        section: docType === 'DL' ? 'Section 4' : docType === 'RC' ? 'Section 41' : 'Section 146',
        act: 'Motor Vehicles Act, 1988',
        explanation: `Field ${field} could not be extracted from the document. This is a mandatory requirement for a valid ${docType}.`
      });
    }
  });

  return violations;
}
