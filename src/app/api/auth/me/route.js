// src/app/api/auth/me/route.js

import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
);

/**
 * GET /api/auth/me
 * Return current user info from httpOnly cookie token
 */
export async function GET(request) {
  try {
    // Get token from httpOnly cookie
    const token = request.cookies.get('token')?.value;

    if (!token) {
      return NextResponse.json(
        { message: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Verify and decode token
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Return user info
    return NextResponse.json({
      id: payload.id,
      username: payload.username,
      email: payload.email,
      role_id: payload.role_id,
      nama_lengkap: payload.nama_lengkap
    });

  } catch (error) {
    console.error('❌ Token verification failed:', error);
    return NextResponse.json(
      { message: 'Invalid token' },
      { status: 401 }
    );
  }
}