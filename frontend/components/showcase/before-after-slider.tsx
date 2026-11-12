"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface BeforeAfterSliderProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel: string;
  afterLabel: string;
  className?: string;
}

export function BeforeAfterSlider({ beforeSrc, afterSrc, beforeLabel, afterLabel, className }: BeforeAfterSliderProps) {
  const [split, setSplit] = useState(0.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const beforeRef = useRef<HTMLImageElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const pendingX = useRef<number | null>(null);
  const draggingRef = useRef(false);

  const clamp = (value: number) => Math.min(1, Math.max(0, value));

  // Imperative DOM-only update during drag (no React state per frame)
  const applySplitImperative = useCallback((value: number) => {
    const clamped = clamp(value);
    const beforeEl = beforeRef.current;
    const dividerEl = dividerRef.current;

    if (!beforeEl || !dividerEl) return;

    const pct = Math.round(clamped * 10000) / 100;
    // Before (flat artwork) sits on the left; clip it from the right edge.
    beforeEl.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    dividerEl.style.left = `${pct}%`;
  }, []);

  // State + DOM update for keyboard and click
  const applySplit = useCallback((value: number) => {
    const clamped = clamp(value);
    setSplit(clamped);
    applySplitImperative(clamped);
  }, [applySplitImperative]);

  const flush = useCallback(() => {
    if (pendingX.current === null) {
      rafRef.current = null;
      return;
    }
    const container = containerRef.current;
    if (!container) {
      pendingX.current = null;
      rafRef.current = null;
      return;
    }
    const rect = container.getBoundingClientRect();
    const value = clamp((pendingX.current - rect.left) / rect.width);
    applySplitImperative(value);
    pendingX.current = null;
    rafRef.current = null;
  }, [applySplitImperative]);

  const setSplitFromClientX = useCallback(
    (clientX: number) => {
      pendingX.current = clientX;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flush);
      }
    },
    [flush]
  );

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!draggingRef.current) return;
      setSplitFromClientX(event.clientX);
    },
    [setSplitFromClientX]
  );

  const endDrag = useCallback(() => {
    draggingRef.current = false;
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", endDrag);
    document.removeEventListener("pointercancel", endDrag);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      flush();
    }
    if (pendingX.current !== null && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setSplit(clamp((pendingX.current - rect.left) / rect.width));
      pendingX.current = null;
    }
  }, [onPointerMove, flush]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      draggingRef.current = true;
      setSplitFromClientX(event.clientX);
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", endDrag);
      document.addEventListener("pointercancel", endDrag);
    },
    [setSplitFromClientX, onPointerMove, endDrag]
  );

  const onContainerClick = useCallback(
    (event: React.MouseEvent) => {
      if (draggingRef.current) return;
      setSplitFromClientX(event.clientX);
    },
    [setSplitFromClientX]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowLeft") applySplit(split - 0.02);
      else if (event.key === "ArrowRight") applySplit(split + 0.02);
      else if (event.key === "Home") applySplit(0);
      else if (event.key === "End") applySplit(1);
    },
    [split, applySplit]
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full cursor-ew-resize touch-none select-none overflow-hidden bg-ink",
        className
      )}
      onClick={onContainerClick}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      role="slider"
      aria-label="Before/after comparison"
      aria-valuenow={Math.round(split * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
    >
      {/* After image (with surface) — full background */}
      <img
        src={afterSrc}
        alt=""
        data-testid="slider-after"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ transform: "translateZ(0)" }}
        aria-hidden="true"
        decoding="async"
        loading="eager"
        draggable={false}
      />

      {/* Before image (flat artwork) — clipped to the left of the divider */}
      <img
        ref={beforeRef}
        src={beforeSrc}
        alt=""
        data-testid="slider-before"
        className="absolute inset-0 h-full w-full object-cover"
        style={{ clipPath: "inset(0 50% 0 0)", transform: "translateZ(0)" }}
        aria-hidden="true"
        decoding="async"
        loading="eager"
        draggable={false}
      />

      {/* Corner labels */}
      <div className="pointer-events-none absolute inset-0 flex items-start justify-between p-4">
        <span className="rounded-full bg-ink/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cream backdrop-blur-sm">
          {beforeLabel}
        </span>
        <span className="rounded-full bg-ink/70 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-cream backdrop-blur-sm">
          {afterLabel}
        </span>
      </div>

      {/* Divider line + handle */}
      <div
        ref={dividerRef}
        className="pointer-events-none absolute inset-y-0 z-20"
        style={{ left: `${split * 100}%` }}
      >
        <div className="absolute inset-y-0 left-0 w-px -translate-x-1/2 bg-cream/80" />
        <div className="absolute top-1/2 left-0 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-cream text-ink shadow-[0_4px_20px_rgba(0,0,0,0.45)]">
          <ChevronLeft size={15} strokeWidth={2.5} className="-mr-0.5" />
          <ChevronRight size={15} strokeWidth={2.5} className="-ml-0.5" />
        </div>
      </div>
    </div>
  );
}
