// ========================================
// FILE 1: /api/admin/genre/route.js
// ========================================
// FIXED: Removed updated_at (column doesn't exist in schema)

import { NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';
import { requireRole, ROLES } from '@/lib/roles';

export async function GET() {
  await initDb();
  const db = getDb();
  
  try {
    const result = await db.query(`
      SELECT * FROM genre 
      ORDER BY nama_genre ASC
    `);
    
    console.log('✅ Genre fetched:', result.rows.length);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching genre:', error);
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const { ok } = await requireRole(req, [ROLES.ADMIN]);
  if (!ok) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  
  await initDb();
  const db = getDb();
  
  try {
    const body = await req.json();
    const { nama_genre, deskripsi } = body;
    
    if (!nama_genre || nama_genre.trim() === '') {
      return NextResponse.json({ 
        message: 'Nama genre diperlukan' 
      }, { status: 400 });
    }
    
    const result = await db.query(`
      INSERT INTO genre (nama_genre, deskripsi) 
      VALUES ($1, $2) 
      RETURNING *
    `, [nama_genre.trim(), deskripsi || null]);
    
    console.log('✅ Genre created:', result.rows[0].nama_genre);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('❌ Error creating genre:', error);
    
    // Handle duplicate genre name
    if (error.code === '23505' && error.constraint === 'genre_nama_genre_key') {
      return NextResponse.json(
        { message: 'Genre sudah ada', error: 'duplicate_genre' }, 
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { message: 'Gagal menambah genre', error: error.message }, 
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
    const { id, nama_genre, deskripsi } = body;
    
    if (!id) {
      return NextResponse.json({ 
        message: 'ID diperlukan' 
      }, { status: 400 });
    }
    
    if (!nama_genre || nama_genre.trim() === '') {
      return NextResponse.json({ 
        message: 'Nama genre diperlukan' 
      }, { status: 400 });
    }
    
    // FIXED: No updated_at column in genre table
    const result = await db.query(`
      UPDATE genre 
      SET nama_genre = $1, deskripsi = $2
      WHERE id = $3
      RETURNING *
    `, [nama_genre.trim(), deskripsi || null, id]);
    
    if (result.rowCount === 0) {
      return NextResponse.json({ 
        message: 'Genre tidak ditemukan' 
      }, { status: 404 });
    }
    
    console.log('✅ Genre updated:', result.rows[0].nama_genre);
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating genre:', error);
    
    if (error.code === '23505' && error.constraint === 'genre_nama_genre_key') {
      return NextResponse.json(
        { message: 'Genre sudah ada', error: 'duplicate_genre' }, 
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { message: 'Gagal update genre', error: error.message }, 
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
    
    // Check if genre is used by any book
    const usageCheck = await db.query(
      `SELECT COUNT(*) as count FROM buku WHERE genre_id = $1`,
      [id]
    );
    
    if (parseInt(usageCheck.rows[0].count) > 0) {
      return NextResponse.json({ 
        message: 'Tidak bisa menghapus genre yang sedang digunakan oleh buku' 
      }, { status: 400 });
    }
    
    const result = await db.query(`DELETE FROM genre WHERE id = $1`, [id]);
    
    if (result.rowCount === 0) {
      return NextResponse.json({ 
        message: 'Genre tidak ditemukan' 
      }, { status: 404 });
    }
    
    console.log('✅ Genre deleted, ID:', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting genre:', error);
    return NextResponse.json(
      { message: 'Gagal hapus genre', error: error.message }, 
      { status: 500 }
    );
  }
}

// ========================================
// FILE 2: /api/admin/tags/route.js
// ========================================
// FIXED: Removed updated_at (column doesn't exist in schema)

export async function GET_TAGS() {
  await initDb();
  const db = getDb();
  
  try {
    const result = await db.query(`
      SELECT * FROM tags 
      ORDER BY nama_tag ASC
    `);
    
    console.log('✅ Tags fetched:', result.rows.length);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('❌ Error fetching tags:', error);
    return NextResponse.json(
      { error: error.message }, 
      { status: 500 }
    );
  }
}

export async function POST_TAGS(req) {
  const { ok } = await requireRole(req, [ROLES.ADMIN]);
  if (!ok) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  
  await initDb();
  const db = getDb();
  
  try {
    const body = await req.json();
    const { nama_tag } = body;
    
    if (!nama_tag || nama_tag.trim() === '') {
      return NextResponse.json({ 
        message: 'Nama tag diperlukan' 
      }, { status: 400 });
    }
    
    const result = await db.query(`
      INSERT INTO tags (nama_tag) 
      VALUES ($1) 
      RETURNING *
    `, [nama_tag.trim()]);
    
    console.log('✅ Tag created:', result.rows[0].nama_tag);
    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error('❌ Error creating tag:', error);
    
    if (error.code === '23505' && error.constraint === 'tags_nama_tag_key') {
      return NextResponse.json(
        { message: 'Tag sudah ada', error: 'duplicate_tag' }, 
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { message: 'Gagal menambah tag', error: error.message }, 
      { status: 500 }
    );
  }
}

export async function PUT_TAGS(req) {
  const { ok } = await requireRole(req, [ROLES.ADMIN]);
  if (!ok) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  
  await initDb();
  const db = getDb();
  
  try {
    const body = await req.json();
    const { id, nama_tag } = body;
    
    if (!id) {
      return NextResponse.json({ 
        message: 'ID diperlukan' 
      }, { status: 400 });
    }
    
    if (!nama_tag || nama_tag.trim() === '') {
      return NextResponse.json({ 
        message: 'Nama tag diperlukan' 
      }, { status: 400 });
    }
    
    // FIXED: No updated_at column in tags table
    const result = await db.query(`
      UPDATE tags 
      SET nama_tag = $1
      WHERE id = $2
      RETURNING *
    `, [nama_tag.trim(), id]);
    
    if (result.rowCount === 0) {
      return NextResponse.json({ 
        message: 'Tag tidak ditemukan' 
      }, { status: 404 });
    }
    
    console.log('✅ Tag updated:', result.rows[0].nama_tag);
    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('❌ Error updating tag:', error);
    
    if (error.code === '23505' && error.constraint === 'tags_nama_tag_key') {
      return NextResponse.json(
        { message: 'Tag sudah ada', error: 'duplicate_tag' }, 
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { message: 'Gagal update tag', error: error.message }, 
      { status: 500 }
    );
  }
}

export async function DELETE_TAGS(req) {
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
    
    // Check if tag is used by any book
    const usageCheck = await db.query(
      `SELECT COUNT(*) as count FROM buku_tags WHERE tag_id = $1`,
      [id]
    );
    
    if (parseInt(usageCheck.rows[0].count) > 0) {
      return NextResponse.json({ 
        message: 'Tidak bisa menghapus tag yang sedang digunakan oleh buku' 
      }, { status: 400 });
    }
    
    const result = await db.query(`DELETE FROM tags WHERE id = $1`, [id]);
    
    if (result.rowCount === 0) {
      return NextResponse.json({ 
        message: 'Tag tidak ditemukan' 
      }, { status: 404 });
    }
    
    console.log('✅ Tag deleted, ID:', id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting tag:', error);
    return NextResponse.json(
      { message: 'Gagal hapus tag', error: error.message }, 
      { status: 500 }
    );
  }
}