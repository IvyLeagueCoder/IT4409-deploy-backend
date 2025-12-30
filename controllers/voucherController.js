import Voucher, { EVoucherDiscountType } from "../models/Voucher.js";
import User from "../models/user.js";
import Product from "../models/Product.js";

function now() {
  return new Date();
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value === "true" || value === "1";
  }
  return false;
}

// Hàm dùng chung để tính toán voucher cho danh sách sản phẩm
export const calculateVoucherForItems = async ({ userId, code, items, orderTotal }) => {
  if (!userId) {
    return { errorMessage: "Bạn cần đăng nhập." };
  }
  if (!code || !Array.isArray(items)) {
    return { errorMessage: "Thiếu mã voucher hoặc danh sách sản phẩm." };
  }

  const voucher = await Voucher.findOne({ code: code.trim().toUpperCase() });
  if (!voucher || !voucher.isActive) {
    return { errorMessage: "Voucher không tồn tại hoặc đã bị vô hiệu." };
  }

  // Kiểm tra số lượng sử dụng tối đa
  if (voucher.maxUsage && voucher.maxUsage > 0) {
    if (voucher.usedCount >= voucher.maxUsage) {
      return { errorMessage: "Voucher đã được sử dụng hết số lượng cho phép." };
    }
  }

  const nowDate = now();
  if (voucher.startDate && voucher.startDate > nowDate) {
    return { errorMessage: "Voucher chưa bắt đầu hiệu lực." };
  }
  if (voucher.endDate && voucher.endDate < nowDate) {
    return { errorMessage: "Voucher đã hết hạn." };
  }

  // Kiểm tra người dùng có được dùng voucher không
  if (!voucher.appliesToAllUsers) {
    const userIdStr = String(userId);
    const allowedUserIds = (voucher.users || []).map((u) => String(u));
    if (!allowedUserIds.includes(userIdStr)) {
      return { errorMessage: "Bạn không được sử dụng voucher này." };
    }
  }

  const totalOrder = typeof orderTotal === "number" ? orderTotal : items.reduce(
    (sum, it) => sum + it.newPrice * it.quantity,
    0
  );

  if (voucher.minOrderValue && totalOrder < voucher.minOrderValue) {
    return {
      errorMessage: `Đơn hàng cần tối thiểu ${voucher.minOrderValue.toLocaleString("vi-VN")}đ để dùng voucher này.`,
    };
  }

  const voucherProductIds = (voucher.products || []).map((p) => String(p));

  const itemResults = items.map((it) => {
    const productIdStr = String(it.productId);
    let eligible = true;
    if (!voucher.appliesToAllProducts) {
      // Nếu voucher chỉ áp dụng cho 1 số sản phẩm
      eligible = voucherProductIds.includes(productIdStr);
    }
    return {
      productId: it.productId,
      eligible,
      lineTotal: it.newPrice * it.quantity,
    };
  });

  const discountableSubtotal = itemResults
    .filter((r) => r.eligible)
    .reduce((sum, r) => sum + r.lineTotal, 0);

  if (discountableSubtotal <= 0) {
    return {
      errorMessage: "Không có sản phẩm nào trong đơn hàng được áp dụng voucher.",
      itemResults,
      voucher,
      totalOrder,
      discountAmount: 0,
      finalTotal: totalOrder,
    };
  }

  let discountAmount = 0;
  if (voucher.discountType === EVoucherDiscountType.Percent) {
    discountAmount = (voucher.discountValue / 100) * discountableSubtotal;
    if (voucher.maxDiscountAmount && voucher.maxDiscountAmount > 0) {
      discountAmount = Math.min(discountAmount, voucher.maxDiscountAmount);
    }
  } else if (voucher.discountType === EVoucherDiscountType.Amount) {
    discountAmount = voucher.discountValue;
  }

  if (discountAmount > discountableSubtotal) {
    discountAmount = discountableSubtotal;
  }

  const finalTotal = Math.max(totalOrder - discountAmount, 0);

  return {
    voucher,
    discountAmount,
    finalTotal,
    itemResults,
    totalOrder,
  };
};

export const createVoucher = async (req, res) => {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minOrderValue,
      maxUsage,
      startDate,
      endDate,
      appliesToAllUsers,
      appliesToAllProducts,
      userIds,
      productIds,
    } = req.body;

    if (!code || !discountType || typeof discountValue !== "number") {
      return res
        .status(400)
        .json({ message: "Thiếu mã, kiểu giảm giá hoặc giá trị giảm." });
    }

    if (!Object.values(EVoucherDiscountType).includes(discountType)) {
      return res.status(400).json({ message: "Kiểu giảm giá không hợp lệ." });
    }

    const existing = await Voucher.findOne({ code: code.trim() });
    if (existing) {
      return res.status(409).json({ message: "Mã voucher đã tồn tại." });
    }

    const voucher = new Voucher({
      code: code.trim().toUpperCase(),
      description,
      discountType,
      discountValue,
      maxDiscountAmount: maxDiscountAmount || 0,
      minOrderValue: minOrderValue || 0,
      maxUsage: maxUsage || 0,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      appliesToAllUsers: normalizeBoolean(appliesToAllUsers),
      appliesToAllProducts: normalizeBoolean(appliesToAllProducts),
      users: Array.isArray(userIds) ? userIds : [],
      products: Array.isArray(productIds) ? productIds : [],
    });

    await voucher.save();
    return res.status(201).json({ voucher });
  } catch (err) {
    console.error("createVoucher error", err);
    return res.status(500).json({ message: "Lỗi server khi tạo voucher." });
  }
};

export const getVouchers = async (req, res) => {
  try {
    const { q } = req.query;
    const filter = {};
    if (q && typeof q === "string" && q.trim()) {
      const regex = new RegExp(q.trim(), "i");
      filter.$or = [{ code: regex }, { description: regex }];
    }

    const vouchers = await Voucher.find(filter)
      .sort({ createdAt: -1 })
      .limit(200);

    return res.json({ vouchers });
  } catch (err) {
    console.error("getVouchers error", err);
    return res.status(500).json({ message: "Lỗi server khi lấy danh sách voucher." });
  }
};

// Danh sách voucher khả dụng cho khách (dựa trên user, ngày hiệu lực, trạng thái)
export const getAvailableVouchersForUser = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Bạn cần đăng nhập." });
    }

    const nowDate = now();

    const vouchers = await Voucher.find({ isActive: true }).sort({ createdAt: -1 });

    const userIdStr = String(userId);

    const available = vouchers.filter((v) => {
      if (v.startDate && v.startDate > nowDate) return false;
      if (v.endDate && v.endDate < nowDate) return false;

      if (!v.appliesToAllUsers) {
        const allowedUserIds = (v.users || []).map((u) => String(u));
        if (!allowedUserIds.includes(userIdStr)) return false;
      }

      return true;
    });

    return res.json({
      vouchers: available.map((v) => ({
        id: v._id,
        code: v.code,
        description: v.description,
        discountType: v.discountType,
        discountValue: v.discountValue,
        maxDiscountAmount: v.maxDiscountAmount,
        minOrderValue: v.minOrderValue,
        maxUsage: v.maxUsage,
        usedCount: v.usedCount,
        startDate: v.startDate,
        endDate: v.endDate,
      })),
    });
  } catch (err) {
    console.error("getAvailableVouchersForUser error", err);
    return res
      .status(500)
      .json({ message: "Lỗi server khi lấy danh sách voucher khả dụng." });
  }
};

export const getVoucherById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "ID voucher không hợp lệ." });
    }

    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return res.status(404).json({ message: "Không tìm thấy voucher." });
    }
    return res.json({ voucher });
  } catch (err) {
    console.error("getVoucherById error", err);
    return res.status(500).json({ message: "Lỗi server khi lấy voucher." });
  }
};

export const updateVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      minOrderValue,
      maxUsage,
      startDate,
      endDate,
      isActive,
      appliesToAllUsers,
      appliesToAllProducts,
      userIds,
      productIds,
    } = req.body;

    const update = {};
    if (typeof description === "string") update.description = description;
    if (discountType && Object.values(EVoucherDiscountType).includes(discountType)) {
      update.discountType = discountType;
    }
    if (typeof discountValue === "number") update.discountValue = discountValue;
    if (typeof maxDiscountAmount === "number") update.maxDiscountAmount = maxDiscountAmount;
    if (typeof minOrderValue === "number") update.minOrderValue = minOrderValue;
    if (typeof maxUsage === "number") update.maxUsage = maxUsage;
    if (typeof isActive !== "undefined") update.isActive = normalizeBoolean(isActive);
    if (typeof appliesToAllUsers !== "undefined") {
      update.appliesToAllUsers = normalizeBoolean(appliesToAllUsers);
    }
    if (typeof appliesToAllProducts !== "undefined") {
      update.appliesToAllProducts = normalizeBoolean(appliesToAllProducts);
    }
    if (startDate) update.startDate = new Date(startDate);
    if (endDate) update.endDate = new Date(endDate);
    if (Array.isArray(userIds)) update.users = userIds;
    if (Array.isArray(productIds)) update.products = productIds;

    const voucher = await Voucher.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    });

    if (!voucher) {
      return res.status(404).json({ message: "Không tìm thấy voucher." });
    }

    return res.json({ voucher });
  } catch (err) {
    console.error("updateVoucher error", err);
    return res.status(500).json({ message: "Lỗi server khi cập nhật voucher." });
  }
};

export const deleteVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const voucher = await Voucher.findByIdAndDelete(id);
    if (!voucher) {
      return res.status(404).json({ message: "Không tìm thấy voucher." });
    }
    return res.json({ message: "Đã xóa voucher." });
  } catch (err) {
    console.error("deleteVoucher error", err);
    return res.status(500).json({ message: "Lỗi server khi xóa voucher." });
  }
};

// Tìm kiếm user cho modal (admin)
export const searchUsersForVoucher = async (req, res) => {
  try {
    const { q } = req.query;
    const filter = {};
    if (q && typeof q === "string" && q.trim()) {
      const regex = new RegExp(q.trim(), "i");
      filter.$or = [{ username: regex }, { fullname: regex }, { email: regex }];
    }

    const users = await User.find(filter)
      .select("fullname username email role")
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({ users });
  } catch (err) {
    console.error("searchUsersForVoucher error", err);
    return res.status(500).json({ message: "Lỗi server khi tìm kiếm người dùng." });
  }
};

// Tìm kiếm sản phẩm cho modal (admin)
export const searchProductsForVoucher = async (req, res) => {
  try {
    const { q } = req.query;
    const filter = {};
    if (q && typeof q === "string" && q.trim()) {
      const regex = new RegExp(q.trim(), "i");
      // Chỉ tìm kiếm theo tên sản phẩm (name) vì brand và category là ObjectId
      // nên không thể áp dụng regex trực tiếp lên đó.
      filter.name = regex;
    }

    const products = await Product.find(filter)
      .select("name price newPrice category")
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({ products });
  } catch (err) {
    console.error("searchProductsForVoucher error", err);
    return res.status(500).json({ message: "Lỗi server khi tìm kiếm sản phẩm." });
  }
};

// Áp dụng voucher cho giỏ hàng tại trang thanh toán
export const applyVoucher = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Bạn cần đăng nhập." });
    }

    const { code, items, orderTotal } = req.body;

    const result = await calculateVoucherForItems({
      userId,
      code,
      items,
      orderTotal,
    });

    if (result.errorMessage) {
      return res.status(400).json({ message: result.errorMessage, itemResults: result.itemResults });
    }

    const { voucher, discountAmount, finalTotal, itemResults } = result;

    return res.json({
      voucher: {
        id: voucher._id,
        code: voucher.code,
        description: voucher.description,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
        maxDiscountAmount: voucher.maxDiscountAmount,
        minOrderValue: voucher.minOrderValue,
        maxUsage: voucher.maxUsage,
        usedCount: voucher.usedCount,
      },
      discountAmount,
      finalTotal,
      itemResults,
    });
  } catch (err) {
    console.error("applyVoucher error", err);
    return res.status(500).json({ message: "Lỗi server khi áp dụng voucher." });
  }
};

export default {
  createVoucher,
  getVouchers,
  getVoucherById,
  updateVoucher,
  deleteVoucher,
  searchUsersForVoucher,
  searchProductsForVoucher,
   calculateVoucherForItems,
  applyVoucher,
  getAvailableVouchersForUser,
};
