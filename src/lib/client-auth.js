// src/lib/client-auth.js

/**
 * Get current user from server (token is httpOnly, so we can't read it client-side)
 */
export async function getUser() {
  try {
    const response = await fetch('/api/auth/me', {
      method: 'GET',
      credentials: 'include', // Important: send httpOnly cookies
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      console.warn('⚠️ Failed to fetch user info:', response.status);
      return null;
    }

    const data = await response.json();
    console.log('✅ User info fetched:', data);
    return data;
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    return null;
  }
}

/**
 * Get role from user info
 */
export async function getRole() {
  const user = await getUser();
  if (!user || !user.role_id) return null;
  
  // Map role_id to role name
  const roleMap = {
    1: 'visitor',
    2: 'member',
    3: 'staf',
    4: 'admin'
  };
  
  const roleName = roleMap[user.role_id] || null;
  console.log('✅ Role resolved:', roleName);
  return roleName;
}

/**
 * Check if authenticated
 */
export async function isAuthenticated() {
  const user = await getUser();
  return !!user;
}

/**
 * Clear auth - call logout API to clear httpOnly cookie
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
 * DEPRECATED - These functions don't work with httpOnly cookies
 */
export function getToken() {
  console.error('❌ getToken() cannot read httpOnly cookies. Use getUser() instead.');
  return null;
}

export function setToken(token) {
  console.warn('⚠️ setToken() is deprecated. Tokens are stored in httpOnly cookies by the server.');
}

export function setUser(user) {
  console.warn('⚠️ setUser() is deprecated. User data comes from server via /api/auth/me.');
}