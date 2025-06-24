import mongoose, { Document, Schema, models } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  category: string;
  brand?: string;
  barcode: string;
  cost?: number;
  computerInventory?: number;
  actualInventory?: number;
  differenceQuantity?: number;
  differenceAmount?: number;
  notes?: string;
  storeId: mongoose.Types.ObjectId;
}

const ProductSchema: Schema = new Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  brand: { type: String },
  barcode: { type: String, required: true },
  cost: { type: Number, default: 0 },
  computerInventory: { type: Number, default: 0 },
  actualInventory: { type: Number, default: 0 },
  differenceQuantity: { type: Number, default: 0 },
  differenceAmount: { type: Number, default: 0 },
  notes: { type: String },
  storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
});

ProductSchema.index({ barcode: 1, storeId: 1 }, { unique: true });

const ProductModel = models.Product || mongoose.model<IProduct>('Product', ProductSchema);
export default ProductModel;
