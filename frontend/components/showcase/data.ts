export interface ShowcaseCategory {
  key: string;
  label: string;
  productSlug: string;
  mockupPath: string;
  flatPath: string;
  slideIndex: number;
}

export interface ColorSwatch {
  name: string;
  hex: string;
}

export interface ShowcaseSlideHeading {
  text: string;
  highlight: string;
}

export interface ShowcaseSlide {
  index: number;
  badge: string;
  heading: ShowcaseSlideHeading;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaHref: string;
}

export const SHOWCASE_CATEGORIES: ShowcaseCategory[] = [
  { key: "tshirt", label: "T-shirt", productSlug: "classic-tee", mockupPath: "/media/mockups/classic-tee-front.png", flatPath: "/media/products/classic-tee.png", slideIndex: 0 },
  { key: "mug", label: "Mug", productSlug: "ceramic-mug", mockupPath: "/media/mockups/ceramic-mug-wrap.png", flatPath: "/media/products/ceramic-mug.png", slideIndex: 1 },
  { key: "bag", label: "Bag", productSlug: "canvas-tote", mockupPath: "/media/mockups/canvas-tote-front.png", flatPath: "/media/products/canvas-tote.png", slideIndex: 2 },
  { key: "phone-case", label: "Phone case", productSlug: "phone-case", mockupPath: "/media/mockups/phone-case-back.png", flatPath: "/media/products/phone-case.png", slideIndex: 3 },
  { key: "card", label: "Card", productSlug: "art-poster", mockupPath: "/media/mockups/art-poster-print.png", flatPath: "/media/products/art-poster.png", slideIndex: 0 },
];

export const SHOWCASE_SLIDES: ShowcaseSlide[] = [
  {
    index: 0,
    badge: "PRODUCT PREVIEW",
    heading: { text: "Your design.", highlight: "Part of the product." },
    description: "See how artwork looks on the product, with surface detail, light and shadow bringing the preview to life.",
    features: ["Beyond flat artwork.", "A feel for the material.", "Explore different products."],
    ctaLabel: "Try the demo",
    ctaHref: "/shop",
  },
  {
    index: 1,
    badge: "PRODUCT PREVIEW",
    heading: { text: "Your creativity.", highlight: "Without limits." },
    description: "Create personalized products using a powerful visual design editor.",
    features: ["Add text and graphics.", "Upload your own images.", "Customize every detail."],
    ctaLabel: "Try the demo",
    ctaHref: "/editor/ceramic-mug",
  },
  {
    index: 2,
    badge: "PRODUCT PREVIEW",
    heading: { text: "Every product.", highlight: "Your imagination." },
    description: "Turn ordinary products into personalized creations.",
    features: ["Multiple product categories.", "Flexible print areas.", "Multiple variants and printing methods."],
    ctaLabel: "Try the demo",
    ctaHref: "/shop",
  },
  {
    index: 3,
    badge: "PRODUCT PREVIEW",
    heading: { text: "From design to", highlight: "production." },
    description: "Prepare your designs for professional printing and order fulfillment.",
    features: ["Print-ready exports.", "High-quality output.", "Organized order management."],
    ctaLabel: "Try the demo",
    ctaHref: "/designs",
  },
];

export const SHOWCASE_COLORS: Record<string, ColorSwatch[]> = {
  tshirt: [
    { name: "Ink Black", hex: "#211b16" },
    { name: "Cream", hex: "#fbf7ef" },
    { name: "Clay", hex: "#d95d39" },
    { name: "Navy", hex: "#062334" },
    { name: "Olive", hex: "#65714c" },
  ],
  mug: [
    { name: "Porcelain White", hex: "#fbf7ef" },
    { name: "Navy", hex: "#062334" },
    { name: "Clay", hex: "#d95d39" },
    { name: "Olive", hex: "#65714c" },
  ],
  bag: [
    { name: "Natural", hex: "#efe7d9" },
    { name: "Ink Black", hex: "#211b16" },
    { name: "Clay", hex: "#d95d39" },
  ],
  "phone-case": [
    { name: "Clear", hex: "#efe7d9" },
    { name: "Ink Black", hex: "#211b16" },
    { name: "Navy", hex: "#062334" },
    { name: "Clay", hex: "#d95d39" },
  ],
  card: [
    { name: "Cream", hex: "#fbf7ef" },
    { name: "Ink Black", hex: "#211b16" },
    { name: "Clay", hex: "#d95d39" },
  ],
};
