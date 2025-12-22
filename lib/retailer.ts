export const RAKUTEN_LEGO_RETAILER = "RAKUTEN_LEGO";

const RETAILER_LABEL_OVERRIDES: Record<string, string> = {
  [RAKUTEN_LEGO_RETAILER]: "LEGO",
};

export function formatRetailerLabel(retailer: string | null | undefined): string {
  const raw = String(retailer ?? "").trim();
  if (!raw) return "Unknown";

  const override = RETAILER_LABEL_OVERRIDES[raw.toUpperCase()];
  return override ?? raw;
}

export function retailerKey(retailer: string | null | undefined): string {
  return formatRetailerLabel(retailer).toUpperCase();
}
