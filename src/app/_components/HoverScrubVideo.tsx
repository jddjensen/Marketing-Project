"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  src: string;
  poster?: string;
  className?: string;
};

// Drop-in replacement for <video controls> on tiles. Default state shows the
// poster + a play badge; horizontal mouse position seeks the underlying video
// frame-by-frame so the user can preview without playback. Click anywhere
// flips into native-controls mode for the rest of the tile's lifetime.
export function HoverScrubVideo({ src, poster, className = "" }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const targetTimeRef = useRef(0);
  const seekingRef = useRef(false);
  const [activated, setActivated] = useState(false);
  const [scrubPercent, setScrubPercent] = useState<number | null>(null);

  // Drive currentTime updates through rAF + a seekingRef gate so a fast cursor
  // doesn't pile dozens of seeks on top of each other. The browser drops
  // intermediate frames anyway; we just keep one in flight at a time and
  // re-fire from the seeked handler if a newer target arrived meanwhile.
  const flushSeek = useCallback(() => {
    rafRef.current = null;
    const video = videoRef.current;
    if (!video || seekingRef.current) return;
    if (Math.abs(video.currentTime - targetTimeRef.current) < 0.04) return;
    seekingRef.current = true;
    video.currentTime = targetTimeRef.current;
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onSeeked = () => {
      seekingRef.current = false;
      if (Math.abs(video.currentTime - targetTimeRef.current) >= 0.04) {
        flushSeek();
      }
    };
    video.addEventListener("seeked", onSeeked);
    return () => video.removeEventListener("seeked", onSeeked);
  }, [flushSeek]);

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (activated) return;
      const wrapper = wrapperRef.current;
      const video = videoRef.current;
      if (!wrapper || !video) return;
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const rect = wrapper.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setScrubPercent(ratio);
      // Park just shy of the end so we never land on the black post-ended frame.
      targetTimeRef.current = ratio * Math.max(0, video.duration - 0.05);
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flushSeek);
      }
    },
    [activated, flushSeek]
  );

  const onMouseLeave = useCallback(() => {
    setScrubPercent(null);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const onActivate = useCallback(() => {
    if (activated) return;
    const video = videoRef.current;
    if (!video) return;
    setActivated(true);
    video.currentTime = 0;
    video.play().catch(() => {
      /* autoplay can be blocked when not in a user gesture; the click is one,
       * but some browsers still refuse without prior interaction tracking.
       * The native controls are already showing, so the user can press play. */
    });
  }, [activated]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (activated) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onActivate();
      }
    },
    [activated, onActivate]
  );

  return (
    <div
      ref={wrapperRef}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onActivate}
      onKeyDown={onKeyDown}
      role={activated ? undefined : "button"}
      tabIndex={activated ? -1 : 0}
      aria-label={activated ? undefined : "Play video"}
      className="relative w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)] focus-visible:ring-offset-0"
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls={activated}
        playsInline
        preload="metadata"
        className={className}
      />
      {!activated && (
        <>
          <div
            className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-[var(--dur-fast)] ease-[var(--ease-apple)] ${
              scrubPercent !== null ? "opacity-0" : "opacity-100"
            }`}
          >
            <span
              className="flex items-center justify-center w-10 h-10 rounded-full bg-black/55 backdrop-blur-sm text-white"
              style={{ boxShadow: "var(--shadow-soft)" }}
            >
              <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
                <path d="M5.5 3.5v9l7-4.5z" />
              </svg>
            </span>
          </div>
          {scrubPercent !== null && (
            <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-[2px] bg-white/25">
              <div
                className="h-full bg-white"
                style={{ width: `${scrubPercent * 100}%` }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
