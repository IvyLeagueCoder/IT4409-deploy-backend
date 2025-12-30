import mongoose from "mongoose";

export const EOrderStatus = {
  WaitingForPayment: "waiting_for_payment",
  Pending: "pending",
  Confirmed: "confirmed",
  Cancelled: "cancelled",
  Refunded: "refunded",
};

export const EPaymentMethod = {
  Card: "card",
  Cash: "cash",
  Zalopay: "zalopay",
  Vnpay: "vnpay",
};

const OrderSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Thông tin khách hàng (để hiển thị nhanh)
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerEmail: { type: String },

    items: [
      {
        _id: {
          type: mongoose.Schema.Types.ObjectId,
          default: () => new mongoose.Types.ObjectId(),
        },
        shipmentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Shipment",
        },
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        productName: { type: String }, // Tên sản phẩm (snapshot)
        productImage: { type: String }, // Ảnh sản phẩm (snapshot)
        quantity: { type: Number, required: true },
        productDiscountCode: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "DiscountCode",
        },
        shippingDiscountCode: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "DiscountCode",
        },
        price: { type: Number, required: true },
        shippingPrice: { type: Number, required: true },
      },
    ],
    orderStatus: {
      type: String,
      enum: Object.values(EOrderStatus),
      default: EOrderStatus.Pending,
    },
    zaloPayAppTransId: { type: String },
    paymentMethod: {
      type: String,
      enum: Object.values(EPaymentMethod),
      required: true,
    },
    shippingAddress: { type: String, required: true },
    note: { type: String },
    totalPrice: { type: Number, required: true },
    originalTotalPrice: { type: Number },
    discountAmount: { type: Number, default: 0 },
    voucherCode: { type: String },
    voucherId: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher" },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.model("Order", OrderSchema);
