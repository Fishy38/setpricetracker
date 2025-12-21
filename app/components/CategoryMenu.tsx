"use client";

import { useState } from "react";
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

  return (
    <header className="w-full bg-black border-b border-gray-800 relative z-50">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold">
          SetPriceTracker
        </Link>

        <button
          onClick={() => setOpen((v) => !v)}
          className="px-3 py-2 text-sm border border-gray-700 rounded bg-gray-900 hover:bg-gray-800"
        >
          Categories ▾
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 bg-black border-t border-gray-800 shadow-xl">
          <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {THEMES.map((t) => (
              <Link
                key={t}
                href={`/category/${slugify(t)}`}
                className="text-sm px-3 py-2 rounded bg-gray-900 hover:bg-gray-800 border border-gray-800"
                onClick={() => setOpen(false)}
              >
                {t}
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}