"use client";

import { useCallback, useRef, useState } from "react";
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
  const afterRef = useRef<HTMLImageElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef<number | null>(null);
  const pendingX = useRef<number | null>(null);
  const draggingRef = useRef(false);

  const clamp = (value: number) => Math.min(1, Math.max(0, value));

  // Imperative DOM-only update — no React state, runs every RAF frame during drag
  const applySplitImperative = useCallback((value: number) => {
    const clamped = clamp(value);
    const container = containerRef.current;
    const afterEl = afterRef.current;
    const handleEl = handleRef.current;

    if (!container || !afterEl || !handleEl) return;

    const pct = Math.round(clamped * 10000) / 100;
    afterEl.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    handleEl.style.left = `${clamped * 100}%`;
    handleEl.style.transform = "translateX(-50%) translateZ(0)";
  }, []);

  // State + DOM update — for keyboard and click
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
    // Sync final position to React state
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
        "relative overflow-hidden rounded-2xl bg-ink shadow-card touch-none select-none",
        className
      )}
      onClick={onContainerClick}
      onKeyDown={onKeyDown}
      role="separator"
      aria-label="Before/after comparison"
      aria-valuenow={Math.round(split * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      style={{ touchAction: "none" }}
    >
      <div className="absolute inset-0 h-full w-full overflow-hidden">
        <img
          ref={afterRef}
          src={afterSrc}
          alt=""
          data-testid="slider-after"
          className="h-full w-full object-cover will-change-transform"
          style={{ transform: "translateZ(0)" }}
          aria-hidden="true"
          decoding="async"
          loading="eager"
        />
      </div>

      <img
        src={beforeSrc}
        alt=""
        data-testid="slider-before"
        className="h-full w-full object-cover will-change-transform"
        style={{ transform: "translateZ(0)" }}
        aria-hidden="true"
        decoding="async"
        loading="eager"
      />

      <div className="absolute inset-0 flex items-end justify-between p-4 pointer-events-none text-xs font-mono uppercase tracking-wider">
        <span className="bg-white/90 text-ink px-2.5 py-1.5 rounded-full shadow-sm">
          {beforeLabel}
        </span>
        <span className="bg-white/90 text-ink px-2.5 py-1.5 rounded-full shadow-sm">
          {afterLabel}
        </span>
      </div>

      <button
        ref={handleRef}
        onPointerDown={onPointerDown}
        onMouseDown={(e) => e.preventDefault()}
        style={{ left: `${split * 100}%`, transform: "translateX(-50%) translateZ(0)" }}
        className="absolute top-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-white shadow-xl transition-none cursor-grab active:cursor-grabbing"
        aria-label="Drag comparison divider"
        aria-valuetext={`${Math.round(split * 100)}%`}
        draggable={false}
      >
        <div className="absolute left-1 top-1/2 -translate-y-1/2 text-ink">
          <span className="block w-1 h-4 bg-ink rounded-sm" />
        </div>
        <div className="absolute right-1 top-1/2 -translate-y-1/2 text-ink">
          <span className="block w-1 h-4 bg-ink rounded-sm" />
        </div>
      </button>

      {draggingRef.current && (
        <span className="absolute -top-10 left-1/2 -translate-x-1/2 z-30 text-[10px] font-mono text-white bg-ink/90 px-2 py-1 rounded whitespace-nowrap pointer-events-none">
          {Math.round(split * 100)}%
        </span>
      )}
    </div>
  );
}
