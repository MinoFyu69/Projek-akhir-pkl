// src/app/api/auth/login/route.js
import { NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
import { signJwt, verifyPassword } from '@/lib/auth';

export async function POST(req) {
  try {
    await initDb();
    const db = getDb();
    const { username, password } = await req.json();
    
    console.log('🔐 Login attempt:', { username });
    
    if (!username || !password) {
      return NextResponse.json({ 
        success: false,
        message: 'Username/email dan password diperlukan' 
      }, { status: 400 });
    }

    // ✅ Cek apakah input adalah email atau username
    const isEmail = username.includes('@');
    const query = isEmail 
      ? 'SELECT u.id, u.username, u.email, u.password, u.nama_lengkap, u.role_id, u.is_active, r.nama_role FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = $1 LIMIT 1'
      : 'SELECT u.id, u.username, u.email, u.password, u.nama_lengkap, u.role_id, u.is_active, r.nama_role FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.username = $1 LIMIT 1';
    
    const userRes = await db.query(query, [username]);
    
    if (userRes.rows.length === 0) {
      console.log('❌ User tidak ditemukan:', username);
      return NextResponse.json({ 
        success: false,
        message: 'Username/email atau password salah' 
      }, { status: 401 });
    }
    
    const user = userRes.rows[0];
    console.log('👤 User found:', { id: user.id, username: user.username, role: user.nama_role });
    
    if (!user.is_active) {
      console.log('⛔ Akun non-aktif:', user.username);
      return NextResponse.json({ 
        success: false,
        message: 'Akun Anda telah dinonaktifkan' 
      }, { status: 403 });
    }

    // ✅ Verify password
    console.log('🔑 Verifying password...');
    const passwordOk = await verifyPassword(password, user.password);
    console.log('🔑 Password check result:', passwordOk);
    
    if (!passwordOk) {
      console.log('❌ Password salah untuk user:', user.username);
      return NextResponse.json({ 
        success: false,
        message: 'Username/email atau password salah' 
      }, { status: 401 });
    }

    // Generate JWT
    const payload = { 
      sub: String(user.id),
      userId: user.id,
      role: user.nama_role || 'visitor', 
      username: user.username 
    };
    
    const token = signJwt(payload, { expiresIn: '2h' });
    
    console.log('✅ Login berhasil:', { 
      username: user.username, 
      role: payload.role 
    });

    return NextResponse.json({
      success: true,
      accessToken: token,
      token: token,
      expiresIn: 7200,
      user: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        nama_lengkap: user.nama_lengkap,
        role: payload.role,
        role_id: user.role_id // ✅ Tambahkan role_id untuk routing
      }
    });
    
  } catch (error) {
    console.error('💥 Login error:', error);
    return NextResponse.json({ 
      success: false, 
      message: 'Terjadi kesalahan saat login', 
      error: error.message 
    }, { status: 500 });
  }
}