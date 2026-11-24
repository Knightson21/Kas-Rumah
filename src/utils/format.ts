export const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export const MONTH_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const;

/**
 * Safely rounds any numeric value to an integer Rupiah amount to avoid floating point drift.
 */
export function toSafeRupiah(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value);
}

/**
 * Formats an integer Rupiah value into Indonesian Rupiah format, e.g. Rp5.000.000 or -Rp1.000.000
 */
export function formatRupiah(amount: number): string {
  const safe = toSafeRupiah(amount);
  const absFormatted = Math.abs(safe).toLocaleString('id-ID');
  return safe < 0 ? `-Rp${absFormatted}` : `Rp${absFormatted}`;
}

/**
 * Formats a signed delta, e.g. +Rp2.000.000 or -Rp1.000.000
 */
export function formatRupiahSigned(amount: number): string {
  const safe = toSafeRupiah(amount);
  const absFormatted = Math.abs(safe).toLocaleString('id-ID');
  if (safe > 0) return `+Rp${absFormatted}`;
  if (safe < 0) return `-Rp${absFormatted}`;
  return 'Rp0';
}

/**
 * Compact axis formatter for charts, e.g. Rp2,5 jt or Rp500 rb
 */
export function formatCompactRupiah(amount: number): string {
  const safe = toSafeRupiah(amount);
  const abs = Math.abs(safe);
  const sign = safe < 0 ? '-' : '';
  if (abs >= 1_000_000_000) {
    return `${sign}Rp${(abs / 1_000_000_000).toFixed(1).replace('.', ',')} M`;
  }
  if (abs >= 1_000_000) {
    const val = abs / 1_000_000;
    const formatted = Number.isInteger(val) ? String(val) : val.toFixed(1).replace('.', ',');
    return `${sign}Rp${formatted} jt`;
  }
  if (abs >= 1_000) {
    return `${sign}Rp${Math.round(abs / 1_000)} rb`;
  }
  return `${sign}Rp${abs}`;
}

/**
 * Parses a user-typed Rupiah string (with dots/commas/Rp) into a positive integer or null.
 */
export function parseRupiahInput(raw: string): number {
  const digitsOnly = raw.replace(/[^\d]/g, '');
  if (!digitsOnly) return 0;
  const parsed = Number.parseInt(digitsOnly, 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0) return 0;
  return parsed;
}

/**
 * Formats raw digits for live Rupiah input display (e.g. "2000000" -> "2.000.000")
 */
export function formatInputThousands(raw: string): string {
  const num = parseRupiahInput(raw);
  if (num === 0) return '';
  return num.toLocaleString('id-ID');
}

export function formatDateID(isoDate: string): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '-';
  const [y, m, d] = isoDate.split('-').map(Number);
  const monthName = MONTH_SHORT_ID[(m || 1) - 1] ?? '';
  return `${d} ${monthName} ${y}`;
}

export function formatDateTimeID(isoDateTime: string | null): string {
  if (!isoDateTime) return 'Belum pernah';
  const dt = new Date(isoDateTime);
  if (Number.isNaN(dt.getTime())) return 'Belum pernah';
  const day = dt.getDate();
  const month = MONTH_NAMES_ID[dt.getMonth()];
  const year = dt.getFullYear();
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  return `${day} ${month} ${year}, ${hh}.${mm}`;
}

export function formatMonthYearID(year: number, month: number): string {
  const name = MONTH_NAMES_ID[month - 1] ?? '';
  return `${name} ${year}`;
}

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

export function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  const rounded = Math.round(value * 10) / 10;
  return `${String(rounded).replace('.', ',')}%`;
}
