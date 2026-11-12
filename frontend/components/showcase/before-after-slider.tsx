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
  const pendingY = useRef<number | null>(null);
  const draggingRef = useRef(false);

  const clamp = (value: number) => Math.min(1, Math.max(0, value));

  // Imperative DOM-only update during drag (no React state per frame)
  const applySplitImperative = useCallback((value: number) => {
    const clamped = clamp(value);
    const container = containerRef.current;
    const afterEl = afterRef.current;
    const handleEl = handleRef.current;

    if (!container || !afterEl || !handleEl) return;

    // Portrait: clip from top, handle moves vertically
    const pct = Math.round(clamped * 10000) / 100;
    afterEl.style.clipPath = `inset(${pct}% 0 0 0)`;
    handleEl.style.top = `${clamped * 100}%`;
    handleEl.style.transform = "translateY(-50%) translateZ(0)";
  }, []);

  // State + DOM update — for keyboard and click
  const applySplit = useCallback((value: number) => {
    const clamped = clamp(value);
    setSplit(clamped);
    applySplitImperative(clamped);
  }, [applySplitImperative]);

  const flush = useCallback(() => {
    if (pendingY.current === null) {
      rafRef.current = null;
      return;
    }
    const container = containerRef.current;
    if (!container) {
      pendingY.current = null;
      rafRef.current = null;
      return;
    }
    const rect = container.getBoundingClientRect();
    const value = clamp((pendingY.current - rect.top) / rect.height);
    applySplitImperative(value);
    pendingY.current = null;
    rafRef.current = null;
  }, [applySplitImperative]);

  const setSplitFromClientY = useCallback(
    (clientY: number) => {
      pendingY.current = clientY;
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(flush);
      }
    },
    [flush]
  );

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!draggingRef.current) return;
      setSplitFromClientY(event.clientY);
    },
    [setSplitFromClientY]
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
    if (pendingY.current !== null && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setSplit(clamp((pendingY.current - rect.top) / rect.height));
      pendingY.current = null;
    }
  }, [onPointerMove, flush]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      draggingRef.current = true;
      setSplitFromClientY(event.clientY);
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", endDrag);
      document.addEventListener("pointercancel", endDrag);
    },
    [setSplitFromClientY, onPointerMove, endDrag]
  );

  const onContainerClick = useCallback(
    (event: React.MouseEvent) => {
      if (draggingRef.current) return;
      setSplitFromClientY(event.clientY);
    },
    [setSplitFromClientY]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowUp") applySplit(split - 0.02);
      else if (event.key === "ArrowDown") applySplit(split + 0.02);
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
      style={{ touchAction: "none-y" }}
    >
      {/* After image (real product) - revealed from top */}
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

      {/* Before image (flat artwork) - full background */}
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

      {/* Labels at top */}
      <div className="absolute inset-0 flex items-start justify-between p-4 pointer-events-none text-xs font-mono uppercase tracking-wider">
        <span className="bg-white/90 text-ink px-2.5 py-1.5 rounded-full shadow-sm">
          {beforeLabel}
        </span>
        <span className="bg-white/90 text-ink px-2.5 py-1.5 rounded-full shadow-sm">
          {afterLabel}
        </span>
      </div>

      {/* Draggable handle (vertical) */}
      <button
        ref={handleRef}
        onPointerDown={onPointerDown}
        onMouseDown={(e) => e.preventDefault()}
        style={{ top: `${split * 100}%`, transform: "translateY(-50%) translateZ(0)" }}
        className="absolute left-1/2 z-20 flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-white shadow-xl transition-none cursor-grab active:cursor-grabbing"
        aria-label="Drag comparison divider"
        aria-valuetext={`${Math.round(split * 100)}%`}
        draggable={false}
      >
        <div className="absolute top-1 left-1/2 -translate-x-1/2 text-ink">
          <span className="block h-1 w-4 bg-ink rounded-sm" />
        </div>
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-ink">
          <span className="block h-1 w-4 bg-ink rounded-sm" />
        </div>
      </button>

      {draggingRef.current && (
        <span className="absolute left-1/2 -translate-x-1/2 -top-10 z-30 text-[10px] font-mono text-white bg-ink/90 px-2 py-1 rounded whitespace-nowrap pointer-events-none">
          {Math.round(split * 100)}%
        </span>
      )}
    </div>
  );
}
