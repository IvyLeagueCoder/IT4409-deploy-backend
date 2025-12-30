import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema(
  {
    // ===== CỬA HÀNG =====
    // Một số dữ liệu cũ đang dùng giá trị chuỗi như "default_store",
    // nên để kiểu String để tránh lỗi cast khi đọc/cập nhật.
    storeId: {
      type: String,
    },

    // ===== THÔNG TIN CƠ BẢN =====
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
    },

    price: {
      type: Number,
      required: true,
    },

    discountPrice: {
      type: Number,
    },

    stock: {
      type: Number,
      required: true,
    },

    // ===== PHÂN LOẠI =====
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    brand: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
    },

    // ===== HÌNH ẢNH =====
    images: [
      {
        type: String, // URL ảnh
      },
    ],

    // ===== BIẾN THỂ (DYNAMIC THEO CATEGORY) =====
    variants: [
      {
        name: {
          type: String, // VD: "16GB / 512GB / Black"
        },

        attributes: {
          type: mongoose.Schema.Types.Mixed,
          // VD laptop: { ram: "16GB", storage: "512GB" }
          // VD keyboard: { color: "Black", switch: "Caramel Latte" }
        },

        // Giá và tồn kho cho biến thể (không bắt buộc để tránh lỗi với dữ liệu cũ)
        price: {
          type: Number,
        },

        stock: {
          type: Number,
        },

        sku: {
          type: String,
        },
      },
    ],

    // ===== ĐIỂM NỔI BẬT (MARKETING) =====
    highlights: [
      {
        type: String,
      },
    ],

    // ===== THÔNG SỐ KỸ THUẬT (LINH HỒN CỦA SCHEMA) =====
    specifications: {
      type: mongoose.Schema.Types.Mixed,
      // VD laptop:
      // { processor, ram, storage, graphics, display, battery }
      // VD keyboard:
      // { switch, layout, connection, keycap }
      // VD balo:
      // { material, size, laptopFit, weight }
    },

    // ===== THÔNG TIN KHÁC =====
    warranty: {
      type: String,
      default: "12 tháng",
    },

    origin: {
      type: String,
      default: "Chính hãng",
    },

    // ===== ĐÁNH GIÁ (TỔNG HỢP) =====
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    numReviews: {
      type: Number,
      default: 0,
    },

    // ===== TRẠNG THÁI =====
    isActive: {
      type: Boolean,
      default: true,
    },

    isBestSeller: {
      type: Boolean,
      default: false,
    },

    isNew: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ===== INDEX (PHỤC VỤ TÌM KIẾM & FILTER) =====
ProductSchema.index({ name: "text", description: "text" });
ProductSchema.index({ category: 1 });
ProductSchema.index({ brand: 1 });
ProductSchema.index({ price: 1 });

export default mongoose.model("Product", ProductSchema);
