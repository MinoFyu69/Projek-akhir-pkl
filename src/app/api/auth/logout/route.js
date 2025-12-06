// src/app/api/auth/logout/route.js
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Create response
    const response = NextResponse.json(
      { success: true, message: 'Logout berhasil' },
      { status: 200 }
    );

    // Delete the token cookie
    response.cookies.set('token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // Expire immediately
      path: '/',
    });

    console.log('✅ User logged out, token cleared');
    return response;

  } catch (error) {
    console.error('❌ Logout error:', error);
    return NextResponse.json(
      { success: false, message: 'Logout gagal' },
      { status: 500 }
    );
  }
}