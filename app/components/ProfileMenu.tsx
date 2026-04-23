"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";

function shorten(addr: string): string {
  return `${addr.slice(0, 4)}..${addr.slice(-4)}`;
}

export function ProfileMenu({ address }: { address: string }) {
  const { logout } = usePrivy();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open]);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Profile"
        aria-expanded={open}
        aria-haspopup="menu"
        className="min-h-11 min-w-11 rounded-full bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white flex items-center justify-center"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M2.5 15.5c0.8-2.5 3.4-4 6.5-4s5.7 1.5 6.5 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      {open ? (
        <>
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30"
          />
          <div
            role="menu"
            className="absolute right-0 top-12 z-40 min-w-[220px] rounded-xl border border-neutral-800 bg-neutral-950 shadow-xl shadow-black/60 overflow-hidden"
          >
            <div className="px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-neutral-500">
                Wallet
              </div>
              <div className="font-mono text-xs text-neutral-300 mt-1">
                {shorten(address)}
              </div>
            </div>
            <div className="h-px bg-neutral-900" />
            <button
              onClick={() => {
                setOpen(false);
                logout();
              }}
              role="menuitem"
              className="w-full text-left px-4 py-3 text-sm text-neutral-300 hover:bg-neutral-900 hover:text-white min-h-11"
            >
              Sign out
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
