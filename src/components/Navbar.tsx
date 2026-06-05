"use client";

import Link from "next/link";
import { LogIn, MapPin } from "lucide-react";
import { useAuth } from "./AuthProvider";
import SearchBox from "./SearchBox";

type Props = {
  onMapPick: (lat: number, lng: number, zoom?: number) => void;
  onPinPick: (pinId: string) => void;
  onUserPick: (userId: string) => void;
};

export default function Navbar({ onMapPick, onPinPick, onUserPick }: Props) {
  const { user, loading } = useAuth();

  return (
    <header className="z-[500] flex items-center gap-4 border-b border-neutral-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
      <Link href="/" className="flex flex-none items-center gap-2">
        <MapPin className="h-5 w-5 text-rose-500" />
        <span className="text-lg font-semibold tracking-tight">OpenPin</span>
      </Link>

      <div className="flex flex-1 justify-center">
        <SearchBox
          onMapPick={onMapPick}
          onPinPick={onPinPick}
          onUserPick={onUserPick}
        />
      </div>

      <div className="flex-none">
        {loading ? (
          <div className="h-8 w-20 animate-pulse rounded-full bg-neutral-200 dark:bg-neutral-800" />
        ) : user ? null : (
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-4 py-1.5 text-sm font-medium text-white shadow hover:bg-rose-600"
          >
            <LogIn className="h-4 w-4" />
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
