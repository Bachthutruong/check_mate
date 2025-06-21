
import mongoose, { Document, Schema, models } from 'mongoose';
import { Product } from '@/lib/data';

export interface IInventoryCheck extends Document {
  storeId: mongoose.Types.ObjectId;
  storeName: string;
  employeeName: string;
  date: Date;
  status: 'Completed' | 'Shortage';
  checkedItems: mongoose.Types.ObjectId[];
  missingItems: mongoose.Types.ObjectId[] | Product[];
}

const InventoryCheckSchema: Schema = new Schema({
  storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true },
  storeName: { type: String, required: true },
  employeeName: { type: String, required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['Completed', 'Shortage'], required: true },
  checkedItems: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  missingItems: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
});

const InventoryCheckModel = models.InventoryCheck || mongoose.model<IInventoryCheck>('InventoryCheck', InventoryCheckSchema);
export default InventoryCheckModel;
