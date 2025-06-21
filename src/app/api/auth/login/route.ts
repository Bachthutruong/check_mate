
import { NextRequest, NextResponse } from 'next/server';
import connectMongo from '@/lib/mongodb';
import UserModel from '@/models/User';
import { signJwt } from '@/lib/auth';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    await connectMongo();
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ message: 'Username and password are required' }, { status: 400 });
    }

    // Use .lean() to get a plain JS object
    // No need for .select('+password') since we removed `select: false` from the model
    const user = await UserModel.findOne({ username }).lean();

    if (!user) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    
    // user.password is now guaranteed to be the hash from the DB if user is found
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
        return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }

    const token = signJwt({ id: user._id, role: user.role, name: user.name });

    cookies().set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: '/',
    });
    
    // Remove password before sending the response
    const { password: _, ...userResult } = user;

    return NextResponse.json(userResult);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
