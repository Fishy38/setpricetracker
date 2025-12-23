// app/components/CategoryMenu.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const THEMES = [
  "Star Wars",
  "Technic",
  "Icons",
  "Botanicals",
  "City",
  "Friends",
  "Ninjago",
  "Harry Potter",
  "Marvel",
  "Disney",
  "Minecraft",
  "Jurassic World",
  "Speed Champions",
  "Architecture",
  "Ideas",
  "Creator",
  "Art",
];

function slugify(s: string) {
  return s.toLowerCase().replace(/\s+/g, "-");
}

export default function CategoryMenu() {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!open) return;
      const target = e.target as Node | null;
      if (menuRef.current && target && !menuRef.current.contains(target)) {
        setPinned(false);
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <header className="w-full bg-black border-b border-gray-800 relative z-50">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold">
          SetPriceTracker
        </Link>

        <div className="flex items-center gap-3" ref={menuRef}>
          {/* Cookie-value optimization: a big "Shop LEGO" CTA */}
          <a
            href="/out?u=https%3A%2F%2Fwww.lego.com%2Fen-us"
            target="_blank"
            rel="noopener noreferrer nofollow sponsored"
            className="px-3 py-2 text-sm border border-gray-700 rounded bg-blue-900 hover:bg-blue-800"
            title="Sets the affiliate cookie if the destination is affiliate-tracked"
          >
            Shop LEGO
          </a>

          {/* New: Merch tab */}
          <Link
            href="/merch"
            className="px-3 py-2 text-sm border border-gray-700 rounded bg-gray-900 hover:bg-gray-800"
          >
            Merch
          </Link>

          {/* Gift Cards is NOT a set category, so it gets its own top-level link */}
          <Link
            href="/giftcards"
            className="px-3 py-2 text-sm border border-gray-700 rounded bg-gray-900 hover:bg-gray-800"
          >
            Gift Cards
          </Link>

          <div
            className="relative"
            onMouseEnter={() => {
              if (!pinned) setOpen(true);
            }}
            onMouseLeave={() => {
              if (!pinned) setOpen(false);
            }}
          >
            <button
              onClick={() => {
                const next = !pinned;
                setPinned(next);
                setOpen(next);
              }}
              className="px-3 py-2 text-sm border border-gray-700 rounded bg-gray-900 hover:bg-gray-800"
            >
              Categories
            </button>

            {open && (
              <div className="absolute left-1/2 top-full mt-0 pt-3 w-[min(720px,85vw)] -translate-x-1/2 bg-black border border-gray-800 shadow-xl z-50">
                <div className="px-6 pb-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {THEMES.map((t) => (
                    <Link
                      key={t}
                      href={`/category/${slugify(t)}`}
                      className="text-sm px-3 py-2 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800"
                      onClick={() => {
                        setPinned(false);
                        setOpen(false);
                      }}
                    >
                      {t}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

