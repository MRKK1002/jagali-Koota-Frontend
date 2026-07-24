// Counter API Service - EXACT SAME as Products page
const API_BASE_URL = import.meta.env.VITE_BACKEND_PRIMARY || 'https://billing.jagalikoota.com/api/v1/hotel'
const API_FALLBACK_URL = import.meta.env.VITE_BACKEND_SECONDARY || 'https://billing.jagalikoota.com/api/v1/hotel'

// VERSION: 2024-02-18-v2 - Backend filtering implementation
// console.log('🔄 counterApi.js loaded - VERSION: 2024-02-18-v2')

class CounterApiService {
  async request(endpoint, options = {}) {
    // Try primary backend first
    let url = `${API_BASE_URL}${endpoint}`
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    }

    // Use shorter timeout for write operations (POST/PUT/DELETE) so offline fallback is fast
    const isWriteOp = options.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method.toUpperCase())
    // Allow caller to override timeout; default: 5s for writes, 10s for reads
    const timeoutMs = options._timeout ?? (isWriteOp ? 5000 : 10000)

    // Add timeout to prevent hanging
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    config.signal = controller.signal

    try {
      // console.log(`🌐 API Request: ${options.method || 'GET'} ${url}`)
      const response = await fetch(url, config)
      clearTimeout(timeoutId)
      
      // Handle rate limiting
      if (response.status === 429) {
        console.warn('⚠️ Rate limit hit, waiting 5 seconds before retry...')
        await new Promise(resolve => setTimeout(resolve, 5000))
        // Don't retry automatically to avoid infinite loops
        throw new Error('Rate limit exceeded. Please wait a moment and try again.')
      }
      
      // Check if response is HTML (404 page) instead of JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('❌ Non-JSON response:', text.substring(0, 200))
        throw new Error(`Server returned ${response.status}: Expected JSON but got ${contentType}`)
      }
      
      const data = await response.json()

      if (!response.ok) {
        const errMsg = data.message || `HTTP error! status: ${response.status}`
        const err = new Error(`${response.status}: ${errMsg}`)
        err.status = response.status
        err.serverMessage = errMsg
        throw err
      }

      // console.log(`✅ API Success: ${options.method || 'GET'} ${url}`)
      return data
    } catch (error) {
      clearTimeout(timeoutId)
      console.error(`❌ API Error: ${options.method || 'GET'} ${url}`, error)
      
      // Skip fallback for write operations — offline queue handles retries
      if (isWriteOp) {
        if (error.name === 'AbortError') {
          throw new Error('Request timed out. Please check your connection and try again.')
        }
        if (error.message.includes('Failed to fetch')) {
          throw new Error('Cannot connect to server. Please check your internet connection and try again.')
        }
        throw error
      }

      // Try fallback URL if primary fails and it's different (read operations only)
      if (API_FALLBACK_URL !== API_BASE_URL && !url.includes(API_FALLBACK_URL)) {
        // console.log('🔄 Trying fallback backend...')
        try {
          const fallbackUrl = `${API_FALLBACK_URL}${endpoint}`
          // console.log(`🌐 Fallback Request: ${options.method || 'GET'} ${fallbackUrl}`)
          
          const fallbackController = new AbortController()
          const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 10000)
          const fallbackConfig = { ...config, signal: fallbackController.signal }
          
          const fallbackResponse = await fetch(fallbackUrl, fallbackConfig)
          clearTimeout(fallbackTimeoutId)
          
          const fallbackContentType = fallbackResponse.headers.get('content-type')
          if (!fallbackContentType || !fallbackContentType.includes('application/json')) {
            const text = await fallbackResponse.text()
            console.error('❌ Fallback Non-JSON response:', text.substring(0, 200))
            throw new Error(`Fallback server returned ${fallbackResponse.status}: Expected JSON but got ${fallbackContentType}`)
          }
          
          const fallbackData = await fallbackResponse.json()
          
          if (!fallbackResponse.ok) {
            throw new Error(fallbackData.message || `Fallback HTTP error! status: ${fallbackResponse.status}`)
          }
          
          // console.log(`✅ Fallback Success: ${options.method || 'GET'} ${fallbackUrl}`)
          return fallbackData
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError)
          // Fall through to original error handling
        }
      }
      
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Please check your connection and try again.')
      }
      
      // Provide more specific error messages
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Cannot connect to server. Please check your internet connection and try again.')
      }
      
      throw error
    }
  }

  // Authentication
  async sendOtp(mobile) {
    return this.request('/counter-auth/login/send-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile }),
    })
  }

  async resendOtp(mobile) {
    return this.request('/counter-auth/login/resend-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile }),
    })
  }

  async verifyOtp(mobile, otp) {
    return this.request('/counter-auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({
        mobile,
        otp,
        isRegistration: false,
      }),
    })
  }

  // Branches
  async getBranches() {
    return this.request('/branch')
  }

  // Categories
  async getCategories(branchId) {
    return this.request(`/category?branchId=${branchId}`)
  }

  // Tables
  async getTables(branchId) {
    return this.request(`/table?branchId=${branchId}`)
  }

  // Menu Items
  async getMenuItems(branchId, categoryId = null, options = {}) {
    const params = new URLSearchParams()
    
    if (branchId) params.append('branchId', branchId)
    if (categoryId) params.append('categoryId', categoryId)
    
    // Add category name filter (for backend filtering by category name)
    if (options.category) params.append('category', options.category)
    
    // Add pagination parameters
    if (options.page) params.append('page', options.page)
    if (options.limit) params.append('limit', options.limit)
    
    // Add search parameter
    if (options.search) params.append('search', options.search)
    
    // Add sorting parameters
    if (options.sortBy) params.append('sortBy', options.sortBy)
    if (options.sortOrder) params.append('sortOrder', options.sortOrder)
    
    // Add date filters
    if (options.startDate) params.append('startDate', options.startDate)
    if (options.endDate) params.append('endDate', options.endDate)
    
    // Add active filter
    if (options.isActive !== undefined) params.append('isActive', options.isActive)
    
    const url = `/menu?${params.toString()}`
    // console.log('📋 Menu API call with category:', options.category, '| URL:', url)
    return this.request(url)
  }

  // Invoices
  async createInvoice(invoiceData) {
    return this.request('/counter-invoice/invoices', {
      method: 'POST',
      body: JSON.stringify(invoiceData),
    })
  }

  // Orders
  async createOrder(orderData) {
    // Use orders-no-stock to bypass stock middleware (counter orders don't need stock validation)
    return this.request('/counter-order/orders-no-stock', {
      method: 'POST',
      body: JSON.stringify(orderData),
      _timeout: 30000, // 30s — sync uploads run in background and can afford to wait
    })
  }

  async getOrderById(orderId) {
    return this.request(`/counter-order/orders/${orderId}`)
  }

  async getOrders(branchId, options = {}) {
    // alert(options)
    // console.log('getOrders called with:', { branchId, options })
    
    const params = new URLSearchParams()
    
    // Add cache buster to force fresh request
    params.append('_t', Date.now())
    
    if (branchId) {
      // console.log('✅ Adding branchId to params:', branchId)
      params.append('branchId', branchId)
    } else {
      console.warn('⚠️ No branchId provided!')
    }
    
    // Add pagination parameters
    if (options.page) params.append('page', options.page)
    if (options.limit) params.append('limit', options.limit)
    
    // Add search parameter
    if (options.search) params.append('search', options.search)
    
    // Add sorting parameters
    if (options.sortBy) params.append('sortBy', options.sortBy)
    if (options.sortOrder) params.append('sortOrder', options.sortOrder)
    
    // Add date filters
    if (options.date) {
      // console.log('📅 Adding date filter:', options.date)
      params.append('date', options.date)
    }
    if (options.startDate) {
      // console.log('📅 Adding startDate filter:', options.startDate)
      params.append('startDate', options.startDate)
    }
    if (options.endDate) {
      // console.log('📅 Adding endDate filter:', options.endDate)
      params.append('endDate', options.endDate)
    }
    
    // Add status filters
    if (options.paymentStatus) params.append('paymentStatus', options.paymentStatus)
    if (options.orderStatus) params.append('orderStatus', options.orderStatus)
    if (options.paymentMethod) params.append('paymentMethod', options.paymentMethod)
    
    // Add category filter
    if (options.categoryName) params.append('categoryName', options.categoryName)
    
    // Add complimentary filter
    if (options.includeComplimentary !== undefined) {
      params.append('includeComplimentary', options.includeComplimentary)
    }
    
    const url = `/counter-order/orders?${params.toString()}`

    // Use a short timeout so the KOT list falls back to cache quickly when server is unavailable
    return this.request(url, { _timeout: 8000 })
  }

  async getOrdersByBranch(branchId) {
    const response = await this.request(`/counter-order/orders`)
    
    // Handle different response formats (same as CounterOrders.jsx)
    let counterOrders = [];
    if (response.success && Array.isArray(response.data)) {
      // New format: {success: true, count: X, data: [...]}
      counterOrders = response.data;
    } else if (response.orders && Array.isArray(response.orders)) {
      // Old format: {orders: [...]}
      counterOrders = response.orders;
    } else if (Array.isArray(response)) {
      // Direct array format
      counterOrders = response;
    }
    
    // Filter by branch if branchId provided
    if (branchId) {
      return counterOrders.filter(order => {
        const orderBranchId = order.branch?.id || order.branchId?._id || order.branchId
        return orderBranchId === branchId
      })
    }
    
    return counterOrders
  }

  async updateOrderStatus(orderId, status) {
    return this.request(`/counter-order/orders/${orderId}/order-status`, {
      method: 'PUT',
      body: JSON.stringify({ orderStatus: status }),
    })
  }

  // Bills
  async createBill(billData) {
    return this.request('/counter-bill', {
      method: 'POST',
      body: JSON.stringify(billData),
    })
  }

  async getBills(branchId) {
    return this.request(`/counter-bill?branchId=${branchId}`)
  }

  // Payments
  async processPayment(paymentData) {
    return this.request('/counter-payment', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    })
  }

  // Invoice Generation
  async generateInvoice() {
    const timestamp = Date.now()
    const randomNum = Math.floor(Math.random() * 1000)
    return {
      invoiceNumber: `INV-${timestamp}-${randomNum}`,
      invoiceId: `${timestamp}${randomNum}`,
      date: new Date().toLocaleDateString('en-IN'),
      time: new Date().toLocaleTimeString('en-IN', { 
        hour12: true,
        hour: '2-digit',
        minute: '2-digit'
      }),
    }
  }

  // NEW: Get next unified bill/invoice number from server with category
  // Note: Bill number and invoice number are the same value
  async getNextBillNumber(branchId, category) {
    if (!category) {
      throw new Error('Category is required for bill number generation');
    }
    return this.request(`/counter-invoice/next-bill-number/${branchId}?category=${encodeURIComponent(category)}`)
  }

  // NEW: Get next invoice number (same as bill number) with category
  async getNextInvoiceNumber(branchId, category) {
    // console.log('📄 Invoice number requested - using unified bill/invoice numbering for category:', category)
    return this.getNextBillNumber(branchId, category) // Same as bill number
  }

  // NEW: Get next KOT number from server
  async getNextKOTNumber(branchId) {
    return this.request(`/counter-invoice/next-kot-number/${branchId}`)
  }

  // NEW: Get current counters for debugging
  async getCurrentCounters(branchId) {
    return this.request(`/counter-invoice/counters/${branchId}`)
  }

  // Complimentary Bills
  async getComplimentaryStats(branchId, startDate, endDate) {
    let url = `/counter-bill/complimentary/stats?branchId=${branchId}`
    if (startDate && endDate) {
      url += `&startDate=${startDate}&endDate=${endDate}`
    }
    return this.request(url)
  }

  // Cancel Order
  async cancelOrder(orderId, cancellationReason, cancelledBy) {
    return this.request(`/counter-order/orders/${orderId}/cancel`, {
      method: 'PUT',
      body: JSON.stringify({ 
        cancellationReason,
        cancelledBy 
      })
    })
  }
}

export default new CounterApiService()