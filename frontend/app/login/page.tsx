"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { Alert, Button } from "@/components/ui";

function LoginContent() {
  const router = useRouter();
  const search = useSearchParams();
  const { login, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const next = search.get("next");
  const destination = next && next.startsWith("/") ? next : "/account";

  useEffect(() => {
    if (user) router.replace(destination);
  }, [user, router, destination]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email.trim(), password);
      router.push(destination);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-x grid min-h-[70vh] items-center gap-12 py-12 lg:grid-cols-2">
      <div className="mx-auto w-full max-w-md">
        <p className="eyebrow">Welcome back</p>
        <h1 className="mt-2 font-display text-4xl">Your studio awaits.</h1>
        <p className="mt-3 text-sm text-muted">Sign in to save designs, check out and track your orders.</p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          {error && <Alert>{error}</Alert>}
          <label className="block">
            <span className="label">Email</span>
            <input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field" placeholder="you@example.com" />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className="field" placeholder="••••••••" />
          </label>
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Sign in <ArrowRight size={16} />
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          New to MerchPress?{" "}
          <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-clay underline">
            Create an account
          </Link>
        </p>
        <div className="mt-8 rounded-2xl bg-sand/70 p-4 text-xs leading-relaxed text-muted">
          <p className="font-semibold text-ink">Demo store</p>
          <p className="mt-1">Use the seeded demo customer from the backend setup, or create a fresh account. No real payments are taken.</p>
        </div>
      </div>

      <div className="hidden overflow-hidden rounded-[2.5rem] bg-ink p-10 text-cream lg:block">
        <h2 className="mt-6 font-display text-4xl leading-tight">Make it once.<br />Wear it forever.</h2>
        <p className="mt-5 max-w-sm text-sm leading-relaxed text-cream/60">
          Your saved designs live in your studio account, ready to reorder, remix or share. Every order keeps its
          original print files.
        </p>
        <div className="mt-12 grid grid-cols-2 gap-3">
          {["Live editor", "Saved versions", "Print-ready files", "Order tracking"].map((item) => (
            <div key={item} className="rounded-xl bg-white/5 px-4 py-3 text-xs text-cream/70">{item}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="container-x py-20 text-center text-sm text-muted">Loading…</div>}>
      <LoginContent />
    </Suspense>
  );
}
