import express from "express";
import {
  createReview,
  getReviewsByProduct,
} from "../controllers/reviewController.js";

const router = express.Router();

// Lấy danh sách review theo sản phẩm
router.get("/product/:productId", getReviewsByProduct);

// Tạo review (CHO PHÉP GUEST)
router.post("/product/:productId", createReview);

export default router;
