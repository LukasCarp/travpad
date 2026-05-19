import type { createClient } from "@/lib/supabase/client";

// A profile's avatar_path holds either a Supabase Storage path (an uploaded
// avatar) or a full http(s) URL carried over from an OAuth provider
// (Google / Facebook). Resolve whichever it is to a displayable URL.
export function avatarUrl(
  supabase: ReturnType<typeof createClient>,
  path: string | null | undefined
): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
}
