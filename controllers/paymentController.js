import CryptoJS from "crypto-js";
import Order, { EOrderStatus } from "../models/Order.js";
import { zaloPayConfig } from "../config/zalopay.js";

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

export default { zaloPayCallback };
