import { LinkButton } from "@/components/ui";

export default function ProductNotFound() {
  return (
    <div className="container-x py-24 text-center">
      <p className="eyebrow">404 · product not found</p>
      <h1 className="mt-3 font-display text-4xl leading-tight sm:text-5xl">This piece isn&apos;t in the collection.</h1>
      <p className="mt-3 text-sm text-muted">It may have sold out, or the link may be out of date.</p>
      <LinkButton href="/shop" className="mt-7">Browse the shop</LinkButton>
    </div>
  );
}
