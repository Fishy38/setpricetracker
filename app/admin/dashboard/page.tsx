// app/admin/dashboard/page.tsx

import { prisma } from "@/lib/prisma";
import Link from "next/link";

async function getTopClickedSets(limit = 25) {
  return await prisma.click.findMany({
    orderBy: { count: "desc" },
    take: limit,
    include: {
      set: true,
    },
  });
}

export default async function AdminDashboardPage() {
  const clicks = await getTopClickedSets();

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-10">
      <h1 className="text-3xl font-bold">🛠 Admin Dashboard</h1>

      {/* Sync Button */}
      <form action="/api/admin/rakuten-refresh" method="GET">
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          🔁 Sync Rakuten Products
        </button>
      </form>

      {/* Click Table */}
      <section>
        <h2 className="text-2xl font-semibold mt-10 mb-4">🔥 Top Clicked LEGO Sets</h2>
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
      </section>
    </main>
  );
}