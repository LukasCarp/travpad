"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Star, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Review } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";

type Props = {
  pinId: string;
};

function StarRow({
  value,
  onChange,
  size = 5,
}: {
  value: number;
  onChange?: (n: number) => void;
  size?: number;
}) {
  const interactive = !!onChange;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(n)}
            aria-label={`${n} stars`}
            className={
              "disabled:cursor-default " +
              (interactive ? "cursor-pointer" : "")
            }
          >
            <Star
              className={
                (size === 5 ? "h-5 w-5 " : "h-4 w-4 ") +
                (filled
                  ? "fill-amber-400 text-amber-400"
                  : "text-neutral-300 dark:text-neutral-600")
              }
            />
          </button>
        );
      })}
    </div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function PinReviews({ pinId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { user } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftRating, setDraftRating] = useState(0);
  const [draftText, setDraftText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const myReview = useMemo(
    () => (user ? reviews.find((r) => r.user_id === user.id) ?? null : null),
    [reviews, user]
  );

  const avg = useMemo(() => {
    if (reviews.length === 0) return null;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return Math.round((sum / reviews.length) * 10) / 10;
  }, [reviews]);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from("pin_reviews")
      .select("id, pin_id, user_id, rating, text, author_label, created_at")
      .eq("pin_id", pinId)
      .order("created_at", { ascending: false });
    if (!err) setReviews((data ?? []) as Review[]);
    setLoading(false);
  }, [pinId, supabase]);

  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  // When we discover the user's own review (or it changes), prefill the form.
  useEffect(() => {
    if (myReview) {
      setDraftRating(myReview.rating);
      setDraftText(myReview.text ?? "");
    } else {
      setDraftRating(0);
      setDraftText("");
    }
  }, [myReview]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (draftRating < 1) {
      setError("Pick a rating (1-5 stars) first.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: rpcErr } = await supabase.rpc("upsert_review", {
        p_pin_id: pinId,
        p_rating: draftRating,
        p_text: draftText,
      });
      if (rpcErr) throw new Error(rpcErr.message);
      await loadReviews();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't save review"
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteOwn() {
    if (!myReview) return;
    setError(null);
    const { error: delErr } = await supabase
      .from("pin_reviews")
      .delete()
      .eq("id", myReview.id);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setDraftRating(0);
    setDraftText("");
    await loadReviews();
  }

  return (
    <div className="space-y-4 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          Reviews
        </h2>
        {avg !== null && (
          <div className="flex items-center gap-1.5 text-sm">
            <StarRow value={Math.round(avg)} />
            <span className="font-medium">{avg.toFixed(1)}</span>
            <span className="text-xs text-neutral-500">
              ({reviews.length})
            </span>
          </div>
        )}
        {avg === null && !loading && (
          <span className="text-xs text-neutral-500">No reviews yet</span>
        )}
      </div>

      {user ? (
        <form
          onSubmit={handleSubmit}
          className="space-y-2 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/40"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
              {myReview ? "Your review" : "Write a review"}
            </span>
            <StarRow value={draftRating} onChange={setDraftRating} />
          </div>
          <textarea
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={3}
            placeholder="Tell us what you think (optional)"
            className="w-full resize-none rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-rose-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-200">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-rose-600 disabled:opacity-50"
            >
              {submitting
                ? "Saving…"
                : myReview
                  ? "Update"
                  : "Submit review"}
            </button>
            {myReview && (
              <button
                type="button"
                onClick={handleDeleteOwn}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-100 hover:text-rose-600 dark:hover:bg-neutral-800"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Remove
              </button>
            )}
          </div>
        </form>
      ) : (
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500 dark:bg-neutral-800/40">
          Sign in to write a review.
        </p>
      )}

      <div className="space-y-3">
        {loading && (
          <p className="text-xs text-neutral-500">Loading reviews…</p>
        )}
        {!loading && reviews.length === 0 && (
          <p className="text-xs text-neutral-500">Be the first to review.</p>
        )}
        {reviews.map((r) => (
          <div
            key={r.id}
            className="space-y-1 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/40"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StarRow value={r.rating} size={4} />
                <span className="text-[11px] text-neutral-500">
                  {formatDate(r.created_at)}
                </span>
              </div>
              <Link
                href={`/?profile=${r.user_id}`}
                className="text-[11px] font-medium text-neutral-500 hover:text-rose-600 hover:underline"
              >
                {r.author_label}
                {user?.id === r.user_id && " (you)"}
              </Link>
            </div>
            {r.text && (
              <p className="whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-200">
                {r.text}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
