import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import counterApi from "../services/counterApi"

const OrderList = () => {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedBranch, setSelectedBranch] = useState(null)

  useEffect(() => {
    // Get selected branch from localStorage
    const branchData = localStorage.getItem("selectedBranch")
    if (branchData) {
      const branch = JSON.parse(branchData)
      setSelectedBranch(branch)
      loadOrders(branch._id)
    } else {
      navigate("/counter/branch-selection")
    }
  }, [navigate])

  const loadOrders = async (branchId) => {
    try {
      setLoading(true)
      setError(null)
      const response = await counterApi.getOrders(branchId)
      const orderList = response.orders || response.data || response || []
      
      // Sort orders by date (newest first)
      const sortedOrders = orderList.sort((a, b) => 
        new Date(b.orderDate || b.createdAt) - new Date(a.orderDate || a.createdAt)
      )
      
      setOrders(sortedOrders)
    } catch (error) {
      setError("Failed to load orders. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleNewOrder = () => {
    navigate("/counter/branch-selection")
  }

  const handleBack = () => {
    navigate("/counter/branch-selection")
  }

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-IN') + ' ' + date.toLocaleTimeString('en-IN', { 
        hour12: true,
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      return dateString
    }
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return '#48bb78'
      case 'pending':
        return '#ed8936'
      case 'cancelled':
        return '#f56565'
      default:
        return '#718096'
    }
  }

  if (loading) {
    return (
      <div className="counter-container">
        <div className="counter-card">
          <div className="counter-loading">
            <div className="counter-spinner"></div>
            <p>Loading orders...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="counter-container">
        <div className="counter-card">
          <div className="counter-error">
            <h3>Error</h3>
            <p>{error}</p>
            <button className="counter-button" onClick={() => selectedBranch && loadOrders(selectedBranch._id)}>
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="counter-container">
      <div className="counter-card">
        <div className="counter-header">
          <h1 className="counter-title">Order History</h1>
          <p className="counter-subtitle">
            {selectedBranch?.name} - Recent Orders
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ 
          display: 'flex', 
          gap: '16px', 
          marginBottom: '24px',
          justifyContent: 'center'
        }}>
          <button
            className="counter-button-secondary"
            onClick={handleBack}
            style={{ flex: 1, maxWidth: '200px' }}
          >
            ← Back
          </button>
          <button
            className="counter-button"
            onClick={handleNewOrder}
            style={{ flex: 1, maxWidth: '200px' }}
          >
            ➕ New Order
          </button>
        </div>

        {/* Orders List */}
        {orders.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '40px 20px',
            color: '#718096'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📋</div>
            <h3 style={{ margin: '0 0 8px 0' }}>No Orders Found</h3>
            <p style={{ margin: '0' }}>No orders have been placed yet.</p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gap: '16px',
            maxHeight: '60vh',
            overflowY: 'auto'
          }}>
            {orders.map((order, index) => (
              <div
                key={order._id || index}
                style={{
                  background: 'white',
                  border: '2px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '20px',
                  transition: 'all 0.2s'
                }}
              >
                {/* Order Header */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start',
                  marginBottom: '16px'
                }}>
                  <div>
                    <h3 style={{ 
                      margin: '0 0 4px 0', 
                      fontSize: '1.1rem',
                      color: '#1a202c'
                    }}>
                      {order.invoiceNumber || `Order #${index + 1}`}
                    </h3>
                    <p style={{ 
                      margin: '0 0 4px 0', 
                      fontSize: '0.875rem',
                      color: '#718096'
                    }}>
                      {order.customerName} • {order.phoneNumber}
                    </p>
                    <p style={{ 
                      margin: '0', 
                      fontSize: '0.875rem',
                      color: '#4a5568'
                    }}>
                      {formatDate(order.orderDate || order.createdAt)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      background: getStatusColor(order.status),
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '20px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      marginBottom: '8px'
                    }}>
                      {order.status || 'Completed'}
                    </div>
                    <div style={{ 
                      fontSize: '1.25rem', 
                      fontWeight: '700',
                      color: '#1a202c'
                    }}>
                      ₹{(order.total || 0).toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                {order.items && order.items.length > 0 && (
                  <div style={{ 
                    background: '#f7fafc', 
                    padding: '12px', 
                    borderRadius: '8px',
                    marginBottom: '12px'
                  }}>
                    <h4 style={{ 
                      margin: '0 0 8px 0', 
                      fontSize: '0.875rem',
                      color: '#4a5568',
                      fontWeight: '600'
                    }}>
                      Items ({order.items.length})
                    </h4>
                    <div style={{ 
                      display: 'grid', 
                      gap: '4px'
                    }}>
                      {order.items.slice(0, 3).map((item, itemIndex) => (
                        <div key={itemIndex} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between',
                          fontSize: '0.875rem'
                        }}>
                          <span style={{ color: '#2d3748' }}>
                            {item.name} × {item.quantity}
                          </span>
                          <span style={{ color: '#1a202c', fontWeight: '500' }}>
                            ₹{(item.total || item.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      ))}
                      {order.items.length > 3 && (
                        <div style={{ 
                          fontSize: '0.75rem', 
                          color: '#718096',
                          fontStyle: 'italic'
                        }}>
                          +{order.items.length - 3} more items
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Payment Info */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.875rem',
                  color: '#4a5568'
                }}>
                  <span>
                    Payment: {order.paymentMethod ? (
                      <span style={{ 
                        textTransform: 'capitalize',
                        fontWeight: '500'
                      }}>
                        {order.paymentMethod}
                      </span>
                    ) : 'Cash'}
                  </span>
                  {order.paymentMethod === 'cash' && order.change > 0 && (
                    <span>
                      Change: ₹{order.change.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default OrderList