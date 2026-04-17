import Tesseract, { Word, Page } from 'tesseract.js';
import fs from 'fs';
import path from 'path';
import pino from 'pino';

const logger = pino();

export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OCRWord {
  text: string;
  confidence: number;
  bbox: BBox;
}

export interface OCRResult {
  text: string;
  words: OCRWord[];
}

/**
 * Runs OCR using Tesseract.js.
 * Includes basic simulated preprocessing (in a real app, use Jimp/Sharp here).
 */
export async function runOCR(filePath: string): Promise<OCRResult> {
  const startTime = Date.now();
  
  try {
    // Note: To truly do grayscale/thresholding, we'd use sharp/jimp
    // Tesseract.js some basic internal preprocessing but let's assume 
    // we process the buffer if we had the libs. 
    // Here we proceed with standard recognition.
    
    const worker = await Tesseract.createWorker('eng');
    
    // Set parameters for better accuracy if needed
    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/-.: ',
    });

    const { data: { text, words } } = await worker.recognize(filePath);
    
    await worker.terminate();

    const formattedWords: OCRWord[] = words.map((w: Word) => ({
      text: w.text,
      confidence: w.confidence / 100,
      bbox: {
        x: w.bbox.x0,
        y: w.bbox.y0,
        w: w.bbox.x1 - w.bbox.x0,
        h: w.bbox.y1 - w.bbox.y0
      }
    }));

    logger.info({ 
      msg: 'OCR completed', 
      file: path.basename(filePath), 
      timeMs: Date.now() - startTime 
    });

    return {
      text,
      words: formattedWords
    };
  } catch (error) {
    logger.error({ msg: 'OCR failed', error, file: filePath });
    throw error;
  }
}
