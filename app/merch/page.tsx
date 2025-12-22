// app/merch/page.tsx
import { Suspense } from "react";
import MerchClient from "./merch-client";

export default function MerchPage() {
  return (
    <Suspense fallback={null}>
      <MerchClient />
    </Suspense>
  );
}
