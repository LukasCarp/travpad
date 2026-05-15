"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/supabase";
import AvatarUpload from "./AvatarUpload";

const BIO_MAX = 280;

type Props = {
  profile: Profile;
  onClose: () => void;
  onSaved: (profile: Profile) => void;
};

export default function ProfileEditModal({ profile, onClose, onSaved }: Props) {
  const supabase = createClient();
  const [displayName, setDisplayName] = useState(profile.display_name);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarPath, setAvatarPath] = useState<string | null>(
    profile.avatar_path
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const name = displayName.trim();
    if (!name) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    try {
      const { data, error: updErr } = await supabase
        .from("profiles")
        .update({
          display_name: name,
          bio: bio.trim() || null,
          avatar_path: avatarPath,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id)
        .select(
          "id, display_name, bio, avatar_path, compass_text, compass_generated_at"
        )
        .single();
      if (updErr) throw new Error(updErr.message);

      onSaved(data as Profile);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save profile");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-xl bg-white shadow-2xl dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-200 p-6 pb-4 dark:border-neutral-800">
          <h2 className="text-lg font-semibold">Edit profile</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <div className="flex-1 space-y-4 overflow-y-auto p-6">
            <div>
              <label className="mb-2 block text-sm font-medium">
                Profile picture
              </label>
              <AvatarUpload
                currentPath={avatarPath}
                onChange={setAvatarPath}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-rose-500 dark:border-neutral-700"
                placeholder="Your name"
                autoFocus
              />
            </div>

            <div>
              <div className="mb-1 flex items-baseline justify-between">
                <label className="block text-sm font-medium">Bio</label>
                <span className="text-[10px] text-neutral-400">
                  {bio.length}/{BIO_MAX}
                </span>
              </div>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
                rows={4}
                maxLength={BIO_MAX}
                className="w-full resize-none rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-rose-500 dark:border-neutral-700"
                placeholder="Tell us a bit about yourself"
              />
            </div>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-200">
                {error}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-neutral-200 p-4 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white shadow hover:bg-rose-600 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
