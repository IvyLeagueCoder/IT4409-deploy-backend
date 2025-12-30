import mongoose from "mongoose";
import Product from "../models/Product.js";
import Category from "../models/Category.js";
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
    let { name, description, price, stock, category, storeId } = req.body;
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

    const product = new Product({
      storeId,
      name,
      description,
      price: Number(price || 0),
      stock: Number(stock || 0),
      category,
      images,
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
      const filter = {
        $or: [{ name: regex }, { brand: regex }, { slug: regex }],
      };

      const query = Product.find(filter)
        .sort({ createdAt: -1 })
        .populate("category", "name");

      if (limit) query.limit(Number(limit));

      const products = await query.exec();
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
      .populate("category", "name");

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
    const { name, description, price, stock, category, storeId } = req.body;

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (name !== undefined) product.name = name;
    if (description !== undefined) product.description = description;
    if (price !== undefined) product.price = Number(price);
    if (stock !== undefined) product.stock = Number(stock);
    if (storeId !== undefined) product.storeId = storeId || undefined;

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
