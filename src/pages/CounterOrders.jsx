import { useState, useEffect } from "react"
import { Search, Download, X, Check, AlertCircle, CreditCard, IndianRupee, Loader } from "lucide-react"
import axios from "axios"

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel",
  headers: {
    "Content-Type": "application/json",
  },
})

const CounterOrders = () => {
  const [allOrders, setAllOrders] = useState([]) // Store all orders from API
  const [displayedOrders, setDisplayedOrders] = useState([]) // Orders to display for current page
  const [filteredOrders, setFilteredOrders] = useState([]) // Orders after applying search filter
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // State for modals
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [editFormData, setEditFormData] = useState({
    orderStatus: "",
    paymentStatus: "",
  })
  const [successMessage, setSuccessMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [orderStatusFilter, setOrderStatusFilter] = useState("all")
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all")
  const [branchFilter, setBranchFilter] = useState("all")

  // State for collection statistics
  const [collectionPeriod, setCollectionPeriod] = useState("today")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const ordersPerPage = 7

  // Fetch orders and related data on component mount or when filters change
  useEffect(() => {
    fetchBranches()
    fetchOrders()
  }, [orderStatusFilter, paymentStatusFilter, branchFilter])

  // Fetch all branches
  const fetchBranches = async () => {
    try {
      const response = await api.get("/branch")
      setBranches(response.data)
    } catch (error) {
      console.error("Error fetching branches:", error)
      setError("Failed to load branches. Some filter options may not be available.")
    }
  }

  // Fetch all counter orders and guest orders from ViratCounter app
  const fetchOrders = async () => {
    setLoading(true)
    setError("")
    setAllOrders([]) // Clear all orders before fetching
    setFilteredOrders([]) // Clear filtered orders
    setDisplayedOrders([]) // Clear displayed orders

    try {
      /* console.log("Fetching counter orders and guest orders...") */ // Debug log
      
      // Fetch both counter orders and guest orders from ViratCounter app
      const [counterResponse, staffResponse] = await Promise.all([
        api.get("/counter-order/orders?fetchAll=true").catch(() => ({ data: { orders: [] } })),
        api.get("/staff-order").catch(() => ({ data: { orders: [] } }))
      ])
      
      /* console.log("Counter orders API response:", counterResponse.data) */ // Debug log
      /* console.log("Staff orders API response:", staffResponse.data) */ // Debug log

      let allOrdersData = []

      // Process counter orders - handle different response formats
      let counterOrders = [];
      if (counterResponse.data.success && Array.isArray(counterResponse.data.data)) {
        // New format: {success: true, count: X, data: [...]}
        counterOrders = counterResponse.data.data;
      } else if (counterResponse.data.orders && Array.isArray(counterResponse.data.orders)) {
        // Old format: {orders: [...]}
        counterOrders = counterResponse.data.orders;
      } else if (Array.isArray(counterResponse.data)) {
        // Direct array format
        counterOrders = counterResponse.data;
      }

      if (counterOrders.length > 0) {
        const formattedCounterOrders = counterOrders
          .map((order, index) => {
            // Log orders with missing fields for debugging
            if (!order.id) {
              console.warn(`Counter order at index ${index} is missing id:`, order)
            }
            if (!order.customerName) {
              console.warn(`Counter order at index ${index} is missing customerName:`, order)
            }
            if (!order.userId?.name) {
              console.warn(`Counter order at index ${index} is missing counter user name:`, order)
            }

            return {
              id: order.id || `temp-counter-id-${index}`, // Fallback ID if id is missing
              customerName: order.customerName || "Unknown Customer",
              phoneNumber: order.phoneNumber || "N/A",
              counterUser: order.userId?.name || "Unknown Counter User",
              counterUserId: order.userId?.id || null,
              date: new Date(order.createdAt || Date.now()).toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
              branch: order.branch?.name || "Unknown Branch",
              branchId: order.branch?.id || null,
              invoice: order.invoice?.invoiceNumber || "N/A",
              items: order.items?.length || 0,
              itemNames: order.items?.map(item => item.name).join(", ") || "No items",
              // Use backend values for tax and service charge
              subtotal: order.subtotal || order.totalAmount || 0,
              tax: order.tax || 0,
              serviceCharge: order.serviceCharge || 0,
              grandTotal: order.grandTotal || order.totalAmount || 0,
              amount: `₹${(order.grandTotal || order.totalAmount || 0).toFixed(2)}`,
              totalAmount: order.totalAmount || 0,
              orderStatus: order.orderStatus || "pending",
              paymentMethod: order.paymentMethod || "cash",
              paymentStatus: order.paymentStatus || "pending",
              cancellationReason: order.cancellationReason || "",
              cancelledAt: order.cancelledAt || null,
              // Include the original order for reference
              originalOrder: order,
              orderSource: 'counter' // Mark as counter order
            }
          })
          .filter((order) => order.id) // Remove any invalid orders
        
        allOrdersData = [...allOrdersData, ...formattedCounterOrders]
      }

      // Process guest orders from ViratCounter app (Self Service category)
      let staffOrders = [];
      if (staffResponse.data.success && Array.isArray(staffResponse.data.data)) {
        // New format: {success: true, count: X, data: [...]}
        staffOrders = staffResponse.data.data;
      } else if (staffResponse.data.orders && Array.isArray(staffResponse.data.orders)) {
        // Old format: {orders: [...]}
        staffOrders = staffResponse.data.orders;
      } else if (Array.isArray(staffResponse.data)) {
        // Direct array format
        staffOrders = staffResponse.data;
      }

      if (staffOrders.length > 0) {
        const guestOrders = staffOrders.filter(order => 
          order.isGuestOrder && 
          order.categoryName && 
          (order.categoryName.toLowerCase().includes('self service') ||
           order.categoryName.toLowerCase().includes('counter'))
        )

        const formattedGuestOrders = guestOrders
          .map((order, index) => {
            return {
              id: order._id || `temp-guest-id-${index}`,
              customerName: order.customerName || "Unknown Customer",
              phoneNumber: order.customerMobile || "N/A",
              counterUser: "ViratCounter App", // Guest orders are from the app
              counterUserId: null,
              date: new Date(order.orderTime || order.createdAt || Date.now()).toLocaleString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
              branch: order.branchName || "Unknown Branch",
              branchId: order.branchId || null,
              invoice: order.orderId || "N/A",
              items: order.items?.length || 0,
              itemNames: order.items?.map(item => item.name).join(", ") || "No items",
              subtotal: order.subtotal || order.totalAmount || 0,
              tax: order.tax || 0,
              serviceCharge: order.serviceCharge || 0,
              grandTotal: order.grandTotal || order.totalAmount || 0,
              amount: `₹${(order.grandTotal || order.totalAmount || 0).toFixed(2)}`,
              totalAmount: order.totalAmount || 0,
              orderStatus: order.status || "pending", // Guest orders use 'status' field
              paymentMethod: order.paymentMethod || "cash",
              paymentStatus: order.paymentStatus || "pending",
              cancellationReason: order.cancellationReason || "",
              cancelledAt: order.cancelledAt || null,
              // Include the original order for reference
              originalOrder: order,
              orderSource: 'guest' // Mark as guest order
            }
          })
          .filter((order) => order.id) // Remove any invalid orders
        
        allOrdersData = [...allOrdersData, ...formattedGuestOrders]
      }

      // Sort all orders by date (newest first)
      allOrdersData.sort((a, b) => new Date(b.originalOrder.createdAt || b.originalOrder.orderTime) - new Date(a.originalOrder.createdAt || a.originalOrder.orderTime))

      // Apply server-side filters
      let filteredData = allOrdersData

      if (orderStatusFilter !== "all") {
        filteredData = filteredData.filter((order) => order.orderStatus === orderStatusFilter)
      }

      if (paymentStatusFilter !== "all") {
        filteredData = filteredData.filter((order) => order.paymentStatus === paymentStatusFilter)
      }

      if (branchFilter !== "all") {
        filteredData = filteredData.filter((order) => order.branchId === branchFilter)
      }

      setAllOrders(filteredData)
    } catch (error) {
      console.error("Error fetching orders:", error)
      setError("Failed to load orders. Please refresh the page and try again.")
    } finally {
      setLoading(false)
    }
  }

  // Handle search filtering and pagination
  useEffect(() => {
    // Apply client-side search filter with defensive checks
    const filtered = allOrders.filter((order) => {
      if (!searchTerm.trim()) return true

      const customerName = order.customerName || ""
      const phoneNumber = order.phoneNumber || ""
      const counterUser = order.counterUser || ""
      const invoice = order.invoice || ""
      const searchLower = searchTerm.trim().toLowerCase()

      console.log(`Searching for "${searchLower}" in order:`, { customerName, phoneNumber, counterUser, invoice }) // Debug log

      return (
        customerName.toLowerCase().includes(searchLower) ||
        phoneNumber.toLowerCase().includes(searchLower) ||
        counterUser.toLowerCase().includes(searchLower) ||
        invoice.toLowerCase().includes(searchLower)
      )
    })
    setFilteredOrders(filtered)
    setTotalPages(Math.ceil(filtered.length / ordersPerPage))
    setCurrentPage(1) // Reset to first page on search or filter change
   /*  console.log("Filtered counter orders:", filtered) */ // Debug log
  }, [allOrders, searchTerm])

  // Handle pagination
  useEffect(() => {
    // Slice filtered orders for the current page
    const startIndex = (currentPage - 1) * ordersPerPage
    const endIndex = startIndex + ordersPerPage
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex)
    setDisplayedOrders(paginatedOrders)
   /*  console.log("Paginated counter orders:", paginatedOrders) */ // Debug log
  }, [filteredOrders, currentPage])

  // Handle search input with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      // Search is handled in the filteredOrders useEffect
    }, 300) // Reduced debounce time for better UX

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Handle view order
  const handleViewOrder = (order) => {
    setSelectedOrder(order)
    setViewModalOpen(true)
  }

  // Handle edit order
  const handleEditOrder = (order) => {
    setSelectedOrder(order)
    setEditFormData({
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
    })
    setEditModalOpen(true)
  }

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target
    setEditFormData({
      ...editFormData,
      [name]: value,
    })
  }

  // Handle save changes
  const handleSaveChanges = async () => {
    setIsSubmitting(true)

    try {
      const isGuestOrder = selectedOrder.orderSource === 'guest'
      
      if (isGuestOrder) {
        // For guest orders from ViratCounter app, use staff-order API
        const updateData = {}
        
        if (editFormData.orderStatus !== selectedOrder.orderStatus) {
          updateData.status = editFormData.orderStatus
        }
        
        if (editFormData.paymentStatus !== selectedOrder.paymentStatus) {
          updateData.paymentStatus = editFormData.paymentStatus
        }
        
        // Update guest order using staff-order endpoint
        if (Object.keys(updateData).length > 0) {
          await api.put(`/staff-order/${selectedOrder.id}/status`, updateData)
        }
      } else {
        // For regular counter orders, use counter-order API
        // Update order status if changed
        if (editFormData.orderStatus !== selectedOrder.orderStatus) {
          await api.put(`/counter-order/orders/${selectedOrder.id}/order-status`, {
            orderStatus: editFormData.orderStatus,
          })
        }

        // Update payment status if changed
        if (editFormData.paymentStatus !== selectedOrder.paymentStatus) {
          await api.put(`/counter-order/orders/${selectedOrder.id}/payment-status`, {
            paymentStatus: editFormData.paymentStatus,
          })
        }
      }

      // Refresh orders
      await fetchOrders()

      setEditModalOpen(false)
      const orderType = isGuestOrder ? 'ViratCounter' : 'Counter'
      setSuccessMessage(`✅ ${orderType} order status updated successfully`)

      // Auto-hide success message after 2 seconds (reduced from 3)
      setTimeout(() => {
        setSuccessMessage("")
      }, 2000)
    } catch (error) {
      console.error("Error updating order:", error)
      alert("Failed to update order. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Close modals
  const closeViewModal = () => {
    setViewModalOpen(false)
    setSelectedOrder(null)
  }

  const closeEditModal = () => {
    setEditModalOpen(false)
    setSelectedOrder(null)
  }

  // Reset pagination when filters change
  const handleFilterChange = (type, value) => {
    if (type === "orderStatus") {
      setOrderStatusFilter(value)
    } else if (type === "paymentStatus") {
      setPaymentStatusFilter(value)
    } else if (type === "branch") {
      setBranchFilter(value)
    }
    setCurrentPage(1)
  }

  // Get payment method icon
  const getPaymentMethodIcon = (method) => {
    switch (method?.toLowerCase()) {
      case "card":
        return <CreditCard size={16} />
      case "upi":
        return <IndianRupee size={16} />
      case "qr":
        return <IndianRupee size={16} />
      case "cash":
      default:
        return <IndianRupee size={16} />
    }
  }

  // Export orders as Excel with detailed information
  const exportOrders = () => {
    // Create detailed CSV with comprehensive order information
    let csv = "Order ID,Customer Name,Phone Number,Counter User,Date & Time,Branch,Invoice Number,Order Status,Payment Status,Payment Method,Subtotal,Tax,Service Charge,Grand Total,Items Count,Item Details\n"

    // Add summary statistics at the top
    const now = new Date()
    const exportDate = now.toLocaleDateString('en-IN') + ' ' + now.toLocaleTimeString('en-IN')
    
    // Calculate summary statistics
    const totalOrdersCount = filteredOrders.length
    const totalAmount = filteredOrders.reduce((sum, order) => sum + (order.grandTotal || 0), 0)
    const paidOrders = filteredOrders.filter(order => order.paymentStatus === "completed")
    const paidAmount = paidOrders.reduce((sum, order) => sum + (order.grandTotal || 0), 0)
    const unpaidAmount = totalAmount - paidAmount
    
    // Add summary header
    csv += `\n"COUNTER ORDERS EXPORT SUMMARY"\n`
    csv += `"Export Date & Time:","${exportDate}"\n`
    csv += `"Total Orders:",${totalOrdersCount}\n`
    csv += `"Total Amount:",${totalAmount.toFixed(2)}\n`
    csv += `"Paid Orders:",${paidOrders.length}\n`
    csv += `"Paid Amount:",${paidAmount.toFixed(2)}\n`
    csv += `"Unpaid Orders:",${totalOrdersCount - paidOrders.length}\n`
    csv += `"Unpaid Amount:",${unpaidAmount.toFixed(2)}\n`
    csv += `"Collection Rate:",${totalAmount > 0 ? ((paidAmount / totalAmount) * 100).toFixed(1) : 0}\n`
    csv += `\n"DETAILED ORDER LIST"\n`
    csv += "Order ID,Customer Name,Phone Number,Counter User,Date & Time,Branch,Invoice Number,Order Status,Payment Status,Payment Method,Subtotal,Tax,Service Charge,Grand Total,Items Count,Item Details\n"

    // Add each order with detailed information
    filteredOrders.forEach((order) => {
      // Format item details
      const itemDetails = order.originalOrder?.items?.map(item => 
        `${item.name} (Qty: ${item.quantity}, Price: ${item.price.toFixed(2)})`
      ).join('; ') || 'No items'

      // Format date
      const orderDate = new Date(order.originalOrder?.createdAt || order.originalOrder?.orderTime || Date.now())
      const formattedDate = orderDate.toLocaleDateString('en-IN') + ' ' + orderDate.toLocaleTimeString('en-IN')

      csv += `"${order.invoice || order.id}","${order.customerName}","${order.phoneNumber}","${order.counterUser}","${formattedDate}","${order.branch}","${order.invoice}","${order.orderStatus}","${order.paymentStatus}","${order.paymentMethod}",${order.subtotal?.toFixed(2) || '0.00'},${order.tax?.toFixed(2) || '0.00'},${order.serviceCharge?.toFixed(2) || '0.00'},${order.grandTotal?.toFixed(2) || '0.00'},${order.items},"${itemDetails}"\n`
    })

    // Add payment method breakdown
    csv += `\n"PAYMENT METHOD BREAKDOWN"\n`
    const paymentMethods = {}
    filteredOrders.forEach(order => {
      const method = order.paymentMethod || 'cash'
      if (!paymentMethods[method]) {
        paymentMethods[method] = { count: 0, amount: 0 }
      }
      paymentMethods[method].count++
      paymentMethods[method].amount += order.grandTotal || 0
    })

    csv += "Payment Method,Order Count,Total Amount\n"
    Object.entries(paymentMethods).forEach(([method, data]) => {
      csv += `"${method.charAt(0).toUpperCase() + method.slice(1)}",${data.count},${data.amount.toFixed(2)}\n`
    })

    // Add branch-wise breakdown
    csv += `\n"BRANCH-WISE BREAKDOWN"\n`
    const branchStats = {}
    filteredOrders.forEach(order => {
      const branch = order.branch || 'Unknown'
      if (!branchStats[branch]) {
        branchStats[branch] = { count: 0, amount: 0 }
      }
      branchStats[branch].count++
      branchStats[branch].amount += order.grandTotal || 0
    })

    csv += "Branch Name,Order Count,Total Amount\n"
    Object.entries(branchStats).forEach(([branch, data]) => {
      csv += `"${branch}",${data.count},${data.amount.toFixed(2)}\n`
    })

    // Add counter user breakdown
    csv += `\n"COUNTER USER BREAKDOWN"\n`
    const userStats = {}
    filteredOrders.forEach(order => {
      const user = order.counterUser || 'Unknown'
      if (!userStats[user]) {
        userStats[user] = { count: 0, amount: 0 }
      }
      userStats[user].count++
      userStats[user].amount += order.grandTotal || 0
    })

    csv += "Counter User,Order Count,Total Amount\n"
    Object.entries(userStats).forEach(([user, data]) => {
      csv += `"${user}",${data.count},${data.amount.toFixed(2)}\n`
    })

    // Create and download file
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.setAttribute("hidden", "")
    a.setAttribute("href", url)
    a.setAttribute("download", `counter-orders-detailed-export-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  return (
    <>
      <div className="orders-page">
      {/* Success message */}
      {successMessage && (
        <div className="success-message">
          <Check size={16} />
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage("")}>
            <X size={16} />
          </button>
        </div>
      )}

      <div className="page-header">
        <h1>Counter Orders & ViratCounter App</h1>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={exportOrders}>
            <Download size={16} />
            <span>Export to Excel</span>
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by customer name, phone, counter user, or invoice..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
          <select
            className="filter-select"
            value={orderStatusFilter}
            onChange={(e) => handleFilterChange("orderStatus", e.target.value)}
          >
            <option value="all">All Order Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            className="filter-select"
            value={paymentStatusFilter}
            onChange={(e) => handleFilterChange("paymentStatus", e.target.value)}
          >
            <option value="all">All Payment Status</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>

          </select>
          <select
            className="filter-select"
            value={branchFilter}
            onChange={(e) => handleFilterChange("branch", e.target.value)}
          >
            <option value="all">All Branches</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div
          className="error-container"
          style={{
            margin: "20px 0",
            padding: "10px 15px",
            backgroundColor: "#fee2e2",
            color: "#dc2626",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Collection Statistics */}
      <div className="collection-stats-section">
        <div className="stats-header">
          <h2>Collection Statistics</h2>
          <div className="period-filters">
            <button
              className={`period-btn ${collectionPeriod === "today" ? "active" : ""}`}
              onClick={() => setCollectionPeriod("today")}
            >
              Today
            </button>
            <button
              className={`period-btn ${collectionPeriod === "week" ? "active" : ""}`}
              onClick={() => setCollectionPeriod("week")}
            >
              This Week
            </button>
            <button
              className={`period-btn ${collectionPeriod === "month" ? "active" : ""}`}
              onClick={() => setCollectionPeriod("month")}
            >
              This Month
            </button>
          </div>
        </div>

        <div className="stats-cards">
          {(() => {
            // Calculate collection statistics based on selected period
            const now = new Date()
            let startDate

            if (collectionPeriod === "today") {
              startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            } else if (collectionPeriod === "week") {
              const dayOfWeek = now.getDay()
              const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
              startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysToMonday)
            } else if (collectionPeriod === "month") {
              startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            }

            // Filter all orders by date only
            const allFilteredOrders = allOrders.filter(order => {
              const orderDate = new Date(order.originalOrder?.createdAt || order.originalOrder?.orderTime)
              return orderDate >= startDate
            })

            // Filter paid orders (completed payment status)
            const paidOrders = allFilteredOrders.filter(order => order.paymentStatus === "completed")
            
            // Filter unpaid orders (pending, failed, etc.)
            const unpaidOrders = allFilteredOrders.filter(order => order.paymentStatus !== "completed")

            // Calculate totals for all orders
            const totalAmount = allFilteredOrders.reduce((sum, order) => sum + (order.grandTotal || 0), 0)
            const totalOrders = allFilteredOrders.length

            // Calculate totals for paid orders
            const paidAmount = paidOrders.reduce((sum, order) => sum + (order.grandTotal || 0), 0)
            const paidCount = paidOrders.length

            // Calculate totals for unpaid orders
            const unpaidAmount = unpaidOrders.reduce((sum, order) => sum + (order.grandTotal || 0), 0)
            const unpaidCount = unpaidOrders.length

            return (
              <>
                <div className="stat-card total">
                  <div className="stat-icon">📊</div>
                  <div className="stat-content">
                    <div className="stat-label">Total Orders</div>
                    <div className="stat-value">{totalOrders} orders</div>
                    <div className="stat-count">₹{totalAmount.toFixed(2)}</div>
                  </div>
                </div>

                <div className="stat-card paid">
                  <div className="stat-icon">✅</div>
                  <div className="stat-content">
                    <div className="stat-label">Paid Orders</div>
                    <div className="stat-value">{paidCount} orders</div>
                    <div className="stat-count">₹{paidAmount.toFixed(2)}</div>
                  </div>
                </div>

                <div className="stat-card unpaid">
                  <div className="stat-icon">⏳</div>
                  <div className="stat-content">
                    <div className="stat-label">Unpaid Orders</div>
                    <div className="stat-value">{unpaidCount} orders</div>
                    <div className="stat-count">₹{unpaidAmount.toFixed(2)}</div>
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      </div>

      <div className="data-card">
        {loading ? (
          <div
            className="loading-container"
            style={{
              textAlign: "center",
              padding: "40px 0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
            }}
          >
            <Loader size={24} className="animate-spin" />
            <p>Loading counter orders...</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Phone</th>
                <th>User</th>
                <th>Date</th>
                <th>Branch</th>
                <th>Invoice</th>
                <th>Item Names</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedOrders.length > 0 ? (
                displayedOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.customerName}</td>
                    <td>{order.phoneNumber}</td>
                    <td>{order.counterUser}</td>
                    <td>{order.date}</td>
                    <td>{order.branch}</td>
                    <td>{order.invoice}</td>
                    <td>{order.itemNames}</td>
                    <td>{order.amount}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btn view" onClick={() => handleViewOrder(order)}>
                          View
                        </button>
                        <button className="action-btn edit" onClick={() => handleEditOrder(order)}>
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="no-orders">
                    No counter orders found matching your criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {totalPages > 0 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1 || loading}
          >
            Previous
          </button>

          <div className="pagination-pages">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }

              return (
                <button
                  key={pageNum}
                  className={`pagination-page ${currentPage === pageNum ? "active" : ""}`}
                  onClick={() => setCurrentPage(pageNum)}
                  disabled={loading}
                >
                  {pageNum}
                </button>
              )
            })}

            {totalPages > 5 && currentPage < totalPages - 2 && <span className="pagination-ellipsis">...</span>}

            {totalPages > 5 && currentPage < totalPages - 2 && (
              <button
                className={`pagination-page ${currentPage === totalPages ? "active" : ""}`}
                onClick={() => setCurrentPage(totalPages)}
                disabled={loading}
              >
                {totalPages}
              </button>
            )}
          </div>

          <button
            className="pagination-btn"
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages || loading}
          >
            Next
          </button>
        </div>
      )}

      {/* View Order Modal */}
      {viewModalOpen && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Counter Order Details - {selectedOrder.invoice}</h3>
              <button className="modal-close" onClick={closeViewModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="order-details">
                <div className="order-detail-row">
                  <div className="order-detail-label">Customer Name</div>
                  <div className="order-detail-value">{selectedOrder.customerName}</div>
                </div>
                <div className="order-detail-row">
                  <div className="order-detail-label">Phone Number</div>
                  <div className="order-detail-value">{selectedOrder.phoneNumber}</div>
                </div>
                <div className="order-detail-row">
                  <div className="order-detail-label">Counter User</div>
                  <div className="order-detail-value">{selectedOrder.counterUser}</div>
                </div>
                <div className="order-detail-row">
                  <div className="order-detail-label">Date</div>
                  <div className="order-detail-value">{selectedOrder.date}</div>
                </div>
                <div className="order-detail-row">
                  <div className="order-detail-label">Branch</div>
                  <div className="order-detail-value">{selectedOrder.branch}</div>
                </div>
                <div className="order-detail-row">
                  <div className="order-detail-label">Invoice Number</div>
                  <div className="order-detail-value">{selectedOrder.invoice}</div>
                </div>
                <div className="order-detail-row">
                  <div className="order-detail-label">Payment Method</div>
                  <div className="order-detail-value">
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {getPaymentMethodIcon(selectedOrder.paymentMethod)}
                      <span>
                        {selectedOrder.paymentMethod
                          ? selectedOrder.paymentMethod.charAt(0).toUpperCase() + selectedOrder.paymentMethod.slice(1)
                          : "Cash"}
                      </span>
                    </div>
                  </div>
                </div>
                {selectedOrder.cancellationReason && (
                  <div className="order-detail-row">
                    <div className="order-detail-label">Cancellation Reason</div>
                    <div className="order-detail-value">{selectedOrder.cancellationReason}</div>
                  </div>
                )}
              </div>

              <div className="order-items-section">
                <h4>Order Items</h4>
                <div className="order-items-table">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.originalOrder?.items?.length > 0 ? (
                        selectedOrder.originalOrder.items.map((item, index) => (
                          <tr key={index}>
                            <td>{item.name}</td>
                            <td>{item.quantity}</td>
                            <td>₹{item.price.toFixed(2)}</td>
                            <td>₹{(item.price * item.quantity).toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" style={{ textAlign: "center" }}>
                            No items available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="order-items-section">
                <h4>Order Summary</h4>
                <div className="order-items-table">
                  <table className="data-table">
                    <tbody>
                      <tr>
                        <td>Subtotal</td>
                        <td style={{ textAlign: "right" }}>₹{selectedOrder.subtotal?.toFixed(2) || "0.00"}</td>
                      </tr>
                      {selectedOrder.tax > 0 && (
                        <tr>
                          <td>Tax</td>
                          <td style={{ textAlign: "right" }}>₹{selectedOrder.tax?.toFixed(2) || "0.00"}</td>
                        </tr>
                      )}
                      {selectedOrder.serviceCharge > 0 && (
                        <tr>
                          <td>Service Charge</td>
                          <td style={{ textAlign: "right" }}>₹{selectedOrder.serviceCharge?.toFixed(2) || "0.00"}</td>
                        </tr>
                      )}
                      <tr style={{ fontWeight: "bold", backgroundColor: "#f8f9fa" }}>
                        <td>Grand Total</td>
                        <td style={{ textAlign: "right", color: "#ff7e47" }}>
                          ₹{selectedOrder.grandTotal?.toFixed(2) || "0.00"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeViewModal}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  closeViewModal()
                  handleEditOrder(selectedOrder)
                }}
              >
                Edit Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editModalOpen && selectedOrder && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Edit Counter Order - {selectedOrder.invoice}</h3>
              <button className="modal-close" onClick={closeEditModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Customer Name</label>
                <input type="text" value={selectedOrder.customerName} className="form-input" disabled={true} />
              </div>

              <div className="form-group">
                <label className="form-label">Phone Number</label>
                <input type="text" value={selectedOrder.phoneNumber} className="form-input" disabled={true} />
              </div>

              <div className="form-group">
                <label className="form-label">Counter User</label>
                <input type="text" value={selectedOrder.counterUser} className="form-input" disabled={true} />
              </div>

              <div className="form-group">
                <label className="form-label">Branch</label>
                <input type="text" value={selectedOrder.branch} className="form-input" disabled={true} />
              </div>

              <div className="form-group">
                <label className="form-label">Order Status</label>
                <select
                  name="orderStatus"
                  value={editFormData.orderStatus}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Payment Status</label>
                <select
                  name="paymentStatus"
                  value={editFormData.paymentStatus}
                  onChange={handleInputChange}
                  className="form-select"
                >
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>

              <div className="order-items-section">
                <div className="section-header">
                  <h4>Order Items</h4>
                  <div className="alert-message">
                    <AlertCircle size={16} />
                    <span>Only order status and payment status can be updated</span>
                  </div>
                </div>
                <div className="order-items-table">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.originalOrder?.items?.length > 0 ? (
                        selectedOrder.originalOrder.items.map((item, index) => (
                          <tr key={index}>
                            <td>{item.name}</td>
                            <td>{item.quantity}</td>
                            <td>₹{item.price.toFixed(2)}</td>
                            <td>₹{(item.price * item.quantity).toFixed(2)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="4" style={{ textAlign: "center" }}>
                            No items available
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeEditModal} disabled={isSubmitting}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveChanges} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    <style>{`
      /* Collection Statistics */
      .collection-stats-section {
        background: white;
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        padding: 24px;
        margin-bottom: 24px;
      }

      .stats-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        flex-wrap: wrap;
        gap: 16px;
      }

      .stats-header h2 {
        font-size: 20px;
        font-weight: 600;
        color: #1f2937;
        margin: 0;
      }

      .period-filters {
        display: flex;
        gap: 8px;
        background: #f3f4f6;
        padding: 4px;
        border-radius: 8px;
      }

      .period-btn {
        padding: 8px 16px;
        border: none;
        background: transparent;
        color: #6b7280;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      }

      .period-btn:hover {
        background: #e5e7eb;
        color: #374151;
      }

      .period-btn.active {
        background: #d97706;
        color: white;
      }

      .stats-cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 20px;
      }

      .stat-card {
        background: #f8fafc;
        border-radius: 12px;
        padding: 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        border: 1px solid #e2e8f0;
        transition: all 0.2s ease;
      }

      .stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      }

      .stat-card.total {
        border-left: 4px solid #d97706;
      }

      .stat-card.paid {
        border-left: 4px solid #10b981;
      }

      .stat-card.unpaid {
        border-left: 4px solid #ef4444;
      }

      .stat-icon {
        font-size: 32px;
        line-height: 1;
      }

      .stat-content {
        flex: 1;
      }

      .stat-label {
        font-size: 14px;
        color: #6b7280;
        margin-bottom: 4px;
      }

      .stat-value {
        font-size: 24px;
        font-weight: 700;
        color: #1f2937;
        margin-bottom: 2px;
      }

      .stat-count {
        font-size: 12px;
        color: #9ca3af;
      }

      /* Responsive Design */
      @media (max-width: 1024px) {
        .collection-stats-section {
          padding: 20px;
        }

        .stats-header {
          flex-direction: column;
          align-items: flex-start;
        }

        .stats-cards {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 768px) {
        .collection-stats-section {
          padding: 16px;
        }

        .stats-header h2 {
          font-size: 18px;
        }

        .period-filters {
          width: 100%;
          justify-content: center;
        }

        .period-btn {
          flex: 1;
          text-align: center;
        }

        .stat-card {
          padding: 16px;
        }

        .stat-icon {
          font-size: 28px;
        }

        .stat-value {
          font-size: 20px;
        }
      }

      @media (max-width: 480px) {
        .collection-stats-section {
          padding: 12px;
        }

        .stats-header h2 {
          font-size: 16px;
        }

        .period-btn {
          padding: 6px 12px;
          font-size: 12px;
        }

        .stat-card {
          padding: 12px;
          gap: 12px;
        }

        .stat-icon {
          font-size: 24px;
        }

        .stat-value {
          font-size: 18px;
        }

        .stat-label {
          font-size: 13px;
        }

        .stat-count {
          font-size: 11px;
        }
      }
    `}</style>
    </>
  )
}

export default CounterOrders
