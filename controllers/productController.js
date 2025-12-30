import mongoose from "mongoose";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Brand from "../models/Brand.js";
import cloudinary from "../config/cloudinary.js";

import { redisClient } from "../config/redis.js";

const PRODUCT_CACHE_KEY = "products:all";

const uploadBufferToCloudinary = async (fileBuffer, mimetype, filename) => {
  const dataUri = `data:${mimetype};base64,${fileBuffer.toString("base64")}`;
  const res = await cloudinary.uploader.upload(dataUri, {
    folder: "shop_products",
  });
  return res.secure_url;
};

export const createProduct = async (req, res) => {
  try {
    let {
      name,
      description,
      price,
      discountPrice,
      stock,
      category,
      brand,
      storeId,
      specifications,
      highlights,
      warranty,
      origin,
      isActive,
      isBestSeller,
      isNew,
    } = req.body;
    const images = [];

    if (req.files && req.files.length) {
      for (const file of req.files) {
        try {
          const url = await uploadBufferToCloudinary(
            file.buffer,
            file.mimetype,
            file.originalname
          );
          images.push(url);
        } catch (e) {
          console.error(
            "Upload to Cloudinary failed for file",
            file.originalname,
            e.message
          );
        }
      }
    }

    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
      } else {
        try {
          const found = await Category.findOne({
            name: { $regex: `^${category}$`, $options: "i" },
          });
          if (found) category = found._id;
          else {
            console.warn(
              "createProduct: provided category not an ObjectId and not found by name, ignoring:",
              category
            );
            category = undefined;
          }
        } catch (e) {
          console.warn(
            "createProduct: error while resolving category by name",
            e?.message || e
          );
          category = undefined;
        }
      }
    }

    // Resolve brand if provided
    if (brand) {
      if (mongoose.Types.ObjectId.isValid(brand)) {
        // keep as-is
      } else {
        try {
          const foundBrand = await Brand.findOne({
            name: { $regex: `^${brand}$`, $options: "i" },
          });
          if (foundBrand) brand = foundBrand._id;
          else brand = undefined;
        } catch (e) {
          console.warn(
            "createProduct: error while resolving brand by name",
            e?.message || e
          );
          brand = undefined;
        }
      }
    }

    let parsedSpecifications = undefined;
    if (specifications) {
      try {
        parsedSpecifications =
          typeof specifications === "string"
            ? JSON.parse(specifications)
            : specifications;
      } catch (e) {
        console.warn(
          "createProduct: cannot parse specifications",
          e?.message || e
        );
        parsedSpecifications = specifications;
      }
    }

    let parsedHighlights = undefined;
    if (highlights) {
      try {
        const h =
          typeof highlights === "string" ? JSON.parse(highlights) : highlights;
        if (Array.isArray(h)) parsedHighlights = h;
      } catch (e) {
        console.warn("createProduct: cannot parse highlights", e?.message || e);
      }
    }

    const product = new Product({
      storeId,
      name,
      description,
      price: Number(price || 0),
      discountPrice:
        discountPrice !== undefined ? Number(discountPrice || 0) : undefined,
      stock: Number(stock || 0),
      category,
      brand,
      images,
      specifications: parsedSpecifications,
      highlights: parsedHighlights,
      warranty: warranty || undefined,
      origin: origin || undefined,
      isActive:
        isActive === undefined
          ? undefined
          : isActive === "true" || isActive === true,
      isBestSeller:
        isBestSeller === undefined
          ? undefined
          : isBestSeller === "true" || isBestSeller === true,
      isNew:
        isNew === undefined ? undefined : isNew === "true" || isNew === true,
    });

    await product.save();

    //Delete cache sau khi tạo mới thành công
    if (redisClient && redisClient.isOpen) {
      await redisClient.del(PRODUCT_CACHE_KEY);
      console.log("--- 🧹 Deleted stale cache after creation ---");
    }

    return res.status(201).json(product);
  } catch (err) {
    console.error("createProduct error", err);
    return res
      .status(500)
      .json({ message: "Error creating product", error: err.message });
  }
};

export const getProducts = async (req, res) => {
  try {
    // Support optional search and limit query params
    const { search = "", limit } = req.query;
    const q = (search || "").trim();

    // If searching, bypass redis cache and query DB with a filter
    if (q) {
      console.log("--- SEARCH MODE (no redis cache) ---", q);
      const regex = new RegExp(q, "i");

      // Tìm brand IDs khớp với search query trước
      const matchingBrands = await Brand.find({ name: regex }).select("_id");
      const brandIds = matchingBrands.map((b) => b._id);
      console.log("Matching brands:", matchingBrands.length, brandIds);

      // Tìm category IDs khớp với search query
      const matchingCategories = await Category.find({ name: regex }).select(
        "_id"
      );
      const categoryIds = matchingCategories.map((c) => c._id);

      // Xây dựng filter động - chỉ thêm điều kiện nếu có kết quả
      const orConditions = [{ name: regex }, { slug: regex }];

      if (brandIds.length > 0) {
        orConditions.push({ brand: { $in: brandIds } });
      }

      if (categoryIds.length > 0) {
        orConditions.push({ category: { $in: categoryIds } });
      }

      const filter = { $or: orConditions };

      const query = Product.find(filter)
        .sort({ createdAt: -1 })
        .populate("category", "name")
        .populate("brand", "name");

      if (limit) query.limit(Number(limit));

      const products = await query.exec();
      console.log("Search results:", products.length);
      return res.json(products);
    }
    

    // No search: attempt to use redis cache
    if (redisClient && redisClient.isOpen) {
      const cachedProducts = await redisClient.get(PRODUCT_CACHE_KEY);
      if (cachedProducts) {
        console.log("--- REDIS CACHE HIT ---");
        return res.json(JSON.parse(cachedProducts));
      }
    }

    //Khong co trong cache thi lay tu db
    console.log("--- MONGODB CACHE MISS ---");
    const products = await Product.find()
      .sort({ createdAt: -1 })
      .populate("category", "name")
      .populate("brand", "name");

    // Luu vao redis, ttl la 3600 giay
    if (redisClient && redisClient.isOpen) {
      await redisClient.setEx(
        PRODUCT_CACHE_KEY,
        3600,
        JSON.stringify(products)
      );
    }

    return res.json(products);
  } catch (err) {
    console.error("getProducts error", err);
    return res.status(500).json({ message: "Error fetching products" });
  }
};

export const getFeaturedProducts = async (req, res) => {
  try {
    const ids = req.query.ids.split(",");
    const products = await Product.find({ _id: { $in: ids } });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      price,
      discountPrice,
      stock,
      category,
      brand,
      storeId,
      specifications,
      highlights,
      warranty,
      origin,
      isActive,
      isBestSeller,
      isNew,
    } = req.body;

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = Number(price);
    if (discountPrice !== undefined)
      product.discountPrice =
        discountPrice === "" ? undefined : Number(discountPrice || 0);
    if (stock !== undefined) product.stock = Number(stock);
    if (storeId !== undefined) product.storeId = storeId || undefined;

    if (specifications !== undefined) {
      let parsedSpecifications = undefined;
      if (specifications) {
        try {
          parsedSpecifications =
            typeof specifications === "string"
              ? JSON.parse(specifications)
              : specifications;
        } catch (e) {
          console.warn(
            "updateProduct: cannot parse specifications",
            e?.message || e
          );
          parsedSpecifications = specifications;
        }
      }
      product.specifications = parsedSpecifications;
    }

    if (category) {
      if (mongoose.Types.ObjectId.isValid(category)) {
        product.category = category;
      } else {
        const found = await Category.findOne({
          name: { $regex: `^${category}$`, $options: "i" },
        });
        if (found) product.category = found._id;
      }
    } else if (category === "") {
      product.category = undefined;
    }

    if (brand) {
      if (mongoose.Types.ObjectId.isValid(brand)) {
        product.brand = brand;
      } else {
        const foundBrand = await Brand.findOne({
          name: { $regex: `^${brand}$`, $options: "i" },
        });
        if (foundBrand) product.brand = foundBrand._id;
      }
    } else if (brand === "") {
      product.brand = undefined;
    }

    if (highlights !== undefined) {
      let parsedHighlights = undefined;
      if (highlights) {
        try {
          const h =
            typeof highlights === "string"
              ? JSON.parse(highlights)
              : highlights;
          if (Array.isArray(h)) parsedHighlights = h;
        } catch (e) {
          console.warn(
            "updateProduct: cannot parse highlights",
            e?.message || e
          );
        }
      }
      product.highlights = parsedHighlights;
    }

    if (warranty !== undefined) product.warranty = warranty || undefined;
    if (origin !== undefined) product.origin = origin || undefined;
    if (isActive !== undefined)
      product.isActive = isActive === "true" || isActive === true;
    if (isBestSeller !== undefined)
      product.isBestSeller = isBestSeller === "true" || isBestSeller === true;
    if (isNew !== undefined) product.isNew = isNew === "true" || isNew === true;

    if (req.files && req.files.length) {
      const images = [];
      for (const file of req.files) {
        try {
          const url = await uploadBufferToCloudinary(
            file.buffer,
            file.mimetype,
            file.originalname
          );
          images.push(url);
        } catch (e) {
          console.warn(
            "Update: Cloudinary upload failed for",
            file.originalname,
            e?.message || e
          );
        }
      }
      if (images.length) product.images = images;
    }

    await product.save();

    // 6 Xoa cache sau khi cap nhat thanh cong
    if (redisClient && redisClient.isOpen) {
      await redisClient.del(PRODUCT_CACHE_KEY);
      console.log("--- Deleted stale cache after update ---");
    }

    return res.json(product);
  } catch (err) {
    console.error("updateProduct error", err);
    return res
      .status(500)
      .json({ message: "Error updating product", error: err.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "Product not found" });

    //xoa cache sau khi xoa thanh cong
    if (redisClient && redisClient.isOpen) {
      await redisClient.del(PRODUCT_CACHE_KEY);
      console.log("--- Deleted stale cache after deletion ---");
    }

    return res.json({ message: "Product deleted", id: deleted._id });
  } catch (err) {
    console.error("deleteProduct error", err);
    return res.status(500).json({ message: "Error deleting product" });
  }
};
