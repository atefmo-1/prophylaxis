import { useCallback, useRef } from "react";

const SELECTED = ':scope > [aria-pressed="true"], :scope > [aria-selected="true"]';

/**
 * A sliding pill for a segmented control. Attach the returned ref to the group; it draws one
 * indicator (the group's ::before, see .has-pill in app.css) under whichever child button is
 * pressed or selected, and slides it when that changes. It watches the buttons' aria state, so
 * the component only has to keep aria-pressed / aria-selected right.
 */
export function usePill<T extends HTMLElement>() {
  const stop = useRef<(() => void) | null>(null);
  return useCallback((el: T | null) => {
    stop.current?.();
    stop.current = null;
    if (!el) return;

    // Slide only between two placements the viewer saw, so the pill doesn't fly in from the
    // corner on load or when a hidden group (the menu's theme switch) appears.
    let shown = false;
    const place = () => {
      const on = el.querySelector<HTMLElement>(SELECTED);
      const visible = !!on && on.offsetWidth > 0;
      el.style.setProperty("--pill-o", visible ? "1" : "0");
      if (!visible) {
        shown = false;
        return;
      }
      if (!shown) el.classList.remove("pill-live");
      el.style.setProperty("--pill-x", `${on.offsetLeft}px`);
      el.style.setProperty("--pill-y", `${on.offsetTop}px`);
      el.style.setProperty("--pill-w", `${on.offsetWidth}px`);
      el.style.setProperty("--pill-h", `${on.offsetHeight}px`);
      if (!shown) {
        getComputedStyle(el, "::before").transform; // settle the first spot before turning the slide on
        el.classList.add("pill-live");
        shown = true;
      }
    };

    el.classList.add("has-pill");
    place();

    const watch = new MutationObserver(place);
    watch.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-pressed", "aria-selected"] });
    // Font loading and wrapping change the buttons' sizes without touching their attributes.
    const sizes = new ResizeObserver(place);
    sizes.observe(el);
    for (const child of el.children) sizes.observe(child);

    stop.current = () => {
      watch.disconnect();
      sizes.disconnect();
    };
  }, []);
}
