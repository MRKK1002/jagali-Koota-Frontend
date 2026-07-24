"use client"

import { useState, useEffect } from "react"
import {
  Search,
  Download,
  CreditCard,
  Wallet,
  ChevronLeft,
  ChevronRight,
  ArrowDown,
  ArrowUp,
  Users,
  RefreshCw,
} from "lucide-react"
import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel",
  headers: {
    "Content-Type": "application/json",
  },
})

const StaffPayment = () => {
  // State for data
  const [allPayments, setAllPayments] = useState([]) // All fetched payments
  const [displayedPayments, setDisplayedPayments] = useState([]) // Currently displayed payments
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // State for filters and sorting
  const [searchQuery, setSearchQuery] = useState("")
  const [orderTypeFilter, setOrderTypeFilter] = useState("all")
  const [sortBy, setSortBy] = useState("date")
  const [sortOrder, setSortOrder] = useState("desc")

  // State for pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const paymentsPerPage = 7
  // State for modals
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [showPaymentDetails, setShowPaymentDetails] = useState(false)

  // Fetch all payments data
  useEffect(() => {
    fetchAllPayments()
  }, [orderTypeFilter]) // Only refetch when order type filter changes

  // Handle search and pagination
  useEffect(() => {
    applyFiltersAndPagination()
  }, [allPayments, searchQuery, currentPage, sortBy, sortOrder])

  const fetchAllPayments = async () => {
    setLoading(true)
    setError("")
    try {
      // Only filter by order type on the server side
      const params = {}
      if (orderTypeFilter !== "all") {
        params.orderType = orderTypeFilter
      }

     /*  console.log("Fetching with params:", params) */
      const response = await api.get("/staff-order", { params })
      /* console.log("API Response:", response.data) */

      // Handle new API response format {success, count, data}
      let ordersData = []
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        // New format: {success, count, data}
        ordersData = response.data.data
      } else if (response.data && response.data.orders && Array.isArray(response.data.orders)) {
        // Current format: {orders: [...]}
        ordersData = response.data.orders
      } else if (Array.isArray(response.data)) {
        // Direct array format
        ordersData = response.data
      } else if (response.data && response.data.message && response.data.message.includes('routes working')) {
        // Placeholder response - treat as empty
        ordersData = []
      } else {
        console.error("❌ Unexpected response format:", response.data)
        console.error("❌ Response keys:", Object.keys(response.data || {}))
        console.error("❌ Response type:", typeof response.data)
        // Don't throw error, just use empty array
        ordersData = []
      }

      const formattedPayments = ordersData.map((order) => ({
        id: order._id,
        orderId: order.orderId || "",
        customer: order.isGuestOrder ? order.customerName : order.userId?.name || "Unknown Staff",
        customerType: order.isGuestOrder ? "Guest" : "Staff",
        customerMobile: order.isGuestOrder ? order.customerMobile : order.userId?.mobile || "N/A",
        date: new Date(order.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        rawDate: new Date(order.createdAt).getTime(), // For sorting
        amount: order.grandTotal || 0,
        method: order.paymentMethod || "cash",
        items: order.items || [],
        subtotal: order.subtotal || 0,
        tax: order.tax || 0,
        serviceCharge: order.serviceCharge || 0,
        totalAmount: order.totalAmount || 0,
        branchName: order.branchName || "Unknown Branch",
        tableNumber: order.tableNumber || "N/A",
        peopleCount: order.peopleCount || 1,
        paymentStatus: order.paymentStatus || "pending",
        notes: order.notes || "",
        orderTime: order.orderTime || order.createdAt,
        isGuestOrder: order.isGuestOrder || false,
      }))

      setAllPayments(formattedPayments)
    } catch (error) {
      console.error("Error fetching payments:", error)
      setError("Failed to load payments. Please try again.")
      setAllPayments([])
    } finally {
      setLoading(false)
    }
  }

  const applyFiltersAndPagination = () => {
    // 1. Apply search filter
    let filtered = [...allPayments]
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (payment) =>
          (payment.orderId || "").toLowerCase().includes(searchLower) ||
          (payment.customer || "").toLowerCase().includes(searchLower) ||
          (payment.branchName || "").toLowerCase().includes(searchLower) ||
          (payment.tableNumber || "").toLowerCase().includes(searchLower) ||
          (payment.customerMobile || "").toLowerCase().includes(searchLower),
      )
    }

    // 2. Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === "date") {
        return sortOrder === "asc" ? a.rawDate - b.rawDate : b.rawDate - a.rawDate
      } else if (sortBy === "amount") {
        return sortOrder === "asc" ? a.amount - b.amount : b.amount - a.amount
      }
      return 0
    })

    // 3. Calculate total pages
    const total = Math.ceil(filtered.length / paymentsPerPage)
    setTotalPages(total || 1) // Ensure at least 1 page

    // 4. Apply pagination
    const startIndex = (currentPage - 1) * paymentsPerPage
    const endIndex = startIndex + paymentsPerPage
    const paginatedData = filtered.slice(startIndex, endIndex)

    // 5. Update displayed payments
    setDisplayedPayments(paginatedData)

    // 6. Adjust current page if needed
    if (currentPage > total && total > 0) {
      setCurrentPage(total)
    }
  }

  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("desc")
    }
  }

  const handleFilterChange = (filterType, value) => {
    if (filterType === "orderType") {
      setOrderTypeFilter(value)
    }
    setCurrentPage(1) // Reset to first page when filter changes
  }

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value)
    setCurrentPage(1) // Reset to first page when search changes
  }

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case "card":
        return <CreditCard className="h-5 w-5" />
      case "upi":
        return <Wallet className="h-5 w-5" />
      case "cash":
        return <span className="rupees-icon">₹</span>
      case "netbanking":
        return <CreditCard className="h-5 w-5" />
      default:
        return <CreditCard className="h-5 w-5" />
    }
  }

  const handleViewPayment = (payment) => {
    setSelectedPayment(payment)
    setShowPaymentDetails(true)
  }

  const handleClosePaymentDetails = () => {
    setShowPaymentDetails(false)
    setSelectedPayment(null)
  }

  const escapeCsvField = (field) => {
    if (field === null || field === undefined) return ""
    const str = field.toString()
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const exportPayments = () => {
    const headers = [
      "Order ID",
      "Customer",
      "Customer Type",
      "Mobile",
      "Branch",
      "Table",
      "Date",
      "Subtotal",
      "Tax",
      "Service Charge",
      "Total",
      "Payment Method",
      "Payment Status",
    ]
    let csv = headers.map(escapeCsvField).join(",") + "\n"

    // Export all filtered payments, not just the current page
    let filtered = [...allPayments]
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (payment) =>
          (payment.orderId || "").toLowerCase().includes(searchLower) ||
          (payment.customer || "").toLowerCase().includes(searchLower) ||
          (payment.branchName || "").toLowerCase().includes(searchLower) ||
          (payment.tableNumber || "").toLowerCase().includes(searchLower) ||
          (payment.customerMobile || "").toLowerCase().includes(searchLower),
      )
    }

    filtered.forEach((payment) => {
      const row = [
        payment.orderId,
        payment.customer,
        payment.customerType,
        payment.customerMobile,
        payment.branchName,
        payment.tableNumber,
        payment.date,
        `₹${payment.subtotal.toFixed(2)}`,
        `₹${payment.tax.toFixed(2)}`,
        `₹${payment.serviceCharge.toFixed(2)}`,
        `₹${payment.amount.toFixed(2)}`,
        payment.method.charAt(0).toUpperCase() + payment.method.slice(1),
        payment.paymentStatus.charAt(0).toUpperCase() + payment.paymentStatus.slice(1),
      ]
      csv += row.map(escapeCsvField).join(",") + "\n"
    })

    const bom = "\uFEFF"
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.setAttribute("hidden", "")
    a.setAttribute("href", url)
    a.setAttribute("download", `all-orders-payments-export-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Generate pagination numbers
  const getPaginationRange = () => {
    const pages = []
    const maxPagesToShow = 5

    if (totalPages <= maxPagesToShow) {
      // Show all pages if total pages are less than max pages to show
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)

      let startPage = Math.max(2, currentPage - 1)
      let endPage = Math.min(totalPages - 1, currentPage + 1)

      // Adjust if at the beginning
      if (currentPage <= 3) {
        startPage = 2
        endPage = Math.min(4, totalPages - 1)
      }

      // Adjust if at the end
      if (currentPage >= totalPages - 2) {
        startPage = Math.max(2, totalPages - 3)
        endPage = totalPages - 1
      }

      // Add ellipsis after first page if needed
      if (startPage > 2) {
        pages.push("...")
      }

      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i)
      }

      // Add ellipsis before last page if needed
      if (endPage < totalPages - 1) {
        pages.push("...")
      }

      // Always show last page
      pages.push(totalPages)
    }

    return pages
  }

  return (
    <div className="payment-ui">
      <div className="page-header">
        <h1>All Orders Payment</h1>
        <div className="refresh-button" onClick={fetchAllPayments} title="Refresh data">
          <RefreshCw className={`h-5 w-5 ${loading ? "animate-spin" : ""}`} />
        </div>
      </div>

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
          <span>{error}</span>
        </div>
      )}

      <div className="filters-bar">
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by order ID, customer name, branch, or table"
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
        <div className="filter-buttons">
          <select
            className="filter-select"
            value={orderTypeFilter}
            onChange={(e) => handleFilterChange("orderType", e.target.value)}
          >
            <option value="all">All Orders</option>
            <option value="staff">Staff Orders</option>
            <option value="guest">Guest Orders</option>
          </select>
          <button className="filter-btn" onClick={exportPayments}>
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      <div className="data-card">
        <div className="card-body">
          {loading ? (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading payments...</p>
            </div>
          ) : displayedPayments.length === 0 ? (
            <div className="empty-state">
              <p>No payments found matching your search.</p>
            </div>
          ) : (
            <>
              <div className="pagination-info">
                Showing {(currentPage - 1) * paymentsPerPage + 1} to{" "}
                {Math.min(currentPage * paymentsPerPage, allPayments.length)} of {allPayments.length} entries
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Branch</th>
                    <th>Table</th>
                    <th className="sortable-header" onClick={() => handleSortChange("date")}>
                      <div className="sort-header">
                        <span>Date</span>
                        {sortBy === "date" &&
                          (sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />)}
                      </div>
                    </th>
                    <th className="sortable-header" onClick={() => handleSortChange("amount")}>
                      <div className="sort-header">
                        <span>Amount</span>
                        {sortBy === "amount" &&
                          (sortOrder === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />)}
                      </div>
                    </th>
                    <th>Payment Method</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedPayments.map((payment) => (
                    <tr key={payment.id}>
                      <td>{payment.orderId}</td>
                      <td>
                        <div>
                          <div>{payment.customer}</div>
                          <div style={{ fontSize: "12px", color: "#666" }}>{payment.customerMobile}</div>
                        </div>
                      </td>
                      <td>
                        <span className={`customer-type-badge ${payment.isGuestOrder ? "guest" : "staff"}`}>
                          {payment.customerType}
                        </span>
                      </td>
                      <td>{payment.branchName}</td>
                      <td>Table {payment.tableNumber}</td>
                      <td>{payment.date}</td>
                      <td>₹{payment.amount.toFixed(2)}</td>
                      <td>
                        <div className="payment-method">
                          {getPaymentMethodIcon(payment.method)}
                          <span className="payment-method-text">
                            {payment.method.charAt(0).toUpperCase() + payment.method.slice(1)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="action-btn view" onClick={() => handleViewPayment(payment)}>
                            View
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      <div className="pagination-section">
        <div className="pagination-info">
          Showing {(currentPage - 1) * paymentsPerPage + 1} to{" "}
          {Math.min(currentPage * paymentsPerPage, allPayments.length)} of {allPayments.length} entries
        </div>

        <div className="pagination">
          <button
            className="pagination-btn flex items-center justify-center gap-1"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>
          <div className="pagination-pages">
            {getPaginationRange().map((page, index) =>
              page === "..." ? (
                <span key={index} className="pagination-ellipsis">
                  ...
                </span>
              ) : (
                <button
                  key={index}
                  className={`pagination-page ${currentPage === page ? "active" : ""}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </button>
              ),
            )}
          </div>
          <button
            className="pagination-btn flex items-center justify-center gap-1"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
          >
            <span>Next</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showPaymentDetails && selectedPayment && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">{selectedPayment.customerType} Order Payment Details</h2>
              <button className="modal-close" onClick={handleClosePaymentDetails}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="payment-details">
                <div className="payment-info-grid">
                  <div className="payment-info-section">
                    <h3 className="payment-info-title">Payment Information</h3>
                    <div className="payment-info-content">
                      <div className="info-row">
                        <span className="info-label">Order ID:</span>
                        <span className="info-value">{selectedPayment.orderId}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Date:</span>
                        <span className="info-value">{selectedPayment.date}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Branch:</span>
                        <span className="info-value">{selectedPayment.branchName}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Table:</span>
                        <span className="info-value">Table {selectedPayment.tableNumber}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Peoples:</span>
                        <span className="info-value">
                          <div className="people-count">
                            <Users className="h-4 w-4" />
                            {selectedPayment.peopleCount}
                          </div>
                        </span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Subtotal:</span>
                        <span className="info-value">₹{selectedPayment.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Tax (5%):</span>
                        <span className="info-value">₹{selectedPayment.tax.toFixed(2)}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Service Charge (10%):</span>
                        <span className="info-value">₹{selectedPayment.serviceCharge.toFixed(2)}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Total Amount:</span>
                        <span className="info-value">₹{selectedPayment.amount.toFixed(2)}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Payment Method:</span>
                        <span className="info-value">
                          <div className="payment-method">
                            {getPaymentMethodIcon(selectedPayment.method)}
                            <span className="payment-method-text">
                              {selectedPayment.method.charAt(0).toUpperCase() + selectedPayment.method.slice(1)}
                            </span>
                          </div>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="payment-info-section">
                    <h3 className="payment-info-title">Customer Information</h3>
                    <div className="payment-info-content">
                      <div className="info-row">
                        <span className="info-label">Name:</span>
                        <span className="info-value">{selectedPayment.customer}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Type:</span>
                        <span className="info-value">
                          <span className={`customer-type-badge ${selectedPayment.isGuestOrder ? "guest" : "staff"}`}>
                            {selectedPayment.customerType}
                          </span>
                        </span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Mobile:</span>
                        <span className="info-value">{selectedPayment.customerMobile}</span>
                      </div>
                      {selectedPayment.notes && (
                        <div className="info-row">
                          <span className="info-label">Notes:</span>
                          <span className="info-value">{selectedPayment.notes}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="order-items-section">
                  <h3 className="payment-info-title">Order Items</h3>
                  <table className="order-items-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Price</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPayment.items.map((item, index) => (
                        <tr key={index}>
                          <td>{item.name}</td>
                          <td>{item.quantity}</td>
                          <td>₹{item.price.toFixed(2)}</td>
                          <td>₹{(item.quantity * item.price).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan="3" className="total-label">
                          Subtotal
                        </td>
                        <td className="total-value">₹{selectedPayment.subtotal.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td colSpan="3" className="total-label">
                          Tax (5%)
                        </td>
                        <td className="total-value">₹{selectedPayment.tax.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td colSpan="3" className="total-label">
                          Service Charge (10%)
                        </td>
                        <td className="total-value">₹{selectedPayment.serviceCharge.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td colSpan="3" className="total-label">
                          Total
                        </td>
                        <td className="total-value">₹{selectedPayment.amount.toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={handleClosePaymentDetails}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }

        .loading-spinner {
          border: 4px solid rgba(0, 0, 0, 0.1);
          border-left-color: var(--primary-color);
          border-radius: 50%;
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
          margin-bottom: 10px;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .refresh-button {
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
          transition: background-color 0.2s;
        }

        .refresh-button:hover {
          background-color: rgba(0, 0, 0, 0.05);
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        .pagination-info {
          margin-bottom: 10px;
          font-size: 14px;
          color: #666;
        }

        .sortable-header {
          cursor: pointer;
        }

        .sort-header {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .payment-method {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .payment-method-text {
          font-size: 14px;
        }

        .rupees-icon {
          display: flex;
          align-items: center;
          font-size: 18px;
          line-height: 1;
        }

        .customer-type-badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          text-transform: uppercase;
        }

        .customer-type-badge.staff {
          background: rgba(59, 130, 246, 0.1);
          color: #3b82f6;
        }

        .customer-type-badge.guest {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }

        .people-count {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .filter-select {
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          background: white;
          min-width: 150px;
          outline: none;
          cursor: pointer;
        }

        .filter-select:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .payment-details {
          padding: 10px 0;
        }

        .payment-info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 20px;
        }

        @media (max-width: 768px) {
          .payment-info-grid {
            grid-template-columns: 1fr;
          }
        }

        .payment-info-section {
          background-color: var(--bg-light);
          border-radius: var(--radius-md);
          overflow: hidden;
        }

        .payment-info-title {
          font-size: 16px;
          font-weight: 600;
          padding: 12px 16px;
          background-color: var(--bg-white);
          border-bottom: 1px solid var(--border-color);
        }

        .payment-info-content {
          padding: 16px;
        }

        .info-row {
          display: flex;
          margin-bottom: 10px;
        }

        .info-label {
          width: 140px;
          font-weight: 500;
          color: var(--text-light);
        }

        .info-value {
          flex: 1;
          font-weight: 500;
        }

        .order-items-section {
          margin-top: 20px;
        }

        .order-items-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }

        .order-items-table th {
          text-align: left;
          padding: 12px;
          background-color: var(--bg-light);
          font-weight: 500;
          color: var(--text-light);
        }

        .order-items-table td {
          padding: 12px;
          border-bottom: 1px solid var(--border-color);
        }

        .order-items-table tfoot td {
          padding: 12px;
          font-weight: 600;
        }

        .total-label {
          text-align: right;
          font-weight: 600;
        }

        .total-value {
          font-weight: 700;
          color: var(--primary-color);
        }

        .pagination-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          margin-top: 24px;
        }

        .pagination-info {
          font-size: 14px;
          color: #666;
          text-align: center;
        }

        .pagination {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .pagination-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 8px 16px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background-color: var(--bg-white);
          cursor: pointer;
        }

        .pagination-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .pagination-page {
          padding: 8px 12px;
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          background-color: var(--bg-white);
          cursor: pointer;
        }

        .pagination-page.active {
          background-color: var(--primary-color);
          color: white;
          border-color: var(--primary-color);
        }

        .pagination-ellipsis {
          padding: 8px 12px;
          color: var(--text-light);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .empty-state {
          text-align: center;
          padding: 40px 20px;
          color: #6b7280;
        }
      `}</style>
    </div>
  )
}

export default StaffPayment
