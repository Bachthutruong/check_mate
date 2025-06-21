
import jwt from 'jsonwebtoken';

const secret = process.env.JWT_SECRET;

if (!secret) {
  throw new Error('JWT_SECRET is not set in environment variables');
}

export function signJwt(payload: object): string {
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifyJwt(token: string) {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}
