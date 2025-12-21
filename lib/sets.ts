// lib/sets.ts

export type SetRow = {
    setId: string;
    name?: string | null;
    imageUrl: string;
    msrp?: string | number | null;
  
    // URLs
    legoUrl?: string;       // raw LEGO product page
    affiliateUrl?: string; // FULL Rakuten deep link
  };
  
  export const SETS: SetRow[] = [
  ];