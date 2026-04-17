import { Violation } from './temporal.rules.js';
import { RegexPatterns } from '../parser/utils/regex.js';

export function checkFormatRules(fields: Record<string, string | null>, docType: string): Violation[] {
  const violations: Violation[] = [];

  if (docType === 'DL' && fields.dl_number) {
    if (!RegexPatterns.DL_NUMBER.test(fields.dl_number)) {
      violations.push({
        type: 'INVALID_FORMAT',
        field: 'dl_number',
        message: 'Driving license number does not follow Indian DL format.',
        severity: 'medium',
        confidence: 0.8,
        section: 'Rule 14',
        act: 'Central Motor Vehicles Rules, 1989',
        explanation: `License number "${fields.dl_number}" does not match the standard SS-RR-YYYY-NNNNNNN pattern required by CMV Rules.`
      });
    }
  }

  if ((docType === 'RC' || docType === 'IC') && (fields.registration_number || fields.vehicle_number)) {
    const val = fields.registration_number || fields.vehicle_number;
    if (val && !RegexPatterns.VEHICLE_NUMBER.test(val)) {
      violations.push({
        type: 'INVALID_FORMAT',
        field: docType === 'RC' ? 'registration_number' : 'vehicle_number',
        message: 'Vehicle registration number format is incorrect.',
        severity: 'medium',
        confidence: 0.8,
        section: 'Section 41',
        act: 'Motor Vehicles Act, 1988',
        explanation: `Vehicle number "${val}" does not match the standard Indian vehicle number plates format.`
      });
    }
  }

  return violations;
}
