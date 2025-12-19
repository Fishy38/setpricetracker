// lib/sets.ts
export type SetRow = {
    setId: string;
    name?: string | null;
    imageUrl: string;
    msrp?: string | number | null;
  
    // ✅ NEW
    legoUrl?: string; // full product page URL
    rakutenOfferId?: string; // offerid string from Rakuten link code
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
      rakutenOfferId: "1606623.139239885619449048605586",
    },
  
    {
      setId: "10280",
      name: "Flower Bouquet",
      imageUrl: "https://www.lego.com/cdn/cs/set/assets/blt53711dac56e01b36/10280_Prod.png?format=webply&fit=bounds&quality=70&width=800&height=800&dpr=1.5",
      msrp: "59.99",
      legoUrl: "https://www.lego.com/en-us/product/flower-bouquet-10280",
      rakutenOfferId: "1606623.139239807376600036302937",
    },
  
    {
      setId: "77251",
      name: "McLaren F1 Team MCL38 Race Car",
      imageUrl: "https://www.lego.com/cdn/cs/set/assets/bltad441c9411550c97/77251_Prod_en-gb.png?format=jpg&fit=bounds&quality=80",
      msrp: "26.99",
      legoUrl: "https://www.lego.com/en-us/product/mclaren-f1-team-mcl38-race-car-77251",
      rakutenOfferId: "1606623.139239708913943786609039",
    },
  
    {
      setId: "76445",
      name: "Hogwarts Castle: Herbology Class",
      imageUrl: "https://www.lego.com/cdn/cs/set/assets/blt5322eaada5ab9de3/76445_Prod_en-gb.png?format=jpg&fit=bounds&quality=80",
      msrp: "99.99",
      legoUrl:
        "https://www.lego.com/en-us/product/hogwarts-castle-herbology-class-76445",
      rakutenOfferId: "1606623.139239738167235093718254",
    },
  
    {
      setId: "40524",
      name: "Sunflowers",
      imageUrl: "https://www.lego.com/cdn/cs/set/assets/blteb14e8c6c9e027df/40524.png?format=jpg&fit=bounds&quality=80",
      msrp: "15.99",
      legoUrl: "https://www.lego.com/en-us/product/sunflowers-40524",
      rakutenOfferId: "1606623.139239615568265922045742",
    },
  ];