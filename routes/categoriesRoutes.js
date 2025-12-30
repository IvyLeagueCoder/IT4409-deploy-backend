import express from 'express';
import Category from '../models/Category.js';

const router = express.Router();

// GET category
router.get('/categories', async (req, res) => {
  try {
    const cats = await Category.find().sort({ name: 1 });
    res.json(cats);
  } catch (err) {
    console.error('GET /categories error', err?.message || err);
    res.status(500).json({ message: 'Error fetching categories' });
  }
});

export default router;
