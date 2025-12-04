// src\app\api\admin\users\route.js
// IMPROVED: Added email validation, self-delete protection, better error handling

import { NextResponse } from 'next/server';
import { getDb, initDb, withTransaction } from '@/lib/db';
import { requireRole, ROLES } from '@/lib/roles';
import { hashPassword } from '@/lib/auth';

export async function GET(req) {
  const { ok } = await requireRole(req, [ROLES.ADMIN]);
  if (!ok) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  await initDb();
  const db = getDb();

  try {
    const { searchParams } = new URL(req.url);
    const roleId = searchParams.get('role_id');
    const isActive = searchParams.get('is_active');
    
    let query = `
      SELECT 
        u.id, u.username, u.email, u.nama_lengkap, 
        u.role_id, u.is_active, u.created_at, u.updated_at,
        r.nama_role
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
    `;
    
    const params = [];
    const conditions = [];
    let paramCount = 0;
    
    if (roleId) {
      paramCount++;
      conditions.push(`u.role_id = $${paramCount}`);
      params.push(roleId);
    }
    
    if (isActive !== null && isActive !== undefined) {
      paramCount++;
      conditions.push(`u.is_active = $${paramCount}`);
      params.push(isActive === 'true');
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY u.created_at DESC`;
    
    const result = await db.query(query, params);
    
    console.log('✅ Users fetched:', result.rows.length);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    return NextResponse.json({ 
      message: 'Failed to fetch users', 
      error: error.message 
    }, { status: 500 });
  }
}

export async function POST(req) {
  const { ok } = await requireRole(req, [ROLES.ADMIN]);
  if (!ok) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  await initDb();
  const db = getDb();

  try {
    const body = await req.json();
    const { username, email, password, nama_lengkap, role_id = 1 } = body;

    // Validation
    if (!username || username.trim() === '') {
      return NextResponse.json({ message: 'Username diperlukan' }, { status: 400 });
    }
    
    if (!email || email.trim() === '') {
      return NextResponse.json({ message: 'Email diperlukan' }, { status: 400 });
    }
    
    if (!password || password.length < 6) {
      return NextResponse.json({ message: 'Password minimal 6 karakter' }, { status: 400 });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: 'Format email tidak valid' }, { status: 400 });
    }

    // Username validation (no special chars except underscore)
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      return NextResponse.json({ 
        message: 'Username harus 3-20 karakter, hanya huruf, angka, dan underscore' 
      }, { status: 400 });
    }

    const hashedPassword = await hashPassword(password);
    const result = await db.query(`
      INSERT INTO users (username, email, password, nama_lengkap, role_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, email, nama_lengkap, role_id, is_active, created_at
    `, [username.trim(), email.trim().toLowerCase(), hashedPassword, nama_lengkap?.trim() || null, role_id]);

    console.log('✅ User created:', result.rows[0].username);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('❌ Error creating user:', error);
    
    // Handle duplicate username
    if (error.code === '23505' && error.constraint === 'users_username_key') {
      return NextResponse.json(
        { message: 'Username sudah digunakan', error: 'duplicate_username' }, 
        { status: 409 }
      );
    }
    
    // Handle duplicate email
    if (error.code === '23505' && error.constraint === 'users_email_key') {
      return NextResponse.json(
        { message: 'Email sudah terdaftar', error: 'duplicate_email' }, 
        { status: 409 }
      );
    }
    
    return NextResponse.json({ 
      message: 'Failed to create user', 
      error: error.message 
    }, { status: 500 });
  }
}

export async function PUT(req) {
  const { ok, user } = await requireRole(req, [ROLES.ADMIN]);
  if (!ok) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  await initDb();
  const db = getDb();

  try {
    const body = await req.json();
    const { id, username, email, nama_lengkap, role_id, is_active, password } = body;

    if (!id) {
      return NextResponse.json({ message: 'ID diperlukan' }, { status: 400 });
    }

    // Email validation if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ message: 'Format email tidak valid' }, { status: 400 });
      }
    }

    // Username validation if provided
    if (username) {
      const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernameRegex.test(username)) {
        return NextResponse.json({ 
          message: 'Username harus 3-20 karakter, hanya huruf, angka, dan underscore' 
        }, { status: 400 });
      }
    }

    await withTransaction(async (client) => {
      // Build update query
      const updates = [];
      const values = [];
      let paramCount = 0;

      if (username !== undefined) {
        paramCount++;
        updates.push(`username = $${paramCount}`);
        values.push(username.trim());
      }
      if (email !== undefined) {
        paramCount++;
        updates.push(`email = $${paramCount}`);
        values.push(email.trim().toLowerCase());
      }
      if (nama_lengkap !== undefined) {
        paramCount++;
        updates.push(`nama_lengkap = $${paramCount}`);
        values.push(nama_lengkap?.trim() || null);
      }
      if (role_id !== undefined) {
        paramCount++;
        updates.push(`role_id = $${paramCount}`);
        values.push(role_id);
      }
      if (is_active !== undefined) {
        paramCount++;
        updates.push(`is_active = $${paramCount}`);
        values.push(is_active);
      }
      if (password) {
        if (password.length < 6) {
          throw new Error('Password minimal 6 karakter');
        }
        const hashedPassword = await hashPassword(password);
        paramCount++;
        updates.push(`password = $${paramCount}`);
        values.push(hashedPassword);
      }

      if (updates.length === 0) {
        throw new Error('Tidak ada data yang diupdate');
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      paramCount++;
      values.push(id);

      await client.query(
        `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramCount}`,
        values
      );
    });

    // Fetch updated user
    const result = await db.query(`
      SELECT u.id, u.username, u.email, u.nama_lengkap, u.role_id, u.is_active, u.updated_at, r.nama_role
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [id]);

    if (result.rowCount === 0) {
      return NextResponse.json({ message: 'User tidak ditemukan' }, { status: 404 });
    }

    console.log('✅ User updated:', result.rows[0].username);
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating user:', error);
    
    // Handle duplicate username
    if (error.code === '23505' && error.constraint === 'users_username_key') {
      return NextResponse.json(
        { message: 'Username sudah digunakan', error: 'duplicate_username' }, 
        { status: 409 }
      );
    }
    
    // Handle duplicate email
    if (error.code === '23505' && error.constraint === 'users_email_key') {
      return NextResponse.json(
        { message: 'Email sudah terdaftar', error: 'duplicate_email' }, 
        { status: 409 }
      );
    }
    
    return NextResponse.json({ 
      message: error.message || 'Failed to update user', 
      error: error.message 
    }, { status: 500 });
  }
}

export async function DELETE(req) {
  const { ok, user } = await requireRole(req, [ROLES.ADMIN]);
  if (!ok) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  await initDb();
  const db = getDb();

  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id'));

    if (!id) {
      return NextResponse.json({ message: 'ID diperlukan' }, { status: 400 });
    }

    // PROTECTION: Prevent admin from deleting themselves
    if (id === user?.id) {
      return NextResponse.json({ 
        message: 'Tidak bisa menghapus akun sendiri' 
      }, { status: 400 });
    }

    // Check if user has active borrows
    const borrowCheck = await db.query(
      `SELECT COUNT(*) as count FROM peminjaman WHERE user_id = $1 AND status = 'dipinjam'`,
      [id]
    );

    if (parseInt(borrowCheck.rows[0].count) > 0) {
      return NextResponse.json({ 
        message: 'Tidak bisa menghapus user yang masih memiliki peminjaman aktif' 
      }, { status: 400 });
    }

    const result = await db.query(`DELETE FROM users WHERE id = $1`, [id]);
    
    if (result.rowCount === 0) {
      return NextResponse.json({ message: 'User tidak ditemukan' }, { status: 404 });
    }

    console.log('✅ User deleted, ID:', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting user:', error);
    return NextResponse.json({ 
      message: 'Failed to delete user', 
      error: error.message 
    }, { status: 500 });
  }
}