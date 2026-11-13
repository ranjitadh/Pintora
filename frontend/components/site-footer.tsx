import Image from "next/image";
import Link from "next/link";
import { FreeShippingNote } from "@/components/free-shipping-note";
import { NewsletterForm } from "@/components/newsletter-form";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-ink/10 bg-sand/50">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.svg" alt="MerchPress" width={36} height={36} className="rounded-full bg-clay" />
            <span className="font-display text-2xl">MerchPress</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Design it. Customize it. Make it yours. Studio-quality custom products, printed and shipped from our
            workshop.
          </p>
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.22em] text-clay">Made to be yours</p>
        </div>
        <div>
          <h4 className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Shop</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/shop" className="hover:text-clay">All products</Link></li>
            <li><Link href="/shop?category=apparel" className="hover:text-clay">Apparel</Link></li>
            <li><Link href="/shop?category=drinkware" className="hover:text-clay">Drinkware</Link></li>
            <li><Link href="/templates" className="hover:text-clay">Design templates</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Studio</h4>
          <ul className="space-y-2.5 text-sm">
            <li><Link href="/#how-it-works" className="hover:text-clay">How it works</Link></li>
            <li><Link href="/designs" className="hover:text-clay">My designs</Link></li>
            <li><Link href="/orders" className="hover:text-clay">Order tracking</Link></li>
            <li><Link href="/account" className="hover:text-clay">Account</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-muted">Good to know</h4>
          <ul className="space-y-2.5 text-sm text-muted">
            <li><FreeShippingNote /></li>
            <li>300 DPI production files</li>
            <li>Secure checkout</li>
            <li>Demo storefront — no real charges</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink/10">
        <div className="container-x grid gap-6 py-10 md:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] md:items-center">
          <div>
            <h4 className="font-display text-2xl">Join the studio list.</h4>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
              New blanks, fresh templates and print tips, straight to your inbox.
            </p>
          </div>
          <NewsletterForm />
        </div>
      </div>
      <div className="border-t border-ink/10">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-5 text-xs text-muted sm:flex-row">
          <span>© {new Date().getFullYear()} MerchPress. All rights reserved.</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em]">Design · Print · Deliver</span>
        </div>
      </div>
    </footer>
  );
}
