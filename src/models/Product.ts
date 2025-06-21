
import mongoose, { Document, Schema, models } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  category: string;
  barcode: string;
  storeId: mongoose.Types.ObjectId;
}

const ProductSchema: Schema = new Schema({
  name: { type: String, required: true },
  category: { type: String, required: true },
  barcode: { type: String, required: true, unique: true },
  storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
});

const ProductModel = models.Product || mongoose.model<IProduct>('Product', ProductSchema);
export default ProductModel;
