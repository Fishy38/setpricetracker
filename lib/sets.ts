// lib/sets.ts
export type SetRow = {
    setId: string;
    name?: string | null;
    imageUrl: string;
    msrp?: string | number | null;
  
    // ✅ NEW
    legoUrl?: string;          // full product page URL
    rakutenOfferId?: string;   // offerid string from Rakuten link code
  };
  
  export const SETS: SetRow[] = [
    {
      setId: "77238",
      name: "Lamborghini Revuelto & Huracán STO",
      imageUrl:
        "https://www.lego.com/cdn/cs/set/assets/bltd322b474d5fd14f0/77238_Prod.png?format=jpg&fit=bounds&quality=80",
      msrp: "49.99",
  
      // ✅ from your product page
      legoUrl:
        "https://www.lego.com/en-us/product/lamborghini-revuelto-huracan-sto-77238",
  
      // ✅ from the Rakuten “Copy link code”
      // example: offerid=1606623.139239885619449048605586
      rakutenOfferId: "1606623.139239885619449048605586",
    },
  ];