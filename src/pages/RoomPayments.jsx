import { useState, useEffect } from "react"
import { Search, Download, Calendar, DollarSign, CreditCard, Banknote, RefreshCw, AlertCircle } from "lucide-react"
import axios from "axios"
import * as XLSX from "xlsx"

const API_BASE = import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
})

const RoomPayments = () => {
  const [summary, setSummary] = useState({
    totalCash: 0,
    totalOnline: 0,
    totalCollected: 0,
    totalPending: 0,
    bookingCount: 0
  })
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetchPaymentSummary()
  }, [startDate, endDate])

  const fetchPaymentSummary = async () => {
    setLoading(true)
    setError("")
    try {
      const response = await api.get(`/room-booking/payment-summary?startDate=${startDate}&endDate=${endDate}`)
      setSummary(response.data.summary)
      setBookings(response.data.bookings)
    } catch (err) {
      console.error("Error fetching payment summary:", err)
      setError("Failed to load payment data")
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleString('en-IN', { 
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  }

  const filteredBookings = Array.isArray(bookings) ? bookings.filter(booking => {
    const searchLower = searchTerm.toLowerCase()
    return (
      booking.guestName?.toLowerCase().includes(searchLower) ||
      booking.roomNumber?.toLowerCase().includes(searchLower) ||
      booking.branchName?.toLowerCase().includes(searchLower)
    )
  }) : []

  const exportToExcel = () => {
    const data = filteredBookings.map(b => ({
      'Room': b.roomNumber,
      'Guest Name': b.guestName,
      'Branch': b.branchName,
      'Check-in': formatDate(b.checkInDate),
      'Check-out': formatDate(b.checkOutDate),
      'Total Amount': b.totalPrice,
      'Cash Paid': b.cashAmount,
      'Online Paid': b.onlineAmount,
      'Total Paid': b.amountPaid,
      'Balance': b.totalPrice - b.amountPaid,
      'Status': b.paymentStatus,
      'Booking Date': formatDateTime(b.createdAt)
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Room Payments")
    XLSX.writeFile(wb, `room-payments-${startDate}-to-${endDate}.xlsx`)
  }

  // Quick date filters
  const setToday = () => {
    const today = new Date().toISOString().split('T')[0]
    setStartDate(today)
    setEndDate(today)
  }

  const setThisWeek = () => {
    const today = new Date()
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - today.getDay())
    setStartDate(weekStart.toISOString().split('T')[0])
    setEndDate(today.toISOString().split('T')[0])
  }

  const setThisMonth = () => {
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    setStartDate(monthStart.toISOString().split('T')[0])
    setEndDate(today.toISOString().split('T')[0])
  }

  const setThisYear = () => {
    const today = new Date()
    const yearStart = new Date(today.getFullYear(), 0, 1)
    setStartDate(yearStart.toISOString().split('T')[0])
    setEndDate(today.toISOString().split('T')[0])
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Room Payment Collections</h1>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={fetchPaymentSummary}>
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
          <button className="btn btn-primary" onClick={exportToExcel}>
            <Download size={16} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Date Filters */}
      <div className="filters-bar" style={{ marginBottom: "20px" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Calendar size={18} />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="filter-select"
            />
            <span>to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="filter-select"
            />
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn btn-outline btn-sm" onClick={setToday}>Today</button>
            <button className="btn btn-outline btn-sm" onClick={setThisWeek}>This Week</button>
            <button className="btn btn-outline btn-sm" onClick={setThisMonth}>This Month</button>
            <button className="btn btn-outline btn-sm" onClick={setThisYear}>This Year</button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
        gap: "20px", 
        marginBottom: "30px" 
      }}>
        <div style={{ 
          backgroundColor: "#f0fdf4", 
          padding: "20px", 
          borderRadius: "12px", 
          border: "1px solid #bbf7d0" 
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <Banknote size={24} color="#16a34a" />
            <span style={{ color: "#166534", fontWeight: "500" }}>Cash Collection</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#16a34a" }}>
            ₹{summary.totalCash.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ 
          backgroundColor: "#eff6ff", 
          padding: "20px", 
          borderRadius: "12px", 
          border: "1px solid #bfdbfe" 
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <CreditCard size={24} color="#2563eb" />
            <span style={{ color: "#1e40af", fontWeight: "500" }}>Online Collection</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#2563eb" }}>
            ₹{summary.totalOnline.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ 
          backgroundColor: "#faf5ff", 
          padding: "20px", 
          borderRadius: "12px", 
          border: "1px solid #e9d5ff" 
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <DollarSign size={24} color="#9333ea" />
            <span style={{ color: "#6b21a8", fontWeight: "500" }}>Total Collected</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#9333ea" }}>
            ₹{summary.totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ 
          backgroundColor: "#fef2f2", 
          padding: "20px", 
          borderRadius: "12px", 
          border: "1px solid #fecaca" 
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
            <AlertCircle size={24} color="#dc2626" />
            <span style={{ color: "#991b1b", fontWeight: "500" }}>Pending Amount</span>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#dc2626" }}>
            ₹{summary.totalPending.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="filters-bar">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by guest name, room number..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ color: "#6b7280", fontSize: "14px" }}>
          {filteredBookings.length} booking(s) found
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ 
          padding: "15px", 
          backgroundColor: "#fee2e2", 
          color: "#dc2626", 
          borderRadius: "8px", 
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}>
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* Bookings Table */}
      <div className="data-card">
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <RefreshCw size={24} className="animate-spin" />
            <p>Loading payment data...</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Room</th>
                <th>Guest</th>
                <th>Branch</th>
                <th>Check-in</th>
                <th>Total</th>
                <th>💵 Cash</th>
                <th>💳 Online</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.length > 0 ? (
                filteredBookings.map((booking) => {
                  const balance = booking.totalPrice - booking.amountPaid
                  return (
                    <tr key={booking._id}>
                      <td><strong>{booking.roomNumber}</strong></td>
                      <td>{booking.guestName}</td>
                      <td>{booking.branchName}</td>
                      <td>{formatDate(booking.checkInDate)}</td>
                      <td>₹{booking.totalPrice?.toFixed(2)}</td>
                      <td style={{ color: "#16a34a", fontWeight: "500" }}>
                        ₹{booking.cashAmount?.toFixed(2)}
                      </td>
                      <td style={{ color: "#2563eb", fontWeight: "500" }}>
                        ₹{booking.onlineAmount?.toFixed(2)}
                      </td>
                      <td style={{ color: balance > 0 ? "#dc2626" : "#16a34a", fontWeight: "500" }}>
                        {balance > 0 ? `₹${balance.toFixed(2)}` : "✓ Paid"}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
                    No bookings found for the selected date range
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default RoomPayments
