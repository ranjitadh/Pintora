"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import type { NewsletterSubscription } from "@/lib/types";
import { cn } from "@/lib/utils";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setMessage("");
    try {
      const result = await api.post<NewsletterSubscription>("/newsletter/subscribe/", {
        email,
        source: "footer",
      });
      setStatus("success");
      setMessage(result.detail);
      setEmail("");
    } catch (error) {
      setStatus("error");
      setMessage(errorMessage(error));
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full" data-testid="newsletter-form">
      <label htmlFor="footer-newsletter-email" className="sr-only">
        Email address
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="footer-newsletter-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status === "success" || status === "error") {
              setStatus("idle");
              setMessage("");
            }
          }}
          placeholder="you@studio.com"
          disabled={status === "loading"}
          aria-invalid={status === "error"}
          aria-describedby="footer-newsletter-note"
          className="h-12 w-full rounded-full border border-ink/15 bg-white px-5 text-sm text-ink placeholder:text-ink/35 outline-none transition focus:border-clay focus:ring-2 focus:ring-clay/20 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-clay px-6 text-sm font-bold text-white transition hover:bg-clay-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-clay/40 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {status === "loading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Joining
            </>
          ) : (
            <>
              Join the list <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
      <p id="footer-newsletter-note" className="mt-3 text-xs leading-relaxed text-muted">
        Studio drops, fresh templates and print tips. No spam — unsubscribe anytime.
      </p>
      <div aria-live="polite" className={cn("mt-3", !message && "hidden")}>
        {status === "success" && (
          <p role="status" className="flex items-start gap-2 text-xs font-medium text-emerald-700">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" /> {message}
          </p>
        )}
        {status === "error" && (
          <p role="alert" className="flex items-start gap-2 text-xs font-medium text-rose-600">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {message}
          </p>
        )}
      </div>
    </form>
  );
}
