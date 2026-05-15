import { NextResponse, type NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

type PinRow = {
  title: string;
  category: string | null;
  subcategory: string | null;
  short_description: string | null;
  services: string[] | null;
};

function buildPrompt(pins: PinRow[]): string {
  if (pins.length === 0) {
    return [
      "A user on TravPad hasn't pinned any places yet.",
      "Write a short, charming comment (max 2 sentences, in English) encouraging them to start exploring.",
    ].join("\n");
  }

  const lines = pins.slice(0, 50).map((p) => {
    const cat = [p.category, p.subcategory].filter(Boolean).join(" / ");
    const services = (p.services ?? []).join(", ");
    const desc = p.short_description ? ` — ${p.short_description}` : "";
    return `- ${p.title} (${cat || "uncategorized"})${
      services ? `; tags: ${services}` : ""
    }${desc}`;
  });

  return [
    "Here are places a user has pinned on TravPad:",
    "",
    lines.join("\n"),
    "",
    "Write a short, charming summary (max 2-3 sentences) of the user's travel character in English.",
    "Feel free to use a creative epithet (e.g. \"Nature Wanderer\", \"City Aesthete\", \"Craft Hunter\", \"Coastal Nomad\") if one fits — but invent one that matches the pattern you see.",
    "Write it personally and warmly, but grounded in the places above. No bullet lists.",
  ].join("\n");
}

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ userId: string }> }
) {
  const { userId } = await context.params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.id !== userId) {
    return NextResponse.json(
      { error: "You can only generate your own Compass." },
      { status: 403 }
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is missing on the server." },
      { status: 500 }
    );
  }

  const { data: pins, error: pinsErr } = await supabase
    .from("pins")
    .select("title, category, subcategory, short_description, services")
    .eq("created_by", userId);
  if (pinsErr) {
    return NextResponse.json({ error: pinsErr.message }, { status: 500 });
  }

  const prompt = buildPrompt((pins ?? []) as PinRow[]);

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [{ role: "user", content: prompt }],
    });
    const block = response.content[0];
    const text =
      block && block.type === "text" ? block.text.trim() : "";

    if (!text) {
      return NextResponse.json(
        { error: "The AI response was empty." },
        { status: 502 }
      );
    }

    const generatedAt = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("profiles")
      .update({
        compass_text: text,
        compass_generated_at: generatedAt,
        updated_at: generatedAt,
      })
      .eq("id", userId);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ text, generated_at: generatedAt });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "The AI request failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
