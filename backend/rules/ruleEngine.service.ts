import { Violation, checkTemporalRules } from './temporal.rules.js';
import { checkFormatRules } from './format.rules.js';
import { checkLogicalRules } from './logical.rules.js';

export interface RuleResult {
  violations: Violation[];
  compliance_status: "compliant" | "review_required" | "flagged";
}

export function runRuleEngine(
  fields: Record<string, string | null>,
  documentType: 'DL' | 'RC' | 'IC'
): RuleResult {
  const violations: Violation[] = [];

  // Run all rule sets
  violations.push(...checkTemporalRules(fields, documentType));
  violations.push(...checkFormatRules(fields, documentType));
  violations.push(...checkLogicalRules(fields, documentType));

  // Determine compliance status
  let status: RuleResult['compliance_status'] = "compliant";

  const critical = violations.some(v => v.severity === 'critical');
  const high = violations.some(v => v.severity === 'high');
  const medium = violations.some(v => v.severity === 'medium');

  if (critical) {
    status = "flagged";
  } else if (high || (medium && violations.length > 2)) {
    status = "review_required";
  }

  return {
    violations,
    compliance_status: status
  };
}
