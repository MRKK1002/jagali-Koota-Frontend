/**
 * Safely parse JSON response, handling HTML error pages
 * @param {Response} response - Fetch API response object
 * @returns {Promise<any>} Parsed JSON data
 * @throws {Error} If response is not JSON or parsing fails
 */
export const safeJsonParse = async (response) => {
  const contentType = response.headers.get('content-type');
  
  // Check if response is actually JSON
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    throw new Error(`Expected JSON but received ${contentType || 'unknown content type'}. Response: ${text.substring(0, 200)}`);
  }
  
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error.message}`);
  }
};

/**
 * Fetch wrapper with automatic JSON parsing and error handling
 * @param {string} url - API endpoint URL
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<any>} Parsed response data
 */
export const fetchJSON = async (url, options = {}) => {
  try {
    const response = await fetch(url, options);
    
    // Check if response is ok before parsing
    if (!response.ok) {
      const contentType = response.headers.get('content-type');
      
      // Try to get error message from JSON if available
      if (contentType && contentType.includes('application/json')) {
        const errorData = await response.json();
        console.error('Backend error response:', errorData);
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Otherwise, get text response
      const errorText = await response.text();
      console.error('Backend error text:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
    }
    
    return await safeJsonParse(response);
  } catch (error) {
    // Re-throw with more context
    if (error.message.includes('Failed to fetch')) {
      throw new Error(`Network error: Unable to reach ${url}. Please check your connection.`);
    }
    throw error;
  }
};

/**
 * Get backend URLs based on environment
 * @returns {string[]} Array of backend URLs
 */
const getBackendUrls = () => {
  const primary = import.meta.env.VITE_BACKEND_PRIMARY || 'https://billing.jagalikoota.com/api/v1/hotel';
  const secondary = import.meta.env.VITE_BACKEND_SECONDARY || 'https://hotelviratbackend.onrender.com/api/v1/hotel';
  
  console.log('🌐 Using backends:', { primary, secondary, mode: import.meta.env.MODE });
  
  return [primary, secondary];
};

/**
 * Single backend API call - simplified version without dual backend sync
 * @param {string} endpoint - API endpoint path (e.g., '/menu', '/category')
 * @param {RequestInit} options - Fetch options
 * @param {boolean} mergeResults - Ignored (kept for backward compatibility)
 * @returns {Promise<any>} Parsed response data
 */
export const fetchDualBackend = async (endpoint, options = {}, mergeResults = false) => {
  const backends = getBackendUrls();
  const [primaryUrl] = backends;
  const method = options.method || 'GET';

  // Ensure Content-Type header is set for POST/PUT requests with body (but not for FormData)
  if ((method === 'POST' || method === 'PUT') && options.body && !options.headers?.['Content-Type']) {
    // Don't set Content-Type for FormData - let browser set it with boundary
    if (!(options.body instanceof FormData)) {
      options.headers = {
        ...options.headers,
        'Content-Type': 'application/json',
      };
    }
  }

  try {
    const fullUrl = `${primaryUrl}${endpoint}`;
    console.log(`📡 ${method} ${fullUrl}`);
    console.log(`📡 Endpoint: "${endpoint}"`);
    console.log(`📡 Primary URL: "${primaryUrl}"`);
    
    const result = await fetchJSON(fullUrl, options);
    
    // For responses with pagination, return the full response
    if (result.pagination) {
      console.log(`✅ ${method} successful (with pagination)`);
      return result;
    }
    
    // Unwrap response if it's wrapped in { menuItem: ... } or { category: ... } or { data: ... }
    const unwrappedResult = result.menuItem || result.category || result.data || result;
    
    console.log(`✅ ${method} successful`);
    return unwrappedResult;
  } catch (error) {
    console.error(`❌ ${method} failed:`, error.message);
    
    // Try to get more detailed error information
    if (error.message.includes('400')) {
      console.error('400 Bad Request - likely validation error');
      console.error('Full error:', error);
    }
    
    throw error;
  }
};
