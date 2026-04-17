import { OCRResult } from '../ocr/ocr.service.js';
import { parseDL, ParsedDocument } from './dl.parser.js';
import { parseRC } from './rc.parser.js';
import { parseIC } from './ic.parser.js';

export async function routeToParser(
  documentType: 'DL' | 'RC' | 'IC',
  ocr: OCRResult
): Promise<ParsedDocument> {
  switch (documentType) {
    case 'DL':
      return parseDL(ocr);
    case 'RC':
      return parseRC(ocr);
    case 'IC':
      return parseIC(ocr);
    default:
      throw new Error(`Unsupported document type: ${documentType}`);
  }
}
