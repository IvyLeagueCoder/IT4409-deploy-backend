import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Brand from "../models/Brand.js";

const slugify = (s) =>
  String(s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");

async function up() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");

  const products = await Product.find({});
  console.log("Products:", products.length);

  const brandCache = new Map();
  const catCache = new Map();

  // Update all brands: add slug if missing
  const allBrands = await Brand.find({});
  for (const b of allBrands) {
    if (!b.slug || b.slug === "") {
      b.slug = slugify(b.name);
      await b.save();
      console.log("Updated Brand slug:", b.name, "->", b.slug);
    }
  }

  // Update all categories: add slug if missing
  const allCats = await Category.find({});
  for (const c of allCats) {
    if (!c.slug || c.slug === "") {
      c.slug = slugify(c.name);
      await c.save();
      console.log("Updated Category slug:", c.name, "->", c.slug);
    }
  }

  for (const p of products) {
    // BRAND
    let brandId = null;
    let brandName = null;
    if (p.brand) {
      if (typeof p.brand === "string" && p.brand.match(/^[a-f\d]{24}$/i)) {
        // Looks like ObjectId in string
        const b = await Brand.findById(p.brand);
        if (b) {
          brandId = b._id;
          brandName = b.name;
          if (!b.slug || b.slug === "") {
            b.slug = slugify(b.name);
            await b.save();
            console.log("Updated Brand slug:", b.name, "->", b.slug);
          }
        }
      } else if (typeof p.brand === "object" && p.brand._id) {
        const b = await Brand.findById(p.brand._id);
        if (b) {
          brandId = b._id;
          brandName = b.name;
          if (!b.slug || b.slug === "") {
            b.slug = slugify(b.name);
            await b.save();
            console.log("Updated Brand slug:", b.name, "->", b.slug);
          }
        }
      } else {
        // Assume it's a name
        brandName = (
          typeof p.brand === "string" ? p.brand : p.brand.name || ""
        ).trim();
        if (brandName) {
          if (brandCache.has(brandName.toLowerCase())) {
            brandId = brandCache.get(brandName.toLowerCase());
          } else {
            let b = await Brand.findOne({
              name: new RegExp("^" + brandName + "$", "i"),
            });
            if (!b) {
              b = await Brand.create({
                name: brandName,
                slug: slugify(brandName),
              });
              console.log("Created Brand:", brandName);
            } else if (!b.slug || b.slug === "") {
              b.slug = slugify(b.name);
              await b.save();
              console.log("Updated Brand slug:", b.name, "->", b.slug);
            }
            brandId = b._id;
            brandCache.set(brandName.toLowerCase(), brandId);
          }
        }
      }
    }

    // CATEGORY
    let catId = null;
    let catName = null;
    if (p.category) {
      if (
        typeof p.category === "string" &&
        p.category.match(/^[a-f\d]{24}$/i)
      ) {
        const c = await Category.findById(p.category);
        if (c) {
          catId = c._id;
          catName = c.name;
          if (!c.slug || c.slug === "") {
            c.slug = slugify(c.name);
            await c.save();
            console.log("Updated Category slug:", c.name, "->", c.slug);
          }
        }
      } else if (typeof p.category === "object" && p.category._id) {
        const c = await Category.findById(p.category._id);
        if (c) {
          catId = c._id;
          catName = c.name;
          if (!c.slug || c.slug === "") {
            c.slug = slugify(c.name);
            await c.save();
            console.log("Updated Category slug:", c.name, "->", c.slug);
          }
        }
      } else {
        catName = (
          typeof p.category === "string" ? p.category : p.category.name || ""
        ).trim();
        if (catName) {
          if (catCache.has(catName.toLowerCase())) {
            catId = catCache.get(catName.toLowerCase());
          } else {
            let c = await Category.findOne({
              name: new RegExp("^" + catName + "$", "i"),
            });
            if (!c) {
              c = await Category.create({
                name: catName,
                slug: slugify(catName),
              });
              console.log("Created Category:", catName);
            } else if (!c.slug || c.slug === "") {
              c.slug = slugify(c.name);
              await c.save();
              console.log("Updated Category slug:", c.name, "->", c.slug);
            }
            catId = c._id;
            catCache.set(catName.toLowerCase(), catId);
          }
        }
      }
    }

    // update product if needed
    const needsUpdate =
      (brandId &&
        (!p.brand ||
          typeof p.brand !== "object" ||
          (p.brand._id && p.brand.name))) ||
      (catId &&
        (!p.category ||
          typeof p.category !== "object" ||
          (p.category._id && p.category.name)));
    if (needsUpdate) {
      if (brandId) p.brand = brandId;
      if (catId) p.category = catId;
      await p.save();
      console.log("Updated product:", p._id.toString());
    }
  }

  await mongoose.disconnect();
  console.log("Migration complete");
}

up().catch((e) => {
  console.error(e);
  process.exit(1);
});
