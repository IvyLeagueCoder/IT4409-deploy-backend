import axios from "axios";
import CryptoJS from "crypto-js";
import moment from "moment";

export const zaloPayConfig = {
  app_id: process.env.ZALOPAY_APP_ID || "2553",
  key1: process.env.ZALOPAY_KEY1 || "PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL",
  key2: process.env.ZALOPAY_KEY2 || "kLtgPl8HHhfvMuDHPwKfgfsY4Ydm9eIz",
  endpoint:
    process.env.ZALOPAY_ENDPOINT || "https://sb-openapi.zalopay.vn/v2/create",
};

export const createZaloPayOrder = async ({
  amount,
  appUser,
  description,
  embedData = {},
  items = [{}],
}) => {
  if (!amount || amount <= 0) {
    throw new Error("Invalid amount for ZaloPay order");
  }

  const transID = Math.floor(Math.random() * 1000000);

  const order = {
    app_id: zaloPayConfig.app_id,
    app_trans_id: `${moment().format("YYMMDD")}_${transID}`,
    app_user: appUser || "user",
    app_time: Date.now(),
    item: JSON.stringify(items),
    embed_data: JSON.stringify(embedData),
    amount,
    description: description || `Payment for order #${transID}`,
    bank_code: "zalopayapp",
  };

  const data =
    order.app_id +
    "|" +
    order.app_trans_id +
    "|" +
    order.app_user +
    "|" +
    order.amount +
    "|" +
    order.app_time +
    "|" +
    order.embed_data +
    "|" +
    order.item;

  order.mac = CryptoJS.HmacSHA256(data, zaloPayConfig.key1).toString();

  const response = await axios.post(zaloPayConfig.endpoint, null, {
    params: order,
  });

  return {
    data: response.data,
    appTransId: order.app_trans_id,
  };
};
 
export default { createZaloPayOrder, zaloPayConfig };
