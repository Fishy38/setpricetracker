// lib/utils.ts

/**
 * Converts a price (e.g. "$19.99") to integer cents.
 * Returns null if invalid.
 */
export function parsePriceToCents(raw: unknown): number | null {
    if (raw == null) return null;
  
    if (typeof raw === "number") {
      if (Number.isInteger(raw)) return raw;
      return Math.round(raw * 100);
    }
  
    if (typeof raw === "string") {
      const cleaned = raw.trim().replace(/[^0-9.]/g, "");
      if (!cleaned) return null;
      const n = Number(cleaned);
      if (Number.isNaN(n)) return null;
      if (cleaned.includes(".") || n < 1000) return Math.round(n * 100);
      return Math.round(n);
    }
  
    return null;
  }

export function formatCentsUsd(cents: number | null | undefined): string {
    if (cents == null) return "\u2014";
    return `$${(cents / 100).toFixed(2)}`;
}
