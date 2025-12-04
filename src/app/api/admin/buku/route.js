// D:\Projek Coding\projek_pkl\src\app\api\admin\buku\route.js
// FIXED: Removed is_approved, now uses status field

import { NextResponse } from 'next/server';
import { getDb, initDb, withTransaction } from '@/lib/db';
import { getRoleFromRequest, requireRole, ROLES } from '@/lib/roles';

export async function GET(req) {
  await initDb();
  const role = await getRoleFromRequest(req);
  const db = getDb();
  
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status'); // pending, approved, rejected
    
    // Admin dan Staf bisa lihat semua buku termasuk yang pending
    const includeAll = role === ROLES.ADMIN || role === ROLES.STAF;
    
    let query = `SELECT b.*, g.nama_genre FROM buku b LEFT JOIN genre g ON b.genre_id = g.id`;
    const params = [];
    
    if (!includeAll) {
      // Non-admin/staf hanya bisa lihat yang approved
      query += ` WHERE b.status = 'approved'`;
    } else if (statusFilter) {
      // Admin/staf bisa filter by status
      query += ` WHERE b.status = $1`;
      params.push(statusFilter);
    }
    
    query += ` ORDER BY b.created_at DESC`;
    
    const result = await db.query(query, params);
    
    console.log('✅ Buku fetched:', result.rows.length, `(role: ${role}, status: ${statusFilter || 'all'})`);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching buku:', error);
    return NextResponse.json({ 
      message: 'Failed to fetch buku', 
      error: error.message 
    }, { status: 500 });
  }
}

export async function POST(req) {
  const { ok, user } = await requireRole(req, [ROLES.ADMIN]);
  if (!ok) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  
  await initDb();
  const db = getDb();
  
  try {
    const body = await req.json();
    const { 
      judul, 
      penulis, 
      penerbit,
      tahun_terbit,
      isbn,
      jumlah_halaman,
      deskripsi,
      stok_tersedia = 0, 
      stok_total = 0,
      sampul_buku,
      genre_id, 
      tag_ids = [] 
    } = body;
    
    // Validation
    if (!judul || !penulis) {
      return NextResponse.json({ 
        message: 'Judul dan penulis wajib diisi' 
      }, { status: 400 });
    }

    // Validate stok
    if (stok_tersedia > stok_total) {
      return NextResponse.json({ 
        message: 'Stok tersedia tidak boleh lebih dari stok total' 
      }, { status: 400 });
    }

    const createdId = await withTransaction(async (client) => {
      // Admin bisa langsung add buku yang sudah approved
      const insertResult = await client.query(`
        INSERT INTO buku (
          judul, penulis, penerbit, tahun_terbit, isbn, jumlah_halaman, 
          deskripsi, stok_tersedia, stok_total, sampul_buku, genre_id, 
          status, created_by, approved_by, approved_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'approved', $12, $12, CURRENT_TIMESTAMP)
        RETURNING id
      `, [
        judul, penulis, penerbit || null, tahun_terbit || null,
        isbn || null, jumlah_halaman || null, deskripsi || null,
        stok_tersedia, stok_total, sampul_buku || null, genre_id || null,
        user?.id || 1
      ]);
      
      const bukuId = insertResult.rows[0].id;
      
      // Insert tags
      if (Array.isArray(tag_ids) && tag_ids.length > 0) {
        const validTagIds = tag_ids.filter(id => Number.isInteger(Number(id)));
        for (const tagId of validTagIds) {
          await client.query(
            `INSERT INTO buku_tags (buku_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [bukuId, tagId]
          );
        }
      }
      
      return bukuId;
    });

    // Fetch created book with genre name and tags
    const result = await db.query(
      `SELECT b.*, g.nama_genre,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'nama_tag', t.nama_tag))
           FROM buku_tags bt
           JOIN tags t ON bt.tag_id = t.id
           WHERE bt.buku_id = b.id), '[]'::json
        ) as tags
       FROM buku b 
       LEFT JOIN genre g ON b.genre_id = g.id 
       WHERE b.id = $1`,
      [createdId]
    );
    
    console.log('✅ Buku created:', result.rows[0].judul);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('❌ Error creating buku:', error);
    
    // Handle unique constraint violation (duplicate ISBN)
    if (error.code === '23505' && error.constraint === 'buku_isbn_key') {
      return NextResponse.json(
        { message: 'ISBN sudah terdaftar', error: 'duplicate_isbn' }, 
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { message: 'Gagal menambah buku', error: error.message }, 
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  const { ok } = await requireRole(req, [ROLES.ADMIN]);
  if (!ok) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  
  await initDb();
  const db = getDb();
  
  try {
    const body = await req.json();
    const { id, tag_ids, nama_genre, ...updateFields } = body;
    
    if (!id) {
      return NextResponse.json({ message: 'ID diperlukan' }, { status: 400 });
    }

    // Validate stok if provided
    if (updateFields.stok_tersedia !== undefined && updateFields.stok_total !== undefined) {
      if (updateFields.stok_tersedia > updateFields.stok_total) {
        return NextResponse.json({ 
          message: 'Stok tersedia tidak boleh lebih dari stok total' 
        }, { status: 400 });
      }
    }

    // Validate status if provided
    if (updateFields.status && !['pending', 'approved', 'rejected'].includes(updateFields.status)) {
      return NextResponse.json({ 
        message: 'Status harus pending, approved, atau rejected' 
      }, { status: 400 });
    }

    await withTransaction(async (client) => {
      // Check if book exists
      const checkResult = await client.query(`SELECT * FROM buku WHERE id = $1`, [id]);
      if (checkResult.rows.length === 0) {
        throw new Error('Buku tidak ditemukan');
      }
      
      // Build update query dynamically
      const updates = [];
      const values = [];
      let paramCount = 0;
      
      // Exclude read-only fields
      const excludeFields = ['id', 'created_at', 'created_by', 'approved_by', 'approved_at', 'rejected_at'];
      
      Object.keys(updateFields).forEach(key => {
        if (updateFields[key] !== undefined && !excludeFields.includes(key)) {
          paramCount++;
          updates.push(`${key} = $${paramCount}`);
          values.push(updateFields[key]);
        }
      });
      
      if (updates.length > 0) {
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        paramCount++;
        values.push(id);
        
        await client.query(
          `UPDATE buku SET ${updates.join(', ')} WHERE id = $${paramCount}`,
          values
        );
      }
      
      // Update tags if provided
      if (Array.isArray(tag_ids)) {
        await client.query(`DELETE FROM buku_tags WHERE buku_id = $1`, [id]);
        
        const validTagIds = tag_ids.filter(tagId => Number.isInteger(Number(tagId)));
        for (const tagId of validTagIds) {
          await client.query(
            `INSERT INTO buku_tags (buku_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [id, tagId]
          );
        }
      }
    });

    // Fetch updated book with tags
    const result = await db.query(
      `SELECT b.*, g.nama_genre,
        COALESCE(
          (SELECT json_agg(json_build_object('id', t.id, 'nama_tag', t.nama_tag))
           FROM buku_tags bt
           JOIN tags t ON bt.tag_id = t.id
           WHERE bt.buku_id = b.id), '[]'::json
        ) as tags
       FROM buku b 
       LEFT JOIN genre g ON b.genre_id = g.id 
       WHERE b.id = $1`,
      [id]
    );
    
    console.log('✅ Buku updated:', result.rows[0].judul);
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating buku:', error);
    
    if (error.code === '23505' && error.constraint === 'buku_isbn_key') {
      return NextResponse.json(
        { message: 'ISBN sudah terdaftar', error: 'duplicate_isbn' }, 
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { message: error.message || 'Gagal update buku', error: error.message }, 
      { status: 500 }
    );
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
    
    // Check if book is currently borrowed
    const borrowCheck = await db.query(
      `SELECT COUNT(*) as count FROM peminjaman WHERE buku_id = $1 AND status = 'dipinjam'`,
      [id]
    );
    
    if (parseInt(borrowCheck.rows[0].count) > 0) {
      return NextResponse.json({ 
        message: 'Tidak bisa menghapus buku yang sedang dipinjam' 
      }, { status: 400 });
    }
    
    const result = await db.query(`DELETE FROM buku WHERE id = $1`, [id]);
    
    if (result.rowCount === 0) {
      return NextResponse.json({ message: 'Buku tidak ditemukan' }, { status: 404 });
    }
    
    console.log('✅ Buku deleted, ID:', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting buku:', error);
    return NextResponse.json(
      { message: 'Gagal hapus buku', error: error.message }, 
      { status: 500 }
    );
  }
}