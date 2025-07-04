
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

    // Explicitly select password for comparison and use lean() for a plain JS object
    const user = await UserModel.findOne({ username }).select('+password').lean();

    if (!user) {
      return NextResponse.json({ message: 'Invalid credentials' }, { status: 401 });
    }
    
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
    
    // The user object from lean() is already clean, but we'll remove the password just in case.
    const { password: _, ...userResult } = user;

    return NextResponse.json(userResult);
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
