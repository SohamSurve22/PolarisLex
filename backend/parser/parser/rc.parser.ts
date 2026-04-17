import { OCRResult } from '../ocr/ocr.service.js';
import { RegexPatterns, Keywords } from '../utils/regex.js';
import { normalizeDate } from '../normalizer/date.normalizer.js';
import { computeFieldConfidence } from '../confidence/confidence.service.js';
import { ParsedDocument } from './dl.parser.js';

export async function parseRC(ocr: OCRResult): Promise<ParsedDocument> {
  const fields: Record<string, string | null> = {
    owner_name: null,
    registration_number: null,
    chassis_number: null,
    registration_date: null
  };

  const confidences: Record<string, any> = {};

  // Registration Number
  const regMatch = ocr.text.match(RegexPatterns.VEHICLE_NUMBER);
  if (regMatch) {
    fields.registration_number = regMatch[0].replace(/\s/g, '').toUpperCase();
  }
  confidences.registration_number = computeFieldConfidence([], !!fields.registration_number, !!fields.registration_number);

  // Chassis Number
  const chassisMatch = ocr.text.match(RegexPatterns.CHASSIS_NUMBER);
  if (chassisMatch) {
    fields.chassis_number = chassisMatch[0].toUpperCase();
  }
  confidences.chassis_number = computeFieldConfidence([], !!fields.chassis_number, !!fields.chassis_number);

  // Registration Date
  const lines = ocr.text.split('\n');
  const findDate = (keywords: RegExp[]) => {
    for (let i = 0; i < lines.length; i++) {
      if (keywords.some(k => k.test(lines[i]))) {
        const match = (lines[i] + (lines[i+1] || '')).match(RegexPatterns.DATE);
        if (match) return match[0];
      }
    }
    return null;
  };

  fields.registration_date = normalizeDate(findDate(Keywords.RC.REG_DATE));
  confidences.registration_date = computeFieldConfidence([], !!fields.registration_date, !!fields.registration_date);

  // Owner Name
  for (let i = 0; i < lines.length; i++) {
    if (Keywords.RC.OWNER.some(k => k.test(lines[i]))) {
      const parts = lines[i].split(':');
      if (parts.length > 1 && parts[1].trim().length > 3) {
        fields.owner_name = parts[1].trim();
        break;
      }
    }
  }
  confidences.owner_name = computeFieldConfidence([], !!fields.owner_name, !!fields.owner_name);

  return {
    fields,
    confidences,
    rawText: ocr.text
  };
}
