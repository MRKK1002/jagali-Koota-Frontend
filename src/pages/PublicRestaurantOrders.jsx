import { useState, useEffect } from "react"
import { Search, X, Check, AlertCircle, QrCode, Phone, User, IndianRupee, Loader, Calendar, Printer } from "lucide-react"
import axios from "axios"
import "./PublicRestaurantOrders.css"

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel",
  headers: { "Content-Type": "application/json" },
})

const PublicRestaurantOrders = () => {
  const [allOrders, setAllOrders] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [branchFilter, setBranchFilter] = useState("all")
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [singleDate, setSingleDate] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalOrders, setTotalOrders] = useState(0)
  const [lastUpdated, setLastUpdated] = useState(null)
  const ordersPerPage = 10

  // Set page title with icon
  useEffect(() => {
    document.title = "🍽️ Public Restaurant Orders - Hotel Virat"
  }, [])

  useEffect(() => {
    fetchBranches()
    fetchOrders()
  }, [statusFilter, branchFilter, paymentMethodFilter, startDate, endDate, singleDate])

  useEffect(() => {
    const interval = setInterval(() => fetchOrders(), 30000)
    return () => clearInterval(interval)
  }, [statusFilter, branchFilter, paymentMethodFilter, startDate, endDate])

  const fetchBranches = async () => {
    try {
      const response = await api.get("/branch")
      setBranches(response.data)
    } catch (error) {
      console.error("Error fetching branches:", error)
    }
  }

  const fetchOrders = async () => {
    setLoading(true)
    setError("")
    try {
      const params = {
        page: currentPage,
        limit: ordersPerPage
      }
      if (statusFilter !== "all") params.status = statusFilter
      if (branchFilter !== "all") params.branchId = branchFilter
      if (paymentMethodFilter !== "all") params.paymentMethod = paymentMethodFilter
      if (searchTerm.trim()) params.search = searchTerm.trim()
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate
      if (singleDate) params.singleDate = singleDate

      const response = await api.get("/public-order", { params })
      if (response.data?.success) {
        setAllOrders(response.data.data || [])
        setTotalOrders(response.data.total || 0)
        setTotalPages(response.data.totalPages || 1)
        setLastUpdated(new Date())
      } else {
        setAllOrders([])
        setTotalOrders(0)
        setTotalPages(1)
      }
      setLoading(false)
    } catch (error) {
      console.error("Error fetching orders:", error)
      setError("Failed to load orders. Please try again.")
      setLoading(false)
    }
  }

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      setCurrentPage(1)
      fetchOrders()
    }, 300)
    return () => clearTimeout(delaySearch)
  }, [searchTerm])

  useEffect(() => {
    fetchOrders()
  }, [currentPage, statusFilter, branchFilter, paymentMethodFilter, startDate, endDate, singleDate])

  const handleViewOrder = (order) => {
    setSelectedOrder(order)
    setViewModalOpen(true)
  }

  const handlePrintBill = async (order) => {
    // Enrich items with gstRate from menu - match by menuItemId OR item name
    let enrichedItems = order.items || []
    try {
      const menuResp = await api.get(`/menu?limit=500`)
      const menuList = menuResp.data?.data || menuResp.data || []
      const menuById = {}
      const menuByName = {}
      menuList.forEach(m => {
        menuById[m._id] = m
        const key = (m.name || m.itemName || '').toLowerCase().trim()
        if (key) menuByName[key] = m
      })
      enrichedItems = enrichedItems.map(item => {
        if (item.gstRate && item.gstRate > 0) return item
        const rawName = (item.name || '').toLowerCase().trim()
        // Remove number prefix like "001 " or "1990 "
        const cleanName = rawName.replace(/^\d+\s+/, '')
        const matched = menuById[item.menuItemId] 
          || menuByName[rawName]
          || menuByName[cleanName]
          || menuList.find(m => {
              const mRaw = (m.name || m.itemName || '').toLowerCase().trim()
              const mClean = mRaw.replace(/^\d+\s+/, '')
              // exact after stripping prefix, or one contains the other
              return mClean === cleanName || mRaw === rawName || mRaw.endsWith(cleanName) || cleanName.endsWith(mClean)
            })
        return { ...item, gstRate: matched?.gstRate || 0 }
      })
    } catch (e) {
      // proceed with original items if fetch fails
    }

    const printWindow = window.open('', '_blank')

    // Calculate GST per item
    const subtotal = enrichedItems.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0)
    const totalGST = enrichedItems.reduce((sum, item) => {
      const rate = item.gstRate || 0
      return sum + (((item.price || 0) * item.quantity * rate) / 100)
    }, 0)
    const grandTotal = subtotal + totalGST

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bill - ${order.orderId}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
            .bill-header { text-align: center; margin-bottom: 10px; }
            .bill-title { font-size: 18px; font-weight: bold; }
            .bill-subtitle { font-size: 12px; margin-bottom: 5px; }
            .gstin { font-size: 10px; margin-bottom: 10px; }
            .bill-type { font-size: 14px; font-weight: bold; margin: 10px 0; }
            .divider { border-top: 1px dashed #000; margin: 8px 0; }
            .bill-info { font-size: 11px; margin-bottom: 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { text-align: left; border-bottom: 1px dashed #000; padding: 4px 0; }
            td { padding: 4px 0; }
            .totals { margin-top: 10px; }
            .total-row { display: flex; justify-content: space-between; margin: 4px 0; font-size: 12px; }
            .grand-total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 14px; margin-top: 6px; border-top: 1px solid #000; padding-top: 4px; }
            .footer { text-align: center; font-size: 10px; margin-top: 15px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>
          <div class="bill-header">
            <div class="bill-title">JAGALI KOOTA</div>
            <div class="bill-subtitle">MYSURU</div>
          </div>
          <div class="bill-type">*** CASH BILL ***</div>
          <div class="bill-info">
            Table ${order.tableNumber || 'N/A'}
          </div>
          <div class="divider"></div>
          <div class="bill-info">
            ${formatDateForPrint(order.orderTime)}
          </div>
          <div class="bill-info">
            BILL NO: ${order.orderId || 'N/A'}
          </div>
          <div class="bill-info">
            Bill Generated: ${new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}
          </div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th style="text-align: left;">ITEM NAME</th>
                <th style="text-align: center;">QTY</th>
                <th style="text-align: right;">RATE</th>
                <th style="text-align: right;">AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              ${enrichedItems.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td style="text-align: center;">${item.quantity.toFixed(3)}</td>
                  <td style="text-align: right;">${(item.price || 0).toFixed(2)}</td>
                  <td style="text-align: right;">${((item.price || 0) * item.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="divider"></div>
          <div class="totals">
            <div class="total-row">
              <span>SUBTOTAL:</span>
              <span>₹${subtotal.toFixed(2)}</span>
            </div>
            ${totalGST > 0 ? `
            <div class="total-row">
              <span>GST AMOUNT:</span>
              <span>₹${totalGST.toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="grand-total-row">
              <span>GRAND TOTAL:</span>
              <span>₹${grandTotal.toFixed(2)}</span>
            </div>
          </div>
          <div class="divider"></div>
          <div class="footer">
            .. !! THANK YOU, VISIT AGAIN !!..
          </div>
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>
    `)
    printWindow.document.close()
  }

  const formatDateForPrint = (dateString) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const year = date.getFullYear()
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    const ampm = date.getHours() >= 12 ? 'pm' : 'am'
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds} ${ampm}`
  }

  const clearDateFilters = () => {
    setStartDate("")
    setEndDate("")
    setSingleDate("")
  }

  const formatDate = (dateString) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatDateForDisplay = (dateString) => {
    if (!dateString) return "any date"
    const date = new Date(dateString)
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "pending": return { bg: "#fef3c7", color: "#92400e" }
      case "preparing": return { bg: "#dbeafe", color: "#1e40af" }
      case "served": return { bg: "#d1fae5", color: "#065f46" }
      case "completed": return { bg: "#f3f4f6", color: "#374151" }
      case "cancelled": return { bg: "#fee2e2", color: "#991b1b" }
      default: return { bg: "#f3f4f6", color: "#374151" }
    }
  }

  const calculateStats = () => {
    const totalRevenue = allOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0)
    const pendingOrders = allOrders.filter((o) => o.orderStatus === "pending").length
    const completedOrders = allOrders.filter((o) => o.orderStatus === "completed").length
    return { totalOrders, totalRevenue, pendingOrders, completedOrders }
  }

  const stats = calculateStats()

  if (loading && allOrders.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Loader size={48} />
      </div>
    )
  }

  return (
    <div className="public-orders-container">
      <div className="public-orders-content">
        <div className="orders-header">
          <div className="header-title-section">
            <div className="header-icon-box">
              <QrCode size={32} style={{ color: '#ea580c' }} />
            </div>
            <div>
              <h1 className="header-title">Public Restaurant Orders</h1>
              <p className="header-subtitle">Orders placed through QR code scanning</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
            {lastUpdated && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#6b7280' }}>
                <div style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%' }}></div>
                <span>Last updated: {formatDate(lastUpdated)}</span>
              </div>
            )}
            {(startDate || endDate) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#ea580c', fontWeight: '500' }}>
                <Calendar size={14} />
                <span>
                  Showing orders from {formatDateForDisplay(startDate)} to {formatDateForDisplay(endDate)}
                </span>
              </div>
            )}
            {singleDate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#ea580c', fontWeight: '500' }}>
                <Calendar size={14} />
                <span>
                  Showing orders for {formatDateForDisplay(singleDate)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card-content">
              <div style={{ padding: '16px', background: '#fed7aa', borderRadius: '12px' }}>
                <QrCode style={{ color: '#ea580c' }} size={32} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <p className="stat-label">Total Orders</p>
                <p className="stat-value" style={{ color: '#111827' }}>{stats.totalOrders}</p>
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-content">
              <div style={{ padding: '16px', background: '#d1fae5', borderRadius: '12px' }}>
                <IndianRupee style={{ color: '#059669' }} size={32} />
              </div>
              <div style={{ textAlign: 'right' }}>
                <p className="stat-label">Total Revenue</p>
                <p className="stat-value" style={{ color: '#059669' }}>₹{stats.totalRevenue.toFixed(2)}</p>
              </div>
            </div>
          </div>

        
        </div>

        <div className="filters-container">
          <div className="filters-grid">
            <div className="search-wrapper">
              <Search className="search-icon" size={20} />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>

            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="filter-select">
              <option value="all">All Branches</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>{branch.name}</option>
              ))}
            </select>

            <div className="date-filter-wrapper">
              <div className="date-input-group">
                <Calendar size={16} className="date-icon" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value)
                    setSingleDate("") // Clear single date when using range
                  }}
                  className="date-input"
                  placeholder="Start Date"
                />
              </div>
              <span className="date-separator">to</span>
              <div className="date-input-group">
                <Calendar size={16} className="date-icon" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value)
                    setSingleDate("") // Clear single date when using range
                  }}
                  className="date-input"
                  placeholder="End Date"
                />
              </div>
              {(startDate || endDate) && (
                <button onClick={clearDateFilters} className="clear-date-btn">
                  Clear
                </button>
              )}
            </div>

            <div className="date-filter-wrapper" style={{ marginTop: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151', marginRight: '8px' }}>Or select specific date:</span>
              <div className="date-input-group">
                <Calendar size={16} className="date-icon" />
                <input
                  type="date"
                  value={singleDate}
                  onChange={(e) => {
                    setSingleDate(e.target.value)
                    setStartDate("") // Clear range when using single date
                    setEndDate("")
                  }}
                  className="date-input"
                  placeholder="Select Date"
                />
              </div>
              {singleDate && (
                <button onClick={clearDateFilters} className="clear-date-btn">
                  Clear
                </button>
              )}
            </div>

            {/* <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="served">Served</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select> */}

            {/* <select value={paymentMethodFilter} onChange={(e) => setPaymentMethodFilter(e.target.value)} className="filter-select">
              <option value="all">All Payment Methods</option>
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="upi">UPI</option>
            </select> */}
          </div>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', borderLeft: '4px solid #ef4444', color: '#991b1b', padding: '16px 24px', borderRadius: '12px', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertCircle size={24} />
            <span style={{ fontWeight: '500' }}>{error}</span>
          </div>
        )}

        <div className="orders-table-container">
          <table className="orders-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Table</th>
                <th>Branch</th>
                <th>Amount</th>
                <th>Date & Time</th>
                <th>Print Bill</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allOrders.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    <div className="empty-icon">
                      <QrCode style={{ color: '#9ca3af' }} size={48} />
                    </div>
                    <p className="empty-title">No orders found</p>
                    <p className="empty-subtitle">Orders placed through QR codes will appear here</p>
                  </td>
                </tr>
              ) : (
                allOrders.map((order) => {
                  const statusColors = getStatusColor(order.orderStatus)
                  return (
                    <tr key={order._id}>
                      <td>
                        <div className="order-id-cell">
                          <div className="order-id-icon">
                            <QrCode size={16} style={{ color: '#ea580c' }} />
                          </div>
                          <span style={{ fontSize: '14px', fontWeight: '600' }}>{order.orderId}</span>
                        </div>
                      </td>
                      <td>
                        <div className="customer-cell">
                          <div className="customer-name">
                            <User size={14} style={{ color: '#6b7280' }} />
                            {order.customerName}
                          </div>
                          <div className="customer-mobile">
                            <Phone size={12} />
                            {order.customerMobile}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="table-cell">
                          <span style={{ fontWeight: '600' }}>{order.tableNumber}</span>
                          {order.peopleCount && (
                            <span className="guest-badge">{order.peopleCount} guests</span>
                          )}
                        </div>
                      </td>
                      <td style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
                        {order.branchName || "N/A"}
                      </td>
                      <td className="amount-cell">
                        {(order.totalAmount || 0).toFixed(2)}
                      </td>
                      <td style={{ fontSize: '14px', color: '#6b7280' }}>
                        {formatDate(order.orderTime)}
                      </td>
                      <td>
                        <button onClick={() => handlePrintBill(order)} className="print-bill-btn" style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#374151' }}>
                          <Printer size={14} />
                          Print Bill
                        </button>
                      </td>
                      <td>
                        <button onClick={() => handleViewOrder(order)} className="view-details-btn">
                          View Details
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="pagination-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', padding: '20px' }}>
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="pagination-btn"
              style={{
                padding: '8px 16px',
                background: currentPage === 1 ? '#e5e7eb' : '#ea580c',
                color: currentPage === 1 ? '#9ca3af' : 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                fontWeight: '500'
              }}
            >
              Previous
            </button>
            <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="pagination-btn"
              style={{
                padding: '8px 16px',
                background: currentPage === totalPages ? '#e5e7eb' : '#ea580c',
                color: currentPage === totalPages ? '#9ca3af' : 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                fontWeight: '500'
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {viewModalOpen && selectedOrder && (
        <div className="modal-overlay" onClick={() => setViewModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-content">
                <div className="modal-icon-box">
                  <QrCode size={24} style={{ color: 'white' }} />
                </div>
                <h2 className="modal-title">Order Details</h2>
              </div>
              <button onClick={() => setViewModalOpen(false)} className="modal-close-btn">
                <X size={24} />
              </button>
            </div>

            <div className="modal-body">
              <div className="order-info-grid">
                <div className="info-card" style={{ background: '#dbeafe' }}>
                  <p className="info-label" style={{ color: '#1e40af' }}>Customer Name</p>
                  <p className="info-value">{selectedOrder.customerName}</p>
                </div>
                <div className="info-card" style={{ background: '#dbeafe' }}>
                  <p className="info-label" style={{ color: '#1e40af' }}>Mobile Number</p>
                  <p className="info-value">{selectedOrder.customerMobile}</p>
                </div>
                <div className="info-card" style={{ background: '#e9d5ff' }}>
                  <p className="info-label" style={{ color: '#7c3aed' }}>Table Number</p>
                  <p className="info-value">{selectedOrder.tableNumber}</p>
                </div>
                <div className="info-card" style={{ background: '#e9d5ff' }}>
                  <p className="info-label" style={{ color: '#7c3aed' }}>Number of Guests</p>
                  <p className="info-value">{selectedOrder.peopleCount || "N/A"}</p>
                </div>
                <div className="info-card" style={{ background: '#d1fae5' }}>
                  <p className="info-label" style={{ color: '#059669' }}>Branch</p>
                  <p className="info-value">{selectedOrder.branchName}</p>
                </div>
                <div className="info-card" style={{ background: '#d1fae5' }}>
                  <p className="info-label" style={{ color: '#059669' }}>Order Time</p>
                  <p className="info-value">{formatDate(selectedOrder.orderTime)}</p>
                </div>
                
                <div className="info-card" style={{ background: '#fef3c7' }}>
                  <p className="info-label" style={{ color: '#d97706' }}>Payment Method</p>
                  <p className="info-value" style={{ textTransform: 'uppercase' }}>{selectedOrder.paymentMethod || "cash"}</p>
                </div>
              </div>

              <div className="items-section">
                <h3 className="items-title">
                  <div style={{ width: '4px', height: '24px', background: '#ea580c', borderRadius: '2px' }}></div>
                  Order Items
                </h3>
                <div className="items-table-container">
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th style={{ textAlign: 'left' }}>Item</th>
                        <th style={{ textAlign: 'center' }}>Qty</th>
                        <th style={{ textAlign: 'right' }}>Price</th>
                        <th style={{ textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items?.map((item, index) => (
                        <tr key={index}>
                          <td style={{ fontWeight: '500' }}>{item.name}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="qty-badge">{item.quantity}</span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: '500', color: '#374151' }}>
                            {(item.price || 0).toFixed(2)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#111827' }}>
                            {((item.price || 0) * item.quantity).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="total-section">
                <div className="total-row">
                  <span className="total-label">Total Amount:</span>
                  <span className="total-amount">{(selectedOrder.totalAmount || 0).toFixed(2)}</span>
                </div>
              </div>

              {selectedOrder.notes && (
                <div className="notes-section">
                  <p className="notes-label">Notes:</p>
                  <p className="notes-text">{selectedOrder.notes}</p>
                </div>
              )}

              <div className="modal-footer">
                <button onClick={() => setViewModalOpen(false)} className="close-modal-btn">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PublicRestaurantOrders
