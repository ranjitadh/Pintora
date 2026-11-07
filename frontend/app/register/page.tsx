"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { errorMessage } from "@/lib/api";
import { Alert, Button } from "@/components/ui";

function RegisterContent() {
  const router = useRouter();
  const search = useSearchParams();
  const { register, user } = useAuth();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "", password_confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const next = search.get("next");
  const destination = next && next.startsWith("/") ? next : "/account";

  useEffect(() => {
    if (user) router.replace(destination);
  }, [user, router, destination]);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    if (form.password !== form.password_confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await register({ ...form, email: form.email.trim() });
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
        <p className="eyebrow">Join the studio</p>
        <h1 className="mt-2 font-display text-4xl">Create your account.</h1>
        <p className="mt-3 text-sm text-muted">Save every design, keep versions and make reordering a breeze.</p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          {error && <Alert>{error}</Alert>}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="label">First name</span>
              <input required value={form.first_name} onChange={(event) => update("first_name", event.target.value)} className="field" />
            </label>
            <label className="block">
              <span className="label">Last name</span>
              <input required value={form.last_name} onChange={(event) => update("last_name", event.target.value)} className="field" />
            </label>
          </div>
          <label className="block">
            <span className="label">Email</span>
            <input type="email" required autoComplete="email" value={form.email} onChange={(event) => update("email", event.target.value)} className="field" placeholder="you@example.com" />
          </label>
          <label className="block">
            <span className="label">Password</span>
            <input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={(event) => update("password", event.target.value)} className="field" placeholder="At least 8 characters" />
          </label>
          <label className="block">
            <span className="label">Confirm password</span>
            <input type="password" required autoComplete="new-password" value={form.password_confirm} onChange={(event) => update("password_confirm", event.target.value)} className="field" />
          </label>
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Create account <ArrowRight size={16} />
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-clay underline">
            Sign in
          </Link>
        </p>
      </div>

      <div className="hidden overflow-hidden rounded-[2.5rem] bg-clay p-10 text-white lg:block">
        <Sparkles />
        <h2 className="mt-6 font-display text-4xl leading-tight">Your ideas,<br />kept safe.</h2>
        <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/70">
          Every canvas version, uploaded asset and print file stays attached to your account. Come back and remix any
          time.
        </p>
        <div className="mt-12 space-y-3">
          {["Unlimited saved designs", "Version history & restore", "Re-order previous pieces"].map((item) => (
            <div key={item} className="rounded-xl bg-white/10 px-4 py-3 text-xs text-white/80">{item}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="container-x py-20 text-center text-sm text-muted">Loading…</div>}>
      <RegisterContent />
    </Suspense>
  );
}
