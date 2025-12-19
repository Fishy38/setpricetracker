// lib/sets.ts

export type SetItem = {
    setId: string;
    name?: string | null;
    imageUrl: string;
    msrp?: string | number | null;
  
    // NEW: product-page support for LEGO + Rakuten
    // Examples:
    //  "/en-us/product/lamborghini-revuelto-huracan-sto-77238"
    //  "https://www.lego.com/en-us/product/lamborghini-revuelto-huracan-sto-77238"
    legoProductPathOrUrl?: string | null;
  
    // NEW: Rakuten "Link ID" shown in dashboard (big number)
    // Example from your screenshot: 139239885619449048605586
    rakutenLinkId?: string | null;
  };
  
  export const SETS: SetItem[] = [
    // ...your existing sets...
  
    {
      setId: "77238",
      name: "Lamborghini Revuelto & Huracán STO",
      imageUrl: "https://www.lego.com/cdn/cs/set/assets/bltd322b474d5fd14f0/77238_Prod.png?format=jpg&fit=bounds&quality=80",
      msrp: 49.99,
  
      // LEGO product page (NOT search page)
      legoProductPathOrUrl: "/en-us/product/lamborghini-revuelto-huracan-sto-77238",
  
      // Rakuten Link ID from dashboard
      rakutenLinkId: "139239885619449048605586",
    },
  ];