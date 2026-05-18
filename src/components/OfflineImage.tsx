"use client";

import { useEffect, useRef, useState } from "react";
import { getOfflineImageBlob } from "@/lib/offline/db";

// An <img> that falls back to a downloaded offline copy when the network
// image fails to load (e.g. when the user is offline).
export default function OfflineImage({
  path,
  src,
  alt = "",
  className,
}: {
  path: string;
  src: string;
  alt?: string;
  className?: string;
}) {
  const [resolved, setResolved] = useState(src);
  const triedOffline = useRef(false);

  useEffect(() => {
    triedOffline.current = false;
    setResolved(src);
  }, [src]);

  useEffect(() => {
    return () => {
      if (resolved.startsWith("blob:")) URL.revokeObjectURL(resolved);
    };
  }, [resolved]);

  async function handleError() {
    if (triedOffline.current) return;
    triedOffline.current = true;
    try {
      const blob = await getOfflineImageBlob(path);
      if (blob) setResolved(URL.createObjectURL(blob));
    } catch {
      // no offline copy — leave the broken image
    }
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={resolved} alt={alt} className={className} onError={handleError} />
  );
}
