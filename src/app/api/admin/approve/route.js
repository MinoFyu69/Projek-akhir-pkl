// D:\Projek Coding\projek_pkl\src\app\api\admin\approve\route.js
// FIXED: Updated to work with new schema (no buku_pending table)
// Now works directly with buku table status field

import { NextResponse } from 'next/server';
import { getDb, initDb, withTransaction } from '@/lib/db';
import { requireRole, ROLES } from '@/lib/roles';

export async function GET(req) {
  const { ok } = await requireRole(req, [ROLES.ADMIN]);
  if (!ok) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  await initDb();
  const db = getDb();

  try {
    const result = await db.query(`
      SELECT 
        b.id,
        b.judul,
        b.penulis,
        b.penerbit,
        b.tahun_terbit,
        b.isbn,
        b.jumlah_halaman,
        b.deskripsi,
        b.stok_tersedia,
        b.stok_total,
        b.sampul_buku,
        b.genre_id,
        b.status,
        b.created_by,
        b.approved_by,
        b.approved_at,
        b.rejected_at,
        b.rejection_reason,
        b.created_at,
        b.updated_at,
        g.nama_genre,
        u1.username as created_by_username,
        u1.nama_lengkap as created_by_name,
        u2.username as approved_by_username,
        u2.nama_lengkap as approved_by_name
      FROM buku b
      LEFT JOIN genre g ON b.genre_id = g.id
      LEFT JOIN users u1 ON b.created_by = u1.id
      LEFT JOIN users u2 ON b.approved_by = u2.id
      WHERE b.status = 'pending'
      ORDER BY b.created_at DESC
    `);
    
    console.log('✅ Pending books fetched:', result.rows.length);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching pending books:', error);
    return NextResponse.json({ 
      message: 'Failed to fetch pending books', 
      error: error.message 
    }, { status: 500 });
  }
}

export async function POST(req) {
  const { ok, user } = await requireRole(req, [ROLES.ADMIN]);
  if (!ok) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  await initDb();
  const db = getDb();

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
  }

  const { id, action, rejection_reason } = body || {};
  
  if (!id || !action) {
    return NextResponse.json({ 
      message: 'id dan action (approve/reject) diperlukan' 
    }, { status: 400 });
  }

  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ 
      message: 'Action harus approve atau reject' 
    }, { status: 400 });
  }

  if (action === 'reject' && !rejection_reason) {
    return NextResponse.json({ 
      message: 'Alasan penolakan diperlukan untuk reject' 
    }, { status: 400 });
  }

  try {
    await withTransaction(async (client) => {
      // Get pending book
      const pendingResult = await client.query(
        `SELECT * FROM buku WHERE id = $1 AND status = 'pending'`,
        [id]
      );
      
      if (pendingResult.rows.length === 0) {
        throw new Error('Buku pending tidak ditemukan atau sudah diproses');
      }

      if (action === 'approve') {
        // Update status to approved
        await client.query(`
          UPDATE buku 
          SET status = 'approved',
              approved_by = $1,
              approved_at = CURRENT_TIMESTAMP,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [user?.id || 1, id]);
        
        console.log('✅ Buku approved, ID:', id);
      } else {
        // Update status to rejected
        await client.query(`
          UPDATE buku 
          SET status = 'rejected',
              approved_by = $1,
              rejected_at = CURRENT_TIMESTAMP,
              rejection_reason = $2,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, [user?.id || 1, rejection_reason, id]);
        
        console.log('✅ Buku rejected, ID:', id);
      }
    });

    // Return the updated book
    const result = await db.query(
      `SELECT b.*, g.nama_genre 
       FROM buku b 
       LEFT JOIN genre g ON b.genre_id = g.id 
       WHERE b.id = $1`,
      [id]
    );
    
    return NextResponse.json({ 
      success: true, 
      action,
      book: result.rows[0] 
    });
  } catch (error) {
    console.error('❌ Error processing approval:', error);
    return NextResponse.json({ 
      message: error.message || 'Proses approval gagal', 
      error: error.message 
    }, { status: 500 });
  }
}