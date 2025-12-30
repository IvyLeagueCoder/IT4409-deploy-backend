import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Category from "../models/Category.js";
import slugify from "slugify";

// slugify config giữ ký tự tiếng Việt, chuyển dấu sang không dấu
const slugOptions = {
  lower: true,
  locale: "vi",
  remove: /[*+~.()'"!:@,?]/g,
};

const categories = [
  "Laptop nhập khẩu",
  "Laptop chính hãng",
  "Màn hình di động",
  "Máy chơi game/Game Console",
  "Kính Thực Tế Ảo VR/AR",
  "Bàn phím",
  "Chuột",
  "Balo, Túi",
  "Ghế công thái học",
  "Bàn nâng hạ",
  "Hộc tủ",
  "Arm màn hình",
  "Phụ kiện Setup",
  "RAM",
  "Ổ cứng",
  "Merchandise",
];

async function run() {
  console.log("MONGO_URI:", process.env.MONGO_URI);
  await mongoose.connect(process.env.MONGO_URI);
  for (const name of categories) {
    const slug = slugify(name, slugOptions);
    const exists = await Category.findOne({
      $or: [{ slug }, { name: new RegExp("^" + name + "$", "i") }],
    });
    if (exists) {
      console.log("Exists:", name);
      continue;
    }
    const doc = await Category.create({ name, slug });
    console.log("Created:", doc.name, doc._id.toString());
  }
  await mongoose.disconnect();
  console.log("Done");
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
