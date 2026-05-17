import type { Metadata } from "next";
import Link from "next/link";
import { MapPin } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy · TravPad",
  description: "How TravPad collects, uses and protects your information.",
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-12 dark:bg-neutral-950">
      <main className="mx-auto max-w-2xl">
        <Link href="/" className="inline-flex items-center gap-2">
          <MapPin className="h-5 w-5 text-rose-500" />
          <span className="text-lg font-semibold tracking-tight">TravPad</span>
        </Link>

        <h1 className="mt-8 text-3xl font-semibold tracking-tight">
          Privacy Policy
        </h1>
        <p className="mt-1 text-sm text-neutral-500">
          Last updated: 18 May 2026
        </p>

        <p className="mt-6 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          TravPad is a wiki-style travel map where people pin and share places.
          This policy explains what information TravPad collects, how it is
          used, and the choices you have.
        </p>

        <Section title="Information we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Account information</strong> — when you create an account
              we store your email address. If you sign in with Google or
              Facebook, we receive your name, email address and profile picture
              from that provider.
            </li>
            <li>
              <strong>Profile</strong> — a display name, an optional bio, and an
              optional profile picture you upload.
            </li>
            <li>
              <strong>Content you create</strong> — pins (their location, title,
              category, descriptions and any photos you upload), reviews, lists,
              and who and what you follow.
            </li>
            <li>
              <strong>Technical data</strong> — standard server logs, such as IP
              address and browser type, generated when you use the site.
            </li>
          </ul>
        </Section>

        <Section title="How we use your information">
          <p>
            We use it to operate TravPad — to show pins on the map, display your
            profile, let you follow places and people, notify you about edits to
            pins you follow, and keep the service secure.
          </p>
        </Section>

        <Section title="Public content">
          <p>
            TravPad is a public, collaborative map. Pins, profiles, reviews and
            lists you create are visible to other users and to anyone with a
            link to them. Please do not pin private locations or post anything
            you do not want to be public.
          </p>
        </Section>

        <Section title="Third-party services">
          <p>TravPad relies on these services to function:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Supabase</strong> — stores your account, content and
              uploaded images, and handles sign-in.
            </li>
            <li>
              <strong>Google and Facebook</strong> — only if you choose to sign
              in with them; they handle that authentication.
            </li>
            <li>
              <strong>Anthropic</strong> — the optional &ldquo;TravPad
              Compass&rdquo; feature sends the titles and categories of your
              pins to Anthropic&apos;s API to generate a short summary of your
              travel style.
            </li>
            <li>
              <strong>OpenStreetMap</strong> — provides the map tiles and the
              place search.
            </li>
            <li>
              <strong>Vercel</strong> — hosts the application.
            </li>
          </ul>
        </Section>

        <Section title="Photo location data">
          <p>
            When you add a photo, TravPad may read GPS coordinates embedded in
            the photo&apos;s metadata to place the pin. This is done in your
            browser; only the resulting pin location is saved.
          </p>
        </Section>

        <Section title="Data retention and deletion">
          <p>
            Your content stays until you delete it or your account. You can edit
            or delete your pins, reviews and lists in the app. To delete your
            account and associated data, contact us at the address below.
          </p>
        </Section>

        <Section title="Children">
          <p>
            TravPad is not directed at children under 13, and we do not
            knowingly collect their information.
          </p>
        </Section>

        <Section title="Changes to this policy">
          <p>
            We may update this policy. The &ldquo;last updated&rdquo; date above
            reflects the latest version.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or your data:{" "}
            <span className="font-medium">your-email@example.com</span>.
          </p>
        </Section>

        <p className="mt-10 text-sm">
          <Link href="/" className="text-rose-600 hover:underline">
            ← Back to TravPad
          </Link>
        </p>
      </main>
    </div>
  );
}
