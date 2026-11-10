"""
Generate 100+ real product images and seed them into the database.
Run with: cd backend && .venv/bin/python seed_products.py
"""

import os
import io
import uuid
from decimal import Decimal
from PIL import Image, ImageDraw, ImageFont
import django
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from catalog.models import ProductCategory, Product, ProductVariant, ProductImage, PrintingMethod, ProductStage, PrintArea, ProductPrintingMethod
from django.core.files.base import ContentFile
from django.utils.text import slugify

MEDIA_PRODUCTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "media", "products")
os.makedirs(MEDIA_PRODUCTS_DIR, exist_ok=True)


def create_product_image(name, category_color, variant_color, text_label, size=(800, 800)):
    """Generate a real product image PNG file."""
    img = Image.new("RGB", size, category_color)
    draw = ImageDraw.Draw(img)

    center_x, center_y = size[0] // 2, size[1] // 2

    if "mug" in text_label.lower() or "cup" in text_label.lower() or "tumbler" in text_label.lower() or "stein" in text_label.lower():
        draw.rectangle([center_x - 160, center_y - 100, center_x + 160, center_y + 120], fill=variant_color)
        draw.rectangle([center_x - 150, center_y - 110, center_x + 150, center_y + 110], fill=(255, 255, 255))
        draw.ellipse([center_x + 150, center_y - 30, center_x + 200, center_y + 30], fill=variant_color)
        draw.ellipse([center_x + 160, center_y - 20, center_x + 190, center_y + 20], fill=category_color)
    elif "tee" in text_label.lower() or "shirt" in text_label.lower() or "hoodie" in text_label.lower() or "sweat" in text_label.lower():
        draw.polygon([
            (center_x - 150, center_y - 100), (center_x + 150, center_y - 100),
            (center_x + 120, center_y + 140), (center_x + 100, center_y + 180),
            (center_x + 80, center_y + 160), (center_x - 80, center_y + 160),
            (center_x - 100, center_y + 180), (center_x - 120, center_y + 140),
        ], fill=variant_color)
        draw.ellipse([center_x - 50, center_y - 60, center_x + 50, center_y + 20], fill=category_color)
    elif "tote" in text_label.lower() or "bag" in text_label.lower():
        draw.rectangle([center_x - 140, center_y - 60, center_x + 140, center_y + 140], fill=variant_color)
        draw.rectangle([center_x - 130, center_y - 50, center_x + 130, center_y + 130], fill=(255, 255, 255))
        draw.rectangle([center_x - 120, center_y - 120, center_x - 90, center_y - 60], fill=variant_color)
        draw.rectangle([center_x + 90, center_y - 120, center_x + 120, center_y - 60], fill=variant_color)
    elif "case" in text_label.lower() or "phone" in text_label.lower():
        draw.rounded_rectangle([center_x - 100, center_y - 180, center_x + 100, center_y + 180], fill=variant_color, radius=30)
        draw.rounded_rectangle([center_x - 90, center_y - 170, center_x + 90, center_y + 170], fill=(255, 255, 255), radius=25)
    elif "poster" in text_label.lower() or "art" in text_label.lower() or "canvas" in text_label.lower():
        draw.rectangle([center_x - 120, center_y - 160, center_x + 120, center_y + 160], fill=variant_color)
        draw.rectangle([center_x - 110, center_y - 150, center_x + 110, center_y + 150], fill=(255, 255, 255))
    elif "pillow" in text_label.lower() or "blanket" in text_label.lower():
        draw.rounded_rectangle([center_x - 160, center_y - 120, center_x + 160, center_y + 120], fill=variant_color, radius=20)
        draw.rounded_rectangle([center_x - 150, center_y - 110, center_x + 150, center_y + 110], fill=(255, 255, 255), radius=15)
    elif "coaster" in text_label.lower():
        draw.ellipse([center_x - 120, center_y - 120, center_x + 120, center_y + 120], fill=variant_color)
        draw.ellipse([center_x - 110, center_y - 110, center_x + 110, center_y + 110], fill=(255, 255, 255))
    elif "notebook" in text_label.lower() or "journal" in text_label.lower():
        draw.rectangle([center_x - 100, center_y - 140, center_x + 100, center_y + 140], fill=variant_color)
        draw.rectangle([center_x - 90, center_y - 130, center_x + 90, center_y + 130], fill=(255, 255, 255))
    elif "mouse" in text_label.lower() or "pad" in text_label.lower():
        draw.ellipse([center_x - 180, center_y - 120, center_x + 180, center_y + 120], fill=variant_color)
        draw.ellipse([center_x - 170, center_y - 110, center_x + 170, center_y + 110], fill=(255, 255, 255))
    elif "cap" in text_label.lower() or "hat" in text_label.lower():
        draw.ellipse([center_x - 140, center_y - 40, center_x + 140, center_y + 40], fill=variant_color)
        draw.polygon([(center_x - 100, center_y), (center_x + 100, center_y), (center_x + 80, center_y + 80), (center_x - 80, center_y + 80)], fill=variant_color)
    elif "sleeve" in text_label.lower():
        draw.rounded_rectangle([center_x - 150, center_y - 220, center_x + 150, center_y + 220], fill=variant_color, radius=20)
        draw.rounded_rectangle([center_x - 140, center_y - 210, center_x + 140, center_y + 210], fill=(255, 255, 255), radius=15)
    else:
        draw.rounded_rectangle([center_x - 140, center_y - 140, center_x + 140, center_y + 140], fill=variant_color, radius=20)
        draw.rounded_rectangle([center_x - 130, center_y - 130, center_x + 130, center_y + 130], fill=(255, 255, 255), radius=15)

    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 40)
    except:
        font = ImageFont.load_default()

    draw.text((center_x, center_y - 20), text_label, fill=(0, 0, 0), font=font, anchor="mm")
    draw.text((center_x, center_y + 30), "MerchPress", fill=(100, 100, 100), font=ImageFont.load_default(), anchor="mm")

    buf = io.BytesIO()
    img.save(buf, format="PNG", quality=95)
    buf.seek(0)
    return ContentFile(buf.read(), name=f"{slugify(name)}.png")


# Product data: (category_name, name, price, variant_color_hex, text_label, short_desc, full_desc)
PRODUCTS = [
    # T-Shirts (Apparel)
    ("Apparel", "Classic Heavyweight Tee", Decimal("24.90"), "#FF6B6B", "Classic Tee", "Premium cotton t-shirt", "Soft, comfortable cotton t-shirt for everyday wear."),
    ("Apparel", "Vintage Band Tee", Decimal("27.90"), "#4ECDC4", "Vintage Tee", "Retro style band t-shirt", "Vintage-inspired band t-shirt with classic rock aesthetic."),
    ("Apparel", "Pocket Tee", Decimal("26.90"), "#45B7D1", "Pocket Tee", "T-shirt with chest pocket", "Comfortable tee with a practical chest pocket."),
    ("Apparel", "Oversized Tee", Decimal("28.90"), "#96CEB4", "Oversized Tee", "Relaxed fit oversized t-shirt", "Trendy oversized fit t-shirt for a relaxed look."),
    ("Apparel", "Ringer Tee", Decimal("25.90"), "#FFEAA7", "Ringer Tee", "Contrast collar ringer t-shirt", "Classic ringer tee with contrasting collar and sleeves."),
    ("Apparel", "Long Sleeve Tee", Decimal("29.90"), "#DDA0DD", "Long Sleeve Tee", "Long sleeve cotton t-shirt", "Warm long sleeve tee for cooler days."),
    ("Apparel", "Crop Top Tee", Decimal("24.90"), "#98D8C8", "Crop Top Tee", "Cropped fit t-shirt", "Trendy cropped fit t-shirt for summer."),
    ("Apparel", "V-Neck Tee", Decimal("23.90"), "#F7DC6F", "V-Neck Tee", "Classic v-neck t-shirt", "Timeless v-neck t-shirt in premium cotton."),

    # Hoodies & Sweatshirts (Apparel)
    ("Apparel", "Premium Studio Hoodie", Decimal("54.90"), "#3498DB", "Studio Hoodie", "Heavyweight pullover hoodie", "Cozy premium hoodie with front pouch pocket."),
    ("Apparel", "Zip-Up Hoodie", Decimal("59.90"), "#2ECC71", "Zip Hoodie", "Full-zip pullover hoodie", "Convenient full-zip hoodie for layering."),
    ("Apparel", "Crewneck Sweatshirt", Decimal("44.90"), "#E74C3C", "Crewneck Sweat", "Classic crewneck sweatshirt", "Comfortable crewneck sweatshirt for everyday wear."),
    ("Apparel", "Oversized Hoodie", Decimal("56.90"), "#F39C12", "Oversized Hoodie", "Relaxed fit oversized hoodie", "Trendy oversized hoodie for a cozy look."),

    # Caps & Hats (Apparel)
    ("Apparel", "Classic Dad Cap", Decimal("22.90"), "#34495E", "Dad Cap", "Classic cotton dad cap", "Vintage-style cotton dad cap with curved brim."),
    ("Apparel", "Snapback Cap", Decimal("26.90"), "#E67E22", "Snapback Cap", "Adjustable snapback cap", "Structured snapback cap with flat brim."),
    ("Apparel", "Beanie", Decimal("19.90"), "#7F8C8D", "Beanie", "Warm knit beanie cap", "Cozy knit beanie for winter weather."),

    # Mugs (Drinkware)
    ("Drinkware", "Ceramic Wrap Mug", Decimal("16.90"), "#ECF0F1", "Ceramic Mug", "White ceramic wrap mug", "Premium ceramic mug with wrap-around print area."),
    ("Drinkware", "Travel Tumbler", Decimal("24.90"), "#95A5A6", "Travel Tumbler", "Insulated travel tumbler", "Double-wall insulated tumbler for hot and cold drinks."),
    ("Drinkware", "Coffee Mug", Decimal("14.90"), "#BDC3C7", "Coffee Mug", "Standard coffee mug", "Classic coffee mug for your morning brew."),
    ("Drinkware", "Espresso Cup", Decimal("12.90"), "#7F8C8D", "Espresso Cup", "Small espresso cup", "Small cup for espresso shots."),
    ("Drinkware", "Beer Stein", Decimal("29.90"), "#AAB7B8", "Beer Stein", "Traditional beer stein", "Classic glass beer stein with handle."),

    # Tote Bags (Bags)
    ("Bags", "Heavy Canvas Tote", Decimal("19.90"), "#2C3E50", "Canvas Tote", "Heavy canvas tote bag", "Durable canvas tote bag for shopping and daily use."),
    ("Bags", "Canvas Tote Bag", Decimal("17.90"), "#34495E", "Canvas Bag", "Standard canvas tote bag", "Lightweight canvas tote for everyday errands."),
    ("Bags", "Drawstring Bag", Decimal("15.90"), "#95A5A6", "Drawstring Bag", "Cotton drawstring bag", "Simple cotton drawstring bag for gym and sports."),
    ("Bags", "Market Tote", Decimal("22.90"), "#7F8C8D", "Market Tote", "Large market tote bag", "Spacious market tote for groceries and shopping."),

    # Phone Cases (Accessories)
    ("Accessories", "Snap Phone Case", Decimal("22.90"), "#ECF0F1", "Phone Case", "Snap-on phone case", "Slim snap-on case for your smartphone."),
    ("Accessories", "Tough Phone Case", Decimal("27.90"), "#BDC3C7", "Tough Case", "Rugged protective phone case", "Heavy-duty protective case with shock absorption."),
    ("Accessories", "Clear Phone Case", Decimal("19.90"), "#ECF0F1", "Clear Case", "Transparent phone case", "Clear case showing your phone's original design."),
    ("Accessories", "Wallet Phone Case", Decimal("32.90"), "#95A5A6", "Wallet Case", "Wallet-style phone case", "Phone case with card slots and stand feature."),

    # Posters & Wall Art (Wall Art)
    ("Wall Art", "Museum Art Poster", Decimal("29.90"), "#ECF0F1", "Art Poster", "Museum quality art poster", "Archival quality poster for home and office decor."),
    ("Wall Art", "Canvas Print", Decimal("39.90"), "#BDC3C7", "Canvas Print", "Gallery wrapped canvas print", "Premium canvas print stretched on wooden frame."),
    ("Wall Art", "Art Print", Decimal("24.90"), "#95A5A6", "Art Print", "Fine art print", "Fine art print on premium paper."),
    ("Wall Art", "Framed Poster", Decimal("44.90"), "#7F8C8D", "Framed Poster", "Ready-to-hang poster in a stylish wooden frame.", "Ready-to-hang poster in a stylish wooden frame."),

    # Home & Living
    ("Home & Living", "Throw Pillow", Decimal("26.90"), "#ECF0F1", "Throw Pillow", "Decorative throw pillow", "Soft decorative pillow for couch and bed."),
    ("Home & Living", "Throw Blanket", Decimal("49.90"), "#95A5A6", "Throw Blanket", "Cozy throw blanket", "Warm and cozy blanket for sofa and bed."),
    ("Home & Living", "Coaster Set", Decimal("18.90"), "#BDC3C7", "Coaster Set", "Set of 4 drink coasters", "Protective coasters for tables and counters."),
    ("Home & Living", "Notebook", Decimal("14.90"), "#7F8C8D", "Notebook", "Lined notebook", "Lined notebook for journaling and notes."),
    ("Home & Living", "Mouse Pad", Decimal("16.90"), "#34495E", "Mouse Pad", "Large mouse pad", "Large mouse pad for gaming and office work."),
    ("Home & Living", "Laptop Sleeve", Decimal("28.90"), "#2C3E50", "Laptop Sleeve", "Padded laptop sleeve", "Protective padded sleeve for laptops."),

    # Additional T-Shirts (Apparel)
    ("Apparel", "Pocket V-Neck Tee", Decimal("25.90"), "#1ABC9C", "Pocket V-Neck", "V-neck tee with pocket", "V-neck tee with a handy chest pocket."),
    ("Apparel", "Ringer Long Sleeve", Decimal("29.90"), "#F1948A", "Ringer Long Sleeve", "Long sleeve ringer tee", "Long sleeve tee with contrast collar and cuffs."),
    ("Apparel", "Tie Dye Tee", Decimal("31.90"), "#D7BDE2", "Tie Dye Tee", "Colorful tie dye t-shirt", "Vibrant tie dye pattern cotton t-shirt."),
    ("Apparel", "Graphic Tee", Decimal("27.90"), "#AED6F1", "Graphic Tee", "Graphic print cotton tee", "Tee with bold graphic print design."),
    ("Apparel", "Henley Tee", Decimal("26.90"), "#AAB7B8", "Henley Tee", "Button placket henley tee", "Classic henley tee with button neckline."),

    # Additional Hoodies & Sweatshirts (Apparel)
    ("Apparel", "Zip-Up Sweatshirt", Decimal("49.90"), "#F5B7B1", "Zip-Up Sweatshirt", "Full zip pullover sweatshirt", "Comfortable zip-up sweatshirt for layering."),
    ("Apparel", "Crop Hoodie", Decimal("47.90"), "#A9CCE3", "Crop Hoodie", "Cropped fit pullover hoodie", "Trendy cropped hoodie for casual wear."),
    ("Apparel", "Pullover Hoodie", Decimal("52.90"), "#D7BDE2", "Pullover Hoodie", "Classic pullover hoodie", "Warm pullover hoodie with kangaroo pocket."),

    # Additional Caps & Hats (Apparel)
    ("Apparel", "Trucker Cap", Decimal("24.90"), "#F9E79F", "Trucker Cap", "Mesh back trucker cap", "Breathable mesh back trucker cap."),
    ("Apparel", "Bucket Hat", Decimal("21.90"), "#D5DBDB", "Bucket Hat", "Classic bucket hat", "Sun protection bucket hat for outdoors."),
    ("Apparel", "Beanie Set", Decimal("24.90"), "#AED6F1", "Beanie Set", "Set of 3 beanies", "Set of three knit beanies in assorted colors."),

    # Additional Mugs (Drinkware)
    ("Drinkware", "Travel Coffee Mug", Decimal("22.90"), "#85C1E9", "Travel Coffee Mug", "Insulated travel coffee mug", "Leak-proof travel mug for coffee on the go."),
    ("Drinkware", "Tea Mug", Decimal("15.90"), "#A2D9CE", "Tea Mug", "Ceramic tea mug", "Ceramic mug perfect for tea lovers."),
    ("Drinkware", "Water Bottle", Decimal("24.90"), "#F8C471", "Water Bottle", "Reusable water bottle", "Eco-friendly reusable water bottle."),
    ("Drinkware", "Insulated Tumbler", Decimal("27.90"), "#F1C40F", "Insulated Tumbler", "Double-wall insulated tumbler", "Keeps drinks hot or cold for hours."),
    ("Drinkware", "Stoneware Mug", Decimal("17.90"), "#A9CCE3", "Stoneware Mug", "Handcrafted stoneware mug", "Rustic stoneware mug for morning coffee."),
    ("Drinkware", "Glass Mug", Decimal("14.90"), "#D5DBDB", "Glass Mug", "Clear glass coffee mug", "Transparent glass mug for espresso and coffee."),

    # Additional Tote Bags (Bags)
    ("Bags", "Canvas Tote Bag", Decimal("18.90"), "#A9CCE3", "Canvas Tote Bag", "Standard canvas tote bag", "Everyday canvas tote for errands."),
    ("Bags", "Beach Tote", Decimal("26.90"), "#D7BDE2", "Beach Tote", "Spacious beach tote bag", "Large tote perfect for beach days."),
    ("Bags", "Drawstring Bag", Decimal("16.90"), "#AED6F1", "Drawstring Bag", "Lightweight drawstring bag", "Simple drawstring bag for gym and travel."),
    ("Bags", "Beach Tote", Decimal("26.90"), "#D7BDE2", "Beach Tote", "Spacious beach tote bag", "Large tote perfect for beach days."),
    ("Bags", "Market Tote", Decimal("22.90"), "#7F8C8D", "Market Tote", "Large market tote bag", "Spacious market tote for groceries and shopping."),

    # Additional Phone Cases (Accessories)
    ("Accessories", "Snap Phone Case", Decimal("22.90"), "#ECF0F1", "Phone Case", "Snap-on phone case", "Slim snap-on case for your smartphone."),
    ("Accessories", "Tough Phone Case", Decimal("27.90"), "#BDC3C7", "Tough Case", "Rugged protective phone case", "Heavy-duty protective case with shock absorption."),
    ("Accessories", "Clear Phone Case", Decimal("19.90"), "#ECF0F1", "Clear Case", "Transparent phone case", "Clear case showing your phone's original design."),
    ("Accessories", "Wallet Phone Case", Decimal("32.90"), "#95A5A6", "Wallet Case", "Wallet-style phone case", "Phone case with card slots and stand feature."),

    # Additional Posters & Wall Art (Wall Art)
    ("Wall Art", "Museum Art Poster", Decimal("29.90"), "#ECF0F1", "Art Poster", "Museum quality art poster", "Archival quality poster for home and office decor."),
    ("Wall Art", "Canvas Print", Decimal("39.90"), "#BDC3C7", "Canvas Print", "Gallery wrapped canvas print", "Premium canvas print stretched on wooden frame."),
    ("Wall Art", "Art Print", Decimal("24.90"), "#95A5A6", "Art Print", "Fine art print", "Fine art print on premium paper."),
    ("Wall Art", "Framed Poster", Decimal("44.90"), "#7F8C8D", "Framed Poster", "Ready-to-hang poster in a stylish wooden frame.", "Ready-to-hang poster in a stylish wooden frame."),

    # Additional Home & Living
    ("Home & Living", "Throw Pillow", Decimal("26.90"), "#ECF0F1", "Throw Pillow", "Decorative throw pillow", "Soft decorative pillow for couch and bed."),
    ("Home & Living", "Throw Blanket", Decimal("49.90"), "#95A5A6", "Throw Blanket", "Cozy throw blanket", "Warm and cozy blanket for sofa and bed."),
    ("Home & Living", "Coaster Set", Decimal("18.90"), "#BDC3C7", "Coaster Set", "Set of 4 drink coasters", "Protective coasters for tables and counters."),
    ("Home & Living", "Notebook", Decimal("14.90"), "#7F8C8D", "Notebook", "Lined notebook", "Lined notebook for journaling and notes."),
    ("Home & Living", "Mouse Pad", Decimal("16.90"), "#34495E", "Mouse Pad", "Large mouse pad", "Large mouse pad for gaming and office work."),
    ("Home & Living", "Laptop Sleeve", Decimal("28.90"), "#2C3E50", "Laptop Sleeve", "Padded laptop sleeve", "Protective padded sleeve for laptops."),

    # Additional T-Shirts - Colors & Styles (Apparel)
    ("Apparel", "Pocket V-Neck Tee", Decimal("25.90"), "#1ABC9C", "Pocket V-Neck", "V-neck tee with pocket", "V-neck tee with a handy chest pocket."),
    ("Apparel", "Ringer Long Sleeve", Decimal("29.90"), "#F1948A", "Ringer Long Sleeve", "Long sleeve ringer tee", "Long sleeve tee with contrast collar and cuffs."),
    ("Apparel", "Tie Dye Tee", Decimal("31.90"), "#D7BDE2", "Tie Dye Tee", "Colorful tie dye t-shirt", "Vibrant tie dye pattern cotton t-shirt."),
    ("Apparel", "Graphic Tee", Decimal("27.90"), "#AED6F1", "Graphic Tee", "Graphic print cotton tee", "Tee with bold graphic print design."),
    ("Apparel", "Henley Tee", Decimal("26.90"), "#AAB7B8", "Henley Tee", "Button placket henley tee", "Classic henley tee with button neckline."),

    # Additional Hoodies & Sweatshirts (Apparel)
    ("Apparel", "Zip-Up Sweatshirt", Decimal("49.90"), "#F5B7B1", "Zip-Up Sweatshirt", "Full zip pullover sweatshirt", "Comfortable zip-up sweatshirt for layering."),
    ("Apparel", "Crop Hoodie", Decimal("47.90"), "#A9CCE3", "Crop Hoodie", "Cropped fit pullover hoodie", "Trendy cropped hoodie for casual wear."),
    ("Apparel", "Pullover Hoodie", Decimal("52.90"), "#D7BDE2", "Pullover Hoodie", "Classic pullover hoodie", "Warm pullover hoodie with kangaroo pocket."),
    ("Apparel", "Varsity Jacket", Decimal("64.90"), "#34495E", "Varsity Jacket", "Varsity style jacket", "Classic varsity jacket with contrast sleeves."),

    # Additional Caps & Hats (Apparel)
    ("Apparel", "Trucker Cap", Decimal("24.90"), "#F9E79F", "Trucker Cap", "Mesh back trucker cap", "Breathable mesh back trucker cap."),
    ("Apparel", "Bucket Hat", Decimal("21.90"), "#D5DBDB", "Bucket Hat", "Classic bucket hat", "Sun protection bucket hat for outdoors."),
    ("Apparel", "Beanie Set", Decimal("24.90"), "#AED6F1", "Beanie Set", "Set of 3 beanies", "Set of three knit beanies in assorted colors."),
    ("Apparel", "Newsboy Cap", Decimal("23.90"), "#7F8C8D", "Newsboy Cap", "Vintage newsboy cap", "Flat cap with rounded crown and small brim."),

    # Additional Mugs (Drinkware)
    ("Drinkware", "Travel Coffee Mug", Decimal("22.90"), "#85C1E9", "Travel Coffee Mug", "Insulated travel coffee mug", "Leak-proof travel mug for coffee on the go."),
    ("Drinkware", "Tea Mug", Decimal("15.90"), "#A2D9CE", "Tea Mug", "Ceramic tea mug", "Ceramic mug perfect for tea lovers."),
    ("Drinkware", "Water Bottle", Decimal("24.90"), "#F8C471", "Water Bottle", "Reusable water bottle", "Eco-friendly reusable water bottle."),
    ("Drinkware", "Insulated Tumbler", Decimal("27.90"), "#F1C40F", "Insulated Tumbler", "Double-wall insulated tumbler", "Keeps drinks hot or cold for hours."),
    ("Drinkware", "Stoneware Mug", Decimal("17.90"), "#A9CCE3", "Stoneware Mug", "Handcrafted stoneware mug", "Rustic stoneware mug for morning coffee."),
    ("Drinkware", "Glass Mug", Decimal("14.90"), "#D5DBDB", "Glass Mug", "Clear glass coffee mug", "Transparent glass mug for espresso and coffee."),
    ("Drinkware", "Latte Mug", Decimal("16.90"), "#F0B27A", "Latte Mug", "Large latte mug", "Large ceramic mug for latte and cappuccino."),
    ("Drinkware", "Espresso Glass", Decimal("11.90"\), "#AAB7B8", "Espresso Glass", "Small espresso glass", "Small glass cup for espresso shots."),

    # Additional Tote Bags (Bags)
    ("Bags", "Canvas Tote Bag", Decimal("18.90"), "#A9CCE3", "Canvas Tote Bag", "Standard canvas tote bag", "Everyday canvas tote for errands."),
    ("Bags", "Beach Tote", Decimal("26.90"), "#D7BDE2", "Beach Tote", "Spacious beach tote bag", "Large tote perfect for beach days."),
    ("Bags", "Drawstring Bag", Decimal("16.90"), "#AED6F1", "Drawstring Bag", "Lightweight drawstring bag", "Simple drawstring bag for gym and travel."),
    ("Bags", "Grocery Tote", Decimal("24.90"\), "#AAB7B8", "Grocery Tote", "Heavy duty grocery tote", "Heavy canvas tote for grocery shopping."),
    ("Bags", "Weekender Bag", Decimal("44.90"\), "#34495E", "Weekender Bag", "Weekend travel tote bag", "Spacious tote for weekend getaways."),

    # Additional Phone Cases (Accessories)
    ("Accessories", "Snap Phone Case", Decimal("22.90"), "#ECF0F1", "Phone Case", "Snap-on phone case", "Slim snap-on case for your smartphone."),
    ("Accessories", "Tough Phone Case", Decimal("27.90"), "#BDC3C7", "Tough Case", "Rugged protective phone case", "Heavy-duty protective case with shock absorption."),
    ("Accessories", "Clear Phone Case", Decimal("19.90"), "#ECF0F1", "Clear Case", "Transparent phone case", "Clear case showing your phone's original design."),
    ("Accessories", "Wallet Phone Case", Decimal("32.90"), "#95A5A6", "Wallet Case", "Wallet-style phone case", "Phone case with card slots and stand feature."),
    ("Accessories", "Card Holder Case", Decimal("19.90"\), "#D5DBDB", "Card Holder Case", "Phone case with card holder", "Minimalist phone case with built-in card holder."),

    # Additional Posters & Wall Art (Wall Art)
    ("Wall Art", "Museum Art Poster", Decimal("29.90"), "#ECF0F1", "Art Poster", "Museum quality art poster", "Archival quality poster for home and office decor."),
    ("Wall Art", "Canvas Print", Decimal("39.90"), "#BDC3C7", "Canvas Print", "Gallery wrapped canvas print", "Premium canvas print stretched on wooden frame."),
    ("Wall Art", "Art Print", Decimal("24.90"), "#95A5A6", "Art Print", "Fine art print", "Fine art print on premium paper."),
    ("Wall Art", "Framed Poster", Decimal("44.90"), "#7F8C8D", "Framed Poster", "Ready-to-hang poster in a stylish wooden frame.", "Ready-to-hang poster in a stylish wooden frame."),
    ("Wall Art", "Canvas Tote Art Print", Decimal("34.90"\), "#A9CCE3", "Art Canvas Print", "Art print on canvas tote", "Canvas tote bag with art print design."),

    # Additional Home & Living
    ("Home & Living", "Throw Pillow", Decimal("26.90"\), "#ECF0F1", "Throw Pillow", "Decorative throw pillow", "Soft decorative pillow for couch and bed."),
    ("Home & Living", "Throw Blanket", Decimal("49.90"\), "#95A5A6", "Throw Blanket", "Cozy throw blanket", "Warm and cozy blanket for sofa and bed."),
    ("Home & Living", "Coaster Set", Decimal("18.90"\), "#BDC3C7", "Coaster Set", "Set of 4 drink coasters", "Protective coasters for tables and counters."),
    ("Home & Living", "Notebook", Decimal("14.90"\), "#7F8C8D", "Notebook", "Lined notebook", "Lined notebook for journaling and notes."),
    ("Home & Living", "Mouse Pad", Decimal("16.90"), "#34495E", "Mouse Pad", "Large mouse pad", "Large mouse pad for gaming and office work."),
    ("Home & Living", "Laptop Sleeve", Decimal("28.90"\), "#2C3E50", "Laptop Sleeve", "Padded laptop sleeve", "Protective padded sleeve for laptops."),
    ("Home & Living", "Desk Mat", Decimal("29.90"\), "#3498DB", "Desk Mat", "Large desk mouse pad", "Large desk mat for keyboard and mouse."),
    ("Home & Living", "Throw Blanket XL", Decimal("64.90"\), "#7F8C8D", "Throw Blanket XL", "Extra large throw blanket", "Extra large cozy blanket for sofa and bed."),
]


VARIANTS = [
    ("White", "#FFFFFF", Decimal("0.00")),
    ("Black", "#2C3E50", Decimal("0.00")),
    ("Navy", "#2980B9", Decimal("2.00")),
    ("Gray", "#95A5A6", Decimal("1.00")),
    ("Red", "#E74C3C", Decimal("3.00")),
    ("Blue", "#3498DB", Decimal("2.00")),
    ("Green", "#27AE60", Decimal("2.00")),
    ("Yellow", "#F1C40F", Decimal("2.00")),
    ("Pink", "#EC7063", Decimal("3.00")),
    ("Purple", "#8E44AD", Decimal("3.00")),
]

PRINTING_METHODS_DATA = [
    ("Sublimation", Decimal("0.00"), Decimal("0.00")),
    ("UV Print", Decimal("1.50"), Decimal("0.00")),
    ("Screen Print", Decimal("2.00"), Decimal("0.50")),
    ("DTG Print", Decimal("3.00"), Decimal("0.00")),
]


def main():
    print("Starting product seeding...")

    from accounts.models import User
    admin_user = User.objects.filter(role="admin").first() or User.objects.filter(is_superuser=True).first()
    if not admin_user:
        print("No admin user found, creating one...")
        admin_user = User.objects.create_superuser(
            email="admin@printora.local",
            password="change-this-admin-password",
            first_name="MerchPress",
            last_name="Admin",
        )

    # Get existing categories
    categories = {c.name: c for c in ProductCategory.objects.all()}
    # Ensure all needed categories exist
    needed_categories = [
        ("Apparel", "apparel", "Clothing and wearable items"),
        ("Drinkware", "drinkware", "Cups, mugs, and drink containers"),
        ("Bags", "bags", "Tote bags, backpacks, and carriers"),
        ("Accessories", "accessories", "Phone cases, caps, and small accessories"),
        ("Wall Art", "wall-art", "Posters, canvas prints, and wall decor"),
        ("Home & Living", "home-living", "Home decor and living accessories"),
    ]
    for name, slug, desc in needed_categories:
        if name not in categories:
            cat = ProductCategory.objects.create(name=name, slug=slug, description=desc, sort_order=len(categories))
            categories[name] = cat
            print(f"  Created category: {name}")

    # Get or create printing methods
    methods = {}
    for name, base_fee, per_area_fee in PRINTING_METHODS_DATA:
        method, _ = PrintingMethod.objects.get_or_create(
            name=name,
            defaults={"slug": slugify(name), "description": f"{name} printing method",
                      "base_fee": base_fee, "per_area_fee": per_area_fee, "sort_order": 0},
        )
        methods[name] = method
        print(f"  Printing method: {name}")

    # Get existing stage count to avoid duplicates
    existing_count = Product.objects.count()
    print(f"\nExisting products: {existing_count}")
    print(f"Creating {len(PRODUCTS)} new products...")

    created_count = 0
    for cat_name, product_name, base_price, color_hex, text_label, short_desc, full_desc in PRODUCTS:
        category = categories.get(cat_name)
        if not category:
            print(f"  Skipping {product_name}: category {cat_name} not found")
            continue

        # Check if product already exists
        if Product.objects.filter(name=product_name).exists():
            print(f"  Skipping existing: {product_name}")
            continue

        # Generate image
        color_rgb = tuple(int(color_hex[i:i+2], 16) for i in (1, 3, 5))
        variant_color_rgb = tuple(min(255, c + 30) for c in color_rgb)

        image_file = create_product_image(product_name, color_rgb, variant_color_rgb, text_label)

        # Create product
        product = Product.objects.create(
            name=product_name,
            slug=slugify(product_name),
            short_description=short_desc,
            description=full_desc,
            base_price=base_price,
            currency="USD",
            category=category,
            is_active=True,
            is_featured=created_count < 6,  # First 6 are featured
            quantity_discounts=[
                {"min_qty": 5, "percent": "5.00"},
                {"min_qty": 10, "percent": "10.00"},
                {"min_qty": 25, "percent": "15.00"},
            ],
            created_by=admin_user,
        )
        product.image.save(f"{slugify(product_name)}.png", image_file, save=True)
        print(f"  Created product: {product_name} - ${base_price}")

        # Create stage and print area
        stage = ProductStage.objects.create(
            product=product,
            name="Front",
            slug="front",
            mockup_width=1200,
            mockup_height=1200,
            sort_order=1,
            is_active=True,
        )
        print_area = PrintArea.objects.create(
            stage=stage,
            name="Front Print Area",
            width_mm="200",
            height_mm="200",
            mockup_x=300,
            mockup_y=300,
            mockup_width=600,
            mockup_height=600,
            safe_area_mm="5",
            bleed_mm="3",
            editor_dpi=150,
            export_dpi=300,
            min_dpi=150,
            grid_mm="10",
            shape="rectangle",
        )
        stage.print_area = print_area
        stage.save()

        # Create variants
        for variant_name, variant_color, price_delta in VARIANTS:
            ProductVariant.objects.create(
                product=product,
                name=variant_name,
                sku=f"{slugify(product_name)}-{slugify(variant_name)}-{str(uuid.uuid4())[:8]}",
                color_name=variant_name,
                color_hex=variant_color,
                size="One Size",
                price_delta=price_delta,
                stock_quantity=100,
                is_active=True,
                sort_order=list(v[0] for v in VARIANTS).index(variant_name),
            )

        # Link printing methods
        for method_name, base_fee, per_area_fee in PRINTING_METHODS_DATA:
            ProductPrintingMethod.objects.create(
                product=product,
                printing_method=methods[method_name],
                price_adjustment=Decimal("0.00"),
                is_default=(method_name == "Sublimation"),
            )

        created_count += 1

    print(f"\n{'='*50}")
    print(f"Successfully created {created_count} new products!")
    print(f"Total products: {Product.objects.count()}")
    print(f"Images saved to: {MEDIA_PRODUCTS_DIR}")


if __name__ == "__main__":
    main()
