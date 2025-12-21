// app/admin/dashboard/page.tsx
import { prisma } from "@/lib/prisma";
import Link from "next/link";

// Make sure Next does NOT attempt to prerender this at build time.
// This forces runtime rendering on the server.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type TopClickRow = {
  id: string;
  count: number;
  updatedAt: Date;
  set: {
    setId: string;
    name: string | null;
  };
};

async function getTopClickedSets(limit = 25): Promise<TopClickRow[]> {
  try {
    return await prisma.click.findMany({
      orderBy: { count: "desc" },
      take: limit,
      include: { set: true },
    });
  } catch (err: any) {
    // If the Click table doesn't exist yet (fresh DB), don't crash build/runtime.
    // Prisma error code for missing table is typically P2021.
    if (err?.code === "P2021") return [];
    // Other errors should still surface so you notice real issues.
    throw err;
  }
}

export default async function AdminDashboardPage() {
  const clicks = await getTopClickedSets();

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">🛠 Admin Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Top clicked sets + quick actions. (If the DB is fresh, this page will show empty until tables exist.)
          </p>
        </div>

        {/* Sync Button */}
        <form action="/api/admin/rakuten-refresh" method="GET">
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            🔁 Sync Rakuten Products
          </button>
        </form>
      </header>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold">🔥 Top Clicked LEGO Sets</h2>
          <span className="text-xs text-zinc-400">
            Showing {clicks.length} row{clicks.length === 1 ? "" : "s"}
          </span>
        </div>

        {clicks.length === 0 ? (
          <div className="border border-zinc-700 rounded p-4 bg-zinc-950">
            <p className="text-sm text-zinc-300">
              No click data yet — or your database tables haven’t been created in prod.
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              Fix: run Prisma DB push/migrations against the same DATABASE_URL Vercel uses.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-black border border-zinc-700 text-white text-sm">
              <thead className="bg-zinc-800 text-left">
                <tr>
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Set</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Clicks</th>
                  <th className="px-4 py-2">Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {clicks.map((click, index) => (
                  <tr key={click.id} className="border-t border-zinc-700 hover:bg-zinc-800">
                    <td className="px-4 py-2">{index + 1}</td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/set/${click.set.setId}`}
                        className="text-blue-400 hover:underline"
                        target="_blank"
                      >
                        {click.set.setId}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{click.set.name ?? "-"}</td>
                    <td className="px-4 py-2 font-semibold">{click.count}</td>
                    <td className="px-4 py-2 text-xs text-zinc-400">
                      {new Date(click.updatedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}