import React, { useState, useEffect } from "react"
import { Search, Download, X, Check, AlertCircle, Calendar, Clock, Users, Phone, Mail, MapPin } from "lucide-react"
import axios from "axios"

// Create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel",
  headers: {
    "Content-Type": "application/json",
  },
})

const Reservations = () => {
  const [allReservations, setAllReservations] = useState([])
  const [displayedReservations, setDisplayedReservations] = useState([])
  const [filteredReservations, setFilteredReservations] = useState([])
  const [branches, setBranches] = useState([])
  const [tables, setTables] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Add custom styles for better UI
  const customStyles = `
    .search-container {
      position: relative;
      flex: 1;
      max-width: 400px;
    }
    
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #666;
      z-index: 1;
    }
    
    .search-input {
      width: 100%;
      padding: 10px 12px 10px 40px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      height: 38px;
    }
    
    .filter-buttons {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
    
    .filter-select.compact {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
      height: 38px;
      min-width: 140px;
      background: white;
    }
    
    .legacy-filter-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      white-space: nowrap;
      cursor: pointer;
    }
    
    .legacy-filter-label input[type="checkbox"] {
      margin: 0;
    }
    
    .filters-bar {
      display: flex;
      gap: 16px;
      align-items: center;
      padding: 16px 20px;
      background: #f8f9fa;
      border-bottom: 1px solid #e5e7eb;
      flex-wrap: wrap;
    }
  `;

  // Inject styles
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = customStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // State for modals
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [selectedReservation, setSelectedReservation] = useState(null)
  const [successMessage, setSuccessMessage] = useState("")

  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [activeTab, setActiveTab] = useState("upcoming") // 'upcoming' or 'completed'
  const [statusFilter, setStatusFilter] = useState("all")
  const [branchFilter, setBranchFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("")
  const [showLegacyReservations, setShowLegacyReservations] = useState(true)

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const reservationsPerPage = 10

  // Fetch data on component mount
  useEffect(() => {
    const fetchAllData = async () => {
      try {
        // Fetch branches and tables first
        const [branchesResponse, tablesResponse] = await Promise.all([
          api.get("/branch"),
          api.get("/table")
        ])
        
        // Handle branches response (should be direct array)
        const branchesData = branchesResponse.data || []
        
        // Handle tables response (new format)
        let tablesData = []
        if (tablesResponse.data && tablesResponse.data.success && Array.isArray(tablesResponse.data.data)) {
          tablesData = tablesResponse.data.data
        } else if (Array.isArray(tablesResponse.data)) {
          tablesData = tablesResponse.data
        }
        
        console.log("✅ Branches API response:", branchesData)
        console.log("✅ Tables API response:", tablesData)
        
        // Debug: Log all branch IDs for comparison
        console.log("🔍 Available branch IDs:", branchesData.map(b => b._id))
        console.log("🔍 Available branch names:", branchesData.map(b => `${b._id}: ${b.name}`))
        
        // Set state and fetch reservations with the fresh data
        setBranches(branchesData)
        setTables(tablesData)
        
        // Fetch reservations with the fresh data directly (not from state)
        await fetchReservationsWithData(branchesData, tablesData)
        
      } catch (error) {
        console.error("❌ Error in fetchAllData:", error)
        setBranches([])
        setTables([])
        setError("Failed to load data. Please refresh the page.")
      } finally {
        setLoading(false)
      }
    }
    
    fetchAllData()
  }, [])

  // Refetch reservations when filters or page changes
  useEffect(() => {
    // Only refetch if we have initial data loaded
    if (branches.length >= 0 && tables.length >= 0) {
      fetchReservations()
    }
  }, [statusFilter, branchFilter, dateFilter, currentPage, activeTab])

  // Handle search filtering (client-side only for search term)
  useEffect(() => {
    let filtered = allReservations

    // Filter out legacy reservations if option is disabled
    if (!showLegacyReservations) {
      filtered = filtered.filter((reservation) => !reservation.isLegacyReservation)
    }

    // Apply search filter (client-side)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.trim().toLowerCase()
      filtered = filtered.filter((reservation) => {
        return (
          reservation.customerName.toLowerCase().includes(searchLower) ||
          reservation.customerPhone.includes(searchLower) ||
          reservation.tableName.toLowerCase().includes(searchLower) ||
          reservation.branchName.toLowerCase().includes(searchLower) ||
          reservation.status.toLowerCase().includes(searchLower)
        )
      })
    }

    // Apply branch filter (client-side fallback)
    if (branchFilter !== "all") {
      filtered = filtered.filter((reservation) => reservation.branchId === branchFilter)
    }

    setFilteredReservations(filtered)
    setDisplayedReservations(filtered)
  }, [allReservations, searchTerm, showLegacyReservations, branchFilter, activeTab])

  // Fetch all reservations with provided data (to avoid state timing issues)
  const fetchReservationsWithData = async (branchesData = branches, tablesData = tables) => {
    try {
      // If branches data is empty, fetch it again
      if (!branchesData || branchesData.length === 0) {
        console.log("🔄 Branches data is empty, fetching again...")
        try {
          const branchResponse = await api.get("/branch")
          branchesData = branchResponse.data || []
          console.log("🔄 Refetched branches:", branchesData)
          setBranches(branchesData) // Update state too
        } catch (error) {
          console.error("❌ Error refetching branches:", error)
          branchesData = []
        }
      }

      // If tables data is empty, fetch it again
      if (!tablesData || tablesData.length === 0) {
        console.log("🔄 Tables data is empty, fetching again...")
        try {
          const tablesResponse = await api.get("/table")
          // Handle new API format for tables
          const tablesResponseData = tablesResponse.data
          if (tablesResponseData && tablesResponseData.success && Array.isArray(tablesResponseData.data)) {
            tablesData = tablesResponseData.data
          } else if (Array.isArray(tablesResponseData)) {
            tablesData = tablesResponseData
          } else {
            tablesData = []
          }
          console.log("🔄 Refetched tables:", tablesData)
          setTables(tablesData) // Update state too
        } catch (error) {
          console.error("❌ Error refetching tables:", error)
          tablesData = []
        }
      }

      const params = {
        page: currentPage,
        limit: reservationsPerPage
      }
      if (statusFilter !== "all") params.status = statusFilter
      if (branchFilter !== "all") params.branchId = branchFilter
      if (dateFilter) params.date = dateFilter

      console.log("Fetching reservations with params:", params)
      const response = await api.get("/reservation", { params })

      console.log("🔍 Full reservation response:", response)
      console.log("🔍 Response status:", response.status)
      console.log("🔍 Response data:", response.data)

      // Handle error responses
      if (response.data && response.data.error) {
        console.error("❌ API returned error:", response.data.error)
        throw new Error(`API Error: ${response.data.error}`)
      }

      // Handle new paginated API response format
      let reservationsData = []
      let paginationData = null
      
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        console.log("✅ Using new paginated format: {success, data, pagination}")
        reservationsData = response.data.data
        paginationData = response.data.pagination
      } else if (Array.isArray(response.data)) {
        console.log("✅ Using old format: direct array (no pagination)")
        reservationsData = response.data
      } else {
        console.error("❌ Unexpected response format:", response.data)
        throw new Error("Invalid response format")
      }

      console.log("Raw reservations data:", reservationsData)
      console.log("Pagination data:", paginationData)

      // Format reservations for display
      const formattedReservations = reservationsData.map((reservation) => {
        console.log("Processing reservation:", reservation)
        
        // Handle reservations without table information (legacy data)
        if (!reservation.tableId) {
          console.log("Legacy reservation without table:", reservation._id)
          return {
            id: reservation._id,
            customerName: reservation.customerName,
            customerPhone: reservation.customerPhone,
            customerEmail: reservation.customerEmail || "",
            guestCount: reservation.guestCount,
            tableNumber: "N/A",
            tableName: "No Table Assigned",
            branchName: "Legacy Data",
            branchId: null,
            reservationDate: new Date(reservation.reservationDate).toLocaleDateString(),
            timeSlot: reservation.timeSlot,
            status: reservation.status,
            notes: reservation.notes || "",
            createdAt: new Date(reservation.createdAt).toLocaleString(),
            originalReservation: reservation,
            isLegacyReservation: true
          }
        }
        
        // Extract table information
        let tableNumber = "N/A"
        if (reservation.tableId) {
          if (typeof reservation.tableId === 'object') {
            tableNumber = reservation.tableId.number || "N/A"
          } else {
            // Find table by ID
            const table = tablesData.find(t => t._id === reservation.tableId)
            tableNumber = table?.number || "N/A"
          }
        }
        
        // Extract branch information
        let branchName = "Unknown Branch"
        let branchId = null
        
        if (reservation.branchId) {
          if (typeof reservation.branchId === 'object') {
            branchName = reservation.branchId.name || "Unknown Branch"
            branchId = reservation.branchId._id
          } else {
            const branch = branchesData.find(b => b._id === reservation.branchId)
            if (branch) {
              branchName = branch.name
              branchId = branch._id
            }
          }
        } else if (reservation.tableId && typeof reservation.tableId === 'object' && reservation.tableId.branchId) {
          const tableBranchId = reservation.tableId.branchId
          if (typeof tableBranchId === 'object') {
            branchName = tableBranchId.name || "Unknown Branch"
            branchId = tableBranchId._id
          } else {
            const branch = branchesData.find(b => b._id === tableBranchId)
            if (branch) {
              branchName = branch.name
              branchId = branch._id
            }
          }
        }

        const isNewReservation = new Date() - new Date(reservation.createdAt) < 24 * 60 * 60 * 1000

        return {
          id: reservation._id,
          customerName: reservation.customerName,
          customerPhone: reservation.customerPhone,
          customerEmail: reservation.customerEmail || "",
          guestCount: reservation.guestCount,
          tableNumber: tableNumber,
          tableName: `Table ${tableNumber}`,
          branchName: branchName,
          branchId: branchId,
          reservationDate: new Date(reservation.reservationDate).toLocaleDateString(),
          timeSlot: reservation.timeSlot,
          status: reservation.status,
          notes: reservation.notes || "",
          createdAt: new Date(reservation.createdAt).toLocaleString(),
          originalReservation: reservation,
          isNewReservation: isNewReservation
        }
      })

      console.log("Formatted reservations:", formattedReservations)
      
      setAllReservations(formattedReservations)
      
      // Update pagination from backend if available
      if (paginationData) {
        setTotalPages(paginationData.totalPages)
        console.log(`📄 Pagination: Page ${paginationData.currentPage} of ${paginationData.totalPages} (${paginationData.totalCount} total)`)
      }
    } catch (error) {
      console.error("Error fetching reservations:", error)
      console.error("Error details:", {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      })
      
      setAllReservations([])
      setError("Failed to load reservations. Please refresh the page and try again.")
    }
  }

  // Fetch all reservations (wrapper for backward compatibility)
  const fetchReservations = async () => {
    setLoading(true)
    setError("")
    await fetchReservationsWithData()
    setLoading(false)
  }

  // Handle search filtering (client-side only for search term)
  useEffect(() => {
    let filtered = allReservations
    // Filter by tab
    if (activeTab === "upcoming") {
      filtered = filtered.filter((r) => r.status !== "completed" && r.status !== "cancelled")
    } else {
      filtered = filtered.filter((r) => r.status === "completed")
    }

    // Filter out legacy reservations if option is disabled
    if (!showLegacyReservations) {
      filtered = filtered.filter((reservation) => !reservation.isLegacyReservation)
    }

    // Apply search filter (client-side)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.trim().toLowerCase()
      filtered = filtered.filter((reservation) => {
        return (
          reservation.customerName.toLowerCase().includes(searchLower) ||
          reservation.customerPhone.includes(searchLower) ||
          reservation.tableName.toLowerCase().includes(searchLower) ||
          reservation.branchName.toLowerCase().includes(searchLower) ||
          reservation.status.toLowerCase().includes(searchLower)
        )
      })
    }

    // Apply branch filter (client-side fallback)
    if (branchFilter !== "all") {
      filtered = filtered.filter((reservation) => reservation.branchId === branchFilter)
    }

    setFilteredReservations(filtered)
    setDisplayedReservations(filtered)
  }, [allReservations, searchTerm, showLegacyReservations, branchFilter, activeTab])

  // Handle view reservation
  const handleViewReservation = (reservation) => {
    setSelectedReservation(reservation)
    setViewModalOpen(true)
  }

  // Handle status update
  const handleStatusUpdate = async (reservationId, newStatus) => {
    try {
      await api.put(`/reservation/${reservationId}`, { status: newStatus })
      setSuccessMessage(`Reservation ${newStatus} successfully`)
      // Optimistic update: move the reservation to its new status immediately
      setAllReservations(prev => prev.map(r => r.id === reservationId ? {...r, status: newStatus} : r))
      // Also refetch for consistency
      fetchReservations()
      
      setTimeout(() => setSuccessMessage(""), 3000)
    } catch (error) {
      console.error("Error updating reservation:", error)
      alert("Failed to update reservation status")
    }
  }

  // Handle cancel reservation
  const handleCancelReservation = async (reservationId) => {
    if (window.confirm("Are you sure you want to cancel this reservation?")) {
      try {
        await api.put(`/reservation/${reservationId}/cancel`)
        setSuccessMessage("Reservation cancelled successfully")
        fetchReservations()
        
        setTimeout(() => setSuccessMessage(""), 3000)
      } catch (error) {
        console.error("Error cancelling reservation:", error)
        alert("Failed to cancel reservation")
      }
    }
  }

  // Export reservations as CSV
  const exportReservations = () => {
    let csv = "Customer Name,Phone,Email,Table,Branch,Date,Time Slot,Guests,Status,Notes,Created At\n"

    filteredReservations.forEach((reservation) => {
      csv += `"${reservation.customerName}","${reservation.customerPhone}","${reservation.customerEmail}","${reservation.tableName}","${reservation.branchName}","${reservation.reservationDate}","${reservation.timeSlot}",${reservation.guestCount},"${reservation.status}","${reservation.notes}","${reservation.createdAt}"\n`
    })

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.setAttribute("hidden", "")
    a.setAttribute("href", url)
    a.setAttribute("download", `reservations-export-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case "confirmed":
        return "#28a745"
      case "reserved":
        return "#ffc107"
      case "cancelled":
        return "#dc3545"
      case "completed":
        return "#17a2b8"
      default:
        return "#6c757d"
    }
  }

  return (
    <div className="reservations-page">
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
        <div>
          {/* <h1>Table Reservations</h1> */}
          <h1>Reservations</h1>
          {allReservations.length > 0 && (
            <div style={{ fontSize: "14px", color: "#666", marginTop: "4px" }}>
              {allReservations.filter(r => r.isNewReservation).length} new reservations in the last 24 hours
            </div>
          )}
        </div>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={exportReservations}>
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by customer name, phone, table, or branch..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
          {/* Tab buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => { setActiveTab('upcoming'); setCurrentPage(1); }}
              style={{
                padding: '9px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                border: activeTab === 'upcoming' ? 'none' : '1.5px solid #ddd',
                borderRadius: '8px',
                background: activeTab === 'upcoming' ? '#7a1f1f' : '#fff',
                color: activeTab === 'upcoming' ? '#fff' : '#555',
                transition: 'all 0.2s',
              }}>
              Upcoming
            </button>
            <button
              onClick={() => { setActiveTab('completed'); setCurrentPage(1); }}
              style={{
                padding: '9px 20px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
                border: activeTab === 'completed' ? 'none' : '1.5px solid #ddd',
                borderRadius: '8px',
                background: activeTab === 'completed' ? '#16a34a' : '#fff',
                color: activeTab === 'completed' ? '#fff' : '#555',
                transition: 'all 0.2s',
              }}>
              Completed
            </button>
          </div>
          <select
            className="filter-select compact"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="all">All Branches</option>
            {branches.map((branch) => (
              <option key={branch._id} value={branch._id}>
                {branch.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="filter-select compact"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            placeholder="Filter by date"
          />
          <label className="legacy-filter-label">
            <input
              type="checkbox"
              checked={showLegacyReservations}
              onChange={(e) => setShowLegacyReservations(e.target.checked)}
            />
            <span>Show Legacy Data</span>
          </label>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="error-container" style={{
          margin: "20px 0",
          padding: "10px 15px",
          backgroundColor: "#fee2e2",
          color: "#dc2626",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div className="data-card">
        {loading ? (
          <div className="loading-container" style={{
            textAlign: "center",
            padding: "40px 0",
          }}>
            <p>Loading reservations...</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer Details</th>
                <th>Table & Branch</th>
                <th>Reservation Details</th>
                <th>Guests</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedReservations.length > 0 ? (
                displayedReservations.map((reservation) => (
                  <tr 
                    key={reservation.id}
                    style={{
                      backgroundColor: reservation.isNewReservation ? '#f0f9ff' : 'transparent',
                      borderLeft: reservation.isNewReservation ? '4px solid #0ea5e9' : 'none'
                    }}
                  >
                    <td>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <strong style={{ fontSize: "16px" }}>{reservation.customerName}</strong>
                          {reservation.isNewReservation && (
                            <span style={{
                              backgroundColor: '#0ea5e9',
                              color: 'white',
                              fontSize: '10px',
                              fontWeight: 'bold',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              NEW
                            </span>
                          )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                          <Phone size={14} />
                          <span style={{ fontSize: "14px" }}>{reservation.customerPhone}</span>
                        </div>
                        {reservation.customerEmail && (
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                            <Mail size={14} />
                            <span style={{ fontSize: "12px", color: "#666" }}>{reservation.customerEmail}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div>
                        <div style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "4px" }}>
                          {reservation.tableName}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <MapPin size={14} />
                          <span style={{ 
                            fontSize: "14px",
                            color: reservation.isLegacyReservation ? "#999" : "inherit",
                            fontStyle: reservation.isLegacyReservation ? "italic" : "normal"
                          }}>
                            {reservation.branchName}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                          <Calendar size={14} />
                          <span style={{ fontSize: "14px", fontWeight: "bold" }}>{reservation.reservationDate}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Clock size={14} />
                          <span style={{ fontSize: "14px" }}>{reservation.timeSlot}</span>
                        </div>
                        {reservation.notes && (
                          <div style={{ fontSize: "12px", color: "#666", marginTop: "4px", fontStyle: "italic" }}>
                            Note: {reservation.notes}
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "center" }}>
                        <Users size={16} />
                        <span style={{ fontSize: "16px", fontWeight: "bold" }}>{reservation.guestCount}</span>
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="action-btn view" 
                          onClick={() => handleViewReservation(reservation)}
                          title="View full details"
                        >
                          View Details
                        </button>
                        {reservation.status === "reserved" && (
                          <button 
                            className="action-btn edit"
                            onClick={() => handleStatusUpdate(reservation.id, "confirmed")}
                            title="Confirm this reservation"
                          >
                            ✓ Confirm
                          </button>
                        )}
                        {reservation.status === "confirmed" && (
                          <button 
                            className="action-btn"
                            style={{ backgroundColor: "#17a2b8", color: "white" }}
                            onClick={() => handleStatusUpdate(reservation.id, "completed")}
                            title="Mark as completed"
                          >
                            ✓ Complete
                          </button>
                        )}
                        {(reservation.status === "reserved" || reservation.status === "confirmed") && (
                          <button 
                            className="action-btn delete"
                            onClick={() => handleCancelReservation(reservation.id)}
                            title="Cancel this reservation"
                          >
                            ✗ Cancel
                          </button>
                        )}
                        {reservation.status === "completed" && (
                          <span style={{ color: "#28a745", fontWeight: "bold", fontSize: "14px" }}>
                            ✓ Completed
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="no-tables">
                    No reservations found matching your criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
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

      {/* View Reservation Modal */}
      {viewModalOpen && selectedReservation && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: "650px", width: "90%" }}>
            <div className="modal-header">
              <h3 className="modal-title">Reservation Details</h3>
              <button className="modal-close" onClick={() => setViewModalOpen(false)}>
                ×
              </button>
            </div>
            <div className="modal-body" style={{ padding: "24px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px" }}>
                  <div style={{ width: "180px", fontWeight: "600", color: "#6b7280", flexShrink: 0 }}>Customer Name</div>
                  <div style={{ flex: 1, fontWeight: "500", color: "#111827" }}>{selectedReservation.customerName}</div>
                </div>
                <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px" }}>
                  <div style={{ width: "180px", fontWeight: "600", color: "#6b7280", flexShrink: 0 }}>Phone Number</div>
                  <div style={{ flex: 1, fontWeight: "500", color: "#111827" }}>{selectedReservation.customerPhone}</div>
                </div>
                {selectedReservation.customerEmail && (
                  <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px" }}>
                    <div style={{ width: "180px", fontWeight: "600", color: "#6b7280", flexShrink: 0 }}>Email</div>
                    <div style={{ flex: 1, fontWeight: "500", color: "#111827", wordBreak: "break-word" }}>{selectedReservation.customerEmail}</div>
                  </div>
                )}
                <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px" }}>
                  <div style={{ width: "180px", fontWeight: "600", color: "#6b7280", flexShrink: 0 }}>Table</div>
                  <div style={{ flex: 1, fontWeight: "500", color: "#111827" }}>{selectedReservation.tableName}</div>
                </div>
                <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px" }}>
                  <div style={{ width: "180px", fontWeight: "600", color: "#6b7280", flexShrink: 0 }}>Branch</div>
                  <div style={{ flex: 1, fontWeight: "500", color: "#111827" }}>{selectedReservation.branchName}</div>
                </div>
                <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px" }}>
                  <div style={{ width: "180px", fontWeight: "600", color: "#6b7280", flexShrink: 0 }}>Reservation Date</div>
                  <div style={{ flex: 1, fontWeight: "500", color: "#111827" }}>{selectedReservation.reservationDate}</div>
                </div>
                <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px" }}>
                  <div style={{ width: "180px", fontWeight: "600", color: "#6b7280", flexShrink: 0 }}>Time Slot</div>
                  <div style={{ flex: 1, fontWeight: "500", color: "#111827" }}>{selectedReservation.timeSlot}</div>
                </div>
                <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px" }}>
                  <div style={{ width: "180px", fontWeight: "600", color: "#6b7280", flexShrink: 0 }}>Number of Guests</div>
                  <div style={{ flex: 1, fontWeight: "500", color: "#111827" }}>{selectedReservation.guestCount}</div>
                </div>
                <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px" }}>
                  <div style={{ width: "180px", fontWeight: "600", color: "#6b7280", flexShrink: 0 }}>Status</div>
                  <div style={{ flex: 1 }}>
                    <span 
                      style={{ 
                        backgroundColor: getStatusColor(selectedReservation.status),
                        color: "white",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontSize: "13px",
                        fontWeight: "600",
                        display: "inline-block"
                      }}
                    >
                      {selectedReservation.status.charAt(0).toUpperCase() + selectedReservation.status.slice(1)}
                    </span>
                  </div>
                </div>
                {selectedReservation.notes && (
                  <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb", paddingBottom: "12px" }}>
                    <div style={{ width: "180px", fontWeight: "600", color: "#6b7280", flexShrink: 0 }}>Special Notes</div>
                    <div style={{ flex: 1, fontWeight: "500", color: "#111827", wordBreak: "break-word" }}>{selectedReservation.notes}</div>
                  </div>
                )}
                <div style={{ display: "flex", paddingBottom: "12px" }}>
                  <div style={{ width: "180px", fontWeight: "600", color: "#6b7280", flexShrink: 0 }}>Created At</div>
                  <div style={{ flex: 1, fontWeight: "500", color: "#111827" }}>{selectedReservation.createdAt}</div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setViewModalOpen(false)}>
                Close
              </button>
              {selectedReservation.status === "reserved" && (
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    handleStatusUpdate(selectedReservation.id, "confirmed")
                    setViewModalOpen(false)
                  }}
                >
                  Confirm Reservation
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default Reservations