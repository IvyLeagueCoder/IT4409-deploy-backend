import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { sanitizeRequest } from "./middleware/sanitize.js";

import { connectRedis } from "./config/redis.js";
import User from "./models/user.js";
import Category, { DEFAULT_CATEGORIES } from "./models/Category.js";
import Product from "./models/Product.js";
import Store from "./models/Store.js";
import Cart from "./models/Cart.js";
import Order from "./models/Order.js";
import Review from "./models/Review.js";

import authRoutes from "./routes/authRoutes.js";
import productsRoutes from "./routes/productsRoutes.js";
import categoriesRoutes from "./routes/categoriesRoutes.js";
import brandsRoutes from "./routes/brandsRoutes.js";
import ordersRoutes from "./routes/ordersRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import reviewsRoutes from "./routes/reviewsRoutes.js";
import voucherRoutes from "./routes/voucherRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });
const app = express();

const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

const corsOptions = {
  origin: allowedOrigins.length ? allowedOrigins : "*",
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false,
};
const isProduction = process.env.NODE_ENV === "production";

if (isProduction) {
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: [
            "'self'",
            ...(allowedOrigins.length ? allowedOrigins : ["*"]),
          ],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(
    helmet.hsts({
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    })
  );
} else {
  app.use(helmet());
}

app.use(cors(corsOptions));
app.use(express.json());
app.use(sanitizeRequest);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", apiLimiter);

if (!process.env.MONGO_URI || !process.env.JWT_SECRET) {
  console.error(
    "❌ Thiếu biến môi trường (MONGO_URI hoặc JWT_SECRET) trong file .env"
  );
  process.exit(1);
}

mongoose.set("strictQuery", false);
mongoose
  .connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  })
  .then(() => console.log(" mongoose.connect() resolved"))
  .catch((err) => console.error(" mongoose.connect() failed:", err));

mongoose.connection.on("connected", async () => {
  console.log(" MongoDB connected");
  // Đã tắt logic tự động tạo default category
});

mongoose.connection.on("error", (err) =>
  console.error("MongoDB connection error:", err)
);
mongoose.connection.on("disconnected", () =>
  console.warn("MongoDB disconnected")
);

//goi redis
if (process.env.REDIS_URL && process.env.REDIS_URL.trim()) {
  connectRedis();
} else {
  console.log("Redis disabled (REDIS_URL not set)");
}

app.get("/", (req, res) => {
  res.send("Backend API running 🚀");
});

app.use("/api", authRoutes);
app.use("/api", productsRoutes);
app.use("/api", categoriesRoutes);
app.use("/api", brandsRoutes);
app.use("/api", ordersRoutes);
app.use("/api", ordersRoutes);
app.use("/api", paymentRoutes);
app.use("/api", chatRoutes);
app.use("/api", userRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api", voucherRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
