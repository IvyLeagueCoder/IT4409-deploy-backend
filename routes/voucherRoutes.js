import express from "express";
import rateLimit from "express-rate-limit";
import {
  createVoucher,
  getVouchers,
  getVoucherById,
  updateVoucher,
  deleteVoucher,
  searchUsersForVoucher,
  searchProductsForVoucher,
  applyVoucher,
  getAvailableVouchersForUser,
} from "../controllers/voucherController.js";
import { authenticateToken, authorizeRole } from "../middleware/auth.js";

const router = express.Router();

const adminVoucherLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});


router.get(
  "/vouchers",
  authenticateToken,
  authorizeRole("admin"),
  adminVoucherLimiter,
  getVouchers
);
router.post(
  "/vouchers",
  authenticateToken,
  authorizeRole("admin"),
  adminVoucherLimiter,
  createVoucher
);
router.get(
  "/vouchers/search-users",
  authenticateToken,
  authorizeRole("admin"),
  adminVoucherLimiter,
  searchUsersForVoucher
);
router.get(
  "/vouchers/search-products",
  authenticateToken,
  authorizeRole("admin"),
  adminVoucherLimiter,
  searchProductsForVoucher
);
// Khách hàng: lấy danh sách voucher khả dụng cho tài khoản
router.get(
	"/vouchers/available",
	authenticateToken,
	getAvailableVouchersForUser
);
router.get(
  "/vouchers/:id",
  authenticateToken,
  authorizeRole("admin"),
  adminVoucherLimiter,
  getVoucherById
);
router.put(
  "/vouchers/:id",
  authenticateToken,
  authorizeRole("admin"),
  adminVoucherLimiter,
  updateVoucher
);
router.delete(
  "/vouchers/:id",
  authenticateToken,
  authorizeRole("admin"),
  adminVoucherLimiter,
  deleteVoucher
);


router.post(
  "/vouchers/apply",
  authenticateToken,
  applyVoucher
);

export default router;
