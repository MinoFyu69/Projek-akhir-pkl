// src/lib/client-auth.js

/**
 * Get token from cookies (NOT localStorage)
 */
export function getToken() {
  if (typeof document === 'undefined') return null;
  
  const cookies = document.cookie.split(';');
  const tokenCookie = cookies.find(c => c.trim().startsWith('token='));
  
  if (!tokenCookie) {
    console.warn('⚠️ No token found in cookies');
    return null;
  }
  
  const token = tokenCookie.split('=')[1];
  console.log('✅ Token found in cookies');
  return token;
}

/**
 * Get user from token (decode JWT from cookies)
 */
export function getUser() {
  const token = getToken();
  if (!token) return null;

  try {
    // Decode JWT payload (base64)
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    
    console.log('✅ User decoded from token:', payload);
    return {
      id: payload.id,
      userId: payload.id,
      username: payload.username,
      role_id: payload.role_id,
      email: payload.email
    };
  } catch (error) {
    console.error('❌ Failed to decode token:', error);
    return null;
  }
}

/**
 * Check if authenticated (has valid token in cookies)
 */
export function isAuthenticated() {
  return !!getToken();
}

/**
 * Clear auth - call logout API to clear cookie
 */
export async function clearAuth() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    console.log('✅ Auth cleared (cookie deleted)');
  } catch (error) {
    console.error('❌ Failed to clear auth:', error);
  }
}

/**
 * DEPRECATED - Don't use these anymore
 */
export function setToken(token) {
  console.warn('⚠️ setToken() is deprecated. Tokens are stored in httpOnly cookies.');
}

export function setUser(user) {
  console.warn('⚠️ setUser() is deprecated. User data is decoded from cookie token.');
}