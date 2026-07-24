import { useState, useEffect } from "react"
import { Search, X, Check, AlertCircle, Loader, LogOut, RefreshCw, Printer, ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { fetchDualBackend } from "../utils/apiHelpers"
import logo from "../assets/logo4.jpeg"

const CategoryOrders = () => {
  const navigate = useNavigate()
  const [categoryStaffData, setCategoryStaffData] = useState(null)
  const [allOrders, setAllOrders] = useState([])
  const [filteredOrders, setFilteredOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  // Filters
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [dateFilterType, setDateFilterType] = useState("single") // "single" or "range" - default to single
  const [singleDate, setSingleDate] = useState(() => {
    // Set default to today's date in YYYY-MM-DD format
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Sales Report
  const [viewMode, setViewMode] = useState("orders") // "orders", "sales", "cancelled", "complimentary"
  const [salesData, setSalesData] = useState(null)
  const [salesLoading, setSalesLoading] = useState(false)
  const [cancelledOrders, setCancelledOrders] = useState([])
  const [complimentaryOrders, setComplimentaryOrders] = useState([])

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(20)

  // Modal states for new features
  const [showComplimentaryModal, setShowComplimentaryModal] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showDiscountModal, setShowDiscountModal] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [complimentaryReason, setComplimentaryReason] = useState("")
  const [cancelReason, setCancelReason] = useState("")
  const [cancelPassword, setCancelPassword] = useState("")
  const [cancelledByName, setCancelledByName] = useState("")
  const [discountType, setDiscountType] = useState("percentage")
  const [discountValue, setDiscountValue] = useState("")
  const [discountReason, setDiscountReason] = useState("")

  useEffect(() => {
    // Check if user is logged in as category staff
    const userType = localStorage.getItem("userType")
    const staffData = localStorage.getItem("categoryStaffData")
    
    if (userType !== "category-staff" || !staffData) {
      navigate("/login")
      return
    }
    
    const parsedStaffData = JSON.parse(staffData)
    console.log('🔍 CategoryOrders - Staff Data:', parsedStaffData)
    console.log('🔍 CategoryOrders - Category Name:', `"${parsedStaffData.categoryName}"`)
    console.log('🔍 CategoryOrders - Category ID:', parsedStaffData.categoryId)
    
    setCategoryStaffData(parsedStaffData)
  }, [navigate])

  useEffect(() => {
    if (categoryStaffData) {
      fetchOrders()
    }
  }, [categoryStaffData, statusFilter, currentPage, itemsPerPage, startDate, endDate, singleDate, dateFilterType])

  useEffect(() => {
    if (categoryStaffData && viewMode === "sales") {
      fetchSalesReport()
    } else if (categoryStaffData && viewMode === "cancelled") {
      fetchCancelledOrders()
    } else if (categoryStaffData && viewMode === "complimentary") {
      fetchComplimentaryOrders()
    }
  }, [categoryStaffData, viewMode, startDate, endDate, singleDate, dateFilterType])

  const fetchSalesReport = async () => {
    if (!categoryStaffData?.categoryId) return
    
    setSalesLoading(true)
    setError("")

    try {
      const categoryId = categoryStaffData.categoryId._id || categoryStaffData.categoryId
      const branchId = categoryStaffData.branchId._id || categoryStaffData.branchId
      
      console.log('📊 Fetching sales report for category:', categoryStaffData.categoryName)

      // Build query parameters
      let params = `branchId=${branchId}&categoryId=${categoryId}`
      
      // Apply date filters based on filter type
      if (dateFilterType === "single" && singleDate) {
        params += `&startDate=${singleDate}&endDate=${singleDate}`
      } else if (dateFilterType === "range") {
        if (startDate) {
          params += `&startDate=${startDate}`
        }
        if (endDate) {
          params += `&endDate=${endDate}`
        }
      }

      const response = await fetchDualBackend(`/mobile-staff-order/sales-report?${params}`, {}, true)
      
      console.log('📊 Sales report response:', response)

      // fetchDualBackend unwraps the response, so we get the data directly
      if (response && (response.orders || response.summary)) {
        setSalesData(response)
      } else {
        const errorMsg = response?.message || "No sales data available"
        console.error('📊 Sales report error:', errorMsg)
        setError(errorMsg)
      }
    } catch (error) {
      console.error("Error fetching sales report:", error)
      const errorMsg = error?.message || error?.toString() || "Failed to load sales report. Please try again."
      setError(errorMsg)
    } finally {
      setSalesLoading(false)
    }
  }

  const fetchCancelledOrders = async () => {
    if (!categoryStaffData?.categoryId) return
    
    setSalesLoading(true)
    setError("")

    try {
      const categoryId = categoryStaffData.categoryId._id || categoryStaffData.categoryId
      const branchId = categoryStaffData.branchId._id || categoryStaffData.branchId
      
      console.log('❌ Fetching cancelled orders for category:', categoryStaffData.categoryName)

      // Build query parameters
      let params = `branchId=${branchId}&categoryId=${categoryId}`
      
      // Apply date filters
      if (dateFilterType === "single" && singleDate) {
        params += `&startDate=${singleDate}&endDate=${singleDate}`
      } else if (dateFilterType === "range") {
        if (startDate) params += `&startDate=${startDate}`
        if (endDate) params += `&endDate=${endDate}`
      }
      // If no date params, backend will default to today

      const response = await fetchDualBackend(`/mobile-staff-order/cancelled?${params}`, {}, true)

      const orders = response.orders || []
      
      const formattedOrders = orders.map(order => ({
        orderId: order.orderId || order.orderNumber,
        tableNumber: order.tableNumber || order.tableId?.tableNumber || 'N/A',
        customerName: order.customerName || order.name || 'Unknown',
        items: order.items || [],
        grandTotal: order.grandTotal || 0,
        cancelledAt: order.cancelledAt || order.updatedAt,
        cancellationReason: order.cancellationReason || 'No reason provided',
        cancelledBy: order.cancelledBy || 'Admin'
      }))

      setCancelledOrders(formattedOrders)
    } catch (error) {
      console.error("Error fetching cancelled orders:", error)
      setError("Failed to load cancelled orders")
    } finally {
      setSalesLoading(false)
    }
  }

  const fetchComplimentaryOrders = async () => {
    if (!categoryStaffData?.categoryId) return
    
    setSalesLoading(true)
    setError("")

    try {
      const categoryId = categoryStaffData.categoryId._id || categoryStaffData.categoryId
      const branchId = categoryStaffData.branchId._id || categoryStaffData.branchId
      
      console.log('🎁 Fetching complimentary orders for category:', categoryStaffData.categoryName)

      // Build query parameters
      let params = `branchId=${branchId}&categoryId=${categoryId}`
      
      // Apply date filters
      if (dateFilterType === "single" && singleDate) {
        params += `&startDate=${singleDate}&endDate=${singleDate}`
      } else if (dateFilterType === "range") {
        if (startDate) params += `&startDate=${startDate}`
        if (endDate) params += `&endDate=${endDate}`
      }
      // If no date params, backend will default to today

      const response = await fetchDualBackend(`/mobile-staff-order/complimentary?${params}`, {}, true)

      const orders = response.orders || []
      
      const formattedOrders = orders.map(order => ({
        orderId: order.orderId || order.orderNumber,
        tableNumber: order.tableNumber || order.tableId?.tableNumber || 'N/A',
        customerName: order.customerName || order.name || 'Unknown',
        items: order.items || [],
        originalGrandTotal: order.originalGrandTotal || 0,
        complimentaryMarkedAt: order.complimentaryMarkedAt || order.updatedAt,
        complimentaryReason: order.complimentaryReason || 'No reason provided'
      }))

      setComplimentaryOrders(formattedOrders)
    } catch (error) {
      console.error("Error fetching complimentary orders:", error)
      setError("Failed to load complimentary orders")
    } finally {
      setSalesLoading(false)
    }
  }

  const fetchOrders = async () => {
    if (!categoryStaffData?.categoryId) return
    
    setLoading(true)
    setError("")

    try {
      const categoryId = categoryStaffData.categoryId._id || categoryStaffData.categoryId

      // Add cache busting parameter to ensure fresh data
      const cacheBuster = Date.now()

      const branchId = categoryStaffData.branchId._id || categoryStaffData.branchId
      
      console.log('🔍 CategoryOrders - Fetching orders for category:', categoryStaffData.categoryName)
      console.log('🔍 CategoryOrders - Category ID:', categoryId)
      console.log('🔍 CategoryOrders - Branch ID:', branchId)
      console.log('🔍 CategoryOrders - Staff Category Name (exact):', `"${categoryStaffData.categoryName}"`)
      console.log('🔍 CategoryOrders - Staff Category Name (lowercase):', `"${categoryStaffData.categoryName.toLowerCase().trim()}"`)

      // Build query parameters
      let staffOrderParams = `branchId=${branchId}&categoryId=${categoryId}&page=${currentPage}&limit=${itemsPerPage}&_t=${cacheBuster}`
      
      // Apply date filters based on filter type - ALWAYS pass date to ensure backend filtering
      if (dateFilterType === "single" && singleDate) {
        // For single date, set both start and end to the same date
        staffOrderParams += `&startDate=${singleDate}&endDate=${singleDate}`
        console.log('🔍 CategoryOrders - Using single date filter:', singleDate)
      } else if (dateFilterType === "range") {
        if (startDate) {
          staffOrderParams += `&startDate=${startDate}`
        }
        if (endDate) {
          staffOrderParams += `&endDate=${endDate}`
        }
        console.log('🔍 CategoryOrders - Using date range:', { startDate, endDate })
      } else {
        // Fallback: if no date is set, use today
        const today = new Date().toISOString().split('T')[0]
        staffOrderParams += `&startDate=${today}&endDate=${today}`
        console.log('🔍 CategoryOrders - Fallback to today:', today)
      }
      
      console.log('🔍 CategoryOrders - Staff Order Params:', staffOrderParams)

      // Fetch only staff orders (no online orders)
      const staffOrders = await fetchDualBackend(`/staff-order?${staffOrderParams}`, {}, true)
        .catch(() => ({ orders: [], totalCount: 0, totalPages: 1 }))
      
      // Handle response formats
      const staffOrdersArray = Array.isArray(staffOrders) ? staffOrders : (staffOrders.orders || [])
      
      // Get pagination info from response
      const staffTotalCount = staffOrders.totalCount || 0
      const staffTotalPages = staffOrders.totalPages || 1
      
      setTotalCount(staffTotalCount)
      setTotalPages(staffTotalPages)
      
      console.log('🔍 CategoryOrders - Raw API response (filtered by backend):', {
        staffOrdersCount: staffOrdersArray.length,
        branchId: branchId,
        categoryId: categoryId
      });

      // Log first few orders to see their structure
      if (staffOrdersArray.length > 0) {
        console.log('🔍 CategoryOrders - First 3 orders structure:')
        staffOrdersArray.slice(0, 3).forEach((order, index) => {
          console.log(`  Order ${index + 1}:`, {
            id: order._id,
            orderId: order.orderId || order.orderNumber,
            categoryName: order.categoryName,
            customerName: order.customerName,
            createdAt: order.createdAt,
            items: order.items?.length || 0
          })
        })
      }
      
      // Use staff orders directly (no need to transform)
      const allOrdersData = staffOrdersArray
      
      // Remove duplicates based on orderId
      const uniqueOrders = allOrdersData.filter((order, index, self) => {
        const orderId = order.orderId || order.orderNumber || order._id
        return index === self.findIndex(o => (o.orderId || o.orderNumber || o._id) === orderId)
      })

      console.log('🔍 CategoryOrders - Orders after backend filtering:', {
        totalOrders: uniqueOrders.length,
        branchId: branchId,
        categoryId: categoryId,
        categoryName: categoryStaffData.categoryName,
        orderIds: uniqueOrders.map(o => o.orderId || o.orderNumber || o._id).slice(0, 10)
      })

      // Since backend already filtered by branch and category, use all orders
      const categoryOrders = uniqueOrders
      
      // EXCLUDE completed, cancelled, and complimentary orders from the orders list (they should only appear in their respective tabs)
      const activeOrders = categoryOrders.filter(order => 
        order.status !== "completed" && 
        order.status !== "cancelled" && 
        !order.isComplimentary
      )
      
      // Apply status filter
      let filtered = activeOrders
      if (statusFilter !== "all") {
        filtered = filtered.filter(order => order.status === statusFilter)
      }

      // Format orders
      const formattedOrders = filtered
        .filter(order => order.orderId || order.orderNumber || order._id) // Only include orders with valid IDs
        .sort((a, b) => {
          // Sort by creation date - newest first
          const dateA = new Date(a.orderTime || a.createdAt || 0);
          const dateB = new Date(b.orderTime || b.createdAt || 0);
          return dateB - dateA; // Descending order (newest first)
        })
        .map((order, index) => ({
        id: order._id || `temp-id-${index}`,
        orderId: order.orderId || order.orderNumber || `UNKNOWN-${index}`,
        kotNumber: order.kotNumber || null, // Add KOT number
        customer: order.isGuestOrder ? order.customerName : order.userId?.name || "Unknown",
        customerType: order.isGuestOrder ? "Guest" : "Staff",
        customerMobile: order.isGuestOrder ? order.customerMobile : order.userId?.mobile || "N/A",
        date: new Date(order.orderTime || order.createdAt || Date.now()).toLocaleString("en-US", {
          year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        }),
        branch: order.branchName || "Unknown Branch",
        tableNumber: order.tableNumber || "N/A",
        tableId: order.tableId?._id || order.tableId || null, // Extract _id if tableId is populated
        peopleCount: order.peopleCount || 0,
        // Show all items since backend already filtered by category
        items: order.items || [],
        allItems: order.items || [],
        status: order.status || "pending",
        paymentStatus: order.paymentStatus || "pending",
        grandTotal: order.grandTotal || 0,
        originalOrder: order,
        // Add sortable date for debugging
        sortDate: new Date(order.orderTime || order.createdAt || 0)
      }))

      setAllOrders(formattedOrders)
    } catch (error) {
      console.error("Error fetching orders:", error)
      setError("Failed to load orders. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Search filtering (client-side for current page)
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

  const handleDateFilterTypeChange = (type) => {
    setDateFilterType(type)
    // Clear all date filters when switching
    setSingleDate("")
    setStartDate("")
    setEndDate("")
    setCurrentPage(1)
  }

  const handlePaymentStatusChange = async (order, newPaymentStatus) => {
    try {
      // Determine which API to use based on order type (same logic as status change)
      const isMobileOrder = order.tableNumber === "Mobile Order" || order.originalOrder?.tableNumber === "Mobile Order"
      const isActualStaffOrder = order.originalOrder?.isGuestOrder !== undefined && !isMobileOrder
      
      const endpoint = isActualStaffOrder 
        ? `/staff-order/${order.id}/payment-status`
        : `/order/${order.id}/payment-status`
      
      console.log('💳 Payment Status Update:', {
        orderId: order.orderId,
        endpoint,
        newPaymentStatus
      })
      
      await fetchDualBackend(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentStatus: newPaymentStatus })
      })
      
      setSuccessMessage(`Order ${order.orderId} payment status updated to ${newPaymentStatus}`)
      setTimeout(() => setSuccessMessage(""), 3000)
      
      // Refresh orders
      fetchOrders()
    } catch (error) {
      console.error("Error updating payment status:", error)
      setError("Failed to update payment status")
      setTimeout(() => setError(""), 3000)
    }
  }

  const handleStatusChange = async (order, newStatus) => {
    try {
      // Determine which API to use based on order type
      // Mobile app orders have tableNumber "Mobile Order" but should use /order/ endpoint
      // Staff orders are created through the staff interface and have actual table numbers
      const isMobileOrder = order.tableNumber === "Mobile Order" || order.originalOrder?.tableNumber === "Mobile Order"
      const isActualStaffOrder = order.originalOrder?.isGuestOrder !== undefined && !isMobileOrder
      
      console.log('🔄 Status Update Debug:', {
        orderId: order.orderId,
        tableNumber: order.tableNumber,
        isMobileOrder,
        isActualStaffOrder,
        originalOrder: !!order.originalOrder
      })
      
      // Mobile orders and online orders use /order/ endpoint
      // Only actual staff orders use /staff-order/ endpoint
      const endpoint = isActualStaffOrder 
        ? `/staff-order/${order.id}/status`
        : `/order/${order.id}/status`
      
      // Map status for online/mobile orders (they use different status values)
      let statusToSend = newStatus
      if (!isActualStaffOrder) {
        // Online/mobile orders use: pending, confirmed, preparing, out for delivery, delivered, cancelled
        // Map "served" to "delivered" for online/mobile orders
        if (newStatus === "served") {
          statusToSend = "delivered"
        }
      }
      
      console.log('🔄 Status Update:', {
        endpoint,
        statusToSend,
        originalStatus: newStatus
      })
      
      await fetchDualBackend(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: statusToSend })
      })
      
      setSuccessMessage(`Order ${order.orderId} status updated to ${newStatus}`)
      setTimeout(() => setSuccessMessage(""), 3000)
      
      // Refresh orders
      fetchOrders()
    } catch (error) {
      console.error("Error updating status:", error)
      setError("Failed to update order status")
      setTimeout(() => setError(""), 3000)
    }
  }

  const printThermalBill = async (order) => {
    try {
      // First, complete the order and mark bill as printed using the new endpoint
      console.log(`🖨️ Completing order ${order.orderId} and marking bill as printed`)
      
      await fetchDualBackend(`/mobile-staff-order/${order.id}/complete-and-print`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" }
      })
      
      console.log(`✅ Order ${order.orderId} completed and marked as printed`)
      setSuccessMessage(`Order ${order.orderId} completed and will appear in sales report`)
      setTimeout(() => setSuccessMessage(""), 3000)
      
      // Refresh orders to show updated status
      fetchOrders()
    } catch (error) {
      console.error("Error completing order:", error)
      setError("Failed to complete order. Please try again.")
      setTimeout(() => setError(""), 3000)
      return // Don't print if order completion fails
    }

    // Aggregate duplicate items by name
    let rawItems = order.items || []
    
    // Enrich items with gstRate from menu - match by menuItemId OR item name
    try {
      const menuData = await fetchDualBackend(`/menu?limit=500`)
      const menuList = menuData?.data || menuData || []
      const menuById = {}
      const menuByName = {}
      menuList.forEach(m => {
        menuById[m._id] = m
        const key = (m.name || m.itemName || '').toLowerCase().trim()
        if (key) menuByName[key] = m
      })
      rawItems = rawItems.map(item => {
        if (item.gstRate && item.gstRate > 0) return item
        const rawName = (item.name || '').toLowerCase().trim()
        const cleanName = rawName.replace(/^\d+\s+/, '')
        const matched = menuById[item.menuItemId]
          || menuByName[rawName]
          || menuByName[cleanName]
          || menuList.find(m => {
              const mRaw = (m.name || m.itemName || '').toLowerCase().trim()
              const mClean = mRaw.replace(/^\d+\s+/, '')
              return mClean === cleanName || mRaw === rawName || mRaw.endsWith(cleanName) || cleanName.endsWith(mClean)
            })
        return { ...item, gstRate: matched?.gstRate || 0 }
      })
    } catch (e) {
      // proceed with original items if fetch fails
    }

    const aggregatedItems = rawItems.reduce((acc, item) => {
      const existingItem = acc.find(i => i.name === item.name && i.price === item.price)
      if (existingItem) {
        existingItem.quantity += item.quantity
      } else {
        acc.push({ ...item })
      }
      return acc
    }, [])

    // Calculate totals
    const subtotal = aggregatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    
    // Calculate GST per item and total GST
    const totalGST = aggregatedItems.reduce((sum, item) => {
      const rate = item.gstRate || 0
      return sum + ((item.price * item.quantity * rate) / 100)
    }, 0)
    
    const hasGST = totalGST > 0
    
    // Get discount information from order
    const originalGrandTotal = order.originalOrder?.originalGrandTotal || order.grandTotal
    const discountAmount = order.originalOrder?.discountAmount || 0
    const discountType = order.originalOrder?.discountType || null
    const discountValue = order.originalOrder?.discountValue || 0
    const hasDiscount = discountAmount > 0
    
    const grandTotal = subtotal + totalGST - discountAmount

    // Create thermal print window
    const printWindow = window.open('', '_blank', 'width=302,height=600')
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Bill</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page { 
              size: 80mm auto; 
              margin: 0; 
            }
            @media print {
              html, body { 
                width: 80mm; 
                margin: 0; 
                padding: 0;
              }
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              width: 72mm;
              padding: 3mm;
              line-height: 1.3;
            }
            .center { text-align: center; }
            .right { text-align: right; }
            .bold { font-weight: bold; }
            .line { border-top: 1px dashed #000; margin: 4px 0; }
            .double-line { border-top: 1px solid #000; border-bottom: 1px solid #000; height: 3px; margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; }
            td { padding: 1px 0; vertical-align: top; }
            .item-name { width: 45%; }
            .item-qty { width: 15%; text-align: center; }
            .item-price { width: 40%; text-align: right; }
            h2 { margin: 3px 0; font-size: 14px; }
            p { margin: 2px 0; }
            .footer { margin-top: 8px; font-size: 10px; }
            .total-row { font-size: 13px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="center">
            <h2>JAGALI KOOTA</h2>
            <p>${categoryStaffData.categoryName}</p>
          </div>
          <div class="line"></div>
          
          <p><strong>Bill No:</strong> ${order.orderId}</p>
          <p><strong>Date:</strong> ${order.date}</p>
          <p><strong>Customer:</strong> ${order.customer}</p>
          ${order.tableNumber !== 'N/A' ? `<p><strong>Table:</strong> ${order.tableNumber}</p>` : ''}
          
          <div class="double-line"></div>
          
          <table>
            <tr class="bold">
              <td class="item-name">Item</td>
              <td class="item-qty">Qty</td>
              <td class="item-price">Amount</td>
            </tr>
          </table>
          
          <div class="line"></div>
          
          <table>
            ${aggregatedItems.map(item => `
              <tr>
                <td class="item-name">${item.name}</td>
                <td class="item-qty">${item.quantity}</td>
                <td class="item-price">₹${(item.price * item.quantity).toFixed(2)}</td>
              </tr>
            `).join('')}
          </table>
          
          <div class="line"></div>
          
          <table>
            <tr>
              <td>Subtotal</td>
              <td class="right">₹${subtotal.toFixed(2)}</td>
            </tr>
            ${hasGST ? `
            <tr>
              <td>GST Amount</td>
              <td class="right">₹${totalGST.toFixed(2)}</td>
            </tr>
            ` : ''}
            ${hasDiscount ? `
            <tr style="color: #059669;">
              <td>Discount ${discountType === 'percentage' ? `(${discountValue}%)` : ''}</td>
              <td class="right">- ₹${discountAmount.toFixed(2)}</td>
            </tr>
            ` : ''}
          </table>
          
          <div class="double-line"></div>
          
          <table>
            <tr class="bold total-row">
              <td>GRAND TOTAL</td>
              <td class="right">₹${grandTotal.toFixed(2)}</td>
            </tr>
          </table>
          
          <div class="double-line"></div>
          
          <div class="center footer">
            <p class="bold">Thank you for your visit!</p>
            <p>Please visit again</p>
            <p>---</p>
          </div>
        </body>
      </html>
    `)
    
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 250)
  }

  const printKOT = (order) => {
    // Check if this is a Restaurant category
    const isRestaurantCategory = categoryStaffData.categoryName && 
      (categoryStaffData.categoryName.toLowerCase().includes('restaurant') || 
       categoryStaffData.categoryName.toLowerCase().includes('dining') ||
       categoryStaffData.categoryName.toLowerCase().includes('food'))
    
    if (!isRestaurantCategory) {
      alert('KOT printing is only available for Restaurant category')
      return
    }

    // Group items by KOT number
    const itemsByKot = {}
    order.items.forEach(item => {
      const kot = item.kotNumber || 'no-kot'
      if (!itemsByKot[kot]) {
        itemsByKot[kot] = []
      }
      itemsByKot[kot].push(item)
    })

    // Get all KOT numbers (excluding 'no-kot')
    const kotNumbers = Object.keys(itemsByKot).filter(kot => kot !== 'no-kot')
    
    if (kotNumbers.length === 0) {
      alert('No KOT numbers found for this order')
      return
    }

    // Print each KOT separately with delay
    kotNumbers.forEach((kotNumber, index) => {
      setTimeout(() => {
        const items = itemsByKot[kotNumber]
        
        // Create thermal print window for KOT
        const printWindow = window.open('', '_blank', 'width=302,height=600')
        
        printWindow.document.write(`
          <html>
            <head>
              <title>KOT - ${kotNumber}</title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                @page { 
                  size: 80mm auto; 
                  margin: 0; 
                }
                @media print {
                  html, body { 
                    width: 80mm; 
                    margin: 0; 
                    padding: 0;
                  }
                }
                body {
                  font-family: 'Courier New', Courier, monospace;
                  font-size: 12px;
                  width: 72mm;
                  padding: 3mm;
                  line-height: 1.4;
                }
                .center { text-align: center; }
                .bold { font-weight: bold; }
                .large { font-size: 16px; }
                .line { border-top: 1px dashed #000; margin: 6px 0; }
                .double-line { border-top: 2px solid #000; margin: 6px 0; }
                table { width: 100%; border-collapse: collapse; margin: 8px 0; }
                td { padding: 3px 0; vertical-align: top; }
                .item-name { width: 70%; }
                .item-qty { width: 30%; text-align: right; font-weight: bold; }
                h2 { margin: 5px 0; font-size: 18px; }
                p { margin: 3px 0; }
              </style>
            </head>
            <body>
              <div class="center">
                <h2 class="bold">*** KOT ***</h2>
                <p class="bold large">${kotNumber}</p>
              </div>
              <div class="double-line"></div>
              
              <p><strong>Table:</strong> ${order.tableNumber}</p>
              <p><strong>Date:</strong> ${order.date}</p>
              <p><strong>Order ID:</strong> ${order.orderId}</p>
              
              <div class="line"></div>
              
              <table>
                <tr class="bold">
                  <td class="item-name">ITEM</td>
                  <td class="item-qty">QTY</td>
                </tr>
              </table>
              
              <div class="line"></div>
              
              <table>
                ${items.map(item => `
                  <tr>
                    <td class="item-name">${item.name || item.itemName || 'Unknown Item'}</td>
                    <td class="item-qty">${item.quantity || 1}</td>
                  </tr>
                `).join('')}
              </table>
              
              <div class="double-line"></div>
              
              <div class="center">
                <p class="bold">*** PREPARE ITEMS ***</p>
                <p style="margin-top: 8px;">KOT ${index + 1} of ${kotNumbers.length}</p>
              </div>
            </body>
          </html>
        `)
        
        printWindow.document.close()
        printWindow.focus()
        
        // Auto-print after a short delay
        setTimeout(() => {
          printWindow.print()
          // Close window after printing
          setTimeout(() => {
            printWindow.close()
          }, 500)
        }, 300)
      }, index * 1500) // 1.5 second delay between each KOT print
    })

    // Show success message
    setSuccessMessage(`Printing ${kotNumbers.length} KOT(s) for order ${order.orderId}`)
    setTimeout(() => setSuccessMessage(""), 3000)
  }

  const printSingleKOT = (order, kotNumber) => {
    // Check if this is a Restaurant category
    const isRestaurantCategory = categoryStaffData.categoryName && 
      (categoryStaffData.categoryName.toLowerCase().includes('restaurant') || 
       categoryStaffData.categoryName.toLowerCase().includes('dining') ||
       categoryStaffData.categoryName.toLowerCase().includes('food'))
    
    if (!isRestaurantCategory) {
      alert('KOT printing is only available for Restaurant category')
      return
    }

    // Get items for this specific KOT
    const items = order.items.filter(item => item.kotNumber === kotNumber)
    
    if (items.length === 0) {
      alert(`No items found for ${kotNumber}`)
      return
    }

    // Create thermal print window for KOT
    const printWindow = window.open('', '_blank', 'width=302,height=600')
    
    printWindow.document.write(`
      <html>
        <head>
          <title>KOT - ${kotNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @page { 
              size: 80mm auto; 
              margin: 0; 
            }
            @media print {
              html, body { 
                width: 80mm; 
                margin: 0; 
                padding: 0;
              }
            }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 12px;
              width: 72mm;
              padding: 3mm;
              line-height: 1.4;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .large { font-size: 16px; }
            .line { border-top: 1px dashed #000; margin: 6px 0; }
            .double-line { border-top: 2px solid #000; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; margin: 8px 0; }
            td { padding: 3px 0; vertical-align: top; }
            .item-name { width: 70%; }
            .item-qty { width: 30%; text-align: right; font-weight: bold; }
            h2 { margin: 5px 0; font-size: 18px; }
            p { margin: 3px 0; }
          </style>
        </head>
        <body>
          <div class="center">
            <h2 class="bold">*** KOT ***</h2>
            <p class="bold large">${kotNumber}</p>
          </div>
          <div class="double-line"></div>
          
          <p><strong>Table:</strong> ${order.tableNumber}</p>
          <p><strong>Date:</strong> ${order.date}</p>
          <p><strong>Order ID:</strong> ${order.orderId}</p>
          
          <div class="line"></div>
          
          <table>
            <tr class="bold">
              <td class="item-name">ITEM</td>
              <td class="item-qty">QTY</td>
            </tr>
          </table>
          
          <div class="line"></div>
          
          <table>
            ${items.map(item => `
              <tr>
                <td class="item-name">${item.name || item.itemName || 'Unknown Item'}</td>
                <td class="item-qty">${item.quantity || 1}</td>
              </tr>
            `).join('')}
          </table>
          
          <div class="double-line"></div>
          
          <div class="center">
            <p class="bold">*** PREPARE ITEMS ***</p>
          </div>
        </body>
      </html>
    `)
    
    printWindow.document.close()
    printWindow.focus()
    
    // Auto-print after a short delay
    setTimeout(() => {
      printWindow.print()
      // Close window after printing
      setTimeout(() => {
        printWindow.close()
      }, 500)
    }, 300)

    // Show success message
    setSuccessMessage(`Printing ${kotNumber} for order ${order.orderId}`)
    setTimeout(() => setSuccessMessage(""), 3000)
  }

  // Handle Complimentary Bill
  const handleComplimentary = async () => {
    if (!complimentaryReason.trim()) {
      setError("Please provide a reason for complimentary bill")
      setTimeout(() => setError(""), 3000)
      return
    }

    try {
      // Determine which endpoint to use based on order type
      const isMobileOrder = selectedOrder.tableNumber === "Mobile Order" || selectedOrder.originalOrder?.tableNumber === "Mobile Order"
      const isActualStaffOrder = selectedOrder.originalOrder?.isGuestOrder !== undefined && !isMobileOrder
      
      const endpoint = isActualStaffOrder 
        ? `/staff-order/${selectedOrder.id}/complimentary`
        : `/mobile-staff-order/${selectedOrder.id}/complimentary`
      
      console.log('🎁 Complimentary - Using endpoint:', endpoint)
      
      await fetchDualBackend(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: complimentaryReason })
      })

      setSuccessMessage(`Order ${selectedOrder.orderId} marked as complimentary`)
      setTimeout(() => setSuccessMessage(""), 3000)
      
      // Close modal and reset
      setShowComplimentaryModal(false)
      setComplimentaryReason("")
      setSelectedOrder(null)
      
      // Refresh orders
      fetchOrders()
    } catch (error) {
      console.error("Error marking as complimentary:", error)
      setError("Failed to mark order as complimentary")
      setTimeout(() => setError(""), 3000)
    }
  }

  // Handle Cancel Order
  const handleCancelOrder = async () => {
    if (!cancelReason.trim()) {
      setError("Please provide a reason for cancellation")
      setTimeout(() => setError(""), 3000)
      return
    }

    if (!cancelledByName.trim()) {
      setError("Please enter your name")
      setTimeout(() => setError(""), 3000)
      return
    }

    if (!cancelPassword.trim()) {
      setError("Please enter password to confirm cancellation")
      setTimeout(() => setError(""), 3000)
      return
    }

    // Validate password against the category staff's cancel password
    const staffCancelPassword = categoryStaffData.cancelPassword
    if (!staffCancelPassword) {
      setError("Cancel password not set for this category. Please contact admin.")
      setTimeout(() => setError(""), 3000)
      return
    }
    
    if (cancelPassword !== staffCancelPassword) {
      setError("Incorrect password. Cancellation denied.")
      setTimeout(() => setError(""), 3000)
      return
    }

    try {
      // Determine which endpoint to use based on order type
      const isMobileOrder = selectedOrder.tableNumber === "Mobile Order" || selectedOrder.originalOrder?.tableNumber === "Mobile Order"
      const isActualStaffOrder = selectedOrder.originalOrder?.isGuestOrder !== undefined && !isMobileOrder
      
      const endpoint = isActualStaffOrder 
        ? `/staff-order/${selectedOrder.id}/cancel`
        : `/mobile-staff-order/${selectedOrder.id}/cancel`
      
      console.log('❌ Cancel - Using endpoint:', endpoint)
      
      await fetchDualBackend(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          reason: cancelReason,
          cancelledBy: cancelledByName
        })
      })

      setSuccessMessage(`Order ${selectedOrder.orderId} cancelled successfully by ${cancelledByName}`)
      setTimeout(() => setSuccessMessage(""), 3000)
      
      // Close modal and reset
      setShowCancelModal(false)
      setCancelReason("")
      setCancelPassword("")
      setCancelledByName("")
      setSelectedOrder(null)
      
      // Refresh orders
      fetchOrders()
    } catch (error) {
      console.error("Error cancelling order:", error)
      setError("Failed to cancel order")
      setTimeout(() => setError(""), 3000)
    }
  }

  // Handle Apply Discount
  const handleApplyDiscount = async () => {
    if (!discountValue || parseFloat(discountValue) <= 0) {
      setError("Please enter a valid discount value")
      setTimeout(() => setError(""), 3000)
      return
    }

    try {
      // Determine which endpoint to use based on order type
      const isMobileOrder = selectedOrder.tableNumber === "Mobile Order" || selectedOrder.originalOrder?.tableNumber === "Mobile Order"
      const isActualStaffOrder = selectedOrder.originalOrder?.isGuestOrder !== undefined && !isMobileOrder
      
      const endpoint = isActualStaffOrder 
        ? `/staff-order/${selectedOrder.id}/discount`
        : `/mobile-staff-order/${selectedOrder.id}/discount`
      
      console.log('💰 Discount - Using endpoint:', endpoint)
      
      await fetchDualBackend(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discountType,
          discountValue: parseFloat(discountValue),
          reason: discountReason || "Discount applied"
        })
      })

      setSuccessMessage(`Discount applied to order ${selectedOrder.orderId}`)
      setTimeout(() => setSuccessMessage(""), 3000)
      
      // Close modal and reset
      setShowDiscountModal(false)
      setDiscountValue("")
      setDiscountReason("")
      setSelectedOrder(null)
      
      // Refresh orders
      fetchOrders()
    } catch (error) {
      console.error("Error applying discount:", error)
      setError(error.message || "Failed to apply discount")
      setTimeout(() => setError(""), 3000)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem("authToken")
    localStorage.removeItem("isAuthenticated")
    localStorage.removeItem("userType")
    localStorage.removeItem("categoryStaffData")
    navigate("/login")
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

  if (!categoryStaffData) {
    return <div className="loading-container"><Loader size={24} className="animate-spin" /></div>
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        marginBottom: "20px",
        padding: "20px 25px",
        background: "linear-gradient(135deg, #8B0000 0%, #B8860B 35%, #DAA520 65%, #8B0000 100%)",
        borderRadius: "12px",
        color: "#FFD700",
        boxShadow: "0 4px 12px rgba(139,0,0,0.4), 0 0 20px rgba(218,165,32,0.2)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <img 
            src={logo} 
            alt="Hotel Virat Logo" 
            style={{ 
              height: "75px", 
              width: "auto",
              objectFit: "contain",
              borderRadius: "10px",
              backgroundColor: "white",
              padding: "8px",
              boxShadow: "0 3px 8px rgba(0,0,0,0.3)",
              border: "2px solid #DAA520"
            }} 
          />
          <div>
            <h1 style={{ margin: 0, fontSize: "26px", fontWeight: "700", letterSpacing: "0.5px", color: "#FFD700", textShadow: "2px 2px 4px rgba(0,0,0,0.3)" }}>Category Orders</h1>
            <p style={{ margin: "6px 0 0", opacity: 0.95, fontSize: "15px", fontWeight: "500", color: "#FFF8DC" }}>
              {categoryStaffData.name} - {categoryStaffData.categoryName}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={fetchOrders}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 16px", backgroundColor: "rgba(255,215,0,0.2)",
              border: "1px solid rgba(255,215,0,0.4)", borderRadius: "6px", color: "#FFD700", cursor: "pointer",
              fontWeight: "600", transition: "all 0.2s",
              backdropFilter: "blur(10px)"
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = "rgba(255,215,0,0.3)"
              e.target.style.borderColor = "rgba(255,215,0,0.6)"
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = "rgba(255,215,0,0.2)"
              e.target.style.borderColor = "rgba(255,215,0,0.4)"
            }}
          >
            <RefreshCw size={16} /> Refresh
          </button>
          <button
            onClick={handleLogout}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "8px 16px", backgroundColor: "#FFD700",
              border: "none", borderRadius: "6px", color: "#8B0000", cursor: "pointer",
              fontWeight: "700", transition: "all 0.2s",
              boxShadow: "0 2px 6px rgba(255,215,0,0.4)"
            }}
            onMouseOver={(e) => {
              e.target.style.backgroundColor = "#FFA500"
              e.target.style.transform = "translateY(-1px)"
            }}
            onMouseOut={(e) => {
              e.target.style.backgroundColor = "#FFD700"
              e.target.style.transform = "translateY(0)"
            }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>

      {successMessage && (
        <div className="success-message">
          <Check size={16} /><span>{successMessage}</span>
          <button onClick={() => setSuccessMessage("")}><X size={16} /></button>
        </div>
      )}

      {/* View Mode Toggle */}
      <div style={{
        display: "flex",
        gap: "8px",
        marginBottom: "20px",
        backgroundColor: "white",
        padding: "6px",
        borderRadius: "8px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        width: "fit-content",
        flexWrap: "wrap"
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
          📋 Orders
        </button>
        <button
          onClick={() => setViewMode("sales")}
          style={{
            padding: "10px 20px",
            backgroundColor: viewMode === "sales" ? "#4f46e5" : "transparent",
            color: viewMode === "sales" ? "white" : "#6b7280",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "500",
            cursor: "pointer",
            transition: "all 0.2s"
          }}
        >
          💰 Sales Report
        </button>
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
        {/* Complimentary Tab - Only show for Restaurant category */}
        {(() => {
          const isRestaurantCategory = categoryStaffData.categoryName && 
            (categoryStaffData.categoryName.toLowerCase().includes('restaurant') || 
             categoryStaffData.categoryName.toLowerCase().includes('dining') ||
             categoryStaffData.categoryName.toLowerCase().includes('food'))
          
          if (isRestaurantCategory) {
            return (
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
            )
          }
          return null
        })()}
      </div>

      {/* Order Count Info */}
      {/* {!loading && (
        <div style={{
          padding: "12px 16px",
          backgroundColor: "#f0f9ff",
          color: "#0369a1",
          borderRadius: "6px",
          marginBottom: "20px",
          fontSize: "14px",
          fontWeight: "500",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span>Found {totalCount} order{totalCount !== 1 ? 's' : ''} for {categoryStaffData.categoryName}</span>
          <span style={{ fontSize: "12px", opacity: 0.8 }}>
            Page {currentPage} of {totalPages}
          </span>
        </div>
      )} */}

      {/* Filters - Only show for Orders view */}
      {viewMode === "orders" && (
        <div style={{ 
          display: "flex", gap: "15px", marginBottom: "20px", 
          flexWrap: "wrap", alignItems: "center" 
        }}>
          <div style={{ position: "relative", flex: 1, minWidth: "250px" }}>
            <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
            <input
              type="text"
              placeholder="Search by order ID, table, or customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: "100%", padding: "10px 10px 10px 40px",
                border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "14px"
              }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: "10px 15px", border: "1px solid #e5e7eb",
              borderRadius: "6px", fontSize: "14px", minWidth: "150px"
            }}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="preparing">Preparing</option>
            <option value="served">Served</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      )}

      {/* Date Filter */}
      <div style={{
        display: "flex", gap: "15px", marginBottom: "20px",
        flexWrap: "wrap", alignItems: "center",
        padding: "15px",
        backgroundColor: "#f9fafb",
        borderRadius: "8px",
        border: "1px solid #e5e7eb"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Calendar size={18} style={{ color: "#6b7280" }} />
          <span style={{ fontSize: "14px", fontWeight: "500", color: "#374151" }}>Date Filter:</span>
        </div>
        
        {/* Date Filter Type Toggle */}
        <div style={{ display: "flex", gap: "4px", backgroundColor: "white", padding: "4px", borderRadius: "6px", border: "1px solid #e5e7eb" }}>
          <button
            onClick={() => handleDateFilterTypeChange("single")}
            style={{
              padding: "6px 12px",
              backgroundColor: dateFilterType === "single" ? "#4f46e5" : "transparent",
              color: dateFilterType === "single" ? "white" : "#6b7280",
              border: "none",
              borderRadius: "4px",
              fontSize: "13px",
              cursor: "pointer",
              fontWeight: dateFilterType === "single" ? "500" : "normal",
              transition: "all 0.2s"
            }}
          >
            Single Day
          </button>
          <button
            onClick={() => handleDateFilterTypeChange("range")}
            style={{
              padding: "6px 12px",
              backgroundColor: dateFilterType === "range" ? "#4f46e5" : "transparent",
              color: dateFilterType === "range" ? "white" : "#6b7280",
              border: "none",
              borderRadius: "4px",
              fontSize: "13px",
              cursor: "pointer",
              fontWeight: dateFilterType === "range" ? "500" : "normal",
              transition: "all 0.2s"
            }}
          >
            Date Range
          </button>
        </div>

        {/* Single Date Picker */}
        {dateFilterType === "single" && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <label style={{ fontSize: "13px", color: "#6b7280" }}>Select Date:</label>
            <input
              type="date"
              value={singleDate}
              onChange={(e) => {
                setSingleDate(e.target.value)
                setCurrentPage(1)
              }}
              style={{
                padding: "8px 12px",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                fontSize: "14px"
              }}
            />
          </div>
        )}

        {/* Date Range Pickers */}
        {dateFilterType === "range" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label style={{ fontSize: "13px", color: "#6b7280" }}>From:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value)
                  setCurrentPage(1)
                }}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "14px"
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label style={{ fontSize: "13px", color: "#6b7280" }}>To:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value)
                  setCurrentPage(1)
                }}
                style={{
                  padding: "8px 12px",
                  border: "1px solid #e5e7eb",
                  borderRadius: "6px",
                  fontSize: "14px"
                }}
              />
            </div>
          </>
        )}

        {/* Clear Button */}
        {(singleDate || startDate || endDate) && (
          <button
            onClick={handleDateReset}
            style={{
              padding: "8px 16px",
              backgroundColor: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "13px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <X size={14} /> Clear Dates
          </button>
        )}

        {/* Items per page selector */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "13px", color: "#6b7280" }}>Items per page:</label>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value))
              setCurrentPage(1)
            }}
            style={{
              padding: "8px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: "6px",
              fontSize: "14px"
            }}
          >
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ 
          padding: "12px 16px", backgroundColor: "#fee2e2", color: "#dc2626",
          borderRadius: "6px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px"
        }}>
          <AlertCircle size={18} /><span>{error}</span>
        </div>
      )}

      {/* Sales Report View */}
      {viewMode === "sales" && (
        <>
          {/* Sales Summary Cards */}
          {salesData && (
            <>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "15px",
                marginBottom: "20px"
              }}>
                <div style={{
                  backgroundColor: "white",
                  padding: "20px",
                  borderRadius: "8px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                }}>
                  <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>Total Orders</div>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: "#4f46e5" }}>
                    {salesData.summary.totalOrders}
                  </div>
                </div>
                <div style={{
                  backgroundColor: "white",
                  padding: "20px",
                  borderRadius: "8px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                }}>
                  <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>Total Sales</div>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: "#10b981" }}>
                    ₹{salesData.summary.totalSales.toFixed(2)}
                  </div>
                </div>
                <div style={{
                  backgroundColor: "white",
                  padding: "20px",
                  borderRadius: "8px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                }}>
                  <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>Total Discount</div>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: "#f59e0b" }}>
                    ₹{(salesData.summary.totalDiscount || 0).toFixed(2)}
                  </div>
                </div>
                <div style={{
                  backgroundColor: "white",
                  padding: "20px",
                  borderRadius: "8px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                }}>
                  <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>Average Order Value</div>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: "#8b5cf6" }}>
                    ₹{salesData.summary.averageOrderValue}
                  </div>
                </div>
              </div>

              {/* Print Sales Report Button */}
              <div style={{ marginBottom: "15px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => {
                    window.print()
                  }}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#4f46e5",
                    color: "white",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "14px",
                    fontWeight: "500"
                  }}
                >
                  <Printer size={16} /> Print Report
                </button>
              </div>
            </>
          )}

          {/* Sales Report Table */}
          <div style={{ 
            backgroundColor: "white", 
            borderRadius: "8px", 
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)", 
            overflow: "auto",
            maxHeight: "60vh"
          }}>
            {salesLoading ? (
              <div style={{ padding: "40px", textAlign: "center" }}>
                <Loader size={24} className="animate-spin" style={{ margin: "0 auto 10px" }} />
                <p>Loading sales report...</p>
              </div>
            ) : salesData && salesData.orders.length > 0 ? (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0, backgroundColor: "#f9fafb", zIndex: 10 }}>
                  <tr>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Bill No</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Table</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Customer</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Bill Time</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Items</th>
                    <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Original</th>
                    <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Discount</th>
                    <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Final Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {salesData.orders.map((order, index) => (
                    <tr key={index} style={{ borderBottom: "1px solid #e5e7eb" }}>
                      <td style={{ padding: "12px 16px" }}>
                        {order.orderId ? order.orderId.split('-').pop() : 'N/A'}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {order.tableNumber && order.tableNumber !== 'N/A' ? order.tableNumber : '-'}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div>{order.customerName}</div>
                        {order.customerMobile !== 'N/A' && (
                          <div style={{ fontSize: "12px", color: "#6b7280" }}>{order.customerMobile}</div>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {new Date(order.billPrintedAt).toLocaleString("en-US", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                        })}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        {order.items.map((item, idx) => (
                          <div key={idx} style={{ fontSize: "13px", marginBottom: "2px" }}>
                            {item.name || item.itemName} x {item.quantity}
                          </div>
                        ))}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "500" }}>
                        {order.originalGrandTotal && order.originalGrandTotal !== order.grandTotal ? (
                          <span style={{ color: "#6b7280" }}>₹{order.originalGrandTotal.toFixed(2)}</span>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        {order.discountAmount ? (
                          <div>
                            <div style={{ color: "#f59e0b", fontWeight: "500" }}>
                              -₹{order.discountAmount.toFixed(2)}
                            </div>
                            {order.discountType && (
                              <div style={{ fontSize: "11px", color: "#6b7280" }}>
                                ({order.discountType === 'percentage' ? `${order.discountValue}%` : `₹${order.discountValue}`})
                              </div>
                            )}
                          </div>
                        ) : (
                          <span>-</span>
                        )}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "600", color: "#10b981" }}>
                        ₹{order.grandTotal.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
                No completed bills found for the selected period
              </div>
            )}
          </div>
        </>
      )}

      {/* Cancelled Orders View */}
      {viewMode === "cancelled" && (
        <>
          {/* Cancelled Summary Cards */}
          {!salesLoading && cancelledOrders.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "15px",
              marginBottom: "20px"
            }}>
              <div style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
              }}>
                <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>Total Cancelled</div>
                <div style={{ fontSize: "28px", fontWeight: "700", color: "#ef4444" }}>
                  {cancelledOrders.length}
                </div>
              </div>
              <div style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
              }}>
                <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>Total Amount Lost</div>
                <div style={{ fontSize: "28px", fontWeight: "700", color: "#ef4444" }}>
                  ₹{cancelledOrders.reduce((sum, order) => sum + order.grandTotal, 0).toFixed(2)}
                </div>
              </div>
            </div>
          )}
          
        <div style={{ 
          backgroundColor: "white", 
          borderRadius: "8px", 
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)", 
          overflow: "auto",
          maxHeight: "60vh"
        }}>
          {salesLoading ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <Loader size={24} className="animate-spin" style={{ margin: "0 auto 10px" }} />
              <p>Loading cancelled orders...</p>
            </div>
          ) : cancelledOrders.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, backgroundColor: "#f9fafb", zIndex: 10 }}>
                <tr>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Order ID</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Table</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Customer</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Cancelled At</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Reason</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Cancelled By</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {cancelledOrders.map((order, index) => (
                  <tr key={index} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "12px 16px" }}>
                      {order.orderId ? order.orderId.split('-').pop() : 'N/A'}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {order.tableNumber && order.tableNumber !== 'N/A' ? order.tableNumber : '-'}
                    </td>
                    <td style={{ padding: "12px 16px" }}>{order.customerName}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {new Date(order.cancelledAt).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                      })}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: "13px", color: "#ef4444", fontStyle: "italic" }}>
                        {order.cancellationReason}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: "13px", color: "#6b7280", fontWeight: "500" }}>
                        {order.cancelledBy || "Admin"}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "600", color: "#ef4444", textDecoration: "line-through" }}>
                      ₹{order.grandTotal.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
              No cancelled orders found for the selected period
            </div>
          )}
        </div>
        </>
      )}

      {/* Complimentary Orders View */}
      {viewMode === "complimentary" && (
        <>
          {/* Complimentary Summary Cards */}
          {!salesLoading && complimentaryOrders.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "15px",
              marginBottom: "20px"
            }}>
              <div style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
              }}>
                <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>Total Complimentary</div>
                <div style={{ fontSize: "28px", fontWeight: "700", color: "#10b981" }}>
                  {complimentaryOrders.length}
                </div>
              </div>
              <div style={{
                backgroundColor: "white",
                padding: "20px",
                borderRadius: "8px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
              }}>
                <div style={{ fontSize: "13px", color: "#6b7280", marginBottom: "8px" }}>Total Amount (FREE)</div>
                <div style={{ fontSize: "28px", fontWeight: "700", color: "#10b981" }}>
                  ₹{complimentaryOrders.reduce((sum, order) => sum + order.originalGrandTotal, 0).toFixed(2)}
                </div>
              </div>
            </div>
          )}
          
        <div style={{ 
          backgroundColor: "white", 
          borderRadius: "8px", 
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)", 
          overflow: "auto",
          maxHeight: "60vh"
        }}>
          {salesLoading ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <Loader size={24} className="animate-spin" style={{ margin: "0 auto 10px" }} />
              <p>Loading complimentary orders...</p>
            </div>
          ) : complimentaryOrders.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead style={{ position: "sticky", top: 0, backgroundColor: "#f9fafb", zIndex: 10 }}>
                <tr>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Order ID</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Table</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Customer</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Marked At</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Reason</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Original Amount</th>
                </tr>
              </thead>
              <tbody>
                {complimentaryOrders.map((order, index) => (
                  <tr key={index} style={{ borderBottom: "1px solid #e5e7eb", backgroundColor: "#f0fdf4" }}>
                    <td style={{ padding: "12px 16px" }}>
                      {order.orderId ? order.orderId.split('-').pop() : 'N/A'}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {order.tableNumber && order.tableNumber !== 'N/A' ? order.tableNumber : '-'}
                    </td>
                    <td style={{ padding: "12px 16px" }}>{order.customerName}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {new Date(order.complimentaryMarkedAt).toLocaleString("en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                      })}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: "13px", color: "#10b981", fontStyle: "italic" }}>
                        {order.complimentaryReason}
                      </div>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "600", color: "#10b981" }}>
                      ₹{order.originalGrandTotal.toFixed(2)} <span style={{ fontSize: "12px" }}>(FREE)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
              No complimentary orders found for the selected period
            </div>
          )}
        </div>
        </>
      )}

      {/* Orders Table - Only show in Orders view */}
      {viewMode === "orders" && (
      <div style={{ 
        backgroundColor: "white", 
        borderRadius: "8px", 
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)", 
        overflow: "auto",
        maxHeight: "60vh"
      }}>
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <Loader size={24} className="animate-spin" style={{ margin: "0 auto 10px" }} />
            <p>Loading orders...</p>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ position: "sticky", top: 0, backgroundColor: "#f9fafb", zIndex: 10 }}>
              <tr>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Order ID</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Table</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Date</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Items ({categoryStaffData.categoryName})</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontWeight: "600", borderBottom: "1px solid #e5e7eb" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => (
                  <tr key={order.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "12px 16px" }}>
                      {order.orderId ? order.orderId.split('-').pop() : 'N/A'}
                      {/* Show KOT number for Restaurant category */}
                      {(() => {
                        const isRestaurantCategory = categoryStaffData.categoryName && 
                          (categoryStaffData.categoryName.toLowerCase().includes('restaurant') || 
                           categoryStaffData.categoryName.toLowerCase().includes('dining') ||
                           categoryStaffData.categoryName.toLowerCase().includes('food'))
                        
                        if (isRestaurantCategory && order.items && order.items.length > 0) {
                          // Get unique KOT numbers from items
                          const kotNumbers = [...new Set(
                            order.items
                              .map(item => item.kotNumber)
                              .filter(kot => kot && kot !== 'no-kot')
                          )]
                          
                          if (kotNumbers.length > 0) {
                            return (
                              <div style={{ marginTop: "4px", fontSize: "11px", color: "#92400e" }}>
                                {kotNumbers.map((kot, idx) => (
                                  <div key={idx} style={{ 
                                    backgroundColor: "#fef3c7", 
                                    padding: "2px 4px", 
                                    borderRadius: "3px",
                                    display: "inline-block",
                                    marginRight: "4px",
                                    marginTop: "2px"
                                  }}>
                                    {kot}
                                  </div>
                                ))}
                              </div>
                            )
                          }
                        }
                        return null
                      })()}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {order.tableNumber && order.tableNumber !== 'N/A' && order.tableNumber !== 'Mobile Order' 
                        ? order.tableNumber 
                        : '-'}
                    </td>
                    <td style={{ padding: "12px 16px" }}>{order.date}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {order.items.length === 0 ? (
                        <div style={{ fontSize: "13px", color: "#6b7280", fontStyle: "italic" }}>
                          No {categoryStaffData.categoryName} items
                        </div>
                      ) : (
                        (() => {
                          // Check if this is a Restaurant category (case-insensitive)
                          const isRestaurantCategory = categoryStaffData.categoryName && 
                            (categoryStaffData.categoryName.toLowerCase().includes('restaurant') || 
                             categoryStaffData.categoryName.toLowerCase().includes('dining') ||
                             categoryStaffData.categoryName.toLowerCase().includes('food'))
                          
                          // Filter out Complementary items for non-restaurant categories
                          const filteredItems = isRestaurantCategory 
                            ? order.items 
                            : order.items.filter(item => {
                                const itemCategory = item.category || item.categoryName || ''
                                return itemCategory.toLowerCase() !== 'complementary'
                              })
                          
                          // Only group by KOT for Restaurant category
                          if (isRestaurantCategory) {
                            // Group items by KOT number
                            const itemsByKot = {}
                            filteredItems.forEach(item => {
                              // Only use item's own kotNumber, don't fall back to order kotNumber
                              const kot = item.kotNumber || 'no-kot'
                              if (!itemsByKot[kot]) {
                                itemsByKot[kot] = []
                              }
                              itemsByKot[kot].push(item)
                            })
                            
                            // Sort KOT numbers - put 'no-kot' items first, then sort KOT numbers
                            const sortedKots = Object.keys(itemsByKot).sort((a, b) => {
                              if (a === 'no-kot') return -1
                              if (b === 'no-kot') return 1
                              return a.localeCompare(b)
                            })
                            
                            return sortedKots.map((kot, kotIdx) => {
                              const items = itemsByKot[kot]
                              const hasKot = kot !== 'no-kot'
                              return (
                                <div key={kotIdx} style={{ marginBottom: "8px" }}>
                                  {hasKot && (
                                    <div style={{ 
                                      backgroundColor: "#fef3c7", 
                                      color: "#92400e", 
                                      padding: "2px 6px", 
                                      borderRadius: "4px", 
                                      fontSize: "11px",
                                      fontWeight: "600",
                                      display: "inline-block",
                                      marginBottom: "4px"
                                    }}>
                                      {kot}
                                    </div>
                                  )}
                                  {items.map((item, idx) => (
                                    <div key={idx} style={{ fontSize: "13px", marginLeft: hasKot ? "8px" : "0px" }}>
                                      {item.name || item.itemName || 'Unknown Item'} x {item.quantity || 1}
                                    </div>
                                  ))}
                                </div>
                              )
                            })
                          } else {
                            // For non-Restaurant categories (like RNS, RNS self Service), just show items without KOT grouping
                            return order.items.map((item, idx) => (
                              <div key={idx} style={{ fontSize: "13px", marginBottom: "4px" }}>
                                {item.name || item.itemName || 'Unknown Item'} x {item.quantity || 1}
                              </div>
                            ))
                          }
                        })()
                      )}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {/* Print KOT buttons - one for each KOT number (only for Restaurant category) */}
                        {(() => {
                          const isRestaurantCategory = categoryStaffData.categoryName && 
                            (categoryStaffData.categoryName.toLowerCase().includes('restaurant') || 
                             categoryStaffData.categoryName.toLowerCase().includes('dining') ||
                             categoryStaffData.categoryName.toLowerCase().includes('food'))
                          
                          if (isRestaurantCategory && order.items && order.items.length > 0) {
                            // Get unique KOT numbers from items
                            const kotNumbers = [...new Set(
                              order.items
                                .map(item => item.kotNumber)
                                .filter(kot => kot && kot !== 'no-kot')
                            )].sort()
                            
                            if (kotNumbers.length > 0) {
                              return kotNumbers.map((kotNumber, idx) => (
                                <button
                                  key={kotNumber}
                                  onClick={() => printSingleKOT(order, kotNumber)}
                                  style={{
                                    padding: "5px 10px", 
                                    backgroundColor: "#f59e0b", 
                                    color: "white",
                                    border: "none", 
                                    borderRadius: "4px", 
                                    cursor: "pointer", 
                                    fontSize: "11px",
                                    display: "flex", 
                                    alignItems: "center", 
                                    gap: "4px",
                                    whiteSpace: "nowrap"
                                  }}
                                  title={`Print ${kotNumber}`}
                                >
                                  <Printer size={12} /> {kotNumber.split('-').pop()}
                                </button>
                              ))
                            }
                          }
                          return null
                        })()}
                        
                        <button
                          onClick={() => printThermalBill(order)}
                          style={{
                            padding: "5px 10px", backgroundColor: "#6366f1", color: "white",
                            border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px",
                            display: "flex", alignItems: "center", gap: "4px"
                          }}
                        >
                          <Printer size={12} /> Bill Complete & Print
                        </button>
                        
                        {/* Complimentary Bill Button - Only show for Restaurant category */}
                        {(() => {
                          const isRestaurantCategory = categoryStaffData.categoryName && 
                            (categoryStaffData.categoryName.toLowerCase().includes('restaurant') || 
                             categoryStaffData.categoryName.toLowerCase().includes('dining') ||
                             categoryStaffData.categoryName.toLowerCase().includes('food'))
                          
                          if (isRestaurantCategory) {
                            return (
                              <button
                                onClick={() => {
                                  setSelectedOrder(order)
                                  setShowComplimentaryModal(true)
                                }}
                                style={{
                                  padding: "5px 10px", backgroundColor: "#10b981", color: "white",
                                  border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px",
                                  display: "flex", alignItems: "center", gap: "4px"
                                }}
                                title="Mark as Complimentary"
                              >
                                🎁 Complimentary
                              </button>
                            )
                          }
                          return null
                        })()}
                        
                        {/* Apply Discount Button */}
                        <button
                          onClick={() => {
                            setSelectedOrder(order)
                            setShowDiscountModal(true)
                          }}
                          style={{
                            padding: "5px 10px", backgroundColor: "#f59e0b", color: "white",
                            border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px",
                            display: "flex", alignItems: "center", gap: "4px"
                          }}
                          title="Apply Discount"
                        >
                          💰 Discount
                        </button>
                        
                        {/* Cancel Order Button */}
                        <button
                          onClick={() => {
                            setSelectedOrder(order)
                            setShowCancelModal(true)
                          }}
                          style={{
                            padding: "5px 10px", backgroundColor: "#ef4444", color: "white",
                            border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px",
                            display: "flex", alignItems: "center", gap: "4px"
                          }}
                          title="Cancel Order"
                        >
                          ❌ Cancel
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
                    No orders found for your category
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      )}

      {/* Pagination Controls - Only show in Orders view */}
      {viewMode === "orders" && !loading && totalPages > 1 && (
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "20px",
          padding: "15px 20px",
          backgroundColor: "white",
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
        }}>
          <div style={{ fontSize: "14px", color: "#6b7280" }}>
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalCount)} of {totalCount} orders
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              style={{
                padding: "8px 12px",
                backgroundColor: currentPage === 1 ? "#f3f4f6" : "#4f46e5",
                color: currentPage === 1 ? "#9ca3af" : "white",
                border: "none",
                borderRadius: "6px",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                fontSize: "13px"
              }}
            >
              First
            </button>
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
            <div style={{
              padding: "8px 16px",
              backgroundColor: "#f3f4f6",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "500"
            }}>
              Page {currentPage} of {totalPages}
            </div>
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
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={currentPage === totalPages}
              style={{
                padding: "8px 12px",
                backgroundColor: currentPage === totalPages ? "#f3f4f6" : "#4f46e5",
                color: currentPage === totalPages ? "#9ca3af" : "white",
                border: "none",
                borderRadius: "6px",
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                fontSize: "13px"
              }}
            >
              Last
            </button>
          </div>
        </div>
      )}

      {/* Complimentary Bill Modal */}
      {showComplimentaryModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white", borderRadius: "8px", padding: "24px",
            maxWidth: "500px", width: "90%", boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "600" }}>
              Mark as Complimentary Bill
            </h3>
            <p style={{ marginBottom: "16px", color: "#6b7280", fontSize: "14px" }}>
              Order: {selectedOrder?.orderId} | Table: {selectedOrder?.tableNumber}
            </p>
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500" }}>
                Reason for Complimentary Bill *
              </label>
              <textarea
                value={complimentaryReason}
                onChange={(e) => setComplimentaryReason(e.target.value)}
                placeholder="Enter reason (e.g., VIP guest, special occasion, service recovery)"
                style={{
                  width: "100%", padding: "10px", border: "1px solid #e5e7eb",
                  borderRadius: "6px", fontSize: "14px", minHeight: "80px", resize: "vertical"
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
                  padding: "8px 16px", backgroundColor: "#f3f4f6", color: "#374151",
                  border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleComplimentary}
                style={{
                  padding: "8px 16px", backgroundColor: "#10b981", color: "white",
                  border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px"
                }}
              >
                Mark as Complimentary
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {showCancelModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white", borderRadius: "8px", padding: "24px",
            maxWidth: "500px", width: "90%", boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "600", color: "#ef4444" }}>
              Cancel Order
            </h3>
            <p style={{ marginBottom: "16px", color: "#6b7280", fontSize: "14px" }}>
              Order: {selectedOrder?.orderId} | Table: {selectedOrder?.tableNumber}
            </p>
            
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500" }}>
                Your Name *
              </label>
              <input
                type="text"
                value={cancelledByName}
                onChange={(e) => setCancelledByName(e.target.value)}
                placeholder="Enter your name"
                style={{
                  width: "100%", padding: "10px", border: "1px solid #e5e7eb",
                  borderRadius: "6px", fontSize: "14px"
                }}
              />
            </div>
            
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500" }}>
                Reason for Cancellation *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter reason (e.g., customer request, item unavailable, wrong order)"
                style={{
                  width: "100%", padding: "10px", border: "1px solid #e5e7eb",
                  borderRadius: "6px", fontSize: "14px", minHeight: "80px", resize: "vertical"
                }}
              />
            </div>
            
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500", color: "#ef4444" }}>
                Password (Required for Cancellation) *
              </label>
              <input
                type="password"
                value={cancelPassword}
                onChange={(e) => setCancelPassword(e.target.value)}
                placeholder="Enter password to confirm"
                style={{
                  width: "100%", padding: "10px", border: "2px solid #ef4444",
                  borderRadius: "6px", fontSize: "14px"
                }}
              />
              <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                Password is required to authorize order cancellation
              </p>
            </div>
            
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowCancelModal(false)
                  setCancelReason("")
                  setCancelPassword("")
                  setCancelledByName("")
                  setSelectedOrder(null)
                }}
                style={{
                  padding: "8px 16px", backgroundColor: "#f3f4f6", color: "#374151",
                  border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px"
                }}
              >
                Close
              </button>
              <button
                onClick={handleCancelOrder}
                style={{
                  padding: "8px 16px", backgroundColor: "#ef4444", color: "white",
                  border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px",
                  fontWeight: "600"
                }}
              >
                Cancel Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Discount Modal */}
      {showDiscountModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000
        }}>
          <div style={{
            backgroundColor: "white", borderRadius: "8px", padding: "24px",
            maxWidth: "500px", width: "90%", boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{ marginBottom: "16px", fontSize: "18px", fontWeight: "600" }}>
              Apply Discount
            </h3>
            <p style={{ marginBottom: "16px", color: "#6b7280", fontSize: "14px" }}>
              Order: {selectedOrder?.orderId} | Current Total: ₹{selectedOrder?.grandTotal}
            </p>
            
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500" }}>
                Discount Type *
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    value="percentage"
                    checked={discountType === "percentage"}
                    onChange={(e) => setDiscountType(e.target.value)}
                  />
                  <span style={{ fontSize: "14px" }}>Percentage (%)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                  <input
                    type="radio"
                    value="amount"
                    checked={discountType === "amount"}
                    onChange={(e) => setDiscountType(e.target.value)}
                  />
                  <span style={{ fontSize: "14px" }}>Fixed Amount (₹)</span>
                </label>
              </div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500" }}>
                Discount Value *
              </label>
              <input
                type="number"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percentage" ? "Enter percentage (0-100)" : "Enter amount"}
                min="0"
                max={discountType === "percentage" ? "100" : undefined}
                style={{
                  width: "100%", padding: "10px", border: "1px solid #e5e7eb",
                  borderRadius: "6px", fontSize: "14px"
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500" }}>
                Reason (Optional)
              </label>
              <input
                type="text"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="Enter reason for discount"
                style={{
                  width: "100%", padding: "10px", border: "1px solid #e5e7eb",
                  borderRadius: "6px", fontSize: "14px"
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowDiscountModal(false)
                  setDiscountValue("")
                  setDiscountReason("")
                  setSelectedOrder(null)
                }}
                style={{
                  padding: "8px 16px", backgroundColor: "#f3f4f6", color: "#374151",
                  border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px"
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleApplyDiscount}
                style={{
                  padding: "8px 16px", backgroundColor: "#f59e0b", color: "white",
                  border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "14px"
                }}
              >
                Apply Discount
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Add CSS styles for status badges
const styles = `
  .status-badge {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    text-transform: capitalize;
    min-width: 60px;
    text-align: center;
  }
  
  .status-badge.pending {
    background: #fef3c7;
    color: #92400e;
    border: 1px solid #f59e0b;
  }
  
  .status-badge.preparing {
    background: #dbeafe;
    color: #1e40af;
    border: 1px solid #3b82f6;
  }
  
  .status-badge.served {
    background: #e0e7ff;
    color: #5b21b6;
    border: 1px solid #8b5cf6;
  }
  
  .status-badge.completed {
    background: #d1fae5;
    color: #065f46;
    border: 1px solid #10b981;
  }
  
  .status-badge.cancelled {
    background: #fee2e2;
    color: #991b1b;
    border: 1px solid #ef4444;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement("style");
  styleSheet.type = "text/css";
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}

export default CategoryOrders