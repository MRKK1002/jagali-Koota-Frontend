import { useState, useEffect } from "react"
import { Eye, Edit, Trash2, Calendar, User, Phone, Mail, MapPin, Download } from "lucide-react"
import API_BASE_URL from "../config/api"
import "./RoomBookings.css"
import * as XLSX from "xlsx"

const RoomBookings = () => {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [stats, setStats] = useState({})
  const [filter, setFilter] = useState('all')
  const [exportLoading, setExportLoading] = useState(false)

  useEffect(() => {
    fetchBookings()
    fetchStats()
  }, [filter])

  const fetchBookings = async () => {
    try {
      setLoading(true)
      const statusParam = filter !== 'all' ? `?status=${filter}` : ''
      const response = await fetch(`${API_BASE_URL}/api/v1/hotel/room-booking${statusParam}`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        setBookings(data.bookings || [])
      } else {
        console.error('Failed to fetch bookings:', data.message)
        setBookings([])
      }
    } catch (error) {
      console.error('Error fetching bookings:', error)
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/hotel/room-booking/stats`)
      const data = await response.json()
      
      if (data.success) {
        setStats(data.stats || {})
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleViewBooking = (booking) => {
    setSelectedBooking(booking)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setSelectedBooking(null)
  }

  const handleStatusUpdate = async (bookingId, newStatus) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/hotel/room-booking/${bookingId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })

      const data = await response.json()
      
      if (data.success) {
        fetchBookings()
        fetchStats()
        if (selectedBooking && selectedBooking._id === bookingId) {
          setSelectedBooking({ ...selectedBooking, status: newStatus })
        }
      } else {
        alert('Error updating status: ' + data.message)
      }
    } catch (error) {
      console.error('Error updating status:', error)
      alert('Failed to update booking status')
    }
  }

  const handleDeleteBooking = async (bookingId) => {
    if (!confirm('Are you sure you want to delete this booking?')) {
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/hotel/room-booking/${bookingId}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (data.success) {
        fetchBookings()
        fetchStats()
        handleCloseModal()
      } else {
        alert('Error deleting booking: ' + data.message)
      }
    } catch (error) {
      console.error('Error deleting booking:', error)
      alert('Failed to delete booking')
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatPrice = (price) => {
    // Handle null, undefined, or NaN values
    const numericPrice = Number(price)
    if (isNaN(numericPrice) || numericPrice < 0) {
      return '₹0.00'
    }
    
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(numericPrice)
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'status-pending'
      case 'confirmed': return 'status-confirmed'
      case 'completed': return 'status-completed'
      case 'cancelled': return 'status-cancelled'
      default: return 'status-pending'
    }
  }

  // Format date for Excel
  const formatDateExcel = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  // Export to Excel for Accounting Team
  const exportToExcel = () => {
    if (exportLoading) return
    
    setExportLoading(true)
    
    try {
      console.log('📊 Exporting bookings to Excel:', bookings.length)
      
      // Prepare data for Excel
      const excelData = bookings.map((booking, index) => {
        const totalGst = (booking.cgst || 0) + (booking.sgst || 0) + (booking.igst || 0)
        const baseAmount = booking.baseAmount || 0
        const totalAmount = booking.totalAmount || booking.totalPrice || 0
        const amountPaid = booking.amountPaid || 0
        const cashAmount = booking.cashAmount || 0
        const onlineAmount = booking.onlineAmount || 0
        const balanceDue = totalAmount - amountPaid
        const restaurantTotal = booking.restaurantTotal || 0
        const grandTotal = totalAmount + restaurantTotal
        const grandBalance = grandTotal - amountPaid
        
        return {
          'S.No': index + 1,
          'Booking ID': booking._id || '',
          'Booking Date': formatDateExcel(booking.createdAt || booking.bookingDate),
          'Guest Name': booking.guestName || booking.userName || '',
          'Guest Phone': booking.guestPhone || booking.userPhone || '',
          'Guest Email': booking.guestEmail || booking.userEmail || '',
          'Guest GST Number': booking.guestGstNumber || '',
          'Room Number': booking.roomId?.roomNumber || 'N/A',
          'Room Type': booking.roomId?.roomType || 'N/A',
          'Floor': booking.roomId?.floor || 'N/A',
          'Branch': booking.branchId?.name || 'N/A',
          'Check-in Date': formatDateExcel(booking.checkInDate),
          'Check-in Time': booking.checkInTime || '12:00',
          'Check-out Date': formatDateExcel(booking.checkOutDate),
          'Check-out Time': booking.checkOutTime || '11:00',
          'Nights': booking.nights || 1,
          'Adults': booking.adults || 1,
          'Children': booking.children || 0,
          'Base Amount (₹)': baseAmount.toFixed(2),
          'Discount (₹)': (booking.discountAmount || 0).toFixed(2),
          'GST Type': booking.gstType === 'gst' ? 'CGST+SGST' : booking.gstType === 'igst' ? 'IGST' : 'No GST',
          'CGST (₹)': (booking.cgst || 0).toFixed(2),
          'SGST (₹)': (booking.sgst || 0).toFixed(2),
          'IGST (₹)': (booking.igst || 0).toFixed(2),
          'Total GST (₹)': totalGst.toFixed(2),
          'Room Total (₹)': totalAmount.toFixed(2),
          'Restaurant Bills (₹)': restaurantTotal.toFixed(2),
          'Grand Total (₹)': grandTotal.toFixed(2),
          'Cash Paid (₹)': cashAmount.toFixed(2),
          'Online Paid (₹)': onlineAmount.toFixed(2),
          'Total Paid (₹)': amountPaid.toFixed(2),
          'Balance Due (₹)': grandBalance.toFixed(2),
          'Payment Status': (booking.paymentStatus || 'pending').toUpperCase(),
          'Booking Status': (booking.status || 'pending').toUpperCase(),
          'Booking Source': booking.bookingSource ? (booking.bookingSource === 'online' ? 'Online (Website/App)' : 'Walk-in') : 'N/A',
          'Special Requests': booking.specialRequests || '',
          'Admin Notes': booking.notes || '',
          'Cancellation Reason': booking.cancellationReason || '',
          'Refund Amount (₹)': (booking.refundAmount || 0).toFixed(2),
        }
      })

      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      
      // Set column widths for better readability
      const columnWidths = [
        { wch: 6 },   // S.No
        { wch: 25 },  // Booking ID
        { wch: 12 },  // Booking Date
        { wch: 20 },  // Guest Name
        { wch: 15 },  // Guest Phone
        { wch: 25 },  // Guest Email
        { wch: 18 },  // Guest GST
        { wch: 12 },  // Room Number
        { wch: 12 },  // Room Type
        { wch: 12 },  // Floor
        { wch: 15 },  // Branch
        { wch: 12 },  // Check-in Date
        { wch: 12 },  // Check-in Time
        { wch: 12 },  // Check-out Date
        { wch: 12 },  // Check-out Time
        { wch: 8 },   // Nights
        { wch: 8 },   // Adults
        { wch: 8 },   // Children
        { wch: 15 },  // Base Amount
        { wch: 12 },  // Discount
        { wch: 15 },  // GST Type
        { wch: 12 },  // CGST
        { wch: 12 },  // SGST
        { wch: 12 },  // IGST
        { wch: 12 },  // Total GST
        { wch: 15 },  // Room Total
        { wch: 15 },  // Restaurant Bills
        { wch: 15 },  // Grand Total
        { wch: 12 },  // Cash Paid
        { wch: 12 },  // Online Paid
        { wch: 12 },  // Total Paid
        { wch: 12 },  // Balance Due
        { wch: 15 },  // Payment Status
        { wch: 15 },  // Booking Status
        { wch: 30 },  // Special Requests
        { wch: 30 },  // Admin Notes
        { wch: 30 },  // Cancellation Reason
        { wch: 15 },  // Refund Amount
      ]
      worksheet['!cols'] = columnWidths

      // Create workbook and add worksheet
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Room Bookings')

      // Generate filename with current date and filter
      const today = new Date().toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      }).replace(/\//g, '-')
      
      const filterText = filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)
      const filename = `Room_Bookings_${filterText}_${today}.xlsx`

      // Download the file
      XLSX.writeFile(workbook, filename)

      console.log('✅ Excel exported successfully:', filename)
      alert(`Excel exported successfully!\n${bookings.length} bookings exported.`)
      
    } catch (error) {
      console.error('❌ Error exporting to Excel:', error)
      alert('Failed to export Excel. Please try again.')
    } finally {
      setExportLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="page-loading">
        <div className="loading-spinner"></div>
        <p>Loading room bookings...</p>
      </div>
    )
  }

  return (
    <div className="room-bookings-page">
      <div className="page-header">
        <div>
          <h1>Room Bookings</h1>
          <p>Manage hotel room reservations and bookings</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={exportToExcel}
          disabled={exportLoading || bookings.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#059669',
            padding: '10px 20px',
            fontSize: '14px',
            fontWeight: '500',
            opacity: (exportLoading || bookings.length === 0) ? 0.6 : 1,
            cursor: (exportLoading || bookings.length === 0) ? 'not-allowed' : 'pointer'
          }}
          title={bookings.length === 0 ? 'No bookings to export' : `Export ${bookings.length} bookings to Excel`}
        >
          <Download size={18} />
          <span>{exportLoading ? 'Exporting...' : `Export to Excel (${bookings.length})`}</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <h3>{stats.total || 0}</h3>
            <p>Total Bookings</p>
          </div>
        </div>
        <div className="stat-card pending">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <h3>{stats.pending || 0}</h3>
            <p>Pending</p>
          </div>
        </div>
        <div className="stat-card confirmed">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <h3>{stats.confirmed || 0}</h3>
            <p>Confirmed</p>
          </div>
        </div>
        <div className="stat-card completed">
          <div className="stat-icon">🏁</div>
          <div className="stat-info">
            <h3>{stats.completed || 0}</h3>
            <p>Completed</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button 
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          All Bookings
        </button>
        <button 
          className={filter === 'pending' ? 'active' : ''}
          onClick={() => setFilter('pending')}
        >
          Pending
        </button>
        <button 
          className={filter === 'confirmed' ? 'active' : ''}
          onClick={() => setFilter('confirmed')}
        >
          Confirmed
        </button>
        <button 
          className={filter === 'completed' ? 'active' : ''}
          onClick={() => setFilter('completed')}
        >
          Completed
        </button>
      </div>

      {/* Bookings Table */}
      <div className="content-card">
        {bookings.length === 0 ? (
          <div className="no-bookings">
            <Calendar size={64} />
            <h3>No Room Bookings</h3>
            <p>No room bookings found for the selected filter.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="bookings-table">
              <thead>
                <tr>
                  <th>Guest Details</th>
                  <th>Room Info</th>
                  <th>Dates</th>
                  <th>Guests</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking._id}>
                    <td>
                      <div className="guest-info">
                        <div className="guest-name">
                          <User size={24} />
                          <strong>{booking.guestName}</strong>
                          {booking.bookingSource && (
                            <span 
                              className={`source-badge ${booking.bookingSource === 'online' ? 'source-online' : 'source-walkin'}`}
                              title={booking.bookingSource === 'online' ? 'Booked via Website/App' : 'Walk-in Booking'}
                            >
                              {booking.bookingSource === 'online' ? '🌐 Online' : '🏨 Walk-in'}
                            </span>
                          )}
                        </div>
                        <div className="guest-contact">
                          <Mail size={20} />
                          <span>{booking.guestEmail}</span>
                        </div>
                        {booking.guestPhone && (
                          <div className="guest-contact">
                            <Phone size={20} />
                            <span>{booking.guestPhone}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="room-info">
                        <div className="room-type">
                          <MapPin size={20} />
                          <strong>{booking.roomId?.roomType || 'N/A'}</strong>
                        </div>
                        <div className="room-details">
                          <span>Floor: {booking.roomId?.floor || 'N/A'}</span>
                          {booking.roomId?.roomNumber && (
                            <span>Room: {booking.roomId.roomNumber}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="booking-dates">
                        <div className="date-range">
                          <Calendar size={18} />
                          <span>{formatDate(booking.checkInDate)} - {formatDate(booking.checkOutDate)}</span>
                        </div>
                        <div className="booking-date">
                          <small>Booked: {formatDate(booking.createdAt)}</small>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="guest-count">
                        <span>{booking.adults} Adults</span>
                        {booking.children > 0 && (
                          <span>{booking.children} Children</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="booking-amount">
                        {formatPrice(booking.totalAmount || booking.amount || 0)}
                      </div>
                    </td>
                    <td>
                      <select
                        className={`status-select ${getStatusColor(booking.status)}`}
                        value={booking.status}
                        onChange={(e) => handleStatusUpdate(booking._id, e.target.value)}
                      >
                        <option value="pending">Pending</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn-action btn-view"
                          onClick={() => handleViewBooking(booking)}
                          title="View Details"
                          style={{
                            padding: '8px 12px',
                            minWidth: '40px',
                            minHeight: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Eye size={24} />
                        </button>
                        <button
                          className="btn-action btn-delete"
                          onClick={() => handleDeleteBooking(booking._id)}
                          title="Delete Booking"
                          style={{
                            padding: '8px 12px',
                            minWidth: '40px',
                            minHeight: '40px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Trash2 size={24} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Booking Details Modal */}
      {showModal && selectedBooking && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Booking Details</h3>
              <button className="modal-close" onClick={handleCloseModal}>×</button>
            </div>

            <div className="modal-body">
              <div className="booking-details-grid">
                <div className="detail-section">
                  <h4>Guest Information</h4>
                  <div className="detail-item">
                    <User size={20} />
                    <span><strong>Name:</strong> {selectedBooking.guestName}</span>
                  </div>
                  <div className="detail-item">
                    <Mail size={20} />
                    <span><strong>Email:</strong> {selectedBooking.guestEmail}</span>
                  </div>
                  {selectedBooking.guestPhone && (
                    <div className="detail-item">
                      <Phone size={20} />
                      <span><strong>Phone:</strong> {selectedBooking.guestPhone}</span>
                    </div>
                  )}
                </div>

                <div className="detail-section">
                  <h4>Room Information</h4>
                  <div className="detail-item">
                    <MapPin size={20} />
                    <span><strong>Type:</strong> {selectedBooking.roomId?.roomType || 'N/A'}</span>
                  </div>
                  <div className="detail-item">
                    <span><strong>Floor:</strong> {selectedBooking.roomId?.floor || 'N/A'}</span>
                  </div>
                  {selectedBooking.roomId?.roomNumber && (
                    <div className="detail-item">
                      <span><strong>Room Number:</strong> {selectedBooking.roomId.roomNumber}</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span><strong>Price per night:</strong> {formatPrice(selectedBooking.roomId?.price || 0)}</span>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Booking Details</h4>
                  <div className="detail-item">
                    <Calendar size={20} />
                    <span><strong>Check-in:</strong> {formatDate(selectedBooking.checkInDate)}</span>
                  </div>
                  <div className="detail-item">
                    <Calendar size={20} />
                    <span><strong>Check-out:</strong> {formatDate(selectedBooking.checkOutDate)}</span>
                  </div>
                  <div className="detail-item">
                    <span><strong>Adults:</strong> {selectedBooking.adults}</span>
                  </div>
                  <div className="detail-item">
                    <span><strong>Children:</strong> {selectedBooking.children}</span>
                  </div>
                  <div className="detail-item">
                    <span><strong>Total Amount:</strong> {formatPrice(selectedBooking.totalAmount || selectedBooking.amount || 0)}</span>
                  </div>
                  <div className="detail-item">
                    <span><strong>Status:</strong> 
                      <span className={`status-badge ${getStatusColor(selectedBooking.status)}`}>
                        {selectedBooking.status}
                      </span>
                    </span>
                  </div>
                </div>

                {selectedBooking.specialRequests && (
                  <div className="detail-section full-width">
                    <h4>Special Requests</h4>
                    <p className="special-requests">{selectedBooking.specialRequests}</p>
                  </div>
                )}

                {selectedBooking.notes && (
                  <div className="detail-section full-width">
                    <h4>Admin Notes</h4>
                    <p className="admin-notes">{selectedBooking.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={handleCloseModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RoomBookings