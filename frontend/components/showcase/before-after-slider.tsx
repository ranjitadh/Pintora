"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
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
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const clamp = (value: number) => Math.min(1, Math.max(0, value));

  const setSplitFromClientX = useCallback(
    (clientX: number) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const value = clamp((clientX - rect.left) / rect.width);
      setSplit(value);
    },
    []
  );

  const onPointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragging) return;
      setSplitFromClientX(event.clientX);
    },
    [dragging, setSplitFromClientX]
  );

  const onPointerUp = useCallback(() => {
    setDragging(false);
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
  }, [onPointerMove]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      setSplitFromClientX(event.clientX);
      setDragging(true);
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointercancel", onPointerUp);
    },
    [setSplitFromClientX, onPointerMove, onPointerUp]
  );

  const onContainerClick = useCallback(
    (event: React.MouseEvent) => {
      if (dragging) return;
      setSplitFromClientX(event.clientX);
    },
    [dragging, setSplitFromClientX]
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === "ArrowLeft") setSplit((prev) => clamp(prev - 0.02));
      else if (event.key === "ArrowRight") setSplit((prev) => clamp(prev + 0.02));
      else if (event.key === "Home") setSplit(0);
      else if (event.key === "End") setSplit(1);
    },
    []
  );

  const handleStyle = {
    left: `${split * 100}%`,
    transform: "translateX(-50%)",
  };

  const afterStyle = { clipPath: `inset(0 ${Math.round((1 - split) * 10000) / 100}% 0 0)` };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-ink shadow-card overflow-hidden",
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
    >
      <div className="absolute inset-0 h-full w-full overflow-hidden">
        <img
          src={afterSrc}
          alt=""
          data-testid="slider-after"
          className="h-full w-full object-cover"
          style={afterStyle}
          aria-hidden="true"
        />
      </div>

      <img
        src={beforeSrc}
        alt=""
        data-testid="slider-before"
        className="h-full w-full object-cover"
        aria-hidden="true"
      />

      <div className="absolute inset-0 flex items-end justify-between p-4 pointer-events-none text-xs font-mono uppercase tracking-wider">
        <span className="bg-white/90 text-ink px-2 py-1 rounded"> {beforeLabel} </span>
        <span className="bg-white/90 text-ink px-2 py-1 rounded"> {afterLabel} </span>
      </div>

      <button
        onPointerDown={onPointerDown}
        onMouseDown={(e) => e.preventDefault()}
        style={handleStyle}
        className="absolute top-1/2 z-20 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-white shadow-lg transition duration-100 ease-out active:scale-95"
        aria-label="Drag comparison divider"
        aria-valuetext={`${Math.round(split * 100)}%`}
        draggable={false}
      >
        <div className="absolute left-1 top-1/2 -translate-y-1/2 text-ink">
          <ArrowLeft size={10} />
        </div>
        <div className="absolute right-1 top-1/2 -translate-y-1/2 text-ink">
          <ArrowRight size={10} />
        </div>
      </button>

      {dragging && (
        <span className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 text-[10px] font-mono text-white bg-ink/80 px-2 py-1 rounded whitespace-nowrap pointer-events-none">
          {Math.round(split * 100)}%
        </span>
      )}
    </div>
  );
}
