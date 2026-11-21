"use client";

import { Newspaper, Layers, Bookmark, Radio } from "lucide-react";
import type { TabId } from "@/lib/types";

const TABS: { id: TabId; label: string; icon: typeof Newspaper }[] = [
  { id: "today", label: "Today", icon: Newspaper },
  { id: "streams", label: "Streams", icon: Layers },
  { id: "saved", label: "Saved", icon: Bookmark },
  { id: "sources", label: "Sources", icon: Radio },
];

interface TabBarProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#050608]/80 backdrop-blur-2xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Primary"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-2 pt-1.5 pb-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex min-w-[64px] flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 transition-colors ${
                isActive
                  ? "text-white"
                  : "text-white/40 hover:text-white/70"
              }`}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.25 : 1.75}
                className={isActive ? "text-[#0A84FF]" : undefined}
              />
              <span className="text-[10px] font-medium tracking-wide">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
