import CryptoJS from "crypto-js";
import Order, { EOrderStatus } from "../models/Order.js";
import { zaloPayConfig, queryZaloPayStatus } from "../config/zalopay.js";

export const zaloPayCallback = async (req, res) => {
  const result = {};

  try {
    const dataStr = req.body?.data;
    const reqMac = req.body?.mac;

    if (!dataStr || !reqMac) {
      result.return_code = -1;
      result.return_message = "missing data or mac";
      return res.json(result);
    }

    const mac = CryptoJS.HmacSHA256(dataStr, zaloPayConfig.key2).toString();
    console.log("[ZaloPay] computed mac =", mac);

    if (reqMac !== mac) {
      result.return_code = -1;
      result.return_message = "mac not equal";
    } else {
      const dataJson = JSON.parse(dataStr);
      const appTransId = dataJson["app_trans_id"];

      if (appTransId) {
        await Order.findOneAndUpdate(
          { zaloPayAppTransId: appTransId },
          { $set: { orderStatus: EOrderStatus.Confirmed } }
        );
        console.log(
          "[ZaloPay] Updated order status to confirmed for app_trans_id =",
          appTransId
        );
      } else {
        console.warn("[ZaloPay] app_trans_id missing in callback data");
      }

      result.return_code = 1;
      result.return_message = "success";
    }
  } catch (ex) {
    console.error("[ZaloPay] callback error:", ex);
    result.return_code = 0; // ZaloPay sẽ callback lại (tối đa 3 lần)
    result.return_message = ex.message;
  }

  return res.json(result);
};

// API để check status thanh toán ZaloPay và auto update order
export const checkZaloPayStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const customerId = req.user?.id;

    if (!customerId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const order = await Order.findOne({ _id: orderId, customerId });
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Nếu đơn hàng không phải đang chờ thanh toán, trả về trạng thái hiện tại
    if (order.orderStatus !== EOrderStatus.WaitingForPayment) {
      return res.json({
        orderStatus: order.orderStatus,
        message: "Order is not waiting for payment",
      });
    }

    if (!order.zaloPayAppTransId) {
      return res.status(400).json({ message: "No ZaloPay transaction found" });
    }

    // Query trạng thái từ ZaloPay
    const zaloPayResult = await queryZaloPayStatus(order.zaloPayAppTransId);
    console.log("[ZaloPay] Query status result:", zaloPayResult);

    // return_code: 1 = thanh toán thành công, 2 = đang xử lý, 3 = thất bại
    if (zaloPayResult.return_code === 1) {
      // Cập nhật trạng thái đơn hàng sang Confirmed (đã thanh toán)
      order.orderStatus = EOrderStatus.Confirmed;
      await order.save();

      return res.json({
        orderStatus: order.orderStatus,
        zaloPayStatus: zaloPayResult,
        message: "Payment confirmed",
      });
    } else if (zaloPayResult.return_code === 2) {
      return res.json({
        orderStatus: order.orderStatus,
        zaloPayStatus: zaloPayResult,
        message: "Payment is processing",
      });
    } else {
      return res.json({
        orderStatus: order.orderStatus,
        zaloPayStatus: zaloPayResult,
        message: "Payment failed or not completed",
      });
    }
  } catch (err) {
    console.error("[ZaloPay] checkZaloPayStatus error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// API để force update order status sang paid (dùng cho testing/demo sau 30s)
export const confirmZaloPayOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const customerId = req.user?.id;

    console.log(
      `[ZaloPay] confirmZaloPayOrder called - orderId: ${orderId}, customerId: ${customerId}`
    );

    if (!customerId) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Tìm order - không check customerId để đảm bảo tìm được
    let order = await Order.findById(orderId);

    if (!order) {
      console.log(`[ZaloPay] Order ${orderId} not found`);
      return res.status(404).json({ message: "Order not found" });
    }

    console.log(
      `[ZaloPay] Found order - status: ${order.orderStatus}, owner: ${order.customerId}`
    );

    // Chỉ cho phép confirm nếu đang ở trạng thái chờ thanh toán
    if (order.orderStatus !== EOrderStatus.WaitingForPayment) {
      return res.json({
        orderStatus: order.orderStatus,
        message: "Order is not waiting for payment",
      });
    }

    // Cập nhật trạng thái sang Confirmed
    order.orderStatus = EOrderStatus.Confirmed;
    await order.save();

    console.log(
      `[ZaloPay] Order ${orderId} confirmed successfully - new status: ${order.orderStatus}`
    );

    return res.json({
      orderStatus: order.orderStatus,
      message: "Order confirmed successfully",
    });
  } catch (err) {
    console.error("[ZaloPay] confirmZaloPayOrder error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export default { zaloPayCallback, checkZaloPayStatus, confirmZaloPayOrder };
