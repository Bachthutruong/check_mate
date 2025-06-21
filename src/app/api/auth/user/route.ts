
import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import UserModel from '@/models/User';
import { verifyJwt } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const token = req.cookies.get('token')?.value;

  if (!token) {
    return NextResponse.json(null);
  }

  const decoded = verifyJwt(token);
  if (!decoded || typeof decoded !== 'object' || !('id' in decoded)) {
    return NextResponse.json(null);
  }

  try {
    await connectMongo();
    const user = await UserModel.findById(decoded.id).lean();

    if (!user) {
      return NextResponse.json(null);
    }
    
    // Convert ObjectId to string for client-side compatibility
    const sanitizedUser = JSON.parse(JSON.stringify(user));
    return NextResponse.json(sanitizedUser);

  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
