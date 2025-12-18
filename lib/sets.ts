export type RetailerOffer = {
    retailer: string;
    price: string;
    url?: string;
  };
  
  export type SetData = {
    setId: string;
    name?: string;
    imageUrl: string;
    offers: RetailerOffer[];
    msrp?: string;
  };
  
  export const SETS: SetData[] = [
    {
      setId: "66802",
      name: "Example Set Name",
      imageUrl: "https://via.placeholder.com/600x600?text=LEGO+66802",
      offers: [
        { retailer: "Amazon", price: "$150.99" },
        { retailer: "Walmart", price: "$134.95" },
        { retailer: "Target", price: "$139.99" },
      ],
    },
    {
      setId: "42158",
      imageUrl: "https://via.placeholder.com/600x600?text=LEGO+42158",
      offers: [
        { retailer: "Walmart", price: "$134.95" },
        { retailer: "Amazon", price: "$150.99" },
      ],
    },
    {
      setId: "10323",
      imageUrl: "https://via.placeholder.com/600x600?text=LEGO+10323",
      offers: [{ retailer: "Target", price: "$139.99" }],
    },
    {
      setId: "75428",
      imageUrl: "https://via.placeholder.com/600x600?text=LEGO+75428",
      offers: [{ retailer: "Target", price: "$139.99" }],
    },
    {
      setId: "43277",
      imageUrl: "https://via.placeholder.com/600x600?text=LEGO+43277",
      offers: [{ retailer: "Target", price: "$139.99" }],
    },
    {
      setId: "40746",
      imageUrl: "https://via.placeholder.com/600x600?text=LEGO+40746",
      msrp: "$200",
      offers: [{ retailer: "Target", price: "$139.99" }],
    },
  ];