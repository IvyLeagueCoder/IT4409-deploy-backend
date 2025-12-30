import mongoose from "mongoose";

const CartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        productName: { type: String },   // thêm tên sản phẩm
        productImage: { type: String },  // thêm ảnh sản phẩm
        quantity: { type: Number, required: true, default: 1 },

        // ===== THÊM MỚI - Lưu variant đã chọn =====
        selectedVariant: {
          variantIndex: { type: Number }, // Index trong mảng variants
          ram: { type: String },
          ssd: { type: String },
          color: { type: String },
          price: { type: Number },
        },

        addedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true } // createdAt, updatedAt
);

export default mongoose.model("Cart", CartSchema);
