// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://billing.jagalikoota.com'

export const API_ENDPOINTS = {
  // Website endpoints
  CAROUSEL: `${API_BASE_URL}/api/website/carousel`,
  CATERING: `${API_BASE_URL}/api/website/catering`,
  APP_DOWNLOAD: `${API_BASE_URL}/api/website/app-download`,
  CONTACT: `${API_BASE_URL}/api/website/contact`,
  CONTACT_MESSAGES: `${API_BASE_URL}/api/website/contact-messages`,
}

// Helper function for API calls
export const apiCall = async (url, options = {}) => {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('API call failed:', error)
    throw error
  }
}

export default API_BASE_URL