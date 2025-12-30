import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import slugify from "slugify";
import Brand from "../models/Brand.js";

dotenv.config();

const slugOptions = {
  lower: true,
  locale: "vi",
  remove: /[*+~.()'"!:@,?]/g,
};

// Đổi tên file JSON tại đây nếu cần
const jsonFile = path.join(process.cwd(), "scripts", "phu_kien.json");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to DB");

  // Đọc file JSON
  const raw = fs.readFileSync(jsonFile, "utf8");
  const products = JSON.parse(raw);

  // Lấy danh sách brand duy nhất
  const brandSet = new Set();
  products.forEach((p) => {
    if (p.brand && typeof p.brand === "string" && p.brand.trim().length > 0) {
      brandSet.add(p.brand.trim());
    }
  });
  const brands = Array.from(brandSet);

  // Tạo brand nếu chưa có
  for (const name of brands) {
    const slug = slugify(name, slugOptions);
    let doc = await Brand.findOne({ $or: [{ name }, { slug }] });
    if (doc) {
      console.log("Exists:", name);
      continue;
    }
    doc = await Brand.create({ name, slug });
    console.log("Created:", name, "->", slug);
  }

  await mongoose.disconnect();
  console.log("Done");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
