import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import StoreModel from '@/models/Store';
import UserModel from '@/models/User';
import mongoose from 'mongoose';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { id: storeId } = params;
  const { userId } = await req.json();

  if (!mongoose.Types.ObjectId.isValid(storeId) || !mongoose.Types.ObjectId.isValid(userId)) {
      return NextResponse.json({ message: 'Invalid ID format' }, { status: 400 });
  }
  
  try {
    await connectMongo();

    const store = await StoreModel.findById(storeId);
    if (!store) {
      return NextResponse.json({ message: 'Store not found' }, { status: 404 });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }
    
    // Add user to store if not already present
    if (!store.employeeIds.includes(user._id)) {
        store.employeeIds.push(user._id);
        await store.save();
    }

    // Add store to user if not already present
    if (!user.storeIds.includes(store._id)) {
        user.storeIds.push(store._id);
        await user.save();
    }

    const updatedUser = await UserModel.findById(userId).lean();
    const sanitizedUser = JSON.parse(JSON.stringify(updatedUser));

    return NextResponse.json(sanitizedUser);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: 'Error assigning employee' }, { status: 500 });
  }
}
