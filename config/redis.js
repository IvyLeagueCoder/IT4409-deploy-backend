import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

let redisClient;

if (process.env.REDIS_URL && process.env.REDIS_URL.trim()) {
  redisClient = createClient({ url: process.env.REDIS_URL });
  redisClient.on("error", (err) => console.warn("⚠️ Redis Error:", err));
} else {
  // noop client để tránh lỗi khi gọi methods nếu không có Redis
  redisClient = {
    isOpen: false,
    connect: async () => {},
    disconnect: async () => {},
    get: async () => null,
    set: async () => null,
    del: async () => null,
    on: () => {},
  };
}

const connectRedis = async () => {
  try {
    if (!process.env.REDIS_URL || !process.env.REDIS_URL.trim()) {
      console.log("Redis disabled (no REDIS_URL)");
      return;
    }
    if (!redisClient.isOpen) {
      await redisClient.connect();
      console.log("Redis connected from config");
    }
  } catch (err) {
    console.warn("Redis connection failed:", err.message || err);
  }
};

export { redisClient, connectRedis };
