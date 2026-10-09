/**
 * Format an ingredient amount for display: whole numbers without decimals
 * (DB NUMERIC arrives as e.g. "2.00"), fractional values trimmed of trailing
 * zeros ("2.50" -> "2.5"). Non-numeric input passes through trimmed.
 */
export function formatAmount(value: string | number | null | undefined): string {
  if (value == null) return '';
  const raw = String(value).trim();
  if (raw === '') return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return String(n);
}
