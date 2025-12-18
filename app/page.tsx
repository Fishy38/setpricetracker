import Link from "next/link";
import { SETS } from "../lib/sets";

export default function Home() {
  const setList = SETS; // ✅ now it's already an array

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-12">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-3">SetPriceTracker</h1>
        <p className="text-gray-400 max-w-xl">
          Track LEGO set prices across major retailers and find the best deal.
        </p>
      </header>

      <section className="w-full max-w-xl mb-10">
        <input
          type="text"
          placeholder="Enter LEGO set number (e.g. 75394)"
          className="w-full rounded-md px-4 py-3 text-black focus:outline-none"
        />
      </section>

      <section className="w-full max-w-6xl grid grid-cols-4 gap-4">
        {setList.map((set) => (
          <PriceCard
            key={set.setId}
            setId={set.setId}
            imageUrl={set.imageUrl}
            store={set.offers[0]?.retailer ?? "Unknown"}
            price={set.offers[0]?.price ?? "—"}
            msrp={set.msrp}
          />
        ))}
      </section>

      <footer className="mt-16 text-sm text-gray-500 text-center">
        <p className="mb-2">As an Amazon Associate, we earn from qualifying purchases.</p>
        <p>© {new Date().getFullYear()} SetPriceTracker</p>
      </footer>
    </main>
  );
}

function PriceCard({
  setId,
  imageUrl,
  store,
  price,
  msrp,
}: {
  setId: string;
  imageUrl: string;
  store: string;
  price: string;
  msrp?: string;
}) {
  return (
    <Link href={`/set/${setId}`} className="w-full">
      <div className="border border-gray-800 rounded-md p-3 hover:border-gray-600 hover:bg-gray-900 transition cursor-pointer">
        <div className="w-full aspect-square rounded-md overflow-hidden border border-gray-800 mb-3 bg-black">
          <img src={imageUrl} alt={`LEGO set ${setId}`} className="w-full h-full object-cover" />
        </div>

        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-xs uppercase tracking-wide text-gray-500">Set</span>
          <span className="text-gray-300 font-semibold">{setId}</span>
        </div>

        <div className="font-medium mb-1">{store}</div>

        <div className="flex items-end gap-2">
          {msrp && <span className="text-xs text-gray-500 line-through">{msrp}</span>}
          <span className="text-green-400 font-semibold">{price}</span>
        </div>
      </div>
    </Link>
  );
}