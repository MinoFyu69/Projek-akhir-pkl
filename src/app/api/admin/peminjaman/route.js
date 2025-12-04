// D:\Projek Coding\projek_pkl\src\app\api\admin\peminjaman\route.js
// FIXED: Removed manual stock update (let trigger handle it), added better validation

import { NextResponse } from 'next/server';
import { getDb, initDb, withTransaction } from '@/lib/db';
import { requireRole, ROLES } from '@/lib/roles';

export async function GET(req) {
  const { ok } = await requireRole(req, [ROLES.ADMIN]);
  if (!ok) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  
  await initDb();
  const db = getDb();
  
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const bukuId = searchParams.get('buku_id');
    const status = searchParams.get('status');
    
    let query = `
      SELECT 
        p.*,
        u.username,
        u.nama_lengkap,
        b.judul,
        b.penulis,
        g.nama_genre
      FROM peminjaman p
      JOIN users u ON p.user_id = u.id
      JOIN buku b ON p.buku_id = b.id
      LEFT JOIN genre g ON b.genre_id = g.id
    `;
    
    const params = [];
    const conditions = [];
    let paramCount = 0;
    
    if (userId) {
      paramCount++;
      conditions.push(`p.user_id = $${paramCount}`);
      params.push(userId);
    }
    if (bukuId) {
      paramCount++;
      conditions.push(`p.buku_id = $${paramCount}`);
      params.push(bukuId);
    }
    if (status) {
      paramCount++;
      conditions.push(`p.status = $${paramCount}`);
      params.push(status);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY p.created_at DESC`;
    
    const result = await db.query(query, params);
    
    console.log('✅ Peminjaman fetched:', result.rows.length);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching peminjaman:', error);
    return NextResponse.json({ 
      message: 'Failed to fetch peminjaman', 
      error: error.message 
    }, { status: 500 });
  }
}

export async function PUT(req) {
  const { ok } = await requireRole(req, [ROLES.ADMIN]);
  if (!ok) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  
  await initDb();
  const db = getDb();
  
  try {
    const body = await req.json();
    const { id, status, catatan, denda } = body || {};
    
    if (!id) {
      return NextResponse.json({ message: 'ID diperlukan' }, { status: 400 });
    }

    await withTransaction(async (client) => {
      // Get current peminjaman
      const currentResult = await client.query(
        `SELECT * FROM peminjaman WHERE id = $1`, 
        [id]
      );
      
      if (currentResult.rows.length === 0) {
        throw new Error('Peminjaman tidak ditemukan');
      }
      
      const current = currentResult.rows[0];

      // Validate status transition
      if (status === 'dikembalikan' && current.status === 'dikembalikan') {
        throw new Error('Buku sudah dikembalikan sebelumnya');
      }

      // Update peminjaman - TRIGGER akan handle stock update otomatis
      if (status === 'dikembalikan') {
        await client.query(`
          UPDATE peminjaman 
          SET status = $1, 
              tanggal_kembali_aktual = CURRENT_TIMESTAMP, 
              catatan = $2, 
              denda = $3, 
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `, [status, catatan || current.catatan, denda || 0, id]);
        
        console.log('✅ Buku returned, stock will be updated by trigger');
      } else if (status) {
        await client.query(`
          UPDATE peminjaman 
          SET status = $1, 
              catatan = $2, 
              denda = $3, 
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `, [status, catatan || current.catatan, denda !== undefined ? denda : current.denda, id]);
      } else {
        // Update only catatan and denda
        await client.query(`
          UPDATE peminjaman 
          SET catatan = $1, 
              denda = $2, 
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [catatan || current.catatan, denda !== undefined ? denda : current.denda, id]);
      }
    });

    // Fetch updated peminjaman with all details
    const result = await db.query(`
      SELECT 
        p.*,
        u.username,
        u.nama_lengkap,
        b.judul,
        b.penulis,
        g.nama_genre
      FROM peminjaman p
      JOIN users u ON p.user_id = u.id
      JOIN buku b ON p.buku_id = b.id
      LEFT JOIN genre g ON b.genre_id = g.id
      WHERE p.id = $1
    `, [id]);
    
    console.log('✅ Peminjaman updated, ID:', id);
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating peminjaman:', error);
    return NextResponse.json({ 
      message: error.message || 'Update gagal', 
      error: error.message 
    }, { status: 500 });
  }
}

export async function DELETE(req) {
  const { ok } = await requireRole(req, [ROLES.ADMIN]);
  if (!ok) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  
  await initDb();
  const db = getDb();
  
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get('id'));
    
    if (!id) {
      return NextResponse.json({ message: 'ID diperlukan' }, { status: 400 });
    }
    
    await withTransaction(async (client) => {
      // Get peminjaman details
      const currentResult = await client.query(
        `SELECT * FROM peminjaman WHERE id = $1`, 
        [id]
      );
      
      if (currentResult.rows.length === 0) {
        throw new Error('Peminjaman tidak ditemukan');
      }
      
      const current = currentResult.rows[0];
      
      // If still borrowed, return the stock
      if (current.status === 'dipinjam') {
        await client.query(
          `UPDATE buku SET stok_tersedia = stok_tersedia + 1 WHERE id = $1`, 
          [current.buku_id]
        );
        console.log('✅ Stock returned for borrowed book before deletion');
      }
      
      // Delete the peminjaman record
      await client.query(`DELETE FROM peminjaman WHERE id = $1`, [id]);
    });
    
    console.log('✅ Peminjaman deleted, ID:', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting peminjaman:', error);
    return NextResponse.json({ 
      message: error.message || 'Delete gagal', 
      error: error.message 
    }, { status: 500 });
  }
}