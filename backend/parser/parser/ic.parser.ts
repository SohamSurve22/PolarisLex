import { OCRResult } from '../ocr/ocr.service.js';
import { RegexPatterns, Keywords } from '../utils/regex.js';
import { normalizeDate } from '../normalizer/date.normalizer.js';
import { computeFieldConfidence } from '../confidence/confidence.service.js';
import { ParsedDocument } from './dl.parser.js';

export async function parseIC(ocr: OCRResult): Promise<ParsedDocument> {
  const fields: Record<string, string | null> = {
    policy_number: null,
    holder_name: null,
    vehicle_number: null,
    expiry_date: null
  };

  const confidences: Record<string, any> = {};

  // Policy Number
  const lines = ocr.text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (Keywords.IC.POLICY_NUMBER.some(k => k.test(lines[i]))) {
      const match = lines[i].match(RegexPatterns.POLICY_NUMBER);
      if (match) fields.policy_number = match[0];
    }
  }
  confidences.policy_number = computeFieldConfidence([], !!fields.policy_number, !!fields.policy_number);

  // Vehicle Number
  const regMatch = ocr.text.match(RegexPatterns.VEHICLE_NUMBER);
  if (regMatch) {
    fields.vehicle_number = regMatch[0].replace(/\s/g, '').toUpperCase();
  }
  confidences.vehicle_number = computeFieldConfidence([], !!fields.vehicle_number, !!fields.vehicle_number);

  // Expiry Date
  const findDate = (keywords: RegExp[]) => {
    for (let i = 0; i < lines.length; i++) {
      if (keywords.some(k => k.test(lines[i]))) {
        const match = (lines[i] + (lines[i+1] || '')).match(RegexPatterns.DATE);
        if (match) return match[0];
      }
    }
    return null;
  };

  fields.expiry_date = normalizeDate(findDate(Keywords.IC.EXPIRY));
  confidences.expiry_date = computeFieldConfidence([], !!fields.expiry_date, !!fields.expiry_date);

  // Holder Name
  for (let i = 0; i < lines.length; i++) {
    if (Keywords.IC.HOLDER.some(k => k.test(lines[i]))) {
      const parts = lines[i].split(':');
      if (parts.length > 1 && parts[1].trim().length > 3) {
        fields.holder_name = parts[1].trim();
        break;
      }
    }
  }
  confidences.holder_name = computeFieldConfidence([], !!fields.holder_name, !!fields.holder_name);

  return {
    fields,
    confidences,
    rawText: ocr.text
  };
}
