"use client";

import { useEffect, useRef, type RefObject } from "react";

// Shared keyboard/focus behavior for modal dialogs:
//
//   const { dialogRef } = useDialogChrome<HTMLDivElement>({ open, onClose });
//   <div ref={dialogRef} role="dialog" ...>
//
// While `open` is true: Escape calls onClose (unless an inner handler already
// claimed the key via e.preventDefault()), Tab/Shift+Tab cycle through
// focusable descendants, initial focus moves to `initialFocusRef` (or the
// first focusable, or the panel itself), and focus that lands outside is
// pulled back in. When `open` flips false OR the component unmounts, focus
// returns to whatever was focused before the dialog opened — so it plays
// well with useExitAnimation, which keeps the panel mounted ~200ms during
// the exit animation: focus is handed back at close time, not unmount time.
//
// The panel element must be in the DOM by the time `open` is true (the
// useExitAnimation `mounted` flag guarantees this, since it flips
// synchronously during render).

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter(
    (el) =>
      el.getClientRects().length > 0 &&
      el.closest("[aria-hidden='true']") === null
  );
}

// Open dialogs, oldest first. Only the topmost one owns Escape and the focus
// trap, so a ConfirmDialog opened from inside another modal behaves correctly.
const dialogStack: HTMLElement[] = [];

export function useDialogChrome<T extends HTMLElement = HTMLDivElement>({
  open,
  onClose,
  initialFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}): { dialogRef: RefObject<T | null> } {
  const dialogRef = useRef<T | null>(null);
  // Latest-value refs so the main effect doesn't tear down/re-run (and
  // re-capture the wrong "previously focused" element) when callers pass
  // inline callbacks.
  const latest = useRef({ onClose, initialFocusRef });
  useEffect(() => {
    latest.current = { onClose, initialFocusRef };
  });

  useEffect(() => {
    if (!open) return;
    const node = dialogRef.current;
    if (!node) return;

    dialogStack.push(node);
    const isTop = () => dialogStack[dialogStack.length - 1] === node;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Let the panel itself take focus as a last resort.
    if (!node.hasAttribute("tabindex")) node.setAttribute("tabindex", "-1");

    const focusInitial = () => {
      const preferred = latest.current.initialFocusRef?.current;
      const target =
        (preferred && !preferred.matches(":disabled") ? preferred : null) ??
        getFocusable(node)[0] ??
        node;
      target.focus({ preventScroll: true });
    };
    focusInitial();

    const onNodeKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !isTop()) return;
      const items = getFocusable(node);
      if (items.length === 0) {
        e.preventDefault();
        node.focus({ preventScroll: true });
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const inside = active instanceof HTMLElement && items.includes(active);
      if (e.shiftKey) {
        if (!inside || active === first) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else if (!inside || active === last) {
        e.preventDefault();
        first.focus({ preventScroll: true });
      }
    };
    node.addEventListener("keydown", onNodeKeyDown);

    // Escape listens on document in the bubble phase so inner handlers —
    // including React ones, which attach at the React root — run first and
    // can claim the key with e.preventDefault().
    const onDocumentKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || !isTop()) return;
      e.preventDefault();
      latest.current.onClose();
    };
    document.addEventListener("keydown", onDocumentKeyDown);

    // If focus escapes (programmatic focus, returning from browser chrome),
    // pull it back into the dialog.
    const onFocusIn = (e: FocusEvent) => {
      if (!isTop()) return;
      if (e.target instanceof Node && node.contains(e.target)) return;
      focusInitial();
    };
    document.addEventListener("focusin", onFocusIn);

    return () => {
      node.removeEventListener("keydown", onNodeKeyDown);
      document.removeEventListener("keydown", onDocumentKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      const i = dialogStack.indexOf(node);
      if (i !== -1) dialogStack.splice(i, 1);
      // Hand focus back to the trigger unless the user already moved it
      // somewhere outside the dialog.
      const current = document.activeElement;
      const focusIsLost =
        current === null || current === document.body || node.contains(current);
      if (previouslyFocused && previouslyFocused.isConnected && focusIsLost) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open]);

  return { dialogRef };
}
