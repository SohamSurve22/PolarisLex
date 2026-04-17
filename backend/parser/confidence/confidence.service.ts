import { OCRWord } from '../ocr/ocr.service.js';

export interface ConfidenceReport {
  value: number;
  method: 'ocr' | 'regex' | 'format_match' | 'combined';
  details: string;
}

export function computeFieldConfidence(
  matchedWords: OCRWord[],
  regexMatch: boolean,
  formatValid: boolean
): ConfidenceReport {
  let score = 0;
  
  if (matchedWords.length > 0) {
    // Average OCR confidence of matched words
    const avgOcr = matchedWords.reduce((acc, w) => acc + w.confidence, 0) / matchedWords.length;
    score += avgOcr * 0.5; // Base 50% from OCR
  }

  if (regexMatch) {
    score += 0.3; // 30% boost for matching expected pattern
  }

  if (formatValid) {
    score += 0.2; // 20% boost for passing format/logical validation (e.g. valid date)
  }

  return {
    value: Math.min(score, 1.0),
    method: 'combined',
    details: `OCR: ${matchedWords.length} words, Regex: ${regexMatch}, Format: ${formatValid}`
  };
}

export function calculateOverallConfidence(fieldConfidences: Record<string, number>): number {
  const values = Object.values(fieldConfidences);
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
