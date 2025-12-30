import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import User, { EUserRole } from "../models/user.js";

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

    const username = "admin";
    const email = "admin@example.com";
    const plainPassword = "Admin@123"; // bạn có thể đổi sau

    let user = await User.findOne({ username });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(plainPassword, salt);

    if (!user) {
      user = new User({
        username,
        fullname: "Quản trị viên",
        email,
        password: hashed,
        role: EUserRole.Admin,
        phoneNumber: "0000000000",
        addresses: ["Địa chỉ admin"],
        isEmailVerified: true,
      });
      await user.save();
      console.log("Created admin user:", { username, email, password: plainPassword });
    } else {
      user.password = hashed;
      user.role = EUserRole.Admin;
      await user.save();
      console.log("Updated existing admin user:", { username, email: user.email, password: plainPassword });
    }
  } catch (err) {
    console.error("Error creating admin user:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
