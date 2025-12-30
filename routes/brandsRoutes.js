import express from 'express';
import Brand from '../models/Brand.js';

const router = express.Router();

// GET brands
router.get('/brands', async (req, res) => {
  try {
    const brands = await Brand.find().sort({ name: 1 });
    res.json(brands);
  } catch (err) {
    console.error('GET /brands error', err?.message || err);
    res.status(500).json({ message: 'Error fetching brands' });
  }
});

export default router;
