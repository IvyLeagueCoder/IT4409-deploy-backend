// Lấy danh sách review theo sản phẩm
export const getReviewsByProduct = async (req, res) => {
  try {
    const { productId } = req.params;
    const reviews = await Review.find({ product_id: productId }).sort({
      createdAt: -1,
    });
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
import Review from "../models/Review.js";
import Product from "../models/Product.js";

export const createReview = async (req, res) => {
  try {
    const { rating, comment, userName } = req.body;
    const productId = req.params.productId;

    let reviewData = {
      product_id: productId,
      rating,
      comment,
      isVerified: false,
    };

    //  CASE 1: ĐÃ ĐĂNG NHẬP
    if (req.user) {
      const existed = await Review.findOne({
        product_id: productId,
        user_id: req.user._id,
      });

      if (existed) {
        return res
          .status(400)
          .json({ message: "Bạn đã đánh giá sản phẩm này rồi" });
      }

      reviewData.user_id = req.user._id;
      reviewData.userName = req.user.name;
      reviewData.userAvatar = req.user.avatar;
      reviewData.isVerified = true;
    }

    // CASE 2: GUEST
    if (!req.user) {
      reviewData.userName = userName || "Khách";
    }

    await Review.create(reviewData);

    //  Update rating sản phẩm
    const reviews = await Review.find({ product_id: productId });

    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

    await Product.findByIdAndUpdate(productId, {
      rating: Number(avg.toFixed(1)),
      numReviews: reviews.length,
    });

    res.status(201).json({ message: "Đánh giá thành công" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
