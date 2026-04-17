/**
 * Normalizes various date formats into YYYY-MM-DD
 */
export function normalizeDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;

  // Cleanup OCR noise
  const clean = dateStr.replace(/[^0-9\/\-.]/g, '-').replace(/[\/.]/g, '-');
  
  const parts = clean.split('-').filter(Boolean);
  
  if (parts.length !== 3) return null;

  let year: string, month: string, day: string;

  // Assuming DD-MM-YYYY or YYYY-MM-DD
  if (parts[0].length === 4) {
    // YYYY-MM-DD
    [year, month, day] = parts;
  } else {
    // DD-MM-YYYY
    [day, month, year] = parts;
  }

  // Handle 2-digit years
  if (year.length === 2) {
    const currentYear = new Date().getFullYear();
    const prefix = parseInt(year) > (currentYear % 100) + 10 ? '19' : '20';
    year = prefix + year;
  }

  // Ensure 2-digit month and day
  month = month.padStart(2, '0');
  day = day.padStart(2, '0');

  const formatted = `${year}-${month}-${day}`;
  
  // Validate date
  const d = new Date(formatted);
  if (isNaN(d.getTime())) return null;
  
  return formatted;
}

/**
 * Removes OCR noise like extra spaces, symbols
 */
export function cleanText(text: string): string {
  return text
    .replace(/[^\x00-\x7F]/g, "") // Remove non-ascii
    .replace(/[\n\r\t]/g, " ")     // Replace newlines with space
    .replace(/\s+/g, " ")          // Collapse spaces
    .trim();
}
