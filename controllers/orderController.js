import mongoose from "mongoose";
import Order, { EOrderStatus, EPaymentMethod } from "../models/Order.js";
import { createZaloPayOrder } from "../config/zalopay.js";

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
      totalPrice,
      zaloPayAppTransId,
    });

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


export default { createOrder, getMyOrders, getAllOrders, cancelOrder };