import mongoose from "mongoose";

export const EShipmentStatus = {
  Pending: "pending",
  Confirmed: "confirmed",
  Stored: "stored",
  Delivered: "delivered",
  Failed: "failed",
};

const ShipmentSchema = new mongoose.Schema(
  {
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
    },
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order.items._id",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(EShipmentStatus),
      required: true,
    },
    estimatedDelivery: { type: Date, required: true },
    deliveryCompany: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deliveryPersonnel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    deliveryDate: { type: Date },
    canceller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Shipment", ShipmentSchema);
