// Order Storage Service - Manages order data in localStorage
class OrderStorageService {
  constructor() {
    this.storageKey = 'counter_orders'
  }

  // Get all orders from localStorage
  getAllOrders() {
    try {
      const orders = localStorage.getItem(this.storageKey)
      return orders ? JSON.parse(orders) : []
    } catch (error) {
      console.error('Error loading orders from localStorage:', error)
      return []
    }
  }

  // Get orders for a specific branch
  getOrdersByBranch(branchId) {
    const allOrders = this.getAllOrders()
    return allOrders.filter(order => order.branchId === branchId)
  }

  // Save a new order
  saveOrder(orderData) {
    try {
      const orders = this.getAllOrders()
      
      // Create order object with all necessary fields
      const newOrder = {
        _id: `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        invoiceNumber: orderData.invoiceNumber,
        branchId: orderData.selectedBranch._id,
        branchName: orderData.selectedBranch.name,
        customerName: orderData.customerName,
        phoneNumber: orderData.phoneNumber,
        orderDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        items: orderData.cartItems.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity,
          gstRate: item.gstRate || 0
        })),
        total: orderData.totalAmount || orderData.total || 0,
        status: 'completed', // Default to completed when order is placed
        paymentMethod: orderData.paymentMethod || 'cash',
        paymentStatus: 'paid',
        // Additional fields for future use
        date: orderData.date,
        time: orderData.time,
        amountReceived: orderData.amountReceived || 0,
        change: orderData.change || 0
      }

      // Add to orders array
      orders.push(newOrder)

      // Sort by date (newest first)
      orders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate))

      // Save back to localStorage
      localStorage.setItem(this.storageKey, JSON.stringify(orders))

      console.log('✅ Order saved successfully:', newOrder.invoiceNumber)
      return newOrder
    } catch (error) {
      console.error('Error saving order:', error)
      throw error
    }
  }

  // Update order status
  updateOrderStatus(orderId, status) {
    try {
      const orders = this.getAllOrders()
      const orderIndex = orders.findIndex(order => order._id === orderId)
      
      if (orderIndex !== -1) {
        orders[orderIndex].status = status
        orders[orderIndex].updatedAt = new Date().toISOString()
        localStorage.setItem(this.storageKey, JSON.stringify(orders))
        return orders[orderIndex]
      }
      
      throw new Error('Order not found')
    } catch (error) {
      console.error('Error updating order status:', error)
      throw error
    }
  }

  // Delete an order
  deleteOrder(orderId) {
    try {
      const orders = this.getAllOrders()
      const filteredOrders = orders.filter(order => order._id !== orderId)
      localStorage.setItem(this.storageKey, JSON.stringify(filteredOrders))
      return true
    } catch (error) {
      console.error('Error deleting order:', error)
      throw error
    }
  }

  // Clear all orders (for testing/reset)
  clearAllOrders() {
    try {
      localStorage.removeItem(this.storageKey)
      console.log('✅ All orders cleared')
      return true
    } catch (error) {
      console.error('Error clearing orders:', error)
      throw error
    }
  }

  // Get order statistics
  getOrderStats(branchId = null) {
    const orders = branchId ? this.getOrdersByBranch(branchId) : this.getAllOrders()
    
    const totalOrders = orders.length
    const completedOrders = orders.filter(order => order.status === 'completed').length
    const pendingOrders = orders.filter(order => order.status === 'pending').length
    const totalSales = orders.reduce((sum, order) => sum + (order.total || 0), 0)
    
    return {
      totalOrders,
      completedOrders,
      pendingOrders,
      totalSales,
      averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0
    }
  }

  // Export orders (for backup/analysis)
  exportOrders() {
    const orders = this.getAllOrders()
    const dataStr = JSON.stringify(orders, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `counter_orders_${new Date().toISOString().split('T')[0]}.json`
    link.click()
    
    URL.revokeObjectURL(url)
  }
}

export default new OrderStorageService()