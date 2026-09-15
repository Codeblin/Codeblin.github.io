/**
 * Formatting used across listings, headers and feeds. Kept in one place so a
 * date never renders two different ways on two different pages.
 */

const MONTHS = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
] as const;

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

function parts(date: string): { year: string; month: number; day: string } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const month = Number.parseInt(match[2] as string, 10) - 1;
  if (month < 0 || month > 11) return null;
  return { year: match[1] as string, month, day: match[3] as string };
}

/** `2026.03.14` — dense, tabular, for listings and record rows. */
export function stampDate(date: string | undefined): string {
  if (!date) return '————.——.——';
  return date.replaceAll('-', '.');
}

/** `14 MAR 2026` — for metadata rows where the month should be readable. */
export function shortDate(date: string | undefined): string {
  const value = date ? parts(date) : null;
  if (!value) return 'UNDATED';
  return `${value.day} ${MONTHS[value.month]} ${value.year}`;
}

/** `14 March 2026` — for the article header and anywhere prose surrounds it. */
export function longDate(date: string | undefined): string {
  const value = date ? parts(date) : null;
  if (!value) return 'Undated';
  return `${Number.parseInt(value.day, 10)} ${MONTHS_LONG[value.month]} ${value.year}`;
}

/** `2026-03` → `MAR 2026`, for project start dates. */
export function monthStamp(value: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return value;
  const month = Number.parseInt(match[2] as string, 10) - 1;
  return `${MONTHS[month] ?? '???'} ${match[1]}`;
}

export function isoDateTime(date: string | undefined): string | undefined {
  return date ? `${date}T00:00:00Z` : undefined;
}

/** The archive's counting motif: `//0042`. */
export function recordNumber(record: number): string {
  return `//${record.toString().padStart(4, '0')}`;
}

export function readingLabel(minutes: number): string {
  return `${minutes}\u00a0MIN`;
}

/** Two-digit sequence used down the left edge of listings: `01`, `02`, … */
export function sequence(index: number): string {
  return (index + 1).toString().padStart(2, '0');
}
