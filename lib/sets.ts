import {
    amazonSearchUrl,
    walmartSearchUrl,
    targetSearchUrl,
    legoAffiliateUrl,
  } from "./affiliate";
  
  export type RetailerOffer = {
    retailer: "LEGO" | "Amazon" | "Walmart" | "Target";
    price: string;
    affiliateUrl: string; // FULL tracking URL (what /out redirects to)
  };
  
  export type SetData = {
    setId: string;
    name?: string;
    imageUrl: string;
    msrp?: string;
    offers: RetailerOffer[];
  };
  
  export const SETS: SetData[] = [
    {
      setId: "66802",
      name: "Example Set Name",
      imageUrl: "https://via.placeholder.com/600x600?text=LEGO+66802",
      offers: [
        { retailer: "Amazon", price: "$150.99", affiliateUrl: amazonSearchUrl("66802") },
        { retailer: "Walmart", price: "$134.95", affiliateUrl: walmartSearchUrl("66802") },
        { retailer: "Target", price: "$139.99", affiliateUrl: targetSearchUrl("66802") },
        { retailer: "LEGO", price: "—", affiliateUrl: legoAffiliateUrl("66802") },
      ],
    },
    {
      setId: "42158",
      imageUrl: "https://via.placeholder.com/600x600?text=LEGO+42158",
      offers: [
        { retailer: "Walmart", price: "$134.95", affiliateUrl: walmartSearchUrl("42158") },
        { retailer: "Amazon", price: "$150.99", affiliateUrl: amazonSearchUrl("42158") },
        { retailer: "LEGO", price: "—", affiliateUrl: legoAffiliateUrl("42158") },
      ],
    },
    {
      setId: "10323",
      imageUrl: "https://via.placeholder.com/600x600?text=LEGO+10323",
      offers: [
        { retailer: "Target", price: "$139.99", affiliateUrl: targetSearchUrl("10323") },
        { retailer: "LEGO", price: "—", affiliateUrl: legoAffiliateUrl("10323") },
      ],
    },
    {
      setId: "75428",
      imageUrl: "https://via.placeholder.com/600x600?text=LEGO+75428",
      offers: [
        { retailer: "Target", price: "$139.99", affiliateUrl: targetSearchUrl("75428") },
        { retailer: "LEGO", price: "—", affiliateUrl: legoAffiliateUrl("75428") },
      ],
    },
    {
      setId: "43277",
      imageUrl: "https://via.placeholder.com/600x600?text=LEGO+43277",
      offers: [
        { retailer: "Target", price: "$139.99", affiliateUrl: targetSearchUrl("43277") },
        { retailer: "LEGO", price: "—", affiliateUrl: legoAffiliateUrl("43277") },
      ],
    },
    {
      setId: "40746",
      imageUrl: "https://via.placeholder.com/600x600?text=LEGO+40746",
      msrp: "$200",
      offers: [
        { retailer: "Target", price: "$139.99", affiliateUrl: targetSearchUrl("40746") },
        { retailer: "LEGO", price: "—", affiliateUrl: legoAffiliateUrl("40746") },
      ],
    },
  ];