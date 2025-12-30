import mongoose from "mongoose";

export const EVoucherDiscountType = {
  Percent: "percent",
  Amount: "amount",
};

const VoucherSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    description: { type: String },

    discountType: {
      type: String,
      enum: Object.values(EVoucherDiscountType),
      required: true,
    },
    
    discountValue: { type: Number, required: true, min: 0 },

    // Giảm tối đa cho 1 đơn (áp dụng cho kiểu %)
    maxDiscountAmount: { type: Number, default: 0 },

    // Giá trị đơn hàng tối thiểu để được áp dụng
    minOrderValue: { type: Number, default: 0 },

    // Số lần được sử dụng tối đa (0 hoặc undefined = không giới hạn)
    maxUsage: { type: Number, default: 0 },
    // Số lần đã được sử dụng
    usedCount: { type: Number, default: 0 },

    startDate: { type: Date },
    endDate: { type: Date },
    isActive: { type: Boolean, default: true },

    
    appliesToAllUsers: { type: Boolean, default: false },
    appliesToAllProducts: { type: Boolean, default: false },

    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true }
);

export default mongoose.model("Voucher", VoucherSchema);
