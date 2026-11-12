"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SHOWCASE_SLIDES } from "./data";

/**
 * Minimal carousel for the showcase page.
 * Renders one slide at a time and provides vertical navigation buttons
 * matching the Playwright expectations:
 *   - button role
 *   - accessible name "Go to slide X"
 *   - aria‑pressed true on the active button
 *   - data-testid="slide-nav-button-X" for reliable selectors
 */
export function ShowcaseCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slide = SHOWCASE_SLIDES[currentSlide];

  return (
    <section
      data-testid="showcase"
      className="relative overflow-hidden bg-ink py-20 lg:py-28 text-cream"
    >
      {/* Background blur layers (unchanged) */}
      <div className="absolute -inset-1 bg-clay/10 blur-[120px] pointer-events-none" />
      <div className="absolute -inset-1/2 top-1/2 h-full w-[200%] bg-clay/10 blur-[100px] rotate-12 pointer-events-none" />

      <div className="container-x relative">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:gap-16">
          {/* Comparison card – unchanged from ProductShowcase */}
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-[0_30px_80px_-40px_rgba(0,0,0,0.8)]">
            {/* Card header (kept static for demo) */}
            <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-3.5">
              <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-cream/60">
                <span className="h-1.5 w-1.5 rounded-full bg-clay" />
                A closer look
              </span>
              {/* Category tabs remain here – they are rendered in the parent component */}
            </div>
            {/* Comparison area – slot for the before/after slider */}
            <div className="relative aspect-[0.92] w-full">
              <slot name="slider" />
            </div>
          </div>

          {/* Dynamic content */}
          <div className="max-w-md lg:ml-auto">
            <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-cream/50">
              <span className="h-1.5 w-1.5 rounded-full bg-clay" /> Product preview
            </p>
            <h2 className="mt-5 font-display text-4xl leading-[1.08] text-cream sm:text-5xl">
              {slide.heading.text}
              <br />
              <span className="text-clay italic">{slide.heading.highlight}</span>
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-cream/60 sm:text-base">
              {slide.description}
            </p>
            <ul className="mt-8 space-y-5">
              {slide.features.map((feature) => (
                <li key={feature} className="flex items-start gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] text-cream/70">
                    •
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold text-cream">{feature}</h3>
                  </div>
                </li>
              ))}
            </ul>
            <a
              href={slide.ctaHref}
              className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.03] px-6 py-2.5 text-sm font-semibold text-cream transition hover:border-white/40 hover:bg-white/10"
            >
              {slide.ctaLabel} <svg className="inline" viewBox="0 0 24 24" width={15} height={15}><path fill="currentColor" d="M12 4l1.41 1.41L8.83 10H20v2H8.83l4.58 4.59L12 18l-8-8z"/></svg>
            </a>

            {/* Vertical navigation – the part the tests look for */}
            <nav className="mt-12 flex flex-col gap-2">
              {SHOWCASE_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  role="button"
                  aria-pressed={currentSlide === idx}
                  data-testid={`slide-nav-button-${idx + 1}`}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition duration-200",
                    currentSlide === idx
                      ? "border-clay bg-clay/15 text-clay"
                      : "border-transparent text-cream/50 hover:bg-white/5 hover:text-cream/80"
                  )}
                  onClick={() => setCurrentSlide(idx)}
                >
                  Go to slide {idx + 1}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </section>
  );
}

