// lib/giftcards.ts
/**
 * Optional seed list for gift cards.
 * You can ignore this if you only want DB-backed from Rakuten sync.
 */
export const GIFT_CARD_SEED: Array<{
    name: string;
    brand?: string;
    destinationUrl: string;
  }> = [
    {
      name: "Giftcard.com",
      brand: "Giftcard.com",
      destinationUrl: "https://www.giftcard.com/",
    },
  ];