"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Mail, MessageCircle, Share2 } from "lucide-react";

type Props = {
  title: string;
  url: string;
  className?: string;
};

// X (Twitter) and WhatsApp don't have lucide icons we use today — render
// them as small SVGs inline to stay consistent in size and stroke.
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l.36.572-1.06 3.872 3.97-1.413zm9.617-3.835l-1.207-1.21c-.301-.301-.769-.4-1.13-.213-.45.235-1.024.575-1.45.575-.566 0-1.13-.298-1.45-.575-.514-.444-1.13-1.13-1.45-1.45-.32-.32-1.024-1.024-1.45-1.45-.276-.32-.575-.884-.575-1.45 0-.426.34-1 .575-1.45.187-.361.088-.83-.213-1.13l-1.21-1.207a.819.819 0 0 0-1.16.001l-.726.726c-.43.43-.65 1.024-.585 1.59.18 1.566 1.13 3.41 2.832 5.112 1.702 1.702 3.546 2.652 5.112 2.832.566.065 1.16-.155 1.59-.585l.726-.726a.819.819 0 0 0 .001-1.16z" />
    </svg>
  );
}

export default function ShareMenu({ title, url, className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  async function handleClick() {
    // Native share sheet is useful on mobile (Facebook/X/Insta apps appear
    // in the list). On desktop — especially macOS — it shows Mail / Messages
    // / AirDrop only, which isn't what someone wants for social sharing.
    // Detect touch input as a proxy for "device that has social apps".
    const isTouch =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;
    if (isTouch && typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // user dismissed
      }
      return;
    }
    setOpen((v) => !v);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked
    }
  }

  const eu = encodeURIComponent(url);
  const et = encodeURIComponent(title);

  const links: Array<{
    label: string;
    href: string;
    icon: React.ReactNode;
  }> = [
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${eu}`,
      icon: <span className="text-[#1877F2]"><FacebookIcon /></span>,
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${eu}&text=${et}`,
      icon: <XIcon />,
    },
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${et}%20${eu}`,
      icon: <span className="text-[#25D366]"><WhatsAppIcon /></span>,
    },
    {
      label: "Messenger",
      href: `https://www.facebook.com/dialog/send?link=${eu}&app_id=291494419107518&redirect_uri=${eu}`,
      icon: <MessageCircle className="h-4 w-4 text-[#0084FF]" />,
    },
    {
      label: "Email",
      href: `mailto:?subject=${et}&body=${eu}`,
      icon: <Mail className="h-4 w-4 text-neutral-500" />,
    },
  ];

  return (
    <div ref={ref} className={"relative " + className}>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
      >
        <Share2 className="h-4 w-4" />
        Share
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[1000] mt-1 w-48 overflow-hidden rounded-xl bg-white py-1 shadow-xl ring-1 ring-black/10 dark:bg-neutral-900 dark:ring-white/10">
          <button
            type="button"
            onClick={copyLink}
            className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4 text-neutral-500" />
            )}
            <span>{copied ? "Copied!" : "Copy link"}</span>
          </button>
          <div className="my-1 h-px bg-neutral-100 dark:bg-neutral-800" />
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              {l.icon}
              <span>{l.label}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
