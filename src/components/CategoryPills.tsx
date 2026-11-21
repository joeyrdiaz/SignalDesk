"use client";

import { CATEGORY_LABELS } from "@/lib/feeds";
import type { CategoryPill } from "@/lib/types";

const PILLS: CategoryPill[] = ["all", "markets", "equity", "data", "ai"];

interface CategoryPillsProps {
  active: CategoryPill;
  onChange: (c: CategoryPill) => void;
}

export function CategoryPills({ active, onChange }: CategoryPillsProps) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {PILLS.map((id) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all ${
              isActive
                ? "bg-white text-[#050608] shadow-sm"
                : "bg-white/[0.06] text-white/70 ring-1 ring-white/[0.08] hover:bg-white/[0.1]"
            }`}
          >
            {CATEGORY_LABELS[id]}
          </button>
        );
      })}
    </div>
  );
}
