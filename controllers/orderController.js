import mongoose from "mongoose";
import Order, { EOrderStatus, EPaymentMethod } from "../models/Order.js";
import Voucher from "../models/Voucher.js";
import { createZaloPayOrder } from "../config/zalopay.js";
import { calculateVoucherForItems } from "./voucherController.js";

export const createOrder = async (req, res) => {
  try {
    const customerId = req.user?.id;
    if (!customerId || !mongoose.isValidObjectId(customerId)) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const {
      customerName,
      customerPhone,
      customerEmail,
      shippingAddress,
      note,
      paymentMethod,
      voucherCode,
      items,
    } = req.body || {};

    if (!customerName || !customerPhone || !shippingAddress) {
      return res.status(400).json({
        message: "Missing required fields (customerName, customerPhone, shippingAddress)",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Order items are required" });
    }

    const normalizedItems = items.map((item) => {
      const productId = item.productId || item.id;
      if (!productId || !mongoose.isValidObjectId(productId)) {
        throw new Error("Invalid productId in items");
      }

      const quantity = Number(item.quantity || 0);
      const price = Number(item.price ?? item.newPrice ?? 0);

      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Invalid quantity in items");
      }
      if (!Number.isFinite(price) || price < 0) {
        throw new Error("Invalid price in items");
      }

      return {
        productId,
        productName: item.productName || item.name,
        productImage: item.productImage || item.imageUrl || item.image,
        quantity,
        price,
        shippingPrice: 0,
      };
    });

    const totalPrice = normalizedItems.reduce(
      (sum, item) => sum + item.price * item.quantity + item.shippingPrice,
      0
    );

    const originalTotalPrice = totalPrice;

    // Áp dụng voucher (nếu có)
    let finalTotalPrice = originalTotalPrice;
    let discountAmount = 0;
    let appliedVoucherId = null;
    let appliedVoucherCode = undefined;

    if (voucherCode && typeof voucherCode === "string") {
      const voucherItems = normalizedItems.map((item) => ({
        productId: item.productId,
        newPrice: item.price,
        quantity: item.quantity,
      }));

      const voucherResult = await calculateVoucherForItems({
        userId: customerId,
        code: voucherCode,
        items: voucherItems,
        orderTotal: originalTotalPrice,
      });

      if (voucherResult.errorMessage) {
        return res.status(400).json({ message: voucherResult.errorMessage });
      }

      discountAmount = voucherResult.discountAmount || 0;
      finalTotalPrice = voucherResult.finalTotal;
      appliedVoucherId = voucherResult.voucher?._id || null;
      appliedVoucherCode = voucherResult.voucher?.code || voucherCode;
    }

    const resolvedPaymentMethod = Object.values(EPaymentMethod).includes(paymentMethod)
      ? paymentMethod
      : EPaymentMethod.Cash;

    let paymentData = null;
    let zaloPayAppTransId = null;

    const orderStatus =
      resolvedPaymentMethod === EPaymentMethod.Zalopay
        ? EOrderStatus.WaitingForPayment
        : EOrderStatus.Pending;

    if (resolvedPaymentMethod === EPaymentMethod.Zalopay) {
      try {
        const clientUrl = process.env.CLIENT_URL?.split(",")[0] || "";
        const embedData = clientUrl
          ? { redirecturl: clientUrl }
          : {};

        const { data, appTransId } = await createZaloPayOrder({
          amount: totalPrice,
          appUser: customerEmail || customerPhone || String(customerId),
          description: `Payment for order by ${customerName}`,
          embedData,
          items: normalizedItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            price: item.price,
          })),
          // Không truyền bankCode để ZaloPay hiển thị danh sách kênh thanh toán (gateway) theo tài liệu
          bankCode: undefined,
          // callbackUrl sẽ lấy từ config (ZALOPAY_CALLBACK_URL) nếu đã cấu hình
          callbackUrl: undefined,
        });
        paymentData = data;
        zaloPayAppTransId = appTransId;
      } catch (paymentErr) {
        console.error("createOrder ZaloPay error:", paymentErr);
        return res.status(502).json({
          message: "Failed to create ZaloPay payment",
        });
      }
    }

    const order = await Order.create({
      customerId,
      customerName,
      customerPhone,
      customerEmail,
      items: normalizedItems,
      orderStatus,
      paymentMethod: resolvedPaymentMethod,
      shippingAddress,
      note,
      totalPrice: finalTotalPrice,
      originalTotalPrice,
      discountAmount,
      voucherCode: appliedVoucherCode,
      voucherId: appliedVoucherId,
      zaloPayAppTransId,
    });

    // Tăng số lần sử dụng voucher nếu có
    if (appliedVoucherId) {
      try {
        await Voucher.findByIdAndUpdate(appliedVoucherId, {
          $inc: { usedCount: 1 },
        });
      } catch (usageErr) {
        console.error("Failed to increment voucher usedCount", usageErr);
      }
    }

    return res.status(201).json({ order, paymentData });
  } catch (err) {
    const message = err?.message || "Server error";
    if (message.includes("Invalid") || message.includes("required") || message.includes("Missing")) {
      return res.status(400).json({ message });
    }
    console.error("createOrder error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getMyOrders = async (req, res) => {
  try {
    const customerId = req.user?.id;
    if (!customerId || !mongoose.isValidObjectId(customerId)) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const orders = await Order.find({ customerId }).sort({ createdAt: -1 }).lean();
    return res.json({ orders });
  } catch (err) {
    console.error("getMyOrders error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ orders });
  } catch (err) {
    console.error("getAllOrders error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Thống kê đơn hàng cho trang admin (biểu đồ)
// - Theo tháng: số đơn bán được, số đơn hoàn trả, doanh thu (chỉ đơn thành công)
// - Theo ngày: cho 7 ngày gần nhất, 30 ngày gần nhất, hoặc 1 tháng cụ thể
export const getOrderStats = async (req, res) => {
  try {
    let { granularity = "month", from, to } = req.query;

    // Ép kiểu granularity
    if (!["month", "day"].includes(granularity)) {
      granularity = "month";
    }

    const minStart = new Date("2025-01-01T00:00:00.000Z");

    let startDate = from ? new Date(from) : minStart;
    let endDate = to ? new Date(to) : new Date();

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ message: "Tham số thời gian không hợp lệ." });
    }

    // Không cho lấy trước 1/2025
    if (startDate < minStart) startDate = minStart;

    const matchStage = {
      createdAt: { $gte: startDate, $lte: endDate },
    };

    const groupId =
      granularity === "day"
        ? {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" },
          }
        : {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          };

    const pipeline = [
      { $match: matchStage },
      {
        $group: {
          _id: groupId,
          soldOrders: {
            $sum: {
              $cond: [
                { $eq: ["$orderStatus", EOrderStatus.Confirmed] },
                1,
                0,
              ],
            },
          },
          returnedOrders: {
            $sum: {
              $cond: [
                { $eq: ["$orderStatus", EOrderStatus.Cancelled] },
                1,
                0,
              ],
            },
          },
          revenue: {
            $sum: {
              $cond: [
                { $eq: ["$orderStatus", EOrderStatus.Confirmed] },
                "$totalPrice",
                0,
              ],
            },
          },
        },
      },
      {
        $sort:
          granularity === "day"
            ? { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
            : { "_id.year": 1, "_id.month": 1 },
      },
    ];

    const raw = await Order.aggregate(pipeline);

    const points = raw.map((item) => {
      const { _id, soldOrders, returnedOrders, revenue } = item;
      let label;

      if (granularity === "day") {
        const date = new Date(_id.year, _id.month - 1, _id.day);
        const d = String(date.getDate()).padStart(2, "0");
        const m = String(date.getMonth() + 1).padStart(2, "0");
        label = `${d}/${m}`;
      } else {
        const m = String(_id.month).padStart(2, "0");
        label = `${m}/${_id.year}`;
      }

      return {
        label,
        year: _id.year,
        month: _id.month,
        day: _id.day,
        soldOrders,
        returnedOrders,
        revenue,
      };
    });

    return res.json({ granularity, from: startDate, to: endDate, points });
  } catch (err) {
    console.error("getOrderStats error", err);
    return res.status(500).json({ message: "Lỗi server khi lấy thống kê đơn hàng." });
  }
};

export const cancelOrder = async (req, res) => {
  try {
    const customerId = req.user?.id;
    const orderId = req.params.id;

    if (!customerId || !mongoose.isValidObjectId(customerId)) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (!mongoose.isValidObjectId(orderId)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const order = await Order.findOne({ _id: orderId, customerId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (order.orderStatus === EOrderStatus.Cancelled) {
      return res.status(400).json({ message: "Order already cancelled" });
    }

    order.orderStatus = EOrderStatus.Cancelled;
    await order.save();

    return res.json({ order });
  } catch (err) {
    console.error("cancelOrder error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};


export default { createOrder, getMyOrders, getAllOrders, cancelOrder, getOrderStats };