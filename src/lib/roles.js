// src/lib/roles.js
// FIXED VERSION - Next.js 15 compatible dengan async cookies()

import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';

// Role constants
export const ROLES = {
  MEMBER: 2,
  STAF: 3,
  ADMIN: 4
};

// Deskripsi roles untuk reference
export const ROLE_NAMES = {
  2: 'Member',
  3: 'Staf',
  4: 'Admin'
};

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

/**
 * ✅ FIXED: Tambah async dan await cookies()
 * Get role from request
 * Returns role_id or null if not authenticated
 */
export async function getRoleFromRequest(req) {
  try {
    const cookieStore = await cookies(); // ✅ TAMBAH AWAIT!
    
    // Try different cookie names
    let token = cookieStore.get('token')?.value || 
                cookieStore.get('session')?.value ||
                cookieStore.get('auth-token')?.value ||
                cookieStore.get('jwt')?.value;
    
    // Check Authorization header (jika ada)
    if (!token && req?.headers) {
      const authHeader = req.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    if (!token) {
      console.log('⚠️  No token found - User not authenticated');
      return null;
    }
    
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('✅ Token verified:', {
      username: decoded.username,
      role_id: decoded.role_id,
      role_name: ROLE_NAMES[decoded.role_id] || 'Unknown'
    });
    
    return decoded.role_id || null;
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      console.error('❌ Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      console.error('❌ Invalid token');
    } else {
      console.error('❌ Error verifying token:', error.message);
    }
    return null;
  }
}

/**
 * ✅ FIXED: Tambah async
 * Require specific roles
 * Returns { ok: boolean, role?: number, error?: string }
 */
export async function requireRole(req, allowedRoles = []) {
  const userRole = await getRoleFromRequest(req);
  
  console.log('🔐 Auth Check:', {
    userRole,
    userRoleName: userRole ? ROLE_NAMES[userRole] : 'Not authenticated',
    allowedRoles: allowedRoles.map(r => ROLE_NAMES[r] || r),
    isAllowed: userRole && allowedRoles.includes(userRole)
  });
  
  // Not authenticated
  if (!userRole) {
    console.log('❌ RETURN: Not authenticated'); // ← TAMBAH INI
    return { 
      ok: false, 
      error: 'Not authenticated',
      message: 'No valid session found. Please login.'
    };
  }
  
  // Not authorized (wrong role)
  if (!allowedRoles.includes(userRole)) {
    console.log('❌ RETURN: Forbidden -', userRole, 'not in', allowedRoles); // ← TAMBAH INI
    return { 
      ok: false, 
      error: 'Forbidden',
      message: `Role ${ROLE_NAMES[userRole]} not allowed. Required: ${allowedRoles.map(r => ROLE_NAMES[r]).join(', ')}`
    };
  }
  
  // Authorized
  console.log('✅ RETURN: Authorized -', ROLE_NAMES[userRole]); // ← TAMBAH INI
  return { 
    ok: true, 
    role: userRole 
  };
}

/**
 * ✅ FIXED: Tambah async
 * Check if user has any of the roles
 */
export async function hasAnyRole(req, roles = []) {
  const userRole = await getRoleFromRequest(req); // ✅ TAMBAH AWAIT!
  return userRole && roles.includes(userRole);
}

/**
 * ✅ FIXED: Tambah async
 * Check if user is admin
 */
export async function isAdmin(req) {
  return (await getRoleFromRequest(req)) === ROLES.ADMIN; // ✅ TAMBAH AWAIT!
}

/**
 * ✅ FIXED: Tambah async
 * Check if user is staff or admin
 */
export async function isStaffOrAdmin(req) {
  const role = await getRoleFromRequest(req); // ✅ TAMBAH AWAIT!
  return role === ROLES.STAF || role === ROLES.ADMIN;
}

/**
 * Create JWT token (for login) - INI TETAP SYNC
 */
export function createToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      username: user.username, 
      role_id: user.role_id,
      email: user.email
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Get user info from token without validation - INI TETAP SYNC
 */
export function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
}