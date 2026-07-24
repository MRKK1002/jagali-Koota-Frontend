import { useState, useEffect } from "react"
import { Search, Download, CreditCard, Wallet, ChevronLeft, ChevronRight, ArrowDown, ArrowUp } from "lucide-react"
import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel",
  headers: {
    "Content-Type": "application/json",
  },
})

const CounterPayment = () => {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState("date")
  const [sortOrder, setSortOrder] = useState("desc")
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [showPaymentDetails, setShowPaymentDetails] = useState(false)
  const paymentsPerPage = 7

  useEffect(() => {
    const fetchCounterPayments = async () => {
      setLoading(true)
      setError("")
      try {
        const params = {
          page: currentPage,
          limit: paymentsPerPage,
        }
        if (searchQuery.trim()) {
          params.search = searchQuery.trim()
        }

        const response = await api.get("/counter-order/orders", { params })
        
        // Handle different API response formats
        let ordersData = [];
        if (response.data.success && Array.isArray(response.data.data)) {
          // New format: {success: true, count: X, data: [...]}
          ordersData = response.data.data;
        } else if (response.data.orders && Array.isArray(response.data.orders)) {
          // Old format: {orders: [...]}
          ordersData = response.data.orders;
        } else if (Array.isArray(response.data)) {
          // Direct array format
          ordersData = response.data;
        } else {
          console.error("❌ Unexpected response format:", response.data);
          ordersData = [];
        }
        
        const formattedPayments = ordersData.map((order) => {
          return {
            id: order.id,
            orderId: order.invoice?.invoiceNumber || order.id,
            customer: order.customerName || "Unknown Customer",
            customerMobile: order.phoneNumber || "N/A",
            counterUser: order.userId?.name || "Unknown Counter User",
            counterMobile: order.userId?.mobile || "N/A",
            date: new Date(order.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            // Use backend values for tax and service charge
            subtotal: order.subtotal || 0,
            tax: order.tax || 0,
            serviceCharge: order.serviceCharge || 0,
            amount: order.grandTotal || order.totalAmount || 0,
            method: order.paymentMethod || "unknown",
            items: order.items || [],
            branchName: order.branch?.name || "Unknown Branch",
            branchLocation: order.branch?.location || "Unknown Location",
            invoiceNumber: order.invoice?.invoiceNumber || "N/A",
            orderTime: order.createdAt,
          }
        })
        setPayments(formattedPayments)

        // Calculate total pages based on response
        const totalOrders = response.data.count || ordersData.length
        setTotalPages(Math.ceil(totalOrders / paymentsPerPage))
      } catch (error) {
        console.error("Error fetching counter payments:", error)
        setError("Failed to load counter payments. Please try again.")
        setPayments([]) // Ensure payments is always an array
        setTotalPages(1) // Set default pagination
      } finally {
        setLoading(false)
      }
    }
    fetchCounterPayments()
  }, [currentPage, searchQuery])

  const filteredPayments = payments.filter((payment) => {
    const searchLower = searchQuery.toLowerCase()
    return (
      (payment.orderId || "").toLowerCase().includes(searchLower) ||
      (payment.customer || "").toLowerCase().includes(searchLower) ||
      (payment.counterUser || "").toLowerCase().includes(searchLower) ||
      (payment.branchName || "").toLowerCase().includes(searchLower) ||
      (payment.customerMobile || "").toLowerCase().includes(searchLower)
    )
  })

  const sortedPayments = [...filteredPayments].sort((a, b) => {
    if (sortBy === "date") {
      return sortOrder === "asc" ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date)
    } else if (sortBy === "amount") {
      return sortOrder === "asc" ? a.amount - b.amount : b.amount - a.amount
    }
    return 0
  })

  const paginatedPayments = sortedPayments.slice(0, paymentsPerPage)

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case "card":
        return <CreditCard className="h-5 w-5" />
      case "upi":
        return <Wallet className="h-5 w-5" />
      case "cash":
        return <span className="rupees-icon">₹</span>
      case "qr":
        return <Wallet className="h-5 w-5" />
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

  const handleSortChange = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("desc")
    }
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
      "Customer Name",
      "Customer Mobile",
      "Counter User",
      "Branch",
      "Date",
      "Subtotal",
      "Tax",
      "Service Charge",
      "Total Amount",
      "Payment Method",
    ]
    let csv = headers.map(escapeCsvField).join(",") + "\n"

    payments.forEach((payment) => {
      const row = [
        payment.orderId,
        payment.customer,
        payment.customerMobile,
        payment.counterUser,
        payment.branchName,
        payment.date,
        `₹${payment.subtotal.toFixed(2)}`,
        `₹${payment.tax.toFixed(2)}`,
        `₹${payment.serviceCharge.toFixed(2)}`,
        `₹${payment.amount.toFixed(2)}`,
        payment.method.charAt(0).toUpperCase() + payment.method.slice(1),
      ]
      csv += row.map(escapeCsvField).join(",") + "\n"
    })

    const bom = "\uFEFF"
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.setAttribute("hidden", "")
    a.setAttribute("href", url)
    a.setAttribute("download", `counter-payments-export-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Pagination logic to show limited pages
  const getPaginationRange = () => {
    const maxPagesToShow = 5
    const pages = []

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)

      let startPage = Math.max(2, currentPage - 2)
      let endPage = Math.min(totalPages - 1, currentPage + 2)

      if (currentPage <= 4) {
        endPage = 5
      }
      if (currentPage >= totalPages - 3) {
        startPage = totalPages - 4
      }

      if (startPage > 2) {
        pages.push("...")
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i)
      }

      if (endPage < totalPages - 1) {
        pages.push("...")
      }

      if (totalPages > 1) {
        pages.push(totalPages)
      }
    }

    return pages
  }

  return (
    <div className="payment-ui">
      <div className="page-header">
        <h1>Counter Payments</h1>
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
            placeholder="Search by order ID, customer name, counter user, or branch"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
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
              <p>Loading counter payments...</p>
            </div>
          ) : paginatedPayments.length === 0 ? (
            <div className="empty-state">
              <p>No counter payments found matching your search.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Counter User</th>
                  <th>Branch</th>
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
                {paginatedPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.orderId}</td>
                    <td>
                      <div>
                        <div>{payment.customer}</div>
                        <div style={{ fontSize: "12px", color: "#666" }}>{payment.customerMobile}</div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div>{payment.counterUser}</div>
                        <div style={{ fontSize: "12px", color: "#666" }}>{payment.counterMobile}</div>
                      </div>
                    </td>
                    <td>{payment.branchName}</td>
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
          )}
        </div>
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

      {showPaymentDetails && selectedPayment && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Counter Payment Details</h2>
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
                        <span className="info-label">Invoice Number:</span>
                        <span className="info-value">{selectedPayment.invoiceNumber}</span>
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
                        <span className="info-label">Subtotal:</span>
                        <span className="info-value">₹{selectedPayment.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Tax:</span>
                        <span className="info-value">₹{selectedPayment.tax.toFixed(2)}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Service Charge:</span>
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
                    <h3 className="payment-info-title">Customer & Counter Information</h3>
                    <div className="payment-info-content">
                      <div className="info-row">
                        <span className="info-label">Customer Name:</span>
                        <span className="info-value">{selectedPayment.customer}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Customer Mobile:</span>
                        <span className="info-value">{selectedPayment.customerMobile}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Counter User:</span>
                        <span className="info-value">{selectedPayment.counterUser}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Counter Mobile:</span>
                        <span className="info-value">{selectedPayment.counterMobile}</span>
                      </div>
                      <div className="info-row">
                        <span className="info-label">Branch Location:</span>
                        <span className="info-value">{selectedPayment.branchLocation}</span>
                      </div>
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
                          Tax
                        </td>
                        <td className="total-value">₹{selectedPayment.tax.toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td colSpan="3" className="total-label">
                          Service Charge
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
      `}</style>
    </div>
  )
}

export default CounterPayment
