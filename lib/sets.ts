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
    {
      setId: "77238",
      name: "Lamborghini Revuelto & Huracán STO",
      imageUrl:
        "https://www.lego.com/cdn/cs/set/assets/bltd322b474d5fd14f0/77238_Prod.png?format=jpg&fit=bounds&quality=80",
      msrp: "59.99",
      legoUrl:
        "https://www.lego.com/en-us/product/lamborghini-revuelto-huracan-sto-77238",
      affiliateUrl:
        "https://click.linksynergy.com/deeplink?id=ymzYtGY2iZw&mid=13923&murl=https%3A%2F%2Fwww.lego.com%2Fen-us%2Fproduct%2Flamborghini-revuelto-huracan-sto-77238&u1=setpricetracker",
    },
  
    {
      setId: "10280",
      name: "Flower Bouquet",
      imageUrl:
        "https://www.lego.com/cdn/cs/set/assets/blt53711dac56e01b36/10280_Prod.png?format=webply&fit=bounds&quality=70&width=800&height=800&dpr=1.5",
      msrp: "59.99",
      legoUrl: "https://www.lego.com/en-us/product/flower-bouquet-10280",
      affiliateUrl:
        "https://click.linksynergy.com/deeplink?id=ymzYtGY2iZw&mid=13923&murl=https%3A%2F%2Fwww.lego.com%2Fen-us%2Fproduct%2Fflower-bouquet-10280&u1=setpricetracker",
    },
  ];