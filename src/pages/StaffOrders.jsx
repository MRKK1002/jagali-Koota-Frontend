import { useState, useEffect } from "react"
import { Search, X, Check, AlertCircle, Loader, ChevronLeft, ChevronRight, Calendar, RefreshCw, Download, Printer } from "lucide-react"
import axios from "axios"
import * as XLSX from "xlsx"

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel",
  headers: {
    "Content-Type": "application/json",
  },
})

const StaffOrders = () => {
  // State for branches and categories
  const [branches, setBranches] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [selectedCategory, setSelectedCategory] = useState(null)
  
  // State for orders
  const [allOrders, setAllOrders] = useState([])
  const [filteredOrders, setFilteredOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFilterType, setDateFilterType] = useState("all") // Changed from "single" to "all"
  const [singleDate, setSingleDate] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // Modals
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showComplimentaryModal, setShowComplimentaryModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [cancelReason, setCancelReason] = useState("")
  const [cancelledBy, setCancelledBy] = useState("")
  const [complimentaryReason, setComplimentaryReason] = useState("")

  // Get logged-in user name on component mount
  useEffect(() => {
    const categoryStaffData = localStorage.getItem("categoryStaffData")
    if (categoryStaffData) {
      try {
        const staffData = JSON.parse(categoryStaffData)
        setCancelledBy(staffData.name || "")
      } catch (error) {
        console.error("Error parsing category staff data:", error)
      }
    }
  }, [])

  // View Mode (tabs)
  const [viewMode, setViewMode] = useState("orders") // "orders", "complimentary", "cancelled"
  const [complimentaryOrders, setComplimentaryOrders] = useState([])
  const [cancelledOrders, setCancelledOrders] = useState([])

  // Fetch branches on mount
  useEffect(() => {
    fetchBranches()
  }, [])

  // Fetch categories when branch is selected
  useEffect(() => {
    if (selectedBranch) {
      fetchCategories(selectedBranch._id)
      setSelectedCategory(null) // Reset category when branch changes
    } else {
      setCategories([])
      setSelectedCategory(null)
    }
  }, [selectedBranch])

  // Fetch orders when branch and category are selected
  useEffect(() => {
    if (selectedBranch && selectedCategory) {
      if (viewMode === "orders") {
        fetchOrders()
      } else if (viewMode === "complimentary") {
        fetchComplimentaryOrders()
      } else if (viewMode === "cancelled") {
        fetchCancelledOrders()
      }
    } else {
      setAllOrders([])
      setFilteredOrders([])
      setComplimentaryOrders([])
      setCancelledOrders([])
    }
  }, [selectedBranch, selectedCategory, statusFilter, currentPage, itemsPerPage, singleDate, startDate, endDate, dateFilterType, viewMode])

  // Search filtering
  useEffect(() => {
    const filtered = allOrders.filter((order) => {
      if (!searchTerm.trim()) return true
      const searchLower = searchTerm.trim().toLowerCase()
      return (
        order.orderId?.toLowerCase().includes(searchLower) ||
        order.tableNumber?.toLowerCase().includes(searchLower) ||
        order.customer?.toLowerCase().includes(searchLower)
      )
    })
    setFilteredOrders(filtered)
  }, [allOrders, searchTerm])

  const fetchBranches = async () => {
    try {
      const response = await api.get("/branch")
      const branchList = response.data || []
      setBranches(branchList)
      
      // Auto-select first branch
      if (branchList.length > 0 && !selectedBranch) {
        setSelectedBranch(branchList[0])
      }
    } catch (error) {
      console.error("Error fetching branches:", error)
      setError("Failed to load branches")
    }
  }

  const fetchCategories = async (branchId) => {
    try {
      const response = await api.get("/category")
      const allCategories = response.data || []
      // Filter categories by branch
      const branchCategories = allCategories.filter(cat => cat.branchId === branchId)
      setCategories(branchCategories)
      
      // Auto-select first category
      if (branchCategories.length > 0 && !selectedCategory) {
        setSelectedCategory(branchCategories[0])
      }
    } catch (error) {
      console.error("Error fetching categories:", error)
      setError("Failed to load categories")
    }
  }

  const fetchOrders = async () => {
    if (!selectedBranch || !selectedCategory) return
    
    setLoading(true)
    setError("")

    try {
      const cacheBuster = Date.now()
      let params = `branchId=${selectedBranch._id}&categoryId=${selectedCategory._id}&page=${currentPage}&limit=${itemsPerPage}&_t=${cacheBuster}`
      
      // Apply date filters only if specified
      if (dateFilterType === "single" && singleDate) {
        params += `&startDate=${singleDate}&endDate=${singleDate}`
      } else if (dateFilterType === "range") {
        if (startDate) params += `&startDate=${startDate}`
        if (endDate) params += `&endDate=${endDate}`
      }
      // Don't apply any date filter if dateFilterType is "all"

      // Apply status filter
      if (statusFilter !== "all") {
        params += `&status=${statusFilter}`
      }

      const response = await api.get(`/staff-order?${params}`)
      
      const ordersData = response.data.orders || []
      const totalCountData = response.data.totalCount || 0
      const totalPagesData = response.data.totalPages || 1
      
      setTotalCount(totalCountData)
      setTotalPages(totalPagesData)

      // Format orders - show only completed orders (sales report)
      const formattedOrders = ordersData
        .filter(order => 
          order.status === "completed" && 
          !order.isComplimentary
        )
        .map((order, index) => ({
          id: order._id || `temp-id-${index}`,
          orderId: order.orderId || `UNKNOWN-${index}`,
          customer: order.isGuestOrder ? order.customerName : order.userId?.name || "Unknown",
          customerType: order.isGuestOrder ? "Guest" : "Staff",
          customerMobile: order.isGuestOrder ? order.customerMobile : order.userId?.mobile || "N/A",
          date: new Date(order.orderTime || order.createdAt || Date.now()).toLocaleString("en-US", {
            year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          }),
          branch: order.branchName || "Unknown Branch",
          tableNumber: order.tableNumber || "N/A",
          peopleCount: order.peopleCount || 0,
          items: order.items || [],
          status: order.status || "pending",
          paymentStatus: order.paymentStatus || "pending",
          grandTotal: order.grandTotal || 0,
          originalOrder: order,
        }))

      setAllOrders(formattedOrders)
    } catch (error) {
      console.error("Error fetching orders:", error)
      setError("Failed to load orders. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const fetchComplimentaryOrders = async () => {
    if (!selectedBranch || !selectedCategory) return
    
    setLoading(true)
    setError("")

    try {
      const cacheBuster = Date.now()
      let params = `branchId=${selectedBranch._id}&categoryId=${selectedCategory._id}&_t=${cacheBuster}`
      
      // Apply date filters only if specified
      if (dateFilterType === "single" && singleDate) {
        params += `&startDate=${singleDate}&endDate=${singleDate}`
      } else if (dateFilterType === "range") {
        if (startDate) params += `&startDate=${startDate}`
        if (endDate) params += `&endDate=${endDate}`
      }
      // Don't apply any date filter if dateFilterType is "all"

      const response = await api.get(`/staff-order?${params}`)
      
      const ordersData = response.data.orders || []
      
      // Filter only complimentary orders
      const complimentary = ordersData
        .filter(order => order.isComplimentary === true)
        .map((order, index) => ({
          id: order._id || `temp-id-${index}`,
          orderId: order.orderId || `UNKNOWN-${index}`,
          customer: order.isGuestOrder ? order.customerName : order.userId?.name || "Unknown",
          customerMobile: order.isGuestOrder ? order.customerMobile : order.userId?.mobile || "N/A",
          date: new Date(order.orderTime || order.createdAt || Date.now()).toLocaleString("en-US", {
            year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
          }),
          tableNumber: order.tableNumber || "N/A",
          items: order.items || [],
          originalGrandTotal: order.originalGrandTotal || 0,
          complimentaryReason: order.complimentaryReason || "No reason provided",
          complimentaryMarkedAt: order.complimentaryMarkedAt || order.updatedAt,
        }))

      setComplimentaryOrders(complimentary)
    } catch (error) {
      console.error("Error fetching complimentary orders:", error)
      setError("Failed to load complimentary orders")
    } finally {
      setLoading(false)
    }
  }

  const fetchCancelledOrders = async () => {
    if (!selectedBranch || !selectedCategory) return
    
    setLoading(true)
    setError("")

    try {
      const cacheBuster = Date.now()
      let params = `branchId=${selectedBranch._id}&categoryId=${selectedCategory._id}&status=cancelled&_t=${cacheBuster}`
      
      // Apply date filters only if specified
      if (dateFilterType === "single" && singleDate) {
        params += `&startDate=${singleDate}&endDate=${singleDate}`
      } else if (dateFilterType === "range") {
        if (startDate) params += `&startDate=${startDate}`
        if (endDate) params += `&endDate=${endDate}`
      }
      // Don't apply any date filter if dateFilterType is "all"

      const response = await api.get(`/staff-order?${params}`)
      
      const ordersData = response.data.orders || []
      
      const cancelled = ordersData.map((order, index) => ({
        id: order._id || `temp-id-${index}`,
        orderId: order.orderId || `UNKNOWN-${index}`,
        customer: order.isGuestOrder ? order.customerName : order.userId?.name || "Unknown",
        customerMobile: order.isGuestOrder ? order.customerMobile : order.userId?.mobile || "N/A",
        date: new Date(order.orderTime || order.createdAt || Date.now()).toLocaleString("en-US", {
          year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        }),
        tableNumber: order.tableNumber || "N/A",
        items: order.items || [],
        grandTotal: order.grandTotal || 0,
        cancellationReason: order.cancellationReason || "No reason provided",
        cancelledBy: order.cancelledBy || "Admin",
        cancelledAt: order.cancelledAt || order.updatedAt,
      }))

      setCancelledOrders(cancelled)
    } catch (error) {
      console.error("Error fetching cancelled orders:", error)
      setError("Failed to load cancelled orders")
    } finally {
      setLoading(false)
    }
  }

  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) {
      setError("Please provide a reason for cancellation")
      setTimeout(() => setError(""), 3000)
      return
    }

    if (!cancelledBy.trim()) {
      setError("Please provide your name")
      setTimeout(() => setError(""), 3000)
      return
    }

    try {
      await api.put(`/staff-order/${selectedOrder.id}/cancel`, {
        reason: cancelReason,
        cancelledBy: cancelledBy
      })

      setSuccessMessage(`Order ${selectedOrder.orderId} cancelled successfully`)
      setTimeout(() => setSuccessMessage(""), 3000)
      
      setShowCancelModal(false)
      setCancelReason("")
      setCancelledBy("")
      setSelectedOrder(null)
      
      fetchOrders()
    } catch (error) {
      console.error("Error cancelling order:", error)
      setError("Failed to cancel order")
      setTimeout(() => setError(""), 3000)
    }
  }

  const handleComplimentary = async () => {
    if (!complimentaryReason.trim()) {
      setError("Please provide a reason for complimentary bill")
      setTimeout(() => setError(""), 3000)
      return
    }

    try {
      await api.put(`/staff-order/${selectedOrder.id}/complimentary`, {
        reason: complimentaryReason
      })

      setSuccessMessage(`Order ${selectedOrder.orderId} marked as complimentary`)
      setTimeout(() => setSuccessMessage(""), 3000)
      
      setShowComplimentaryModal(false)
      setComplimentaryReason("")
      setSelectedOrder(null)
      
      fetchOrders()
    } catch (error) {
      console.error("Error marking as complimentary:", error)
      setError("Failed to mark order as complimentary")
      setTimeout(() => setError(""), 3000)
    }
  }

  const handleStatusChange = async (order, newStatus) => {
    try {
      await api.put(`/staff-order/${order.id}/status`, {
        status: newStatus
      })
      
      setSuccessMessage(`Order ${order.orderId} status updated to ${newStatus}`)
      setTimeout(() => setSuccessMessage(""), 3000)
      
      fetchOrders()
    } catch (error) {
      console.error("Error updating status:", error)
      setError("Failed to update order status")
      setTimeout(() => setError(""), 3000)
    }
  }

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage)
    }
  }

  const handleDateReset = () => {
    setSingleDate("")
    setStartDate("")
    setEndDate("")
    setCurrentPage(1)
  }

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case "completed": 
      case "delivered": 
        return "completed"
      case "preparing": return "preparing"
      case "served": 
      case "out for delivery": 
        return "served"
      case "cancelled": return "cancelled"
      case "confirmed": return "preparing"
      default: return "pending"
    }
  }

  const calculateTotalAmount = () => {
    return filteredOrders.reduce((sum, order) => sum + order.grandTotal, 0)
  }

  const exportToExcel = async () => {
    // Show loading state
    setLoading(true)
    
    try {
      // Fetch all data types before exporting
      await Promise.all([
        fetchOrders(),
        fetchComplimentaryOrders(),
        fetchCancelledOrders()
      ])
      
      // Wait a moment for state to update
      await new Promise(resolve => setTimeout(resolve, 500))
    } catch (error) {
      console.error("Error fetching data for export:", error)
      setError("Failed to fetch all data for export")
      setTimeout(() => setError(""), 3000)
      setLoading(false)
      return
    } finally {
      setLoading(false)
    }

    // Prepare data for all three sheets
    const completedData = filteredOrders.map(order => ({
      "Order ID": order.orderId,
      "Customer": order.customer,
      "Mobile": order.customerMobile,
      "Table": order.tableNumber,
      "Items": order.items.length,
      "Amount": order.grandTotal,
      "Discount": order.originalOrder?.discountAmount || 0,
      "Date": order.date,
      "Status": order.status
    }))

    const complimentaryData = complimentaryOrders.map(order => ({
      "Order ID": order.orderId,
      "Customer": order.customer,
      "Mobile": order.customerMobile,
      "Table": order.tableNumber,
      "Items": order.items.length,
      "Original Amount": order.originalGrandTotal,
      "Reason": order.complimentaryReason,
      "Date": order.date
    }))

    const cancelledData = cancelledOrders.map(order => ({
      "Order ID": order.orderId,
      "Customer": order.customer,
      "Mobile": order.customerMobile,
      "Table": order.tableNumber,
      "Items": order.items.length,
      "Amount": order.grandTotal,
      "Reason": order.cancellationReason,
      "Cancelled By": order.cancelledBy || "Admin",
      "Date": order.date
    }))

    // Check if category is Restaurant
    const isRestaurant = selectedCategory?.name?.toLowerCase().includes("restaurant") || 
                        selectedCategory?.name?.toLowerCase() === "restaurant"
    
    console.log("Export - Category:", selectedCategory?.name, "isRestaurant:", isRestaurant)
    console.log("Export - Data counts:", {
      completed: completedData.length,
      complimentary: complimentaryData.length,
      cancelled: cancelledData.length
    })

    // Check if there's any data to export at all
    const hasCompletedData = completedData.length > 0
    const hasCancelledData = cancelledData.length > 0
    const hasComplimentaryData = isRestaurant && complimentaryData.length > 0
    
    if (!hasCompletedData && !hasCancelledData && !hasComplimentaryData) {
      setError("No data to export")
      setTimeout(() => setError(""), 3000)
      return
    }

    // Create workbook
    const wb = XLSX.utils.book_new()
    let sheetsAdded = 0

    // Add Completed Orders sheet (only if has data)
    if (hasCompletedData) {
      const wsCompleted = XLSX.utils.json_to_sheet(completedData)
      XLSX.utils.book_append_sheet(wb, wsCompleted, "Completed Orders")
      console.log("✅ Added Completed Orders sheet with", completedData.length, "orders")
      sheetsAdded++
    } else {
      console.log("⏭️ Skipped Completed Orders sheet - no data")
    }

    // Add Cancelled Orders sheet (only if has data)
    if (hasCancelledData) {
      const wsCancelled = XLSX.utils.json_to_sheet(cancelledData)
      XLSX.utils.book_append_sheet(wb, wsCancelled, "Cancelled Orders")
      console.log("✅ Added Cancelled Orders sheet with", cancelledData.length, "orders")
      sheetsAdded++
    } else {
      console.log("⏭️ Skipped Cancelled Orders sheet - no data")
    }

    // Add Complimentary Orders sheet - ONLY for Restaurant category AND if has data
    if (hasComplimentaryData) {
      const wsComplimentary = XLSX.utils.json_to_sheet(complimentaryData)
      XLSX.utils.book_append_sheet(wb, wsComplimentary, "Complimentary Orders")
      console.log("✅ Added Complimentary Orders sheet with", complimentaryData.length, "orders")
      sheetsAdded++
    } else if (isRestaurant) {
      console.log("⏭️ Skipped Complimentary Orders sheet - no data")
    } else {
      console.log("⏭️ Skipped Complimentary Orders sheet - not a restaurant category")
    }

    if (sheetsAdded === 0) {
      setError("No data to export")
      setTimeout(() => setError(""), 3000)
      return
    }

    // Generate filename with date range
    let dateInfo = ""
    if (dateFilterType === "single" && singleDate) {
      dateInfo = singleDate
    } else if (dateFilterType === "range" && startDate && endDate) {
      dateInfo = `${startDate}_to_${endDate}`
    } else if (dateFilterType === "range" && startDate) {
      dateInfo = `from_${startDate}`
    } else if (dateFilterType === "range" && endDate) {
      dateInfo = `until_${endDate}`
    } else {
      dateInfo = "All_Dates"
    }

    const fileName = `Staff_Orders_${selectedBranch?.name}_${selectedCategory?.name}_${dateInfo}.xlsx`
    
    // Save file
    XLSX.writeFile(wb, fileName)
    
    setSuccessMessage("Excel file exported successfully with all order types")
    setTimeout(() => setSuccessMessage(""), 3000)
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ 
        marginBottom: "20px",
        padding: "20px",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        borderRadius: "12px",
        color: "white",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
      }}>
        <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "700" }}>Staff Orders Management</h1>
        <p style={{ margin: "8px 0 0", opacity: 0.9 }}>Select branch and category to view and manage orders</p>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div style={{
          padding: "12px 16px",
          backgroundColor: "#d1fae5",
          color: "#065f46",
          borderRadius: "8px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <Check size={18} />
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>
      )}

      {error && (
        <div style={{
          padding: "12px 16px",
          backgroundColor: "#fee2e2",
          color: "#dc2626",
          borderRadius: "8px",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "8px"
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Branch and Category Selection */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "20px",
        marginBottom: "20px"
      }}>
        {/* Branch Selection */}
        <div style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
        }}>
          <h3 style={{ margin: "0 0 15px 0", fontSize: "16px", fontWeight: "600" }}>1. Select Branch</h3>
          <select
            value={selectedBranch?._id || ""}
            onChange={(e) => {
              const branch = branches.find(b => b._id === e.target.value)
              setSelectedBranch(branch || null)
            }}
            style={{
              width: "100%",
              padding: "12px",
              border: "2px solid #e5e7eb",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "500"
            }}
          >
            <option value="">-- Select Branch --</option>
            {branches.map(branch => (
              <option key={branch._id} value={branch._id}>{branch.name}</option>
            ))}
          </select>
          {selectedBranch && (
            <div style={{ marginTop: "10px", fontSize: "13px", color: "#059669", fontWeight: "500" }}>
              ✓ {selectedBranch.name} selected
            </div>
          )}
        </div>

        {/* Category Selection */}
        <div style={{
          backgroundColor: "white",
          padding: "20px",
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          opacity: selectedBranch ? 1 : 0.5,
          pointerEvents: selectedBranch ? "auto" : "none"
        }}>
          <h3 style={{ margin: "0 0 15px 0", fontSize: "16px", fontWeight: "600" }}>2. Select Category</h3>
          <select
            value={selectedCategory?._id || ""}
            onChange={(e) => {
              const category = categories.find(c => c._id === e.target.value)
              setSelectedCategory(category || null)
            }}
            disabled={!selectedBranch}
            style={{
              width: "100%",
              padding: "12px",
              border: "2px solid #e5e7eb",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "500"
            }}
          >
            <option value="">-- Select Category --</option>
            {categories.map(category => (
              <option key={category._id} value={category._id}>{category.name}</option>
            ))}
          </select>
          {selectedCategory && (
            <div style={{ marginTop: "10px", fontSize: "13px", color: "#059669", fontWeight: "500" }}>
              ✓ {selectedCategory.name} selected
            </div>
          )}
        </div>
      </div>
      {/* Orders Section - Only show when branch and category are selected */}
      {selectedBranch && selectedCategory && (
        <>
          {/* View Mode Tabs */}
          <div style={{
            display: "flex",
            gap: "8px",
            marginBottom: "20px",
            backgroundColor: "white",
            padding: "6px",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            width: "fit-content"
          }}>
            <button
              onClick={() => setViewMode("orders")}
              style={{
                padding: "10px 20px",
                backgroundColor: viewMode === "orders" ? "#4f46e5" : "transparent",
                color: viewMode === "orders" ? "white" : "#6b7280",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              � Completed Orders
            </button>
            {/* Only show Complimentary tab for Restaurant category */}
            {(() => {
              const categoryName = selectedCategory?.name || ""
              const isRestaurant = categoryName.toLowerCase().includes("restaurant")
              console.log("Category check:", { categoryName, isRestaurant })
              return isRestaurant
            })() && (
              <button
                onClick={() => setViewMode("complimentary")}
                style={{
                  padding: "10px 20px",
                  backgroundColor: viewMode === "complimentary" ? "#10b981" : "transparent",
                  color: viewMode === "complimentary" ? "white" : "#6b7280",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                🎁 Complimentary
              </button>
            )}
            <button
              onClick={() => setViewMode("cancelled")}
              style={{
                padding: "10px 20px",
                backgroundColor: viewMode === "cancelled" ? "#ef4444" : "transparent",
                color: viewMode === "cancelled" ? "white" : "#6b7280",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              ❌ Cancelled
            </button>
          </div>

          {/* Filters and Stats - Only show for "orders" view */}
          {viewMode === "orders" && (
            <>
          {/* Filters and Stats */}
          <div style={{
            backgroundColor: "white",
            padding: "20px",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            marginBottom: "20px"
          }}>
            {/* Stats Row */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "15px",
              marginBottom: "20px"
            }}>
              <div style={{ textAlign: "center", padding: "15px", backgroundColor: "#f0f9ff", borderRadius: "8px" }}>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#0369a1" }}>{filteredOrders.length}</div>
                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Completed Orders</div>
              </div>
              <div style={{ textAlign: "center", padding: "15px", backgroundColor: "#f0fdf4", borderRadius: "8px" }}>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#059669" }}>₹{calculateTotalAmount().toFixed(2)}</div>
                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Total Amount</div>
              </div>
              <div style={{ textAlign: "center", padding: "15px", backgroundColor: "#fee2e2", borderRadius: "8px" }}>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#ef4444" }}>
                  ₹{filteredOrders.reduce((sum, order) => sum + (order.originalOrder?.discountAmount || 0), 0).toFixed(2)}
                </div>
                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Total Discount</div>
              </div>
              <div style={{ textAlign: "center", padding: "15px", backgroundColor: "#fef3c7", borderRadius: "8px" }}>
                <div style={{ fontSize: "24px", fontWeight: "700", color: "#d97706" }}>
                  ₹{filteredOrders.length > 0 ? (calculateTotalAmount() / filteredOrders.length).toFixed(2) : "0.00"}
                </div>
                <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Average Order Value</div>
              </div>
            </div>

            {/* Filters Row */}
            <div style={{ display: "flex", gap: "15px", flexWrap: "wrap", alignItems: "center" }}>
              {/* Search */}
              <div style={{ position: "relative", flex: 1, minWidth: "250px" }}>
                <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
                <input
                  type="text"
                  placeholder="Search by order ID, table, or customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 10px 10px 40px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "14px"
                  }}
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: "10px 15px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "14px",
                  minWidth: "150px"
                }}
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="preparing">Preparing</option>
                <option value="served">Served</option>
              </select>

              {/* Refresh Button */}
              <button
                onClick={fetchOrders}
                disabled={loading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 16px",
                  backgroundColor: "#4f46e5",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? <Loader size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Refresh
              </button>

              {/* Export to Excel Button */}
              <button
                onClick={exportToExcel}
                disabled={loading}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 16px",
                  backgroundColor: "#059669",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1
                }}
              >
                <Download size={16} />
                Export Excel
              </button>
            </div>
          </div>

          {/* Date Filter */}
          <div style={{
            backgroundColor: "white",
            padding: "15px 20px",
            borderRadius: "8px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
            marginBottom: "20px",
            display: "flex",
            gap: "15px",
            flexWrap: "wrap",
            alignItems: "center"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Calendar size={18} style={{ color: "#6b7280" }} />
              <span style={{ fontSize: "14px", fontWeight: "500", color: "#374151" }}>Date Filter:</span>
            </div>

            {/* Date Type Toggle */}
            <div style={{ display: "flex", gap: "4px", backgroundColor: "#f3f4f6", padding: "4px", borderRadius: "6px" }}>
              <button
                onClick={() => {
                  setDateFilterType("all")
                  setSingleDate("")
                  setStartDate("")
                  setEndDate("")
                }}
                style={{
                  padding: "6px 12px",
                  backgroundColor: dateFilterType === "all" ? "#4f46e5" : "transparent",
                  color: dateFilterType === "all" ? "white" : "#6b7280",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "13px",
                  cursor: "pointer",
                  fontWeight: dateFilterType === "all" ? "500" : "normal"
                }}
              >
                All Dates
              </button>
              <button
                onClick={() => {
                  setDateFilterType("single")
                  setStartDate("")
                  setEndDate("")
                }}
                style={{
                  padding: "6px 12px",
                  backgroundColor: dateFilterType === "single" ? "#4f46e5" : "transparent",
                  color: dateFilterType === "single" ? "white" : "#6b7280",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "13px",
                  cursor: "pointer",
                  fontWeight: dateFilterType === "single" ? "500" : "normal"
                }}
              >
                Single Day
              </button>
              <button
                onClick={() => {
                  setDateFilterType("range")
                  setSingleDate("")
                }}
                style={{
                  padding: "6px 12px",
                  backgroundColor: dateFilterType === "range" ? "#4f46e5" : "transparent",
                  color: dateFilterType === "range" ? "white" : "#6b7280",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "13px",
                  cursor: "pointer",
                  fontWeight: dateFilterType === "range" ? "500" : "normal"
                }}
              >
                Date Range
              </button>
            </div>

            {/* Date Inputs */}
            {dateFilterType === "single" && (
              <input
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "14px"
                }}
              />
            )}

            {dateFilterType === "range" && (
              <>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  placeholder="From"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "14px"
                  }}
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder="To"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "14px"
                  }}
                />
              </>
            )}

            {(singleDate || startDate || endDate) && (
              <button
                onClick={handleDateReset}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  backgroundColor: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  cursor: "pointer"
                }}
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>
          </>
          )}

          {/* Orders Table - All Orders View */}
          {viewMode === "orders" && (
            <>
              {loading ? (
            <div style={{ textAlign: "center", padding: "40px", backgroundColor: "white", borderRadius: "8px" }}>
              <Loader size={32} className="animate-spin" style={{ margin: "0 auto", color: "#4f46e5" }} />
              <p style={{ marginTop: "16px", color: "#6b7280" }}>Loading orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", backgroundColor: "white", borderRadius: "8px" }}>
              <AlertCircle size={48} style={{ margin: "0 auto", color: "#9ca3af" }} />
              <p style={{ marginTop: "16px", color: "#6b7280", fontSize: "16px" }}>No orders found</p>
            </div>
          ) : (
            <>
              <div style={{ backgroundColor: "white", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                    <tr>
                      <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Order ID</th>
                      <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Customer</th>
                      <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Table</th>
                      <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Items</th>
                      <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Amount</th>
                      <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order, index) => (
                      <tr key={order.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                        <td style={{ padding: "12px", fontSize: "14px", fontWeight: "500" }}>{order.orderId}</td>
                        <td style={{ padding: "12px", fontSize: "14px" }}>
                          <div>{order.customer}</div>
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>{order.customerMobile}</div>
                        </td>
                        <td style={{ padding: "12px", fontSize: "14px" }}>{order.tableNumber}</td>
                        <td style={{ padding: "12px", fontSize: "14px" }}>{order.items.length} items</td>
                        <td style={{ padding: "12px", fontSize: "14px", fontWeight: "600", color: "#059669" }}>₹{order.grandTotal.toFixed(2)}</td>
                        <td style={{ padding: "12px", fontSize: "13px", color: "#6b7280" }}>{order.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "10px",
                  marginTop: "20px",
                  padding: "15px",
                  backgroundColor: "white",
                  borderRadius: "8px"
                }}>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: currentPage === 1 ? "#f3f4f6" : "#4f46e5",
                      color: currentPage === 1 ? "#9ca3af" : "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: currentPage === 1 ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <span style={{ fontSize: "14px", color: "#374151" }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: "8px 12px",
                      backgroundColor: currentPage === totalPages ? "#f3f4f6" : "#4f46e5",
                      color: currentPage === totalPages ? "#9ca3af" : "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
          </>
          )}

          {/* Complimentary Orders View */}
          {viewMode === "complimentary" && (
            <>
              {/* Complimentary Stats */}
              <div style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                marginBottom: "20px"
              }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "15px"
                }}>
                  <div style={{ textAlign: "center", padding: "15px", backgroundColor: "#f0fdf4", borderRadius: "8px" }}>
                    <div style={{ fontSize: "24px", fontWeight: "700", color: "#10b981" }}>{complimentaryOrders.length}</div>
                    <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Complimentary Orders</div>
                  </div>
                  <div style={{ textAlign: "center", padding: "15px", backgroundColor: "#fef3c7", borderRadius: "8px" }}>
                    <div style={{ fontSize: "24px", fontWeight: "700", color: "#d97706" }}>
                      ₹{complimentaryOrders.reduce((sum, order) => sum + (order.originalGrandTotal || 0), 0).toFixed(2)}
                    </div>
                    <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Total Complimentary Amount</div>
                  </div>
                </div>
              </div>

              {loading ? (
                <div style={{ textAlign: "center", padding: "40px", backgroundColor: "white", borderRadius: "8px" }}>
                  <Loader size={32} className="animate-spin" style={{ margin: "0 auto", color: "#10b981" }} />
                  <p style={{ marginTop: "16px", color: "#6b7280" }}>Loading complimentary orders...</p>
                </div>
              ) : complimentaryOrders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", backgroundColor: "white", borderRadius: "8px" }}>
                  <AlertCircle size={48} style={{ margin: "0 auto", color: "#9ca3af" }} />
                  <p style={{ marginTop: "16px", color: "#6b7280", fontSize: "16px" }}>No complimentary orders found</p>
                </div>
              ) : (
                <div style={{ backgroundColor: "white", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                      <tr>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Order ID</th>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Customer</th>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Table</th>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Items</th>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Original Amount</th>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Reason</th>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {complimentaryOrders.map((order) => (
                        <tr key={order.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "12px", fontSize: "14px", fontWeight: "500" }}>{order.orderId}</td>
                          <td style={{ padding: "12px", fontSize: "14px" }}>
                            <div>{order.customer}</div>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>{order.customerMobile}</div>
                          </td>
                          <td style={{ padding: "12px", fontSize: "14px" }}>{order.tableNumber}</td>
                          <td style={{ padding: "12px", fontSize: "14px" }}>{order.items.length} items</td>
                          <td style={{ padding: "12px", fontSize: "14px", fontWeight: "600", color: "#10b981" }}>₹{order.originalGrandTotal.toFixed(2)}</td>
                          <td style={{ padding: "12px", fontSize: "13px", color: "#6b7280", maxWidth: "200px" }}>{order.complimentaryReason}</td>
                          <td style={{ padding: "12px", fontSize: "13px", color: "#6b7280" }}>{order.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Cancelled Orders View */}
          {viewMode === "cancelled" && (
            <>
              {/* Cancelled Stats */}
              <div style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                marginBottom: "20px"
              }}>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                  gap: "15px"
                }}>
                  <div style={{ textAlign: "center", padding: "15px", backgroundColor: "#fee2e2", borderRadius: "8px" }}>
                    <div style={{ fontSize: "24px", fontWeight: "700", color: "#ef4444" }}>{cancelledOrders.length}</div>
                    <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Cancelled Orders</div>
                  </div>
                  <div style={{ textAlign: "center", padding: "15px", backgroundColor: "#fef3c7", borderRadius: "8px" }}>
                    <div style={{ fontSize: "24px", fontWeight: "700", color: "#d97706" }}>
                      ₹{cancelledOrders.reduce((sum, order) => sum + (order.grandTotal || 0), 0).toFixed(2)}
                    </div>
                    <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>Total Cancelled Amount</div>
                  </div>
                </div>
              </div>

              {loading ? (
                <div style={{ textAlign: "center", padding: "40px", backgroundColor: "white", borderRadius: "8px" }}>
                  <Loader size={32} className="animate-spin" style={{ margin: "0 auto", color: "#ef4444" }} />
                  <p style={{ marginTop: "16px", color: "#6b7280" }}>Loading cancelled orders...</p>
                </div>
              ) : cancelledOrders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", backgroundColor: "white", borderRadius: "8px" }}>
                  <AlertCircle size={48} style={{ margin: "0 auto", color: "#9ca3af" }} />
                  <p style={{ marginTop: "16px", color: "#6b7280", fontSize: "16px" }}>No cancelled orders found</p>
                </div>
              ) : (
                <div style={{ backgroundColor: "white", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.1)", overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ backgroundColor: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                      <tr>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Order ID</th>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Customer</th>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Table</th>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Items</th>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Amount</th>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Reason</th>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Cancelled By</th>
                        <th style={{ padding: "12px", textAlign: "left", fontSize: "13px", fontWeight: "600", color: "#374151" }}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cancelledOrders.map((order) => (
                        <tr key={order.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                          <td style={{ padding: "12px", fontSize: "14px", fontWeight: "500" }}>{order.orderId}</td>
                          <td style={{ padding: "12px", fontSize: "14px" }}>
                            <div>{order.customer}</div>
                            <div style={{ fontSize: "12px", color: "#6b7280" }}>{order.customerMobile}</div>
                          </td>
                          <td style={{ padding: "12px", fontSize: "14px" }}>{order.tableNumber}</td>
                          <td style={{ padding: "12px", fontSize: "14px" }}>{order.items.length} items</td>
                          <td style={{ padding: "12px", fontSize: "14px", fontWeight: "600", color: "#ef4444" }}>₹{order.grandTotal.toFixed(2)}</td>
                          <td style={{ padding: "12px", fontSize: "13px", color: "#6b7280", maxWidth: "200px" }}>{order.cancellationReason}</td>
                          <td style={{ padding: "12px", fontSize: "13px", color: "#6b7280" }}>{order.cancelledBy || "Admin"}</td>
                          <td style={{ padding: "12px", fontSize: "13px", color: "#6b7280" }}>{order.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "500px",
            width: "90%",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "20px", fontWeight: "600", color: "#111827" }}>
              Cancel Order
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6b7280" }}>
              Order ID: <strong>{selectedOrder?.orderId}</strong>
            </p>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500", color: "#374151" }}>
                Your Name *
              </label>
              <input
                type="text"
                value={cancelledBy}
                onChange={(e) => setCancelledBy(e.target.value)}
                placeholder="Enter your name..."
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "14px"
                }}
              />
            </div>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500", color: "#374151" }}>
                Cancellation Reason *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason for cancellation..."
                rows={4}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "14px",
                  resize: "vertical"
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowCancelModal(false)
                  setCancelReason("")
                  setCancelledBy("")
                  setSelectedOrder(null)
                }}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleCancelOrder}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer"
                }}
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complimentary Modal */}
      {showComplimentaryModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white",
            borderRadius: "12px",
            padding: "24px",
            maxWidth: "500px",
            width: "90%",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "20px", fontWeight: "600", color: "#111827" }}>
              Mark as Complimentary
            </h3>
            <p style={{ margin: "0 0 20px 0", fontSize: "14px", color: "#6b7280" }}>
              Order ID: <strong>{selectedOrder?.orderId}</strong><br />
              Amount: <strong style={{ color: "#059669" }}>₹{selectedOrder?.grandTotal.toFixed(2)}</strong>
            </p>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500", color: "#374151" }}>
                Reason *
              </label>
              <textarea
                value={complimentaryReason}
                onChange={(e) => setComplimentaryReason(e.target.value)}
                placeholder="Enter reason for complimentary bill..."
                rows={4}
                style={{
                  width: "100%",
                  padding: "10px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "14px",
                  resize: "vertical"
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowComplimentaryModal(false)
                  setComplimentaryReason("")
                  setSelectedOrder(null)
                }}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#f3f4f6",
                  color: "#374151",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleComplimentary}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "14px",
                  fontWeight: "500",
                  cursor: "pointer"
                }}
              >
                Confirm Complimentary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default StaffOrders

