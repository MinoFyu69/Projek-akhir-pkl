// src/middleware.js
import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-super-secret-key-change-in-production'
);

const ROLES = {
  MEMBER: 2,
  STAF: 3,
  ADMIN: 4
};

// ==========================================
// PUBLIC ROUTES - NO AUTH REQUIRED
// ==========================================
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/visitor',
  '/api/visitor',
  '/api/auth/login',
  '/api/auth/register',
  '/',
];

// EXACT MATCH - must match exactly
const PUBLIC_STATIC = [
  '/favicon.ico',
  '/robots.txt',
];

// Route permissions (ONLY for authenticated users)
const ROUTE_PERMISSIONS = {
  '/admin': [ROLES.ADMIN],
  '/staf': [ROLES.STAF, ROLES.ADMIN],
  '/member': [ROLES.MEMBER, ROLES.STAF, ROLES.ADMIN],
  '/api/admin': [ROLES.ADMIN],
  '/api/staf': [ROLES.STAF, ROLES.ADMIN],
  '/api/member': [ROLES.MEMBER, ROLES.STAF, ROLES.ADMIN],
  '/api/peminjaman': [ROLES.MEMBER, ROLES.STAF, ROLES.ADMIN]
};

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  console.log('🔍 Middleware checking:', pathname);

  // ==========================================
  // STEP 1: Skip Next.js internal routes
  // ==========================================
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/public') ||
    pathname.includes('.')  // static files: .ico, .png, .js, .css
  ) {
    console.log('⏭️  Skipping internal/static route:', pathname);
    return NextResponse.next();
  }

  // ==========================================
  // STEP 2: Check EXACT match for static files
  // ==========================================
  if (PUBLIC_STATIC.includes(pathname)) {
    console.log('✅ Public static file:', pathname);
    return NextResponse.next();
  }

  // ==========================================
  // STEP 3: Check if route starts with PUBLIC path
  // ==========================================
  const isPublicRoute = PUBLIC_ROUTES.some(route => {
    // Exact match
    if (pathname === route) return true;
    
    // Starts with (but not for root /)
    if (route !== '/' && pathname.startsWith(route)) return true;
    
    return false;
  });

  if (isPublicRoute) {
    console.log('✅ Public route, allowing access:', pathname);
    return NextResponse.next();
  }

  // ==========================================
  // STEP 4: Not public - need authentication
  // ==========================================
  const token = request.cookies.get('token')?.value;

  if (!token) {
    console.log('❌ No token found for:', pathname);
    
    // For API routes, return 401 instead of redirect
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { message: 'Unauthorized - No token' },
        { status: 401 }
      );
    }
    
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // ==========================================
  // STEP 5: Verify token
  // ==========================================
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userRole = payload.role_id;

    console.log('✅ Token verified:', {
      username: payload.username,
      role_id: userRole,
      role_name: userRole === 4 ? 'Admin' : userRole === 3 ? 'Staf' : userRole === 2 ? 'Member' : 'Unknown'
    });

    // ==========================================
    // STEP 6: Check route permissions
    // ==========================================
    for (const [route, allowedRoles] of Object.entries(ROUTE_PERMISSIONS)) {
      if (pathname.startsWith(route)) {
        if (!allowedRoles.includes(userRole)) {
          console.log('❌ Forbidden:', {
            pathname,
            userRole,
            allowedRoles
          });
          
          // For API routes, return 403
          if (pathname.startsWith('/api/')) {
            return NextResponse.json(
              { message: 'Forbidden - Insufficient permissions' },
              { status: 403 }
            );
          }
          
          // For page routes, redirect based on user role
          let redirectUrl;
          switch (userRole) {
            case ROLES.ADMIN:
              redirectUrl = new URL('/admin/dashboard', request.url);
              break;
            case ROLES.STAF:
              redirectUrl = new URL('/staf/dashboard', request.url);
              break;
            case ROLES.MEMBER:
              redirectUrl = new URL('/member/dashboard', request.url);
              break;
            default:
              redirectUrl = new URL('/login', request.url);
          }
          
          return NextResponse.redirect(redirectUrl);
        }
        
        console.log('✅ Authorized access:', pathname);
        break;
      }
    }

    return NextResponse.next();

  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    
    // For API routes, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { message: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }
    
    // For page routes, clear cookie and redirect to login
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('token');
    return response;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};