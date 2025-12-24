// app/admin/dashboard/page.tsx
import { prisma } from "@/lib/prisma";
import { formatRetailerLabel } from "@/lib/retailer";
import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminSessionCookieName, verifyAdminSessionToken } from "@/lib/admin-session";

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

// ✅ FIX: your error is P2022 (missing column) not P2021.
// Treat “table missing” (P2021) AND “column missing” (P2022) as “no data yet”.
async function getTopClickedSets(limit = 25): Promise<TopClickRow[]> {
  try {
    return await prisma.click.findMany({
      orderBy: { count: "desc" },
      take: limit,
      include: { set: true },
    });
  } catch (err: any) {
    if (err?.code === "P2021" || err?.code === "P2022") return [];
    return [];
  }
}

type EpcRow = {
  retailer: string;
  clicks: number;
  conversions: number;
  commissionCents: number;
  salesCents: number;
  epcCentsPerClick: number; // commission/click
  epcCentsPer100Clicks: number; // commission per 100 clicks
  crPct: number; // conversions / clicks * 100
};

function moneyFromCents(cents: number) {
  const v = (cents || 0) / 100;
  return `$${v.toFixed(2)}`;
}

function pct(v: number) {
  if (!Number.isFinite(v)) return "0.00%";
  return `${v.toFixed(2)}%`;
}

function safeRetailerLabel(v: string | null | undefined) {
  return formatRetailerLabel(v);
}

async function buildEpcWindow(days: number): Promise<{
  windowLabel: string;
  rows: EpcRow[];
  totals: {
    clicks: number;
    conversions: number;
    commissionCents: number;
    salesCents: number;
    epcCentsPerClick: number;
    epcCentsPer100Clicks: number;
    crPct: number;
  };
  unmatchedConversions: number;
  clicksMissingU1OnRakuten: number;
}> {
  const now = new Date();
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  let clicks: {
    cid: string;
    retailer: string | null;
    destination: string;
    destinationHost: string | null;
  }[] = [];

  let conversions: {
    cid: string;
    commissionCents: number;
    saleAmountCents: number | null;
  }[] = [];

  try {
    clicks = await prisma.outboundClick.findMany({
      where: { createdAt: { gte: since } },
      select: {
        cid: true,
        retailer: true,
        destination: true,
        destinationHost: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50_000,
    });
  } catch (err: any) {
    // ✅ FIX: handle missing table OR missing column
    if (err?.code !== "P2021" && err?.code !== "P2022") throw err;
  }

  try {
    conversions = await prisma.affiliateConversion.findMany({
      where: { occurredAt: { gte: since } },
      select: {
        cid: true,
        commissionCents: true,
        saleAmountCents: true,
      },
      orderBy: { occurredAt: "desc" },
      take: 50_000,
    });
  } catch (err: any) {
    // ✅ FIX: handle missing table OR missing column
    if (err?.code !== "P2021" && err?.code !== "P2022") throw err;
  }

  // Map click cid -> retailer
  const clickByCid = new Map<
    string,
    { retailer: string; destination: string; destinationHost: string | null }
  >();
  for (const c of clicks) {
    clickByCid.set(c.cid, {
      retailer: safeRetailerLabel(c.retailer),
      destination: c.destination,
      destinationHost: c.destinationHost ?? null,
    });
  }

  // Aggregate clicks by retailer
  const clickCountByRetailer = new Map<string, number>();
  for (const c of clicks) {
    const r = safeRetailerLabel(c.retailer);
    clickCountByRetailer.set(r, (clickCountByRetailer.get(r) ?? 0) + 1);
  }

  // Aggregate conversions by retailer (via cid -> click)
  const convCountByRetailer = new Map<string, number>();
  const commissionByRetailer = new Map<string, number>();
  const salesByRetailer = new Map<string, number>();
  let unmatchedConversions = 0;

  for (const conv of conversions) {
    const hit = clickByCid.get(conv.cid);
    if (!hit) {
      unmatchedConversions++;
      continue;
    }
    const r = hit.retailer;

    convCountByRetailer.set(r, (convCountByRetailer.get(r) ?? 0) + 1);
    commissionByRetailer.set(
      r,
      (commissionByRetailer.get(r) ?? 0) + (conv.commissionCents ?? 0)
    );
    salesByRetailer.set(
      r,
      (salesByRetailer.get(r) ?? 0) + (conv.saleAmountCents ?? 0)
    );
  }

  // If it's a Rakuten click host, it MUST contain u1
  let clicksMissingU1OnRakuten = 0;
  for (const c of clicks) {
    const host = (c.destinationHost ?? "").toLowerCase();
    const isRakutenClick =
      host.includes("linksynergy.com") || host.includes("click.linksynergy.com");
    if (!isRakutenClick) continue;

    try {
      const u = new URL(c.destination);
      if (!u.searchParams.get("u1")) clicksMissingU1OnRakuten++;
    } catch {
      clicksMissingU1OnRakuten++;
    }
  }

  const retailers = Array.from(
    new Set<string>([
      ...Array.from(clickCountByRetailer.keys()),
      ...Array.from(convCountByRetailer.keys()),
    ])
  ).sort((a, b) => a.localeCompare(b));

  const rows: EpcRow[] = retailers.map((retailer) => {
    const clicksN = clickCountByRetailer.get(retailer) ?? 0;
    const convN = convCountByRetailer.get(retailer) ?? 0;
    const comm = commissionByRetailer.get(retailer) ?? 0;
    const sales = salesByRetailer.get(retailer) ?? 0;

    const epcPerClick = clicksN > 0 ? Math.round(comm / clicksN) : 0;
    const epcPer100 = clicksN > 0 ? Math.round((comm * 100) / clicksN) : 0;
    const cr = clicksN > 0 ? (convN / clicksN) * 100 : 0;

    return {
      retailer,
      clicks: clicksN,
      conversions: convN,
      commissionCents: comm,
      salesCents: sales,
      epcCentsPerClick: epcPerClick,
      epcCentsPer100Clicks: epcPer100,
      crPct: cr,
    };
  });

  const totalClicks = rows.reduce((a, r) => a + r.clicks, 0);
  const totalConv = rows.reduce((a, r) => a + r.conversions, 0);
  const totalComm = rows.reduce((a, r) => a + r.commissionCents, 0);
  const totalSales = rows.reduce((a, r) => a + r.salesCents, 0);

  const totals = {
    clicks: totalClicks,
    conversions: totalConv,
    commissionCents: totalComm,
    salesCents: totalSales,
    epcCentsPerClick: totalClicks > 0 ? Math.round(totalComm / totalClicks) : 0,
    epcCentsPer100Clicks:
      totalClicks > 0 ? Math.round((totalComm * 100) / totalClicks) : 0,
    crPct: totalClicks > 0 ? (totalConv / totalClicks) * 100 : 0,
  };

  return {
    windowLabel: `Last ${days} days`,
    rows,
    totals,
    unmatchedConversions,
    clicksMissingU1OnRakuten,
  };
}

export default async function AdminDashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(getAdminSessionCookieName())?.value;
  const session = await verifyAdminSessionToken(token);
  if (!session.ok) {
    redirect("/admin/login");
  }

  const [clicks, epc7, epc30] = await Promise.all([
    getTopClickedSets(),
    buildEpcWindow(7),
    buildEpcWindow(30),
  ]);

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-10">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">🛠 Admin Dashboard</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Top clicked sets + quick actions. (If the DB is fresh, this page will
            show empty until tables/columns exist.)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <form action="/api/admin/logout" method="POST">
            <button
              type="submit"
              className="bg-zinc-800 text-white px-4 py-2 rounded hover:bg-zinc-700 transition"
            >
              Sign Out
            </button>
          </form>

          <form action="/api/admin/rakuten-refresh" method="GET">
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
            >
              🔁 Sync Rakuten Products
            </button>
          </form>

          <form action="/api/admin/giftcard-refresh" method="POST">
            <button
              type="submit"
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition"
            >
              🎁 Refresh Gift Cards
            </button>
          </form>
          <form action="/api/refresh/lego" method="GET">
            <input type="hidden" name="all" value="1" />
            <button
              type="submit"
              className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 transition"
            >
              Refresh LEGO
            </button>
          </form>

          <form action="/api/refresh/amazon" method="GET">
            <input type="hidden" name="all" value="1" />
            <button
              type="submit"
              className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 transition"
            >
              Refresh Amazon
            </button>
          </form>
        </div>
      </header>

      {/* ADMIN ACTIONS */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold">Admin Actions</h2>
          <span className="text-xs text-zinc-400">
            Manual tools for refreshes and debug endpoints.
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="border border-zinc-700 rounded p-4 bg-zinc-950 space-y-4">
            <div className="text-xs uppercase tracking-wide text-zinc-500">Refresh</div>

            <form action="/api/refresh/lego" method="GET" className="flex flex-col sm:flex-row gap-2">
              <input
                name="setId"
                placeholder="Set ID (e.g. 75394)"
                className="flex-1 rounded bg-black border border-zinc-800 px-3 py-2 text-sm text-white"
              />
              <button
                type="submit"
                className="bg-zinc-800 text-white px-4 py-2 rounded hover:bg-zinc-700 transition"
              >
                Refresh LEGO Set
              </button>
            </form>

            <form action="/api/refresh/lego" method="GET" className="flex flex-col sm:flex-row gap-2">
              <input type="hidden" name="all" value="1" />
              <input
                name="limit"
                placeholder="Concurrency (default 2)"
                className="flex-1 rounded bg-black border border-zinc-800 px-3 py-2 text-sm text-white"
              />
              <input
                name="take"
                placeholder="Take N (optional)"
                className="flex-1 rounded bg-black border border-zinc-800 px-3 py-2 text-sm text-white"
              />
              <button
                type="submit"
                className="bg-zinc-800 text-white px-4 py-2 rounded hover:bg-zinc-700 transition"
              >
                Refresh All LEGO
              </button>
            </form>

            <form action="/api/refresh/amazon" method="GET" className="flex flex-col sm:flex-row gap-2">
              <input
                name="setId"
                placeholder="Amazon Set ID (e.g. 75394)"
                className="flex-1 rounded bg-black border border-zinc-800 px-3 py-2 text-sm text-white"
              />
              <button
                type="submit"
                className="bg-zinc-800 text-white px-4 py-2 rounded hover:bg-zinc-700 transition"
              >
                Refresh Amazon Set
              </button>
            </form>

            <form action="/api/refresh/amazon" method="GET" className="flex flex-col sm:flex-row gap-2">
              <input type="hidden" name="all" value="1" />
              <input
                name="limit"
                placeholder="Concurrency (default 2)"
                className="flex-1 rounded bg-black border border-zinc-800 px-3 py-2 text-sm text-white"
              />
              <input
                name="take"
                placeholder="Take N (optional)"
                className="flex-1 rounded bg-black border border-zinc-800 px-3 py-2 text-sm text-white"
              />
              <button
                type="submit"
                className="bg-zinc-800 text-white px-4 py-2 rounded hover:bg-zinc-700 transition"
              >
                Refresh All Amazon
              </button>
            </form>

            <form action="/api/admin/giftcard-refresh" method="GET" className="flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  name="keyword"
                  placeholder="Giftcard keyword (default lego)"
                  className="flex-1 rounded bg-black border border-zinc-800 px-3 py-2 text-sm text-white"
                />
                <button
                  type="submit"
                  className="bg-zinc-800 text-white px-4 py-2 rounded hover:bg-zinc-700 transition"
                >
                  Refresh Giftcards
                </button>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="purge" value="1" className="accent-zinc-400" />
                  Purge old rows
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="dry" value="1" className="accent-zinc-400" />
                  Dry run
                </label>
              </div>
            </form>
          </div>

          <div className="border border-zinc-700 rounded p-4 bg-zinc-950 space-y-4">
            <div className="text-xs uppercase tracking-wide text-zinc-500">Amazon Import</div>

            <form action="/api/admin/import-amazon-links" method="POST" className="space-y-3">
              <textarea
                name="links"
                placeholder="Paste Amazon links (one per line). Duplicate set IDs are skipped."
                className="w-full min-h-[180px] rounded bg-black border border-zinc-800 px-3 py-2 text-sm text-white"
              />
              <button
                type="submit"
                className="bg-amber-600 text-white px-4 py-2 rounded hover:bg-amber-700 transition"
              >
                Import Amazon Links
              </button>
            </form>
          </div>

          <div className="border border-zinc-700 rounded p-4 bg-zinc-950 space-y-4">
            <div className="text-xs uppercase tracking-wide text-zinc-500">Utilities</div>

            <form action="/api/admin/fetch-rakuten" method="GET" className="flex flex-col sm:flex-row gap-2">
              <input
                name="q"
                placeholder="Rakuten query (default lego)"
                className="flex-1 rounded bg-black border border-zinc-800 px-3 py-2 text-sm text-white"
              />
              <input
                name="limit"
                placeholder="Limit (default 10)"
                className="w-40 rounded bg-black border border-zinc-800 px-3 py-2 text-sm text-white"
              />
              <button
                type="submit"
                className="bg-zinc-800 text-white px-4 py-2 rounded hover:bg-zinc-700 transition"
              >
                Preview Rakuten
              </button>
            </form>

            <form action="/api/admin/epc" method="GET" className="flex flex-col sm:flex-row gap-2">
              <input
                name="days"
                placeholder="EPC window days (default 30)"
                className="flex-1 rounded bg-black border border-zinc-800 px-3 py-2 text-sm text-white"
              />
              <button
                type="submit"
                className="bg-zinc-800 text-white px-4 py-2 rounded hover:bg-zinc-700 transition"
              >
                Export EPC JSON
              </button>
            </form>

            <form action="/api/admin/epc" method="POST" className="flex flex-col gap-2">
              <div className="text-xs text-zinc-400">Manual conversion insert</div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  name="cid"
                  placeholder="cid"
                  className="flex-1 rounded bg-black border border-zinc-800 px-3 py-2 text-sm text-white"
                />
                <input
                  name="commissionCents"
                  placeholder="commissionCents"
                  className="w-48 rounded bg-black border border-zinc-800 px-3 py-2 text-sm text-white"
                />
                <input
                  name="saleAmountCents"
                  placeholder="saleAmountCents"
                  className="w-48 rounded bg-black border border-zinc-800 px-3 py-2 text-sm text-white"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  name="occurredAt"
                  placeholder="occurredAt (ISO, optional)"
                  className="flex-1 rounded bg-black border border-zinc-800 px-3 py-2 text-sm text-white"
                />
                <button
                  type="submit"
                  className="bg-zinc-800 text-white px-4 py-2 rounded hover:bg-zinc-700 transition"
                >
                  Insert Conversion
                </button>
              </div>
            </form>

            <div className="flex flex-col sm:flex-row gap-2">
              <form action="/api/admin/seed" method="POST" className="flex-1">
                <button
                  type="submit"
                  className="w-full bg-zinc-800 text-white px-4 py-2 rounded hover:bg-zinc-700 transition"
                >
                  Seed Sets (dev or SEED_SECRET)
                </button>
              </form>
              <form action="/api/admin/test-insert" method="GET" className="flex-1">
                <button
                  type="submit"
                  className="w-full bg-zinc-800 text-white px-4 py-2 rounded hover:bg-zinc-700 transition"
                >
                  Insert Test Price History (dev)
                </button>
              </form>
            </div>

            <form action="/api/themes" method="GET">
              <button
                type="submit"
                className="bg-zinc-800 text-white px-4 py-2 rounded hover:bg-zinc-700 transition"
              >
                View Theme Counts
              </button>
            </form>
          </div>
        </div>

        <div className="border border-zinc-700 rounded p-4 bg-zinc-950 space-y-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Admin URLs
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            <a
              href="/api/admin/rakuten-refresh"
              target="_blank"
              className="bg-zinc-800 text-white px-3 py-2 rounded hover:bg-zinc-700 transition text-sm text-center"
              rel="noreferrer"
            >
              Rakuten Refresh
            </a>
            <a
              href="/api/admin/fetch-rakuten"
              target="_blank"
              className="bg-zinc-800 text-white px-3 py-2 rounded hover:bg-zinc-700 transition text-sm text-center"
              rel="noreferrer"
            >
              Fetch Rakuten
            </a>
            <a
              href="/api/admin/giftcard-refresh"
              target="_blank"
              className="bg-zinc-800 text-white px-3 py-2 rounded hover:bg-zinc-700 transition text-sm text-center"
              rel="noreferrer"
            >
              Giftcard Refresh
            </a>
            <a
              href="/api/admin/epc?days=30"
              target="_blank"
              className="bg-zinc-800 text-white px-3 py-2 rounded hover:bg-zinc-700 transition text-sm text-center"
              rel="noreferrer"
            >
              EPC JSON
            </a>
            <form action="/api/admin/seed" method="POST" target="_blank">
              <button
                type="submit"
                className="w-full bg-zinc-800 text-white px-3 py-2 rounded hover:bg-zinc-700 transition text-sm text-center"
              >
                Seed Sets
              </button>
            </form>
            <a
              href="/api/admin/test-insert"
              target="_blank"
              className="bg-zinc-800 text-white px-3 py-2 rounded hover:bg-zinc-700 transition text-sm text-center"
              rel="noreferrer"
            >
              Test Insert
            </a>
            <a
              href="/api/cron/daily"
              target="_blank"
              className="bg-zinc-800 text-white px-3 py-2 rounded hover:bg-zinc-700 transition text-sm text-center"
              rel="noreferrer"
            >
              Cron Daily
            </a>
          </div>
        </div>
      </section>

      {/* EPC DASHBOARD */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-2xl font-semibold">💸 EPC Dashboard</h2>
          <span className="text-xs text-zinc-400">
            EPC = earnings per click (commission ÷ clicks). Also showing EPC/100
            clicks + CR.
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[epc7, epc30].map((w) => (
            <div
              key={w.windowLabel}
              className="border border-zinc-700 rounded p-4 bg-zinc-950"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="text-lg font-semibold">{w.windowLabel}</div>
                <div className="text-xs text-zinc-400">
                  Clicks: {w.totals.clicks} · Conversions: {w.totals.conversions}{" "}
                  · CR: {pct(w.totals.crPct)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="border border-zinc-800 rounded p-3">
                  <div className="text-xs uppercase text-zinc-500">
                    Commission
                  </div>
                  <div className="text-xl font-bold text-green-400">
                    {moneyFromCents(w.totals.commissionCents)}
                  </div>
                </div>
                <div className="border border-zinc-800 rounded p-3">
                  <div className="text-xs uppercase text-zinc-500">
                    EPC / 100 Clicks
                  </div>
                  <div className="text-xl font-bold text-green-400">
                    {moneyFromCents(w.totals.epcCentsPer100Clicks)}
                  </div>
                </div>
                <div className="border border-zinc-800 rounded p-3">
                  <div className="text-xs uppercase text-zinc-500">
                    Sales (if provided)
                  </div>
                  <div className="text-xl font-bold">
                    {moneyFromCents(w.totals.salesCents)}
                  </div>
                </div>
                <div className="border border-zinc-800 rounded p-3">
                  <div className="text-xs uppercase text-zinc-500">Alerts</div>
                  <div className="text-sm text-zinc-200 mt-1">
                    <div>
                      Unmatched conversions:{" "}
                      <span
                        className={
                          w.unmatchedConversions
                            ? "text-red-400 font-semibold"
                            : ""
                        }
                      >
                        {w.unmatchedConversions}
                      </span>
                    </div>
                    <div>
                      Rakuten clicks missing u1:{" "}
                      <span
                        className={
                          w.clicksMissingU1OnRakuten
                            ? "text-red-400 font-semibold"
                            : ""
                        }
                      >
                        {w.clicksMissingU1OnRakuten}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {w.rows.length === 0 ? (
                <div className="text-sm text-zinc-400">No EPC data yet.</div>
              ) : (
                <div className="overflow-x-hidden">
                  <table className="w-full table-fixed bg-black border border-zinc-700 text-white text-[11px]">
                    <thead className="bg-zinc-800 text-left">
                      <tr>
                        <th className="px-2 py-2 w-[26%] whitespace-nowrap">
                          Retailer
                        </th>
                        <th className="px-2 py-2 w-[9%] text-right whitespace-nowrap">
                          Clicks
                        </th>
                        <th className="px-2 py-2 w-[9%] text-right whitespace-nowrap">
                          Conv
                        </th>
                        <th className="px-2 py-2 w-[10%] text-right whitespace-nowrap">
                          CR
                        </th>
                        <th className="px-2 py-2 w-[16%] text-right whitespace-nowrap">
                          Commission
                        </th>
                        <th className="px-2 py-2 w-[14%] text-right whitespace-nowrap">
                          EPC
                        </th>
                        <th className="px-2 py-2 w-[16%] text-right whitespace-nowrap">
                          EPC/100
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {w.rows.map((r) => (
                        <tr
                          key={`${w.windowLabel}-${r.retailer}`}
                          className="border-t border-zinc-700 hover:bg-zinc-900"
                        >
                          <td className="px-2 py-2 truncate">{r.retailer}</td>
                          <td className="px-2 py-2 text-right font-semibold whitespace-nowrap">
                            {r.clicks}
                          </td>
                          <td className="px-2 py-2 text-right font-semibold whitespace-nowrap">
                            {r.conversions}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">
                            {pct(r.crPct)}
                          </td>
                          <td className="px-2 py-2 text-right text-green-400 font-semibold whitespace-nowrap">
                            {moneyFromCents(r.commissionCents)}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">
                            {moneyFromCents(r.epcCentsPerClick)}
                          </td>
                          <td className="px-2 py-2 text-right whitespace-nowrap">
                            {moneyFromCents(r.epcCentsPer100Clicks)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="text-xs text-zinc-500 mt-3">
                Note: “Unmatched conversions” means a conversion cid exists
                without a corresponding OutboundClick(cid) in this window.
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* TOP CLICKED SETS */}
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
              No click data yet — or your DB doesn’t have the Click/Set tables
              (or columns) created yet.
            </p>
            <p className="text-xs text-zinc-500 mt-2">
              Fix: run Prisma migrations / db push against the same DATABASE_URL
              your app is using.
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
                  <tr
                    key={click.id}
                    className="border-t border-zinc-700 hover:bg-zinc-800"
                  >
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
