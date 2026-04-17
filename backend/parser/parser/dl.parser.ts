import { OCRResult, OCRWord } from '../ocr/ocr.service.js';
import { RegexPatterns, Keywords } from '../utils/regex.js';
import { normalizeDate } from '../normalizer/date.normalizer.js';
import { computeFieldConfidence, ConfidenceReport } from '../confidence/confidence.service.js';

export interface ParsedDocument {
  fields: Record<string, string | null>;
  confidences: Record<string, ConfidenceReport>;
  rawText: string;
}

export async function parseDL(ocr: OCRResult): Promise<ParsedDocument> {
  const fields: Record<string, string | null> = {
    name: null,
    dl_number: null,
    dob: null,
    issue_date: null,
    expiry_date: null
  };

  const confidences: Record<string, ConfidenceReport> = {};

  // 1. Extract DL Number
  const dlMatch = ocr.text.match(RegexPatterns.DL_NUMBER);
  if (dlMatch) {
    fields.dl_number = dlMatch[0].replace(/\s/g, '').toUpperCase();
    confidences.dl_number = computeFieldConfidence([], true, true);
  } else {
    confidences.dl_number = { value: 0, method: 'regex', details: 'No match found' };
  }

  // 2. Extract Dates (DOB, Issue, Expiry)
  const lines = ocr.text.split('\n');
  
  const findDateNearKeyword = (keywords: RegExp[]) => {
    for (let i = 0; i < lines.length; i++) {
      if (keywords.some(k => k.test(lines[i]))) {
        // Look in current line and next line
        const textToSearch = lines[i] + (lines[i+1] || '');
        const dateMatch = textToSearch.match(RegexPatterns.DATE);
        if (dateMatch) return dateMatch[0];
      }
    }
    return null;
  };

  fields.dob = normalizeDate(findDateNearKeyword(Keywords.DL.DOB));
  fields.issue_date = normalizeDate(findDateNearKeyword(Keywords.DL.ISSUE_DATE));
  fields.expiry_date = normalizeDate(findDateNearKeyword(Keywords.DL.EXPIRY_DATE));

  confidences.dob = computeFieldConfidence([], !!fields.dob, !!fields.dob);
  confidences.issue_date = computeFieldConfidence([], !!fields.issue_date, !!fields.issue_date);
  confidences.expiry_date = computeFieldConfidence([], !!fields.expiry_date, !!fields.expiry_date);

  // 3. Extract Name
  // Simplistic: Find line with name keyword and take the next part
  for (let i = 0; i < lines.length; i++) {
    if (Keywords.DL.NAME.some(k => k.test(lines[i]))) {
      const parts = lines[i].split(':');
      if (parts.length > 1 && parts[1].trim().length > 3) {
        fields.name = parts[1].trim();
        break;
      } else if (lines[i+1] && lines[i+1].trim().length > 3) {
        fields.name = lines[i+1].trim();
        break;
      }
    }
  }
  confidences.name = computeFieldConfidence([], !!fields.name, !!fields.name);

  return {
    fields,
    confidences,
    rawText: ocr.text
  };
}
