
import mongoose, { Document, Schema, models } from 'mongoose';

export interface IStore extends Document {
  name: string;
  employeeIds: mongoose.Types.ObjectId[];
}

const StoreSchema: Schema = new Schema({
  name: { type: String, required: true, unique: true },
  employeeIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
});

const StoreModel = models.Store || mongoose.model<IStore>('Store', StoreSchema);
export default StoreModel;
