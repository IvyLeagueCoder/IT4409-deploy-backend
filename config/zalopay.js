import axios from "axios";
import CryptoJS from "crypto-js";
import moment from "moment";

export const zaloPayConfig = {
  app_id: process.env.ZALOPAY_APP_ID || "2553",
  key1: process.env.ZALOPAY_KEY1 || "PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL",
  key2: process.env.ZALOPAY_KEY2 || "kLtgPl8HHhfvMuDHPwKfgfsY4Ydm9eIz",
  endpoint:
    process.env.ZALOPAY_ENDPOINT || "https://sb-openapi.zalopay.vn/v2/create",
  callback_url: process.env.ZALOPAY_CALLBACK_URL || "",
};

export const queryZaloPayStatus = async (appTransId) => {
  const postData = {
    app_id: zaloPayConfig.app_id,
    app_trans_id: appTransId,
  };

  const data =
    postData.app_id + "|" + postData.app_trans_id + "|" + zaloPayConfig.key1;
  postData.mac = CryptoJS.HmacSHA256(data, zaloPayConfig.key1).toString();

  const queryEndpoint =
    process.env.ZALOPAY_QUERY_ENDPOINT ||
    "https://sb-openapi.zalopay.vn/v2/query";

  const response = await axios.post(queryEndpoint, null, {
    params: postData,
  });

  return response.data;
};

export const createZaloPayOrder = async ({
  amount,
  appUser,
  description,
  embedData = {},
  items = [{}],
  bankCode,
  callbackUrl,
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
    // Nếu bankCode không truyền vào, để trống để ZaloPay hiển thị nhiều kênh thanh toán (gateway)
    ...(bankCode ? { bank_code: bankCode } : {}),
    ...(callbackUrl
      ? { callback_url: callbackUrl }
      : zaloPayConfig.callback_url
      ? { callback_url: zaloPayConfig.callback_url }
      : {}),
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

export default { createZaloPayOrder, queryZaloPayStatus, zaloPayConfig };
