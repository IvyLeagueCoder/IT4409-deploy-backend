import express from 'express';
import upload from '../middleware/upload.js';
import * as productController from '../controllers/productController.js';
import { authenticateToken, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

// list products
router.get('/products', productController.getProducts);

// create product
router.post('/products', authenticateToken, authorizeRole('admin'), upload.array('images', 6), productController.createProduct);
// update product 
router.put('/products/:id', authenticateToken, authorizeRole('admin'), upload.array('images', 6), productController.updateProduct);
// delete product
router.delete('/products/:id', authenticateToken, authorizeRole('admin'), productController.deleteProduct);
//feature product
router.get("/products/featured", productController.getFeaturedProducts);

export default router;
