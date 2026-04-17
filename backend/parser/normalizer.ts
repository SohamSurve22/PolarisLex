export function normalizeDate(rawDate: string | null | undefined): string | null {
  if (!rawDate) return null;

  const cleaned = rawDate.trim();

  // Try YYYY-MM-DD (already ISO)
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const d = new Date(cleaned + "T00:00:00Z");
    if (!isNaN(d.getTime())) return cleaned;
  }

  // Try DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = cleaned.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const [, dd, mm, yyyy] = ddmmyyyy;
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
    if (!isNaN(d.getTime())) return `${yyyy}-${mm}-${dd}`;
  }

  // Try MM/DD/YYYY (US format fallback)
  const mmddyyyy = cleaned.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
  if (mmddyyyy) {
    const [, mm, dd, yyyy] = mmddyyyy;
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
    if (!isNaN(d.getTime())) return `${yyyy}-${mm}-${dd}`;
  }

  // Try natural language like "12 May 2022" or "12-May-2022"
  const natural = cleaned.match(/^(\d{1,2})[\s\-]([A-Za-z]+)[\s\-](\d{4})$/);
  if (natural) {
    const [, dd, mon, yyyy] = natural;
    const d = new Date(`${dd} ${mon} ${yyyy}`);
    if (!isNaN(d.getTime())) {
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      return `${yyyy}-${m}-${day}`;
    }
  }

  return null;
}

export function isDateExpired(isoDate: string | null): boolean {
  if (!isoDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(isoDate + "T00:00:00Z");
  return exp < today;
}

export function normalizeName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.trim().toUpperCase().replace(/\s+/g, " ");
}

export function normalizeVehicleNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.trim().toUpperCase().replace(/[\s\-]/g, "");
}

export function normalizeLicenseNumber(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export interface NormalizedData {
  name: string | null;
  licenseNumber: string | null;
  vehicleNumber: string | null;
  expiryDate: string | null;
  rawExpiryDate: string | null;
  rawText: string | null;
}

export function normalizeExtractedFields(fields: {
  name?: string | null;
  licenseNumber?: string | null;
  vehicleNumber?: string | null;
  expiryDate?: string | null;
  rawText?: string | null;
}): NormalizedData {
  return {
    name: normalizeName(fields.name),
    licenseNumber: normalizeLicenseNumber(fields.licenseNumber),
    vehicleNumber: normalizeVehicleNumber(fields.vehicleNumber),
    expiryDate: normalizeDate(fields.expiryDate),
    rawExpiryDate: fields.expiryDate ?? null,
    rawText: fields.rawText ?? null,
  };
}
