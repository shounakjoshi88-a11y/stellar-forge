import { useEffect } from "react";

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

/**
 * Global key listener. Skips the shortcut while the user is typing in a field
 * (so "n" still types normally in a search box). `enabled` lets a page gate it.
 */
export function useShortcut(key: string, handler: () => void, enabled = true, ignoreWhileTyping = true) {
  useEffect(() => {
    if (!enabled) return;
    const k = key.toLowerCase();
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key.toLowerCase() !== k) return;
      if (ignoreWhileTyping && isTyping(e.target)) return;
      e.preventDefault();
      handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, handler, enabled, ignoreWhileTyping]);
}

/**
 * Same as useShortcut but funnels any key handling to a single keydown effect
 * (for multi-shortcut pages) — call cb(e) and do your own matching.
 */
export function useShortcutKeyboard(cb: (e: KeyboardEvent) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.target)) return;
      cb(e);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cb, enabled]);
}