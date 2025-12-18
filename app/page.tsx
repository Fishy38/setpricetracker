export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center px-6 py-12">
      {/* Header */}
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold mb-3">SetPriceTracker</h1>
        <p className="text-gray-400 max-w-xl">
          Track LEGO set prices across major retailers and find the best deal.
        </p>
      </header>

      {/* Search */}
      <section className="w-full max-w-xl mb-10">
        <input
          type="text"
          placeholder="Enter LEGO set number (e.g. 75394)"
          className="w-full rounded-md px-4 py-3 text-black focus:outline-none"
        />
      </section>

      {/* Example results */}
      <section className="w-full max-w-xl space-y-4">
        <PriceRow store="Amazon" price="$129.99" />
        <PriceRow store="Walmart" price="$134.95" />
        <PriceRow store="Target" price="$139.99" />
      </section>

      {/* Footer */}
      <footer className="mt-16 text-sm text-gray-500 text-center">
        <p className="mb-2">
          As an Amazon Associate, we earn from qualifying purchases.
        </p>
        <p>© {new Date().getFullYear()} SetPriceTracker</p>
      </footer>
    </main>
  );
}

function PriceRow({ store, price }: { store: string; price: string }) {
  return (
    <div className="flex justify-between items-center border border-gray-800 rounded-md px-4 py-3">
      <span className="font-medium">{store}</span>
      <span className="text-green-400 font-semibold">{price}</span>
    </div>
  );
}