"use client";

import { useCallback, useState } from "react";
import { Pipette } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColorSwatch } from "./data";

interface ColorPickerProps {
  colors: ColorSwatch[];
  value: string;
  onChange: (hex: string) => void;
  label?: string;
}

export function ColorPicker({ colors, value, onChange, label = "Color" }: ColorPickerProps) {
  const [custom, setCustom] = useState(value);
  const selected = colors.find((c) => c.hex === value);

  const handleSwatch = useCallback(
    (hex: string) => {
      setCustom(hex);
      onChange(hex);
    },
    [onChange]
  );

  const handleCustom = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const hex = e.target.value;
      setCustom(hex);
      onChange(hex);
    },
    [onChange]
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-clay/60">{label}</span>
        {selected && (
          <span className="ml-auto text-[11px] font-semibold text-cream/90">{selected.name}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {colors.map((color) => (
          <button
            key={color.hex}
            onClick={() => handleSwatch(color.hex)}
            className={cn(
              "shrink-0 h-7 w-7 rounded-full border-2 transition duration-200 focus:outline-none focus:ring-2 focus:ring-clay",
              value === color.hex
                ? "border-clay shadow-[0_0_0_3px_rgba(255,255,255,0.6)]"
                : "border-white/20 hover:border-white/50"
            )}
            style={{ backgroundColor: color.hex }}
            aria-label={color.name}
            aria-pressed={value === color.hex}
          />
        ))}
        <div className="relative shrink-0 h-7 w-7 rounded-full border-2 border-white/20 cursor-pointer">
          <input
            type="color"
            value={custom}
            onChange={handleCustom}
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
            aria-label="Custom color picker"
          />
          <Pipette size={14} className="text-cream/70" />
        </div>
      </div>
    </div>
  );
}

function ImageTint({ hex }: { hex: string }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ backgroundColor: hex, mixBlendMode: "overlay", opacity: 0.35 }}
    />
  );
}

export { ImageTint };
