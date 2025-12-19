// lib/lego.ts
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari";

function pickFirst<T>(arr: T[] | undefined | null) {
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

// 1) Resolve a setId -> product page URL by scraping LEGO search results
export async function resolveLegoProductUrl(setId: string) {
  const searchUrl = `https://www.lego.com/en-us/search?q=${encodeURIComponent(setId)}`;

  const res = await fetch(searchUrl, {
    headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const html = await res.text();

  // Look for /en-us/product/<slug>-<setId>
  const re = new RegExp(`\\/en-us\\/product\\/[^"']*-${setId}\\b`, "i");
  const m = html.match(re);
  if (!m?.[0]) return null;

  return `https://www.lego.com${m[0]}`;
}

// 2) Scrape product page and extract price (best-effort)
export async function scrapeLegoPriceCents(productUrl: string) {
  const res = await fetch(productUrl, {
    headers: { "user-agent": UA, "accept-language": "en-US,en;q=0.9" },
    cache: "no-store",
  });
  if (!res.ok) return null;

  const html = await res.text();

  // Try grabbing __NEXT_DATA__ JSON
  const nextDataMatch = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );

  if (nextDataMatch?.[1]) {
    try {
      const data = JSON.parse(nextDataMatch[1]);

      // Walk the object looking for a formatted price like "$49.99"
      const stack: any[] = [data];
      while (stack.length) {
        const cur = stack.pop();
        if (!cur) continue;

        if (typeof cur === "string") {
          // nothing
        } else if (typeof cur === "object") {
          for (const v of Object.values(cur)) {
            if (typeof v === "string") {
              const m = v.match(/\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2})?)/);
              if (m?.[1]) {
                const dollars = Number(m[1].replace(/,/g, ""));
                if (!Number.isNaN(dollars)) return Math.round(dollars * 100);
              }
            } else if (typeof v === "object") {
              stack.push(v);
            }
          }
        }
      }
    } catch {
      // fall through
    }
  }

  // Fallback: any $xx.xx in HTML (less reliable)
  const m2 = html.match(/\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{2}))/);
  if (m2?.[1]) {
    const dollars = Number(m2[1].replace(/,/g, ""));
    if (!Number.isNaN(dollars)) return Math.round(dollars * 100);
  }

  return null;
}