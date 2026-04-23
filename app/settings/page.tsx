"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import type { Address } from "viem";
import { ProfileMenu } from "@/app/components/ProfileMenu";
import { haptic } from "@/lib/haptic";

const MAX_LEN = 40;

export default function SettingsPage() {
  const { ready, authenticated, login, user, getAccessToken } = usePrivy();
  const { client: smartClient } = useSmartWallets();
  const address = smartClient?.account?.address as Address | undefined;

  const [name, setName] = useState("");
  const [initial, setInitial] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = (user?.customMetadata as { displayName?: unknown })
      ?.displayName;
    if (typeof existing === "string") {
      setName(existing);
      setInitial(existing);
    }
  }, [user]);

  async function handleSave() {
    if (saving) return;
    const trimmed = name.trim().slice(0, MAX_LEN);
    setSaving(true);
    setError(null);
    setSaved(false);
    haptic.press();
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Not signed in");
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Save failed");
      }
      setInitial(trimmed);
      setName(trimmed);
      setSaved(true);
      haptic.success();
    } catch (err: any) {
      haptic.error();
      setError(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const dirty = name.trim() !== initial;

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-neutral-500 text-sm">Loading...</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-20">
      <header className="sticky top-0 z-20 bg-black/80 backdrop-blur border-b border-neutral-900">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <Link
            href="/collection"
            className="text-base font-semibold tracking-tight text-white"
          >
            Field Notes
          </Link>
          {authenticated && address ? (
            <nav className="flex items-center gap-1 text-sm">
              <Link
                href="/collection"
                className="min-h-11 px-3 rounded-full hover:bg-neutral-900 text-neutral-400 hover:text-white flex items-center"
              >
                Collection
              </Link>
              <Link
                href="/sent"
                className="min-h-11 px-3 rounded-full hover:bg-neutral-900 text-neutral-400 hover:text-white flex items-center"
              >
                Sent
              </Link>
              <ProfileMenu address={address} />
            </nav>
          ) : null}
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 pt-8">
        {!authenticated ? (
          <div className="pt-10 text-center space-y-5">
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
            <p className="text-neutral-400 text-sm">
              Sign in to manage your profile.
            </p>
            <button
              onClick={login}
              className="w-full max-w-xs mx-auto rounded-xl bg-blue-600 hover:bg-blue-500 px-5 py-4 text-base font-medium min-h-[52px]"
            >
              Sign in
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>

            <div className="space-y-2">
              <label
                htmlFor="displayName"
                className="block text-xs uppercase tracking-wide text-neutral-500"
              >
                Display name
              </label>
              <input
                id="displayName"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                placeholder="Your name"
                maxLength={MAX_LEN}
                autoComplete="off"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-base text-white placeholder:text-neutral-600 focus:outline-none focus:border-neutral-600 min-h-[52px]"
              />
              <p className="text-xs text-neutral-500">
                Shown on link previews when you send a Field Note. Leave blank
                to send anonymously.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={!dirty || saving}
                className="rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-5 py-3 text-sm font-medium min-h-[44px]"
              >
                {saving ? "Saving..." : "Save"}
              </button>
              {saved && !dirty ? (
                <span className="text-xs text-emerald-300">Saved</span>
              ) : null}
              {error ? (
                <span className="text-xs text-red-300">{error}</span>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
