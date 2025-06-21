
import mongoose, { Document, Schema, models } from 'mongoose';

export interface IUser extends Document {
  name: string;
  username: string;
  password: string;
  role: 'admin' | 'employee';
  storeIds: mongoose.Types.ObjectId[];
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'employee'], required: true },
  storeIds: [{ type: Schema.Types.ObjectId, ref: 'Store' }],
});

const UserModel = models.User || mongoose.model<IUser>('User', UserSchema);
export default UserModel;
