
// thêm database dựa trên mock data   



import dotenv from "dotenv";
import mongoose from "mongoose";

import connectDB from "../config/db.js";
import Product from "../models/Product.js";
import Category from "../models/Category.js";


import { getProducts } from "../../frontend/src/api/mockService.js";

dotenv.config();

const mapMockToProduct = async (mock) => {
	
	let categoryDoc = null;
	if (mock.category) {
		categoryDoc = await Category.findOne({ name: mock.category });
		if (!categoryDoc) {
			categoryDoc = await Category.create({
				name: mock.category,
				description: `${mock.category} category`,
				subcategories: mock.subcategory ? [mock.subcategory] : [],
			});
		}
	}

	const specs = mock.specs || {};

	const highlights = [
		specs.cpu,
		specs.ram,
		specs.storage,
		specs.screen,
		specs.gpu,
	].filter(Boolean);

	const features = {
		processor: specs.cpu,
		ram: specs.ram,
		storage: specs.storage,
		display: specs.screen,
		graphics: specs.gpu,
	};

	const productData = {
		name: mock.name,
		description: `${mock.brand || ""} ${mock.name || ""}`.trim(),
		price: mock.originalPrice || mock.price || 0,
		discountPrice: mock.price || undefined,
		stock: mock.stock ?? 0,
		category: categoryDoc?._id || undefined,
		brand: mock.brand,
		images: [mock.image, mock.thumbnail].filter(Boolean),
		highlights,
		features,
		specifications: specs,
		isBestSeller: !!mock.isBestSeller,
		isNew: !!mock.isNew,
		ratings: {
			average: mock.rating ?? 0,
			count: mock.reviewCount ?? 0,
		},
	};

	
	Object.keys(productData).forEach((key) => {
		if (productData[key] === undefined) {
			delete productData[key];
		}
	});

	return productData;
};

const seedProducts = async () => {
	try {
		await connectDB();

		const mockProducts = await getProducts();
		console.log(`Found ${mockProducts.length} mock products`);

		let created = 0;
		let updated = 0;

		for (const mock of mockProducts) {
			const data = await mapMockToProduct(mock);

			const result = await Product.findOneAndUpdate(
				{ name: mock.name },
				{ $set: data },
				{ upsert: true, new: true }
			);

			if (result.createdAt && result.updatedAt && result.createdAt.getTime() === result.updatedAt.getTime()) {
				created += 1;
			} else {
				updated += 1;
			}
		}

		console.log(`✅ Seed products completed. Created: ${created}, Updated: ${updated}`);
	} catch (err) {
		console.error("❌ Error seeding products:", err);
	} finally {
		await mongoose.disconnect();
		process.exit(0);
	}
};

seedProducts();

