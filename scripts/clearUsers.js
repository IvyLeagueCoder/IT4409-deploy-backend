import mongoose from "mongoose";
import dotenv from "dotenv";
import User from "../models/user.js";

dotenv.config();

async function run() {
  try {
    if (!process.env.MONGO_URI) {
      console.error("MONGO_URI is not set in backend/.env");
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const result = await User.deleteMany({});
    console.log("Deleted users:", result.deletedCount);
  } catch (err) {
    console.error("Error clearing users:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
