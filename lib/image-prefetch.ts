type PrefetchOptions = {
  max?: number;
  timeoutMs?: number;
};

const prefetched = new Set<string>();

function scheduleIdle(callback: () => void, timeoutMs: number) {
  if (typeof window === "undefined") return;

  const win = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  };

  if (typeof win.requestIdleCallback === "function") {
    win.requestIdleCallback(() => callback(), { timeout: timeoutMs });
  } else {
    window.setTimeout(callback, timeoutMs);
  }
}

export function warmImageCache(urls: string[], options: PrefetchOptions = {}) {
  if (typeof window === "undefined") return;

  const max = options.max ?? 40;
  const timeoutMs = options.timeoutMs ?? 1500;
  const queue: string[] = [];

  for (const raw of urls ?? []) {
    const url = String(raw ?? "").trim();
    if (!url || prefetched.has(url)) continue;
    prefetched.add(url);
    queue.push(url);
    if (queue.length >= max) break;
  }

  if (!queue.length) return;

  scheduleIdle(() => {
    for (const url of queue) {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
    }
  }, timeoutMs);
}
