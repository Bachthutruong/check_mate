
import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import UserModel from '@/models/User';
import { signJwt } from '@/lib/auth';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    await connectMongo();
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ message: 'User ID is required' }, { status: 400 });
    }

    const user = await UserModel.findById(userId);

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 });
    }

    const token = signJwt({ id: user._id, role: user.role });

    cookies().set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
    
    // Return user data without sensitive info
    const { ...userResult } = user.toObject();

    return NextResponse.json(userResult);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
