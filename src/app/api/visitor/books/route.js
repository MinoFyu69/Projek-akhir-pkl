import { NextResponse } from 'next/server';
import { getDb, initDb } from '@/lib/db';

export async function GET() {
  try {
    await initDb();
    const db = getDb();
    
    const result = await db.query(`
      SELECT 
        b.id,
        b.judul as title,
        b.penulis as author,
        b.penerbit as publisher,
        b.tahun_terbit as year,
        b.isbn,
        b.jumlah_halaman as pages,
        b.deskripsi as description,
        b.stok_tersedia as stock,
        b.stok_total as total_stock,
        b.sampul_buku as cover,
        b.genre_id as "genreId",
        b.created_at as "createdAt",
        g.nama_genre as genre_name
      FROM buku b
      LEFT JOIN genre g ON b.genre_id = g.id
      WHERE b.status = 'approved'
      ORDER BY b.created_at DESC
    `);
    
    console.log('✅ Visitor books fetched:', result.rows.length);
    return NextResponse.json(result.rows);
    
  } catch (error) {
    console.error('❌ Visitor Books API Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}