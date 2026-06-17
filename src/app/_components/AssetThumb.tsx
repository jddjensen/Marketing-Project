"use client";

import { useMemo, useState } from "react";
import { thumbHashToDataURL } from "thumbhash";

// Decode a base64 ThumbHash into a data URL for an instant blurred placeholder.
// Returns null on any malformed input so callers fall back to the plain image.
function thumbhashToDataUrl(hash: string): string | null {
  try {
    const binary = atob(hash);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return thumbHashToDataURL(bytes);
  } catch {
    return null;
  }
}

// Lazy-loaded media tile with a ThumbHash placeholder that cross-fades to the
// real image once it paints. Renders a self-contained `relative` box that fills
// its parent, so callers just give it a sized container (the existing aspect
// wrappers already do). Intentionally a plain <img>, not next/image — sources
// are short-lived Supabase signed URLs, which next/image's optimizer can't
// cache usefully.
export function AssetThumb({
  src,
  thumbhash,
  alt,
  width,
  height,
  fit = "cover",
  eager = false,
}: {
  src: string;
  thumbhash?: string | null;
  alt: string;
  width?: number | null;
  height?: number | null;
  fit?: "cover" | "contain";
  /** Load immediately instead of lazily (e.g. an active slideshow frame). */
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const placeholder = useMemo(
    () => (thumbhash ? thumbhashToDataUrl(thumbhash) : null),
    [thumbhash]
  );
  const fitClass = fit === "contain" ? "object-contain" : "object-cover";

  return (
    <div className="relative h-full w-full overflow-hidden">
      {placeholder && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          aria-hidden
          alt=""
          src={placeholder}
          className={`absolute inset-0 h-full w-full ${fitClass} transition-opacity duration-500 ${
            loaded ? "opacity-0" : "opacity-100"
          }`}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={width ?? undefined}
        height={height ?? undefined}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        // Treat a load error like "done" so we don't leave the tile stuck on
        // the blurred placeholder forever.
        onError={() => setLoaded(true)}
        className={`absolute inset-0 h-full w-full ${fitClass} transition-opacity duration-500 ${
          loaded || !placeholder ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
