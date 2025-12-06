// src/lib/api-client.js

export async function apiFetch(url, options = {}) {
  console.log('🌐 apiFetch called for:', url);
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // IMPORTANT: Send cookies automatically
  const config = {
    ...options,
    headers,
    credentials: 'include', // THIS IS CRUCIAL!
  };

  console.log('📤 Request:', options.method || 'GET', url);

  try {
    const response = await fetch(url, config);
    console.log('📥 Response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      let error;
      
      try {
        error = JSON.parse(errorText);
      } catch {
        error = { message: errorText || `HTTP ${response.status}` };
      }
      
      console.error('❌ Request failed:', error);
      
      // Handle auth errors
      if (response.status === 401) {
        console.error('🔒 Unauthorized - redirecting to login');
        if (typeof window !== 'undefined') {
          alert('Sesi Anda telah berakhir. Silakan login kembali.');
          window.location.href = '/login';
        }
      } else if (response.status === 403) {
        console.error('🚫 Forbidden - insufficient permissions');
        if (error.yourRole !== undefined) {
          console.error(`Your role: ${error.yourRole}, Required: ${error.requiredRoles?.join(' or ')}`);
        }
      }
      
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Request successful');
    return data;
    
  } catch (error) {
    console.error('💥 apiFetch error:', error);
    throw error;
  }
}