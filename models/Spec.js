import mongoose from 'mongoose';

const SpecSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true }, 
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true }, 
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
});

export default mongoose.model('Spec', SpecSchema);