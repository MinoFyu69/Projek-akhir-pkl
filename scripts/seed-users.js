// scripts/seed-users.js
// Run dengan: node scripts/seed-users.js

import pkg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pkg;

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'perpustakaan',
  user: 'postgres',
  password: 'postgres',
});

async function seedUsers() {
  try {
    console.log('🌱 Starting user seeding...');
    
    // Hash passwords
    const passwords = {
      admin: await bcrypt.hash('admin123', 10),
      staf: await bcrypt.hash('staf123', 10),
      member: await bcrypt.hash('member123', 10),
      visitor: await bcrypt.hash('visitor123', 10),
    };
    
    console.log('🔐 Passwords hashed successfully');
    
    // Insert roles first
    await pool.query(`
      INSERT INTO roles (id, nama_role, deskripsi) VALUES 
      (1, 'visitor', 'Hanya dapat melihat katalog, genre dan jenis buku'),
      (2, 'member', 'Dapat melihat dan meminjam buku'),
      (3, 'staf', 'Dapat melihat, mengubah, dan menghapus buku. Butuh approval admin untuk menambah buku baru'),
      (4, 'admin', 'Role tertinggi dengan akses penuh ke semua fitur')
      ON CONFLICT (id) DO UPDATE SET 
        nama_role = EXCLUDED.nama_role,
        deskripsi = EXCLUDED.deskripsi
    `);
    
    console.log('✅ Roles seeded');
    
    // Insert users with hashed passwords
    await pool.query(`
      INSERT INTO users (id, username, email, password, nama_lengkap, role_id, is_active) VALUES 
      (1, 'admin', 'admin@perpustakaan.com', $1, 'Administrator', 4, true),
      (2, 'staf1', 'staf1@perpustakaan.com', $2, 'Staf Perpustakaan 1', 3, true),
      (3, 'member1', 'member1@example.com', $3, 'Member Satu', 2, true),
      (4, 'visitor1', 'visitor1@example.com', $4, 'Visitor Satu', 1, true)
      ON CONFLICT (id) DO UPDATE SET 
        password = EXCLUDED.password,
        nama_lengkap = EXCLUDED.nama_lengkap,
        role_id = EXCLUDED.role_id,
        is_active = EXCLUDED.is_active
    `, [passwords.admin, passwords.staf, passwords.member, passwords.visitor]);
    
    console.log('✅ Users seeded');
    
    // Display credentials
    console.log('\n📋 Test Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('ADMIN:');
    console.log('  Username: admin');
    console.log('  Password: admin123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STAF:');
    console.log('  Username: staf1');
    console.log('  Password: staf123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('MEMBER:');
    console.log('  Username: member1');
    console.log('  Password: member123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('VISITOR:');
    console.log('  Username: visitor1');
    console.log('  Password: visitor123');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('🎉 Seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await pool.end();
  }
}

seedUsers();