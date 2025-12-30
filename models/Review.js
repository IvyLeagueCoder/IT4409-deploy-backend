import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    // Thông tin user (snapshot để hiển thị nhanh)
    userName: { type: String },
    userAvatar: { type: String },

    rating: { type: Number, min: 1, max: 5, required: true },
    comment: String,

    // Hình ảnh đánh giá
    images: [{ type: String }],

    // Verified purchase
    isVerified: { type: Boolean, default: false },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Review = mongoose.model("Review", ReviewSchema);

export default Review;
