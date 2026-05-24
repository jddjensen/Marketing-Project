"use client";

import { useEffect, useState } from "react";

// Keep an element mounted long enough for its CSS exit animation to play,
// then remove it. Pair with `[data-state="closed"]` selectors in globals.css
// (modal-out, popover-out, etc.).
//
//   const { mounted, state } = useExitAnimation(open, 200);
//   if (!mounted) return null;
//   <div className="modal-surface" data-state={state}>...
//
// While `open` is true, `state` is "open" and the element stays mounted.
// When `open` flips false, `state` flips to "closed" immediately so the
// exit keyframes play; after `exitMs` we unmount.
export function useExitAnimation(open: boolean, exitMs = 200) {
  // React 19's preferred pattern for "reset state when prop changes" is a
  // tracked-prop guard during render. The setState that schedules the
  // delayed unmount lives in a useEffect because timeouts are inherently
  // side-effectful — that's exactly what useEffect is for.
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<"open" | "closed">(
    open ? "open" : "closed"
  );
  const [trackedOpen, setTrackedOpen] = useState(open);

  if (open !== trackedOpen) {
    setTrackedOpen(open);
    if (open) {
      setMounted(true);
      // Render with state="closed" for one frame, then flip to "open" via
      // the rAF effect below. That gives CSS keyframes a starting state to
      // interpolate from on re-opens.
      setState("closed");
    } else {
      setState("closed");
    }
  }

  useEffect(() => {
    if (!open || state === "open") return;
    const id = requestAnimationFrame(() => setState("open"));
    return () => cancelAnimationFrame(id);
  }, [open, state]);

  useEffect(() => {
    if (open || !mounted) return;
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
  }, [open, mounted, exitMs]);

  return { mounted, state };
}
