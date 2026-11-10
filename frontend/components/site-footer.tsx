import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-ink/10 bg-sand/50">
      <div className="container-x grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="max-w-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-clay text-white">
            </span>
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
            <li>Free shipping over $75</li>
            <li>300 DPI production files</li>
            <li>Secure checkout</li>
            <li>Demo storefront — no real charges</li>
          </ul>
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
