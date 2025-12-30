import mongoose from "mongoose";

const BranchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, 
    address: { type: String, required: true },
    employees: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", 
      },
    ],
    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product", 
          required: true,
        },
        quantity: { type: Number, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

const StoreSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    branches: [BranchSchema], 
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", 
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Store", StoreSchema);
