// import { useState, useEffect } from "react"
// import { ShoppingCart, Users, Calendar, DollarSign, Package, Filter, Download, RefreshCw, Eye, X } from "lucide-react"
// import * as XLSX from "xlsx"
// import "../styles/CategorizedOrders.css"

// const CategorizedOrders = () => {
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState(null)
//   const [allOrders, setAllOrders] = useState([])
//   const [activeTab, setActiveTab] = useState("")
  
//   // Branch and Category filters
//   const [branches, setBranches] = useState([])
//   const [categories, setCategories] = useState([])
//   const [selectedBranch, setSelectedBranch] = useState("")
  
//   // Dynamic category tabs based on selected branch
//   const [branchCategories, setBranchCategories] = useState([])
  
//   // Complimentary orders state
//   const [complimentaryCount, setComplimentaryCount] = useState(0)
//   const [complimentaryOrders, setComplimentaryOrders] = useState([])
  
//   const today = (() => {
//     const now = new Date()
//     return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
//   })()
//   const [dateFilter, setDateFilter] = useState(today)
//   const [fromDate, setFromDate] = useState("")
//   const [toDate, setToDate] = useState("")
//   const [statusFilter, setStatusFilter] = useState("all")
  
//   const [currentPage, setCurrentPage] = useState(1)
//   const [ordersPerPage] = useState(50)
//   const [totalOrders, setTotalOrders] = useState(0)
//   const [totalPages, setTotalPages] = useState(1)
//   const [categoryOrders, setCategoryOrders] = useState({})


//   const [backendStats, setBackendStats] = useState({
//     totalOrders: 0,
//     totalRevenue: 0,
//     cancelledOrders: 0,
//     cancelledAmount: 0,
//     completedOrders: 0,
//     pendingOrders: 0,
//     totalGSTCollected: 0
//   })

//   const [categoryCounts, setCategoryCounts] = useState({
//     selfService: 0,
//     restaurant: 0,
//     templeMeals: 0
//   })

//   const [showOrderDetails, setShowOrderDetails] = useState(false)
//   const [selectedOrderDetails, setSelectedOrderDetails] = useState(null)

//   useEffect(() => {
//     fetchBranches()
//     fetchCategories()
//   }, [])

//   useEffect(() => {
//     if (selectedBranch) {
//       // Set "All Orders" as the default active tab
//       if (!activeTab) {
//         setActiveTab('All Orders')
//       }
//     }
//   }, [selectedBranch])

//   useEffect(() => {
//     if (selectedBranch && activeTab) {
//       fetchOrders()
//     }
//   }, [dateFilter, fromDate, toDate, activeTab, currentPage, statusFilter, selectedBranch]) // Re-fetch when filters or page changes

//   const fetchBranches = async () => {
//     try {
//       const response = await fetch('https://billing.jagalikoota.com/api/v1/hotel/branch')
//       if (!response.ok) throw new Error('Failed to fetch branches')
//       const data = await response.json()
//       setBranches(data || [])
      
//       // Auto-select first branch if available
//       if (data && data.length > 0) {
//         setSelectedBranch(data[0]._id)
//       }
//     } catch (error) {
//       console.error('Error fetching branches:', error)
//     }
//   }

//   const fetchCategories = async () => {
//     try {
//       const response = await fetch('https://billing.jagalikoota.com/api/v1/hotel/category')
//       if (!response.ok) throw new Error('Failed to fetch categories')
//       const data = await response.json()
//       setCategories(data || [])
//     } catch (error) {
//       console.error('Error fetching categories:', error)
//     }
//   }

//   const fetchOrders = async () => {
//       try {
//         setLoading(true)
//         setError(null)

//         // Use selected branch instead of localStorage
//         if (!selectedBranch) {
//           setLoading(false)
//           return
//         }
//         const branchId = selectedBranch

//         // STEP 1: Fetch ALL category counts (without category filter) to show correct counts in tabs
//         const countsApiOptions = {
//           includeComplimentary: true,  // MUST include complimentary to count them
//           limit: 10000,  // Fetch all orders to count properly
//           excludePending: true  // Exclude KOTs from counts
//         }

//         // Add date filters to counts API
//         if (dateFilter) {
//           countsApiOptions.date = dateFilter
//         } else if (fromDate && toDate) {
//           countsApiOptions.startDate = fromDate
//           countsApiOptions.endDate = toDate
//         } else if (fromDate) {
//           countsApiOptions.startDate = fromDate
//         } else if (toDate) {
//           countsApiOptions.endDate = toDate
//         }

//         // Add status filter to counts
//         if (statusFilter !== 'all') {
//           countsApiOptions.orderStatus = statusFilter
//         }

//         console.log('🔢 Fetching category counts with options:', countsApiOptions)

//         // Use the same API as Sales Report for consistency
//         const countsResponse = await fetch(`https://billing.jagalikoota.com/api/v1/hotel/counter-order/orders?branchId=${branchId}&${new URLSearchParams(countsApiOptions).toString()}`)
        
//         if (countsResponse.ok) {
//           const countsData = await countsResponse.json()
          
//           // Calculate category counts from the response
//           let allOrdersForCounts = []
//           if (countsData.success && Array.isArray(countsData.data)) {
//             allOrdersForCounts = countsData.data
//           } else if (Array.isArray(countsData.orders)) {
//             allOrdersForCounts = countsData.orders
//           }
          
//           console.log('📊 Total orders fetched for counting:', allOrdersForCounts.length)
          
//           // Apply the same filtering as the main orders (exclude KOTs only — pending payment with a kotNumber)
//           allOrdersForCounts = allOrdersForCounts.filter(order => {
//             const paymentStatus = (order.paymentStatus || '').toLowerCase()
//             const orderStatus = (order.orderStatus || order.status || '').toLowerCase()
            
//             // Exclude KOTs: pending payment status
//             if (paymentStatus === 'pending') return false
//             // Exclude consolidated KOTs (intermediate state, not a bill)
//             if (paymentStatus === 'consolidated') return false
            
//             return true
//           })
          
//           console.log('📊 Orders after filtering for counting:', allOrdersForCounts.length)
          
//           // Count orders by category dynamically and complimentary orders
//           const counts = {}
//           let complimentaryOrdersCount = 0
          
//           allOrdersForCounts.forEach(order => {
//             // Count complimentary orders separately
//             if (order.isComplimentary) {
//               complimentaryOrdersCount++
//             }
            
//             const category = (order.categoryName || '').trim()
//             if (category) {
//               counts[category] = (counts[category] || 0) + 1
//             }
//           })
          
//           setCategoryCounts(counts)
//           setComplimentaryCount(complimentaryOrdersCount)
//           console.log('✅ Category counts updated:', counts)
//           console.log('✅ Complimentary orders count:', complimentaryOrdersCount)
//         }

//         // STEP 2: Build API options for current tab's orders
//         const apiOptions = {
//           includeComplimentary: true,  // Always include complimentary orders
//           limit: 10000,  // Fetch all orders, we'll handle pagination on frontend
//           excludePending: true  // CRITICAL: Exclude KOTs (pending orders)
//         }

//         // Add date filters
//         if (dateFilter) {
//           apiOptions.date = dateFilter
//           console.log('📅 Fetching orders with single date filter:', dateFilter)
//         } else if (fromDate && toDate) {
//           apiOptions.startDate = fromDate
//           apiOptions.endDate = toDate
//           console.log('📅 Fetching orders with date range:', fromDate, 'to', toDate)
//         } else if (fromDate) {
//           apiOptions.startDate = fromDate
//           console.log('📅 Fetching orders from date:', fromDate)
//         } else if (toDate) {
//           apiOptions.endDate = toDate
//           console.log('📅 Fetching orders until date:', toDate)
//         }

//         // Add category filter based on active tab (skip for Complimentary tab and All Orders tab)
//         const categoryToFilter = (activeTab !== 'Complimentary' && activeTab !== 'All Orders') ? activeTab : null
        
//         if (categoryToFilter) {
//           apiOptions.categoryName = categoryToFilter
//         }

//         // Add status filter
//         if (statusFilter !== 'all') {
//           apiOptions.orderStatus = statusFilter
//         }

//         console.log('🌐 Fetching orders with options:', apiOptions)

//         // Use the same API endpoint as Sales Report
//         const response = await fetch(`https://billing.jagalikoota.com/api/v1/hotel/counter-order/orders?branchId=${branchId}&${new URLSearchParams(apiOptions).toString()}`)

//         if (!response.ok) {
//           throw new Error(`HTTP error! status: ${response.status}`)
//         }

//         const data = await response.json()

//         console.log('📊 API Response:', data)

//         // Extract orders from response
//         let orders = []
//         if (data.success && Array.isArray(data.data)) {
//           orders = data.data
//         } else if (data.orders && Array.isArray(data.orders)) {
//           orders = data.orders
//         }

//         console.log('📊 Fetched orders:', orders.length)

//         // CRITICAL: Filter out KOTs (pending payment status) — only show completed bills
//         orders = orders.filter(order => {
//           const paymentStatus = (order.paymentStatus || '').toLowerCase()
//           const orderStatus = (order.orderStatus || order.status || '').toLowerCase()
          
//           // Exclude KOTs (pending payment)
//           if (paymentStatus === 'pending') {
//             console.log('🚫 Excluding KOT (pending payment):', order.invoiceNumber || order.id)
//             return false
//           }
          
//           // Exclude consolidated KOTs (intermediate state)
//           if (paymentStatus === 'consolidated') {
//             console.log('🚫 Excluding consolidated KOT:', order.invoiceNumber || order.id)
//             return false
//           }
          
//           return true
//         })

//         console.log('📊 Orders after filtering out KOTs and processing orders:', orders.length)

//         // Filter for Complimentary tab - show only complimentary orders
//         if (activeTab === 'Complimentary') {
//           orders = orders.filter(order => order.isComplimentary === true)
//           console.log('🎁 Filtered complimentary orders:', orders.length)
//         }

//         // Calculate stats from ALL filtered orders (before pagination)
        
//         // Calculate total GST - use gstAmount field if available, otherwise calculate from items
//         const totalGSTCollected = orders
//           .filter(o => (o.orderStatus || o.status || '').toLowerCase() !== 'cancelled')
//           .reduce((sum, order) => {
//             // First, try to use the gstAmount field if it exists
//             if (order.gstAmount && order.gstAmount > 0) {
//               return sum + order.gstAmount
//             }
            
//             // Fallback: Calculate from items if gstAmount not available
//             if (!order.items || !Array.isArray(order.items)) return sum
            
//             const orderGST = order.items.reduce((itemSum, item) => {
//               const rate = item.gstRate || 0
//               const itemGST = ((item.price || 0) * (item.quantity || 0) * rate) / 100
//               return itemSum + itemGST
//             }, 0)
            
//             return sum + orderGST
//           }, 0)
        
//         const stats = {
//           totalOrders: orders.filter(o => (o.orderStatus || o.status || '').toLowerCase() !== 'cancelled').length,
//           totalRevenue: orders
//             .filter(o => (o.orderStatus || o.status || '').toLowerCase() !== 'cancelled')
//             .reduce((sum, o) => sum + (o.grandTotal || o.totalAmount || 0), 0),
//           cancelledOrders: orders.filter(o => (o.orderStatus || o.status || '').toLowerCase() === 'cancelled').length,
//           cancelledAmount: orders
//             .filter(o => (o.orderStatus || o.status || '').toLowerCase() === 'cancelled')
//             .reduce((sum, o) => sum + (o.grandTotal || o.totalAmount || 0), 0),
//           completedOrders: orders.filter(o => (o.orderStatus || o.status || '').toLowerCase() === 'completed').length,
//           pendingOrders: orders.filter(o => (o.orderStatus || o.status || '').toLowerCase() === 'pending').length,
//           totalGSTCollected: totalGSTCollected
//         }
        
//         setBackendStats(stats)
//         console.log('📊 Calculated stats from all orders:', stats)

//         // Calculate pagination
//         const totalItems = orders.length
//         setTotalOrders(totalItems)
//         setTotalPages(Math.ceil(totalItems / ordersPerPage))

//         // Apply frontend pagination - slice orders for current page
//         const startIndex = (currentPage - 1) * ordersPerPage
//         const endIndex = startIndex + ordersPerPage
//         const paginatedOrders = orders.slice(startIndex, endIndex)

//         console.log('📊 Pagination:', { 
//           totalItems, 
//           currentPage, 
//           ordersPerPage, 
//           startIndex, 
//           endIndex, 
//           paginatedOrdersCount: paginatedOrders.length 
//         })

//         // Set paginated orders for current category
//         setCategoryOrders(prev => ({
//           ...prev,
//           [activeTab]: paginatedOrders
//         }))

//         // Update all orders for stats
//         setAllOrders(orders)

//       } catch (error) {
//         console.error("Error fetching orders:", error)
//         setError(`Failed to load orders: ${error.message}`)
//       } finally {
//         setLoading(false)
//       }
//     }

//   const getCurrentOrders = () => {
//     // Return orders based on active tab
//     return categoryOrders[activeTab] || []
//   }

//   const getOrderStats = () => {
//     // Use backend stats directly
//     return backendStats
//   }

//   const exportToExcel = async () => {
//     try {
//       // Use active tab as category name
//       const categoryName = activeTab || "All Categories"
      
//       // Fetch ALL orders for export (no pagination limit)
//       let exportApiUrl = `https://billing.jagalikoota.com/api/v1/hotel/counter-order/categorized-orders?includeComplimentary=false&page=1&limit=100000`

//       // Add date filters
//       if (dateFilter) {
//         exportApiUrl += `&date=${dateFilter}`
//       } else if (fromDate && toDate) {
//         exportApiUrl += `&startDate=${fromDate}&endDate=${toDate}`
//       } else if (fromDate) {
//         exportApiUrl += `&startDate=${fromDate}`
//       } else if (toDate) {
//         exportApiUrl += `&endDate=${toDate}`
//       }

//       // Add category filter
//       if (activeTab) {
//         exportApiUrl += `&categoryName=${encodeURIComponent(activeTab)}`
//       }

//       // Add status filter if not "all"
//       if (statusFilter !== 'all') {
//         exportApiUrl += `&orderStatus=${statusFilter}`
//       }

//       console.log('📊 Fetching all orders for export:', exportApiUrl)

//       const response = await fetch(exportApiUrl)
//       if (!response.ok) {
//         throw new Error(`HTTP error! status: ${response.status}`)
//       }

//       const data = await response.json()
//       let ordersToExport = data.orders || data.data || []
      
//       // EXCLUDE CANCELLED ORDERS from export (unless specifically filtering for cancelled)
//       if (statusFilter !== "cancelled") {
//         ordersToExport = ordersToExport.filter(order => {
//           const status = (order.orderStatus || order.status || "completed").toLowerCase()
//           return status !== "cancelled"
//         })
//       }
      
//       console.log(`📊 Exporting ${ordersToExport.length} orders for ${categoryName} (cancelled orders excluded)`)
      
//       // NEW: Detailed item-wise export data
//       const detailedExportData = []
//       ordersToExport.forEach(order => {
//         const invoiceNumber = order.invoice?.invoiceNumber || order.invoiceNumber || "N/A"
//         const orderDate = new Date(order.createdAt || order.orderDate).toLocaleDateString()
//         const paymentMethod = order.paymentMethod || "Cash"
//         const tableNumber = order.tableNumber || "N/A"
//         const orderTotal = order.grandTotal || order.totalAmount || 0
        
//         if (order.items && order.items.length > 0) {
//           order.items.forEach(item => {
//             const cleanName = item.name ? item.name.replace(/^\d+\s+/, '').trim() : item.name || 'Unknown Item'
//             const itemPrice = item.price || 0
//             const itemQuantity = item.quantity || 1
//             const itemTotal = itemPrice * itemQuantity
            
//             detailedExportData.push({
//               "Invoice Number": invoiceNumber,
//               "Order Date": orderDate,
//               "Table Number": tableNumber,
//               "Item Name": cleanName,
//               "Item Price": itemPrice,
//               "Quantity": itemQuantity,
//               "Item Total": itemTotal,
//               "Payment Method": paymentMethod,
//               "Order Total": orderTotal
//             })
//           })
//         } else {
//           // If no items, still add order row
//           detailedExportData.push({
//             "Invoice Number": invoiceNumber,
//             "Order Date": orderDate,
//             "Table Number": tableNumber,
//             "Item Name": "No items",
//             "Item Price": 0,
//             "Quantity": 0,
//             "Item Total": 0,
//             "Payment Method": paymentMethod,
//             "Order Total": orderTotal
//           })
//         }
//       })

//       // Calculate item summary with price - total quantities and revenue for each item
//       const itemSummary = {}
//       ordersToExport.forEach(order => {
//         if (order.items && Array.isArray(order.items)) {
//           order.items.forEach(item => {
//             const cleanName = item.name ? item.name.replace(/^\d+\s+/, '').trim() : item.name || 'Unknown Item'
//             const quantity = parseInt(item.quantity) || 0
//             const price = parseFloat(item.price) || 0
//             const itemTotal = price * quantity
            
//             if (itemSummary[cleanName]) {
//               itemSummary[cleanName].quantity += quantity
//               itemSummary[cleanName].revenue += itemTotal
//             } else {
//               itemSummary[cleanName] = {
//                 quantity: quantity,
//                 price: price,
//                 revenue: itemTotal
//               }
//             }
//           })
//         }
//       })

//       // Convert item summary to array and sort by revenue (highest first)
//       const itemSummaryData = Object.entries(itemSummary)
//         .map(([itemName, data]) => ({
//           "Item Name": itemName,
//           "Price per Unit": data.price,
//           "Total Quantity Sold": data.quantity,
//           "Total Revenue": data.revenue
//         }))
//         .sort((a, b) => b["Total Revenue"] - a["Total Revenue"])

//       // NEW: Menu category-wise breakdown (like charts - Juices, Snacks, etc.)
//       const menuCategorySummary = {}
//       ordersToExport.forEach(order => {
//         if (order.items && Array.isArray(order.items)) {
//           order.items.forEach(item => {
//             // Get menu category (e.g., "Juices", "Snacks", "Meals")
//             const menuCategory = item.category || item.menuCategory || "Uncategorized"
//             const quantity = parseInt(item.quantity) || 0
//             const price = parseFloat(item.price) || 0
//             const itemTotal = price * quantity
            
//             if (menuCategorySummary[menuCategory]) {
//               menuCategorySummary[menuCategory].quantity += quantity
//               menuCategorySummary[menuCategory].revenue += itemTotal
//               menuCategorySummary[menuCategory].itemCount += 1
//             } else {
//               menuCategorySummary[menuCategory] = {
//                 quantity: quantity,
//                 revenue: itemTotal,
//                 itemCount: 1
//               }
//             }
//           })
//         }
//       })

//       // Convert menu category summary to array and sort by revenue
//       const menuCategoryData = Object.entries(menuCategorySummary)
//         .map(([categoryName, data]) => ({
//           "Menu Category": categoryName,
//           "Total Items Sold": data.quantity,
//           "Total Revenue": data.revenue,
//           "Number of Different Items": data.itemCount
//         }))
//         .sort((a, b) => b["Total Revenue"] - a["Total Revenue"])

//       // Service category summary (Self Service, Restaurant, Temple Meals)
//       const categoryStats = {
//         "Service Category": categoryName,
//         "Total Orders": ordersToExport.length,
//         "Total Revenue": ordersToExport.reduce((sum, order) => sum + (order.grandTotal || order.totalAmount || 0), 0),
//         "Total Items Sold": ordersToExport.reduce((sum, order) => {
//           return sum + (order.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0)
//         }, 0),
//         "Average Order Value": ordersToExport.length > 0 
//           ? (ordersToExport.reduce((sum, order) => sum + (order.grandTotal || order.totalAmount || 0), 0) / ordersToExport.length).toFixed(2)
//           : 0
//       }

//       // Create workbook with multiple sheets
//       const wb = XLSX.utils.book_new()
      
//       // Sheet 1: Detailed item-wise data
//       const detailedWs = XLSX.utils.json_to_sheet(detailedExportData)
//       XLSX.utils.book_append_sheet(wb, detailedWs, `Detailed Items`)
      
//       // Sheet 2: Item summary with price and revenue
//       const summaryWs = XLSX.utils.json_to_sheet(itemSummaryData)
//       XLSX.utils.book_append_sheet(wb, summaryWs, `Items Summary`)
      
//       // Sheet 3: Menu category breakdown (Juices, Snacks, etc.)
//       const menuCategoryWs = XLSX.utils.json_to_sheet(menuCategoryData)
//       XLSX.utils.book_append_sheet(wb, menuCategoryWs, `Menu Categories`)
      
//       // Sheet 4: Service category summary
//       const categoryWs = XLSX.utils.json_to_sheet([categoryStats])
//       XLSX.utils.book_append_sheet(wb, categoryWs, `Service Category`)
      
//       // Generate filename with date
//       const today = new Date().toISOString().split('T')[0]
//       XLSX.writeFile(wb, `${categoryName.toLowerCase().replace(' ', '-')}-orders-${today}.xlsx`)
      
//       console.log(`✅ Exported ${ordersToExport.length} orders to Excel (cancelled orders excluded)`)
//     } catch (error) {
//       console.error('Error exporting to Excel:', error)
//       alert('Failed to export orders. Please try again.')
//     }
//   }

//   const viewOrderDetails = (order) => {
//     setSelectedOrderDetails(order)
//     setShowOrderDetails(true)
//   }

//   const closeOrderDetails = () => {
//     setShowOrderDetails(false)
//     setSelectedOrderDetails(null)
//   }

//   const formatDate = (dateString) => {
//     try {
//       const date = new Date(dateString)
//       return date.toLocaleDateString('en-IN') + ' ' + date.toLocaleTimeString('en-IN', { 
//         hour12: true,
//         hour: '2-digit',
//         minute: '2-digit'
//       })
//     } catch (error) {
//       return dateString
//     }
//   }

//   const getStatusColor = (status) => {
//     switch (status?.toLowerCase()) {
//       case 'completed':
//         return '#48bb78'
//       case 'pending':
//         return '#ed8936'
//       case 'cancelled':
//         return '#f56565'
//       default:
//         return '#718096'
//     }
//   }

//   if (loading) {
//     return (
//       <div className="page-container">
//         <div className="loading-container">
//           <RefreshCw size={24} className="animate-spin" />
//           <p>Loading categorized orders...</p>
//         </div>
//       </div>
//     )
//   }

//   if (error) {
//     return (
//       <div className="page-container">
//         <div className="error-container">
//           <h3>Error</h3>
//           <p>{error}</p>
//           <button className="btn btn-primary" onClick={fetchOrders}>
//             Retry
//           </button>
//         </div>
//       </div>
//     )
//   }

//   const currentOrders = getCurrentOrders()
//   const currentStats = getOrderStats()

//   return (
//     <div className="page-container">
//       <div className="page-header">
//         <h1>📊 Categorized Orders</h1>
//         <p>View orders by service category</p>
//         <div className="header-actions">
//           <button className="btn btn-outline" onClick={fetchOrders}>
//             <RefreshCw size={16} />
//             Refresh
//           </button>
//           <button className="btn btn-primary" onClick={exportToExcel}>
//             <Download size={16} />
//             Export Excel
//           </button>
//         </div>
//       </div>

//       {/* Branch Selector at Top */}
//       <div className="filters-container" style={{ marginBottom: '20px' }}>
//         <div className="filters">
//           <div className="filter-group" style={{ flex: '0 0 300px' }}>
//             <label style={{ fontWeight: '600', fontSize: '16px' }}>Select Branch:</label>
//             <select
//               value={selectedBranch}
//               onChange={(e) => {
//                 setSelectedBranch(e.target.value)
//                 setActiveTab("") // Reset active tab when branch changes
//                 setCurrentPage(1)
//               }}
//               className="filter-input"
//               style={{ padding: '10px 14px', fontSize: '15px', fontWeight: '500' }}
//             >
//               <option value="">Select Branch</option>
//               {branches.map((branch) => (
//                 <option key={branch._id} value={branch._id}>
//                   {branch.name}
//                 </option>
//               ))}
//             </select>
//           </div>
//         </div>
//       </div>

//       {/* Order Tabs - All Orders and Complimentary */}
//       {selectedBranch && (
//         <div className="tabs-container">
//           <div className="tabs">
//             {/* All Orders Tab */}
//             <button
//               className={`tab ${activeTab === 'All Orders' ? "active" : ""}`}
//               onClick={() => {
//                 setActiveTab('All Orders')
//                 setCurrentPage(1) // Reset to first page when switching tabs
//               }}
//             >
//               <Package size={16} />
//               All Orders
//               <span className="badge">{backendStats.totalOrders || 0}</span>
//             </button>
            
//             {/* Complimentary Tab - Always visible */}
//             <button
//               className={`tab ${activeTab === 'Complimentary' ? "active" : ""}`}
//               style={{
//                 background: activeTab === 'Complimentary' ? '#8b5cf6' : '#f3e8ff',
//                 color: activeTab === 'Complimentary' ? 'white' : '#6b21a8',
//                 borderColor: '#8b5cf6'
//               }}
//               onClick={() => {
//                 setActiveTab('Complimentary')
//                 setCurrentPage(1) // Reset to first page when switching tabs
//               }}
//             >
//               🎁 Complimentary
//               <span className="badge" style={{
//                 background: activeTab === 'Complimentary' ? 'white' : '#8b5cf6',
//                 color: activeTab === 'Complimentary' ? '#8b5cf6' : 'white'
//               }}>
//                 {complimentaryCount}
//               </span>
//             </button>
//           </div>
//         </div>
//       )}

//       {/* Filters */}
//       <div className="filters-container">
//         <div className="filters">
//           <div className="filter-group">
//             <label>Single Date Filter:</label>
//             <input
//               type="date"
//               value={dateFilter}
//               onChange={(e) => {
//                 setDateFilter(e.target.value)
//                 // Clear range filters when single date is selected
//                 if (e.target.value) {
//                   setFromDate("")
//                   setToDate("")
//                 }
//                 setCurrentPage(1) // Reset to first page on filter change
//               }}
//               className="filter-input"
//             />
//           </div>
          
//           <div className="filter-separator">OR</div>
          
//           <div className="filter-group">
//             <label>From Date:</label>
//             <input
//               type="date"
//               value={fromDate}
//               onChange={(e) => {
//                 setFromDate(e.target.value)
//                 // Clear single date filter when range is used
//                 if (e.target.value) {
//                   setDateFilter("")
//                 }
//                 setCurrentPage(1) // Reset to first page on filter change
//               }}
//               className="filter-input"
//             />
//           </div>
          
//           <div className="filter-group">
//             <label>To Date:</label>
//             <input
//               type="date"
//               value={toDate}
//               onChange={(e) => {
//                 setToDate(e.target.value)
//                 // Clear single date filter when range is used
//                 if (e.target.value) {
//                   setDateFilter("")
//                 }
//                 setCurrentPage(1) // Reset to first page on filter change
//               }}
//               className="filter-input"
//             />
//           </div>
          
//           <div className="filter-group">
//             <label>Status:</label>
//             <select
//               value={statusFilter}
//               onChange={(e) => {
//                 setStatusFilter(e.target.value)
//                 setCurrentPage(1) // Reset to first page on filter change
//               }}
//               className="filter-input"
//               style={{ padding: '8px 12px' }}
//             >
//               <option value="all">All Orders</option>
//               <option value="completed">Completed</option>
//               <option value="pending">Pending</option>
//               <option value="processing">Processing</option>
//               <option value="cancelled">Cancelled</option>
//             </select>
//           </div>
          
//           <button
//             className="btn btn-outline"
//             onClick={() => {
//               setDateFilter("")
//               setFromDate("")
//               setToDate("")
//               setStatusFilter("all")
//               setCurrentPage(1) // Reset to first page
//             }}
//           >
//             <Filter size={16} />
//             Clear Filters
//           </button>
//         </div>
//       </div>

//       {/* Stats Cards */}
//       <div className="stats-grid">
//         <div className="stat-card">
//           <div className="stat-icon">
//             <ShoppingCart size={24} />
//           </div>
//           <div className="stat-content">
//             <h3>{currentStats.totalOrders}</h3>
//             <p>Total Orders</p>
//           </div>
//         </div>
//         <div className="stat-card">
//           <div className="stat-icon">
//             <DollarSign size={24} />
//           </div>
//           <div className="stat-content">
//             <h3>₹{currentStats.totalRevenue.toFixed(2)}</h3>
//             <p>Total Revenue (Excl. Cancelled)</p>
//           </div>
//         </div>
//         <div className="stat-card" style={{ backgroundColor: '#f0fdf4', borderLeft: '4px solid #22c55e' }}>
//           <div className="stat-icon" style={{ backgroundColor: '#bbf7d0', color: '#16a34a' }}>
//             <DollarSign size={24} />
//           </div>
//           <div className="stat-content">
//             <h3 style={{ color: '#16a34a' }}>₹{currentStats.totalGSTCollected?.toFixed(2) || '0.00'}</h3>
//             <p>GST Collected</p>
//           </div>
//         </div>
//         <div className="stat-card" style={{ backgroundColor: '#fff5f5', borderLeft: '4px solid #f56565' }}>
//           <div className="stat-icon" style={{ backgroundColor: '#fed7d7', color: '#f56565' }}>
//             <X size={24} />
//           </div>
//           <div className="stat-content">
//             <h3 style={{ color: '#f56565' }}>{currentStats.cancelledOrders}</h3>
//             <p>Cancelled Orders</p>
//           </div>
//         </div>
//         <div className="stat-card" style={{ backgroundColor: '#fff5f5', borderLeft: '4px solid #e53e3e' }}>
//           <div className="stat-icon" style={{ backgroundColor: '#fed7d7', color: '#e53e3e' }}>
//             <DollarSign size={24} />
//           </div>
//           <div className="stat-content">
//             <h3 style={{ color: '#e53e3e' }}>₹{currentStats.cancelledAmount.toFixed(2)}</h3>
//             <p>Cancelled Amount</p>
//           </div>
//         </div>
//       </div>

//       {/* Orders List */}
//       <div className="orders-container">
//         <div className="orders-header">
//           <h2>
//             {activeTab && `📋 ${activeTab} Orders`}
//             ({currentOrders.length})
//           </h2>
//           {/* <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
//             <span style={{ fontSize: '14px', color: '#666' }}>Filter by Status:</span>
//             <select
//               value={statusFilter}
//               onChange={(e) => {
//                 setStatusFilter(e.target.value)
//                 setCurrentPage(1)
//               }}
//               style={{
//                 padding: '8px 12px',
//                 borderRadius: '6px',
//                 border: '1px solid #e2e8f0',
//                 fontSize: '14px',
//                 cursor: 'pointer',
//                 backgroundColor: '#fff'
//               }}
//             >
//               <option value="all">All Orders</option>
//               <option value="completed">Completed</option>
//               <option value="pending">Pending</option>
//               <option value="processing">Processing</option>
//               <option value="cancelled">Cancelled</option>
//             </select>
//           </div> */}
//         </div>

//         {currentOrders.length === 0 ? (
//           <div className="no-orders">
//             <ShoppingCart size={48} />
//             <h3>No Orders Found</h3>
//             <p>No orders found for the selected category and filters.</p>
//           </div>
//         ) : (
//           <div className="orders-grid">
//             {currentOrders.map((order, index) => (
//               <div key={order.id || index} className="order-card">
//                 <div className="order-header">
//                   <div className="order-info">
//                     <h4>{order.invoice?.invoiceNumber ? `BILL-${order.invoice.invoiceNumber}` : order.invoiceNumber || `Order #${index + 1}`}</h4>
//                     <p className="customer-name">
//                       {(order.customerName || "Walk-in Customer")
//                         .replace(/\[undefined\]/gi, '')
//                         .replace(/\[null\]/gi, '')
//                         .replace(/\[\]/g, '')
//                         .trim() || "Walk-in Customer"}
//                     </p>
//                     {order.tableNumber && (
//                       <p className="table-info">Table: {order.tableNumber}</p>
//                     )}
//                     {order.serverName && (
//                       <p className="table-info" style={{ color: '#f59e0b', fontWeight: '600' }}>
//                         👤 Server: {order.serverName}
//                       </p>
//                     )}
//                     <p className="order-date">{formatDate(order.createdAt || order.orderDate)}</p>
//                     {order.isComplimentary && (
//                       <div style={{ 
//                         marginTop: '8px',
//                         padding: '6px 10px',
//                         background: '#f3e8ff',
//                         border: '1px solid #8b5cf6',
//                         borderRadius: '6px'
//                       }}>
//                         <p style={{ fontSize: '12px', color: '#6b21a8', fontWeight: '600', margin: 0 }}>
//                           🎁 Complimentary Bill
//                         </p>
//                         {order.complimentaryReason && (
//                           <p style={{ fontSize: '11px', color: '#7c3aed', fontStyle: 'italic', margin: '4px 0 0 0' }}>
//                             {order.complimentaryReason}
//                           </p>
//                         )}
//                       </div>
//                     )}
//                     {(order.orderStatus || order.status)?.toLowerCase() === 'cancelled' && (
//                       <div style={{ marginTop: '8px' }}>
//                         {order.cancelledBy && (
//                           <p style={{ fontSize: '12px', color: '#f56565', fontWeight: '500' }}>
//                             Cancelled by: {order.cancelledBy}
//                           </p>
//                         )}
//                         {order.cancellationReason && (
//                           <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
//                             Reason: {order.cancellationReason}
//                           </p>
//                         )}
//                       </div>
//                     )}
//                   </div>
//                   <div className="order-amount">
//                     <div className="amount">₹{(order.grandTotal || order.totalAmount || 0).toFixed(2)}</div>
//                     <div 
//                       className="status-badge"
//                       style={{ backgroundColor: getStatusColor(order.orderStatus || order.status) }}
//                     >
//                       {(order.orderStatus || order.status || "Completed").toUpperCase()}
//                     </div>
//                     <button 
//                       className="btn btn-primary btn-sm"
//                       onClick={() => viewOrderDetails(order)}
//                       style={{ 
//                         marginTop: '8px',
//                         padding: '4px 8px',
//                         fontSize: '12px',
//                         display: 'flex',
//                         alignItems: 'center',
//                         gap: '4px'
//                       }}
//                     >
//                       <Eye size={14} />
//                       View
//                     </button>
//                   </div>
//                 </div>

//                 <div className="order-details">
//                   {/* Branch information removed as requested */}
//                 </div>

//                 {order.items && order.items.length > 0 && (
//                   <div className="order-items">
//                     <h5>Items:</h5>
//                     <div className="items-list">
//                       {order.items.slice(0, 3).map((item, idx) => {
//                         // Remove item code from the beginning of item name (e.g., "198 Water Bottle" -> "Water Bottle")
//                         const cleanName = item.name ? item.name.replace(/^\d+\s+/, '').trim() : item.name
//                         return (
//                           <span key={idx} className="item-tag">
//                             {cleanName} x{item.quantity}
//                           </span>
//                         )
//                       })}
//                       {order.items.length > 3 && (
//                         <span className="item-tag more">+{order.items.length - 3} more</span>
//                       )}
//                     </div>
//                   </div>
//                 )}
//               </div>
//             ))}
//           </div>
//         )}
//       </div>

//       {/* Pagination Controls */}
//       {!loading && currentOrders.length > 0 && (
//         <div className="pagination-container" style={{
//           display: 'flex',
//           justifyContent: 'center',
//           alignItems: 'center',
//           gap: '10px',
//           marginTop: '20px',
//           padding: '20px',
//           backgroundColor: '#fff',
//           borderRadius: '8px',
//           boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
//         }}>
//           <button
//             className="btn btn-outline"
//             onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
//             disabled={currentPage === 1}
//             style={{
//               opacity: currentPage === 1 ? 0.5 : 1,
//               cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
//             }}
//           >
//             Previous
//           </button>
          
//           <div style={{
//             display: 'flex',
//             gap: '5px',
//             alignItems: 'center'
//           }}>
//             {/* Show page numbers */}
//             {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
//               let pageNum
//               if (totalPages <= 5) {
//                 pageNum = i + 1
//               } else if (currentPage <= 3) {
//                 pageNum = i + 1
//               } else if (currentPage >= totalPages - 2) {
//                 pageNum = totalPages - 4 + i
//               } else {
//                 pageNum = currentPage - 2 + i
//               }
              
//               return (
//                 <button
//                   key={pageNum}
//                   className={`btn ${currentPage === pageNum ? 'btn-primary' : 'btn-outline'}`}
//                   onClick={() => setCurrentPage(pageNum)}
//                   style={{
//                     minWidth: '40px',
//                     padding: '8px 12px'
//                   }}
//                 >
//                   {pageNum}
//                 </button>
//               )
//             })}
//           </div>
          
//           <button
//             className="btn btn-outline"
//             onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
//             disabled={currentPage === totalPages}
//             style={{
//               opacity: currentPage === totalPages ? 0.5 : 1,
//               cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
//             }}
//           >
//             Next
//           </button>
          
//           <div style={{
//             marginLeft: '20px',
//             color: '#666',
//             fontSize: '14px'
//           }}>
//             Page {currentPage} of {totalPages} ({totalOrders} total orders)
//           </div>
//         </div>
//       )}

//       {/* Order Details Modal */}
//       {showOrderDetails && selectedOrderDetails && (
//         <div className="modal-overlay" onClick={closeOrderDetails}>
//           <div className="modal-content" onClick={(e) => e.stopPropagation()}>
//             <div className="modal-header">
//               <h3>Order Details</h3>
//               <button className="modal-close" onClick={closeOrderDetails}>
//                 <X size={20} />
//               </button>
//             </div>
            
//             <div className="modal-body">
//               <div className="order-summary">
//                 <div className="summary-row">
//                   <span className="label">Order ID:</span>
//                   <span className="value">{selectedOrderDetails.invoice?.invoiceNumber ? `BILL-${selectedOrderDetails.invoice.invoiceNumber}` : selectedOrderDetails.invoiceNumber || selectedOrderDetails.id}</span>
//                 </div>
//                 <div className="summary-row">
//                   <span className="label">Customer:</span>
//                   <span className="value">
//                     {(selectedOrderDetails.customerName || "Walk-in Customer")
//                       .replace(/\[undefined\]/gi, '')
//                       .replace(/\[null\]/gi, '')
//                       .replace(/\[\]/g, '')
//                       .trim() || "Walk-in Customer"}
//                   </span>
//                 </div>
//                 <div className="summary-row">
//                   <span className="label">Phone:</span>
//                   <span className="value">{selectedOrderDetails.phoneNumber || "N/A"}</span>
//                 </div>
//                 <div className="summary-row">
//                   <span className="label">Date & Time:</span>
//                   <span className="value">{formatDate(selectedOrderDetails.createdAt || selectedOrderDetails.orderDate)}</span>
//                 </div>
//                 {selectedOrderDetails.tableNumber && (
//                   <div className="summary-row">
//                     <span className="label">Table:</span>
//                     <span className="value">{selectedOrderDetails.tableNumber}</span>
//                   </div>
//                 )}
//                 <div className="summary-row">
//                   <span className="label">Status:</span>
//                   <span className="value">
//                     <span 
//                       className="status-badge"
//                       style={{ backgroundColor: getStatusColor(selectedOrderDetails.orderStatus || selectedOrderDetails.status) }}
//                     >
//                       {(selectedOrderDetails.orderStatus || selectedOrderDetails.status || "Completed").toUpperCase()}
//                     </span>
//                   </span>
//                 </div>
//                 <div className="summary-row">
//                   <span className="label">Payment Method:</span>
//                   <span className="value">{selectedOrderDetails.paymentMethod || "Cash"}</span>
//                 </div>
//                 {selectedOrderDetails.isComplimentary && (
//                   <>
//                     <div className="summary-row">
//                       <span className="label">Complimentary:</span>
//                       <span className="value" style={{ 
//                         color: '#8b5cf6', 
//                         fontWeight: '600',
//                         display: 'flex',
//                         alignItems: 'center',
//                         gap: '4px'
//                       }}>
//                         🎁 Yes
//                       </span>
//                     </div>
//                     {selectedOrderDetails.complimentaryReason && (
//                       <div className="summary-row">
//                         <span className="label">Complimentary Reason:</span>
//                         <span className="value" style={{ color: '#7c3aed', fontStyle: 'italic' }}>
//                           {selectedOrderDetails.complimentaryReason}
//                         </span>
//                       </div>
//                     )}
//                   </>
//                 )}
//                 {(selectedOrderDetails.orderStatus || selectedOrderDetails.status)?.toLowerCase() === 'cancelled' && (
//                   <>
//                     {selectedOrderDetails.cancelledBy && (
//                       <div className="summary-row">
//                         <span className="label">Cancelled By:</span>
//                         <span className="value" style={{ color: '#f56565', fontWeight: '500' }}>
//                           {selectedOrderDetails.cancelledBy}
//                         </span>
//                       </div>
//                     )}
//                     {selectedOrderDetails.cancellationReason && (
//                       <div className="summary-row">
//                         <span className="label">Cancellation Reason:</span>
//                         <span className="value" style={{ color: '#666', fontStyle: 'italic' }}>
//                           {selectedOrderDetails.cancellationReason}
//                         </span>
//                       </div>
//                     )}
//                     {selectedOrderDetails.cancelledAt && (
//                       <div className="summary-row">
//                         <span className="label">Cancelled At:</span>
//                         <span className="value">{formatDate(selectedOrderDetails.cancelledAt)}</span>
//                       </div>
//                     )}
//                   </>
//                 )}
//               </div>

//               <div className="items-section">
//                 <h4>Ordered Items ({(selectedOrderDetails.items || []).length})</h4>
//                 <div className="items-table">
//                   <div className="items-header">
//                     <span className="item-name">Item Name</span>
//                     <span className="item-qty">Qty</span>
//                     <span className="item-price">Price</span>
//                     <span className="item-total">Total</span>
//                   </div>
//                   {(selectedOrderDetails.items || []).map((item, index) => {
//                     // Remove item code from the beginning of item name (e.g., "198 Water Bottle" -> "Water Bottle")
//                     const cleanName = item.name ? item.name.replace(/^\d+\s+/, '').trim() : item.name
//                     return (
//                       <div key={index} className="items-row">
//                         <span className="item-name">{cleanName}</span>
//                         <span className="item-qty">{item.quantity}</span>
//                         <span className="item-price">₹{(item.price || 0).toFixed(2)}</span>
//                         <span className="item-total">₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
//                       </div>
//                     )
//                   })}
//                 </div>
                
//                 <div className="order-total">
//                   <div className="total-row">
//                     <span className="total-label">Grand Total:</span>
//                     <span className="total-amount">₹{(selectedOrderDetails.grandTotal || selectedOrderDetails.totalAmount || 0).toFixed(2)}</span>
//                   </div>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   )
// }

// export default CategorizedOrders 
 
 
import { useState, useEffect } from "react"
import { ShoppingCart, Users, Calendar, DollarSign, Package, Filter, Download, RefreshCw, Eye, X } from "lucide-react"
import * as XLSX from "xlsx"
import "../styles/CategorizedOrders.css"

const CategorizedOrders = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [allOrders, setAllOrders] = useState([])
  const [activeTab, setActiveTab] = useState("")
  
  // Branch and Category filters
  const [branches, setBranches] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedBranch, setSelectedBranch] = useState("")
  
  // Dynamic category tabs based on selected branch
  const [branchCategories, setBranchCategories] = useState([])
  
  // Complimentary orders state
  const [nonChargeableCount, setNonChargeableCount] = useState(0)
  const [complimentaryCount, setComplimentaryCount] = useState(0)
  const [complimentaryOrders, setComplimentaryOrders] = useState([])
  
  const today = (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })()
  const [dateFilter, setDateFilter] = useState(today)
  const [fromDate, setFromDate] = useState("")
  const [toDate, setToDate] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  
  const [currentPage, setCurrentPage] = useState(1)
  const [ordersPerPage] = useState(50)
  const [totalOrders, setTotalOrders] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [categoryOrders, setCategoryOrders] = useState({})


  const [backendStats, setBackendStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    cancelledOrders: 0,
    cancelledAmount: 0,
    completedOrders: 0,
    pendingOrders: 0,
    totalGSTCollected: 0
  })

  const [categoryCounts, setCategoryCounts] = useState({
    selfService: 0,
    restaurant: 0,
    templeMeals: 0
  })

  const [showOrderDetails, setShowOrderDetails] = useState(false)
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null)

  useEffect(() => {
    fetchBranches()
    fetchCategories()
  }, [])

  useEffect(() => {
    if (selectedBranch) {
      // Set "All Orders" as the default active tab
      if (!activeTab) {
        setActiveTab('All Orders')
      }
    }
  }, [selectedBranch])

  useEffect(() => {
    if (selectedBranch && activeTab) {
      fetchOrders()
    }
  }, [dateFilter, fromDate, toDate, activeTab, currentPage, statusFilter, selectedBranch]) // Re-fetch when filters or page changes

  const fetchBranches = async () => {
    try {
      const response = await fetch('https://billing.jagalikoota.com/api/v1/hotel/branch')
      if (!response.ok) throw new Error('Failed to fetch branches')
      const data = await response.json()
      setBranches(data || [])
      
      // Auto-select first branch if available
      if (data && data.length > 0) {
        setSelectedBranch(data[0]._id)
      }
    } catch (error) {
      console.error('Error fetching branches:', error)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('https://billing.jagalikoota.com/api/v1/hotel/category')
      if (!response.ok) throw new Error('Failed to fetch categories')
      const data = await response.json()
      setCategories(data || [])
    } catch (error) {
      console.error('Error fetching categories:', error)
    }
  }

  const fetchOrders = async () => {
      try {
        setLoading(true)
        setError(null)

        if (!selectedBranch) {
          setLoading(false)
          return
        }
        const branchId = selectedBranch

        // ── Build query params for the optimized backend endpoint ──
        // /counter-order/categorized-orders already does:
        //  - server-side pagination (page, limit)
        //  - date / date-range filtering
        //  - category filtering
        //  - status filtering
        //  - stats & category counts aggregation
        // So we send all filters and get back ONE paginated page + stats.
        const params = new URLSearchParams()
        params.set('branchId', branchId)
        params.set('page', currentPage)
        params.set('limit', ordersPerPage)
        params.set('includeComplimentary', 'true')
        // Give-aways must be fetched so their own tabs can list them; the tab
        // filter below decides what is actually shown.
        params.set('includeNonChargeable', 'true')
        params.set('sortBy', 'createdAt')
        params.set('sortOrder', 'desc')

        // Date filters
        if (dateFilter) {
          params.set('date', dateFilter)
        } else {
          if (fromDate) params.set('startDate', fromDate)
          if (toDate) params.set('endDate', toDate)
        }

        // Category filter (skip for All Orders and the give-away tabs)
        if (activeTab !== 'Complimentary' && activeTab !== 'Non-Chargeable' && activeTab !== 'All Orders') {
          params.set('categoryName', activeTab)
        }

        // Status filter
        if (statusFilter !== 'all') {
          params.set('orderStatus', statusFilter)
        }

        const url = `https://billing.jagalikoota.com/api/v1/hotel/counter-order/categorized-orders?${params.toString()}`
        const response = await fetch(url)

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()

        // Extract orders from response
        let orders = data.orders || data.data || []

        // Give-away tabs show only their own kind. Other tabs exclude both, so
        // free bills never inflate the sales figures on screen.
        if (activeTab === 'Complimentary') {
          orders = orders.filter(order => order.isComplimentary === true)
        } else if (activeTab === 'Non-Chargeable') {
          orders = orders.filter(order => order.isNonChargeable === true)
        } else {
          orders = orders.filter(order => !order.isComplimentary && !order.isNonChargeable)
        }

        // Use backend-provided stats directly
        const stats = data.stats || {}
        
        // Calculate GST from the page's orders (backend doesn't aggregate GST yet)
        const totalGSTCollected = orders
          .filter(o => (o.orderStatus || '').toLowerCase() !== 'cancelled')
          .reduce((sum, order) => {
            if (order.gstAmount && order.gstAmount > 0) return sum + order.gstAmount
            if (!order.items || !Array.isArray(order.items)) return sum
            return sum + order.items.reduce((itemSum, item) => {
              return itemSum + (((item.price || 0) * (item.quantity || 0) * (item.gstRate || 0)) / 100)
            }, 0)
          }, 0)

        setBackendStats({
          totalOrders: stats.totalOrders || 0,
          totalRevenue: stats.totalRevenue || 0,
          cancelledOrders: stats.cancelledOrders || 0,
          cancelledAmount: stats.cancelledAmount || 0,
          completedOrders: stats.completedOrders || 0,
          pendingOrders: stats.pendingOrders || 0,
          totalGSTCollected
        })

        // Use backend pagination metadata
        const pagination = data.pagination || {}
        setTotalOrders(pagination.totalItems || orders.length)
        setTotalPages(pagination.totalPages || 1)

        // Category counts from backend
        const counts = data.categoryCounts || {}
        setCategoryCounts(counts)

        // Complimentary count — server-side count, so the badge is correct on
        // every tab (previously it borrowed pagination.totalItems, which is the
        // count of ALL orders, making the badge match Total Orders).
        setComplimentaryCount(data.complimentaryCount || 0)
        setNonChargeableCount(data.nonChargeableCount || 0)

        // Set orders for the current tab (already paginated by backend)
        setCategoryOrders(prev => ({
          ...prev,
          [activeTab]: orders
        }))

        setAllOrders(orders)

      } catch (error) {
        console.error("Error fetching orders:", error)
        setError(`Failed to load orders: ${error.message}`)
      } finally {
        setLoading(false)
      }
    }

  const getCurrentOrders = () => {
    // Return orders based on active tab
    return categoryOrders[activeTab] || []
  }

  const getOrderStats = () => {
    // Use backend stats directly
    return backendStats
  }

  const exportToExcel = async () => {
    try {
      // Use active tab as category name
      const categoryName = activeTab || "All Categories"
      
      // Fetch ALL orders for export (no pagination limit)
      let exportApiUrl = `https://billing.jagalikoota.com/api/v1/hotel/counter-order/categorized-orders?includeComplimentary=false&page=1&limit=100000`

      // Add date filters
      if (dateFilter) {
        exportApiUrl += `&date=${dateFilter}`
      } else if (fromDate && toDate) {
        exportApiUrl += `&startDate=${fromDate}&endDate=${toDate}`
      } else if (fromDate) {
        exportApiUrl += `&startDate=${fromDate}`
      } else if (toDate) {
        exportApiUrl += `&endDate=${toDate}`
      }

      // Add category filter
      if (activeTab) {
        exportApiUrl += `&categoryName=${encodeURIComponent(activeTab)}`
      }

      // Add status filter if not "all"
      if (statusFilter !== 'all') {
        exportApiUrl += `&orderStatus=${statusFilter}`
      }

      console.log('📊 Fetching all orders for export:', exportApiUrl)

      const response = await fetch(exportApiUrl)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      let ordersToExport = data.orders || data.data || []
      
      // EXCLUDE CANCELLED ORDERS from export (unless specifically filtering for cancelled)
      if (statusFilter !== "cancelled") {
        ordersToExport = ordersToExport.filter(order => {
          const status = (order.orderStatus || order.status || "completed").toLowerCase()
          return status !== "cancelled"
        })
      }
      
      console.log(`📊 Exporting ${ordersToExport.length} orders for ${categoryName} (cancelled orders excluded)`)
      
      // NEW: Detailed item-wise export data
      const detailedExportData = []
      ordersToExport.forEach(order => {
        const invoiceNumber = order.invoice?.invoiceNumber || order.invoiceNumber || "N/A"
        const orderDate = new Date(order.createdAt || order.orderDate).toLocaleDateString()
        const paymentMethod = order.paymentMethod || "Cash"
        const tableNumber = order.tableNumber || "N/A"
        const orderTotal = order.grandTotal || order.totalAmount || 0
        
        if (order.items && order.items.length > 0) {
          order.items.forEach(item => {
            const cleanName = item.name ? item.name.replace(/^\d+\s+/, '').trim() : item.name || 'Unknown Item'
            const itemPrice = item.price || 0
            const itemQuantity = item.quantity || 1
            const itemTotal = itemPrice * itemQuantity
            
            detailedExportData.push({
              "Invoice Number": invoiceNumber,
              "Order Date": orderDate,
              "Table Number": tableNumber,
              "Item Name": cleanName,
              "Item Price": itemPrice,
              "Quantity": itemQuantity,
              "Item Total": itemTotal,
              "Payment Method": paymentMethod,
              "Order Total": orderTotal
            })
          })
        } else {
          // If no items, still add order row
          detailedExportData.push({
            "Invoice Number": invoiceNumber,
            "Order Date": orderDate,
            "Table Number": tableNumber,
            "Item Name": "No items",
            "Item Price": 0,
            "Quantity": 0,
            "Item Total": 0,
            "Payment Method": paymentMethod,
            "Order Total": orderTotal
          })
        }
      })

      // Calculate item summary with price - total quantities and revenue for each item
      const itemSummary = {}
      ordersToExport.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach(item => {
            const cleanName = item.name ? item.name.replace(/^\d+\s+/, '').trim() : item.name || 'Unknown Item'
            const quantity = parseInt(item.quantity) || 0
            const price = parseFloat(item.price) || 0
            const itemTotal = price * quantity
            
            if (itemSummary[cleanName]) {
              itemSummary[cleanName].quantity += quantity
              itemSummary[cleanName].revenue += itemTotal
            } else {
              itemSummary[cleanName] = {
                quantity: quantity,
                price: price,
                revenue: itemTotal
              }
            }
          })
        }
      })

      // Convert item summary to array and sort by revenue (highest first)
      const itemSummaryData = Object.entries(itemSummary)
        .map(([itemName, data]) => ({
          "Item Name": itemName,
          "Price per Unit": data.price,
          "Total Quantity Sold": data.quantity,
          "Total Revenue": data.revenue
        }))
        .sort((a, b) => b["Total Revenue"] - a["Total Revenue"])

      // NEW: Menu category-wise breakdown (like charts - Juices, Snacks, etc.)
      const menuCategorySummary = {}
      ordersToExport.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach(item => {
            // Get menu category (e.g., "Juices", "Snacks", "Meals")
            const menuCategory = item.category || item.menuCategory || "Uncategorized"
            const quantity = parseInt(item.quantity) || 0
            const price = parseFloat(item.price) || 0
            const itemTotal = price * quantity
            
            if (menuCategorySummary[menuCategory]) {
              menuCategorySummary[menuCategory].quantity += quantity
              menuCategorySummary[menuCategory].revenue += itemTotal
              menuCategorySummary[menuCategory].itemCount += 1
            } else {
              menuCategorySummary[menuCategory] = {
                quantity: quantity,
                revenue: itemTotal,
                itemCount: 1
              }
            }
          })
        }
      })

      // Convert menu category summary to array and sort by revenue
      const menuCategoryData = Object.entries(menuCategorySummary)
        .map(([categoryName, data]) => ({
          "Menu Category": categoryName,
          "Total Items Sold": data.quantity,
          "Total Revenue": data.revenue,
          "Number of Different Items": data.itemCount
        }))
        .sort((a, b) => b["Total Revenue"] - a["Total Revenue"])

      // Service category summary (Self Service, Restaurant, Temple Meals)
      const categoryStats = {
        "Service Category": categoryName,
        "Total Orders": ordersToExport.length,
        "Total Revenue": ordersToExport.reduce((sum, order) => sum + (order.grandTotal || order.totalAmount || 0), 0),
        "Total Items Sold": ordersToExport.reduce((sum, order) => {
          return sum + (order.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 0), 0)
        }, 0),
        "Average Order Value": ordersToExport.length > 0 
          ? (ordersToExport.reduce((sum, order) => sum + (order.grandTotal || order.totalAmount || 0), 0) / ordersToExport.length).toFixed(2)
          : 0
      }

      // Create workbook with multiple sheets
      const wb = XLSX.utils.book_new()
      
      // Sheet 1: Detailed item-wise data
      const detailedWs = XLSX.utils.json_to_sheet(detailedExportData)
      XLSX.utils.book_append_sheet(wb, detailedWs, `Detailed Items`)
      
      // Sheet 2: Item summary with price and revenue
      const summaryWs = XLSX.utils.json_to_sheet(itemSummaryData)
      XLSX.utils.book_append_sheet(wb, summaryWs, `Items Summary`)
      
      // Sheet 3: Menu category breakdown (Juices, Snacks, etc.)
      const menuCategoryWs = XLSX.utils.json_to_sheet(menuCategoryData)
      XLSX.utils.book_append_sheet(wb, menuCategoryWs, `Menu Categories`)
      
      // Sheet 4: Service category summary
      const categoryWs = XLSX.utils.json_to_sheet([categoryStats])
      XLSX.utils.book_append_sheet(wb, categoryWs, `Service Category`)
      
      // Generate filename with date
      const today = new Date().toISOString().split('T')[0]
      XLSX.writeFile(wb, `${categoryName.toLowerCase().replace(' ', '-')}-orders-${today}.xlsx`)
      
      console.log(`✅ Exported ${ordersToExport.length} orders to Excel (cancelled orders excluded)`)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Failed to export orders. Please try again.')
    }
  }

  const viewOrderDetails = (order) => {
    setSelectedOrderDetails(order)
    setShowOrderDetails(true)
  }

  const closeOrderDetails = () => {
    setShowOrderDetails(false)
    setSelectedOrderDetails(null)
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
      <div className="page-container">
        <div className="loading-container">
          <RefreshCw size={24} className="animate-spin" />
          <p>Loading categorized orders...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-container">
        <div className="error-container">
          <h3>Error</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={fetchOrders}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  const currentOrders = getCurrentOrders()
  const currentStats = getOrderStats()

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>📊 Categorized Orders</h1>
        <p>View orders by service category</p>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={fetchOrders}>
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="btn btn-primary" onClick={exportToExcel}>
            <Download size={16} />
            Export Excel
          </button>
        </div>
      </div>

      {/* Branch Selector at Top */}
      <div className="filters-container" style={{ marginBottom: '20px' }}>
        <div className="filters">
          <div className="filter-group" style={{ flex: '0 0 300px' }}>
            <label style={{ fontWeight: '600', fontSize: '16px' }}>Select Branch:</label>
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value)
                setActiveTab("") // Reset active tab when branch changes
                setCurrentPage(1)
              }}
              className="filter-input"
              style={{ padding: '10px 14px', fontSize: '15px', fontWeight: '500' }}
            >
              <option value="">Select Branch</option>
              {branches.map((branch) => (
                <option key={branch._id} value={branch._id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Order Tabs - All Orders and Complimentary */}
      {selectedBranch && (
        <div className="tabs-container">
          <div className="tabs">
            {/* All Orders Tab */}
            <button
              className={`tab ${activeTab === 'All Orders' ? "active" : ""}`}
              onClick={() => {
                setActiveTab('All Orders')
                setCurrentPage(1) // Reset to first page when switching tabs
              }}
            >
              <Package size={16} />
              All Orders
              <span className="badge">{backendStats.totalOrders || 0}</span>
            </button>
            
            {/* Complimentary Tab - Always visible. Uses the tab--gift variant
                (bronze/gold accent) instead of an inline purple, so it stays
                inside the same palette as the rest of the page. */}
            <button
              className={`tab tab--gift ${activeTab === 'Complimentary' ? "active" : ""}`}
              onClick={() => {
                setActiveTab('Complimentary')
                setCurrentPage(1) // Reset to first page when switching tabs
              }}
            >
              🎁 Complimentary
              <span className="badge">
                {complimentaryCount}
              </span>
            </button>

            {/* Non-Chargeable Tab — internal consumption (staff meals, tasting,
                wastage). Separate from Complimentary because the two are
                accounted differently at month end. */}
            <button
              className={`tab tab--nc ${activeTab === 'Non-Chargeable' ? "active" : ""}`}
              onClick={() => {
                setActiveTab('Non-Chargeable')
                setCurrentPage(1)
              }}
            >
              🍽️ Non-Chargeable
              <span className="badge">
                {nonChargeableCount}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-container">
        <div className="filters">
          <div className="filter-group">
            <label>Single Date Filter:</label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value)
                // Clear range filters when single date is selected
                if (e.target.value) {
                  setFromDate("")
                  setToDate("")
                }
                setCurrentPage(1) // Reset to first page on filter change
              }}
              className="filter-input"
            />
          </div>
          
          <div className="filter-separator">OR</div>
          
          <div className="filter-group">
            <label>From Date:</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value)
                // Clear single date filter when range is used
                if (e.target.value) {
                  setDateFilter("")
                }
                setCurrentPage(1) // Reset to first page on filter change
              }}
              className="filter-input"
            />
          </div>
          
          <div className="filter-group">
            <label>To Date:</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value)
                // Clear single date filter when range is used
                if (e.target.value) {
                  setDateFilter("")
                }
                setCurrentPage(1) // Reset to first page on filter change
              }}
              className="filter-input"
            />
          </div>
          
          <div className="filter-group">
            <label>Status:</label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setCurrentPage(1) // Reset to first page on filter change
              }}
              className="filter-input"
              style={{ padding: '8px 12px' }}
            >
              <option value="all">All Orders</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          
          <button
            className="btn btn-outline"
            onClick={() => {
              setDateFilter("")
              setFromDate("")
              setToDate("")
              setStatusFilter("all")
              setCurrentPage(1) // Reset to first page
            }}
          >
            <Filter size={16} />
            Clear Filters
          </button>
        </div>
      </div>

      {/* Stats Cards — variant classNames drive the accent color now,
          instead of inline style objects, so they read as one system. */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <ShoppingCart size={24} />
          </div>
          <div className="stat-content">
            <h3>{currentStats.totalOrders}</h3>
            <p>Total Orders</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <h3>₹{currentStats.totalRevenue.toFixed(2)}</h3>
            <p>Total Revenue (Excl. Cancelled)</p>
          </div>
        </div>
        <div className="stat-card stat-card--gst">
          <div className="stat-icon">
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <h3>₹{currentStats.totalGSTCollected?.toFixed(2) || '0.00'}</h3>
            <p>GST Collected</p>
          </div>
        </div>
        <div className="stat-card stat-card--cancelled">
          <div className="stat-icon">
            <X size={24} />
          </div>
          <div className="stat-content">
            <h3>{currentStats.cancelledOrders}</h3>
            <p>Cancelled Orders</p>
          </div>
        </div>
        <div className="stat-card stat-card--cancelled-amount">
          <div className="stat-icon">
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <h3>₹{currentStats.cancelledAmount.toFixed(2)}</h3>
            <p>Cancelled Amount</p>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="orders-container">
        <div className="orders-header">
          <h2>
            {activeTab && `📋 ${activeTab} Orders`}
            ({currentOrders.length})
          </h2>
        </div>

        {currentOrders.length === 0 ? (
          <div className="no-orders">
            <ShoppingCart size={48} />
            <h3>No Orders Found</h3>
            <p>No orders found for the selected category and filters.</p>
          </div>
        ) : (
          <div className="orders-grid">
            {currentOrders.map((order, index) => (
              <div key={order.id || index} className="order-card">
                <div className="order-header">
                  <div className="order-info">
                    <h4>{order.invoice?.invoiceNumber ? `BILL-${order.invoice.invoiceNumber}` : order.invoiceNumber || `Order #${index + 1}`}</h4>
                    <p className="customer-name">
                      {(order.customerName || "Walk-in Customer")
                        .replace(/\[undefined\]/gi, '')
                        .replace(/\[null\]/gi, '')
                        .replace(/\[\]/g, '')
                        .trim() || "Walk-in Customer"}
                    </p>
                    {order.tableNumber && (
                      <p className="table-info">Table: {order.tableNumber}</p>
                    )}
                    {order.serverName && (
                      <p className="table-info" style={{ color: '#f59e0b', fontWeight: '600' }}>
                        👤 Server: {order.serverName}
                      </p>
                    )}
                    <p className="order-date">{formatDate(order.createdAt || order.orderDate)}</p>
                    {order.isComplimentary && (
                      <div className="callout callout--gift">
                        <p style={{ fontWeight: '600', margin: 0 }}>
                          🎁 Complimentary Bill
                        </p>
                        {order.complimentaryReason && (
                          <p className="callout-reason">
                            {order.complimentaryReason}
                          </p>
                        )}
                      </div>
                    )}
                    {order.isNonChargeable && (
                      <div className="callout callout--nc">
                        <p style={{ fontWeight: '600', margin: 0 }}>
                          🍽️ Non-Chargeable
                          {order.nonChargeableType && (
                            <span style={{ textTransform: 'capitalize', fontWeight: 500 }}>
                              {' · '}{order.nonChargeableType}
                            </span>
                          )}
                          {order.originalGrandTotal > 0 && (
                            <span style={{ fontWeight: 500 }}>
                              {' · ₹'}{Number(order.originalGrandTotal).toFixed(2)}
                            </span>
                          )}
                        </p>
                        {order.nonChargeableReason && (
                          <p className="callout-reason">
                            {order.nonChargeableReason}
                            {order.nonChargeableBy ? ` — ${order.nonChargeableBy}` : ''}
                          </p>
                        )}
                      </div>
                    )}
                    {(order.orderStatus || order.status)?.toLowerCase() === 'cancelled' && (
                      <div style={{ marginTop: '8px' }}>
                        {order.cancelledBy && (
                          <p style={{ fontSize: '12px', color: '#f56565', fontWeight: '500' }}>
                            Cancelled by: {order.cancelledBy}
                          </p>
                        )}
                        {order.cancellationReason && (
                          <p style={{ fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                            Reason: {order.cancellationReason}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="order-amount">
                    <div className="amount">₹{(order.grandTotal || order.totalAmount || 0).toFixed(2)}</div>
                    <div 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(order.orderStatus || order.status) }}
                    >
                      {(order.orderStatus || order.status || "Completed").toUpperCase()}
                    </div>
                    <button 
                      className="btn btn-primary btn-sm"
                      onClick={() => viewOrderDetails(order)}
                      style={{ 
                        marginTop: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Eye size={14} />
                      View
                    </button>
                  </div>
                </div>

                <div className="order-details">
                  {/* Branch information removed as requested */}
                </div>

                {order.items && order.items.length > 0 && (
                  <div className="order-items">
                    <h5>Items:</h5>
                    <div className="items-list">
                      {order.items.slice(0, 3).map((item, idx) => {
                        // Remove item code from the beginning of item name (e.g., "198 Water Bottle" -> "Water Bottle")
                        const cleanName = item.name ? item.name.replace(/^\d+\s+/, '').trim() : item.name
                        return (
                          <span key={idx} className="item-tag">
                            {cleanName} x{item.quantity}
                          </span>
                        )
                      })}
                      {order.items.length > 3 && (
                        <span className="item-tag more">+{order.items.length - 3} more</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      {!loading && currentOrders.length > 0 && (
        <div className="pagination-container">
          <button
            className="btn btn-outline"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            style={{
              opacity: currentPage === 1 ? 0.5 : 1,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>
          
          <div style={{
            display: 'flex',
            gap: '5px',
            alignItems: 'center'
          }}>
            {/* Show page numbers */}
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
                  className={`btn ${currentPage === pageNum ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setCurrentPage(pageNum)}
                  style={{
                    minWidth: '40px',
                    padding: '8px 12px'
                  }}
                >
                  {pageNum}
                </button>
              )
            })}
          </div>
          
          <button
            className="btn btn-outline"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            style={{
              opacity: currentPage === totalPages ? 0.5 : 1,
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
          
          <div style={{
            marginLeft: '20px',
            color: '#666',
            fontSize: '14px'
          }}>
            Page {currentPage} of {totalPages} ({totalOrders} total orders)
          </div>
        </div>
      )}

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrderDetails && (
        <div className="modal-overlay" onClick={closeOrderDetails}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Order Details</h3>
              <button className="modal-close" onClick={closeOrderDetails}>
                <X size={20} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="order-summary">
                <div className="summary-row">
                  <span className="label">Order ID:</span>
                  <span className="value">{selectedOrderDetails.invoice?.invoiceNumber ? `BILL-${selectedOrderDetails.invoice.invoiceNumber}` : selectedOrderDetails.invoiceNumber || selectedOrderDetails.id}</span>
                </div>
                <div className="summary-row">
                  <span className="label">Customer:</span>
                  <span className="value">
                    {(selectedOrderDetails.customerName || "Walk-in Customer")
                      .replace(/\[undefined\]/gi, '')
                      .replace(/\[null\]/gi, '')
                      .replace(/\[\]/g, '')
                      .trim() || "Walk-in Customer"}
                  </span>
                </div>
                <div className="summary-row">
                  <span className="label">Phone:</span>
                  <span className="value">{selectedOrderDetails.phoneNumber || "N/A"}</span>
                </div>
                <div className="summary-row">
                  <span className="label">Date & Time:</span>
                  <span className="value">{formatDate(selectedOrderDetails.createdAt || selectedOrderDetails.orderDate)}</span>
                </div>
                {selectedOrderDetails.tableNumber && (
                  <div className="summary-row">
                    <span className="label">Table:</span>
                    <span className="value">{selectedOrderDetails.tableNumber}</span>
                  </div>
                )}
                <div className="summary-row">
                  <span className="label">Status:</span>
                  <span className="value">
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(selectedOrderDetails.orderStatus || selectedOrderDetails.status) }}
                    >
                      {(selectedOrderDetails.orderStatus || selectedOrderDetails.status || "Completed").toUpperCase()}
                    </span>
                  </span>
                </div>
                <div className="summary-row">
                  <span className="label">Payment Method:</span>
                  <span className="value">{selectedOrderDetails.paymentMethod || "Cash"}</span>
                </div>
                {selectedOrderDetails.isComplimentary && (
                  <>
                    <div className="summary-row">
                      <span className="label">Complimentary:</span>
                      <span className="value" style={{ 
                        color: '#8a5a2b', 
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        🎁 Yes
                      </span>
                    </div>
                    {selectedOrderDetails.complimentaryReason && (
                      <div className="summary-row">
                        <span className="label">Complimentary Reason:</span>
                        <span className="value" style={{ color: '#a3762f', fontStyle: 'italic' }}>
                          {selectedOrderDetails.complimentaryReason}
                        </span>
                      </div>
                    )}
                  </>
                )}
                {(selectedOrderDetails.orderStatus || selectedOrderDetails.status)?.toLowerCase() === 'cancelled' && (
                  <>
                    {selectedOrderDetails.cancelledBy && (
                      <div className="summary-row">
                        <span className="label">Cancelled By:</span>
                        <span className="value" style={{ color: '#f56565', fontWeight: '500' }}>
                          {selectedOrderDetails.cancelledBy}
                        </span>
                      </div>
                    )}
                    {selectedOrderDetails.cancellationReason && (
                      <div className="summary-row">
                        <span className="label">Cancellation Reason:</span>
                        <span className="value" style={{ color: '#666', fontStyle: 'italic' }}>
                          {selectedOrderDetails.cancellationReason}
                        </span>
                      </div>
                    )}
                    {selectedOrderDetails.cancelledAt && (
                      <div className="summary-row">
                        <span className="label">Cancelled At:</span>
                        <span className="value">{formatDate(selectedOrderDetails.cancelledAt)}</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="items-section">
                <h4>Ordered Items ({(selectedOrderDetails.items || []).length})</h4>
                <div className="items-table">
                  <div className="items-header">
                    <span className="item-name">Item Name</span>
                    <span className="item-qty">Qty</span>
                    <span className="item-price">Price</span>
                    <span className="item-total">Total</span>
                  </div>
                  {(selectedOrderDetails.items || []).map((item, index) => {
                    // Remove item code from the beginning of item name (e.g., "198 Water Bottle" -> "Water Bottle")
                    const cleanName = item.name ? item.name.replace(/^\d+\s+/, '').trim() : item.name
                    return (
                      <div key={index} className="items-row">
                        <span className="item-name">{cleanName}</span>
                        <span className="item-qty">{item.quantity}</span>
                        <span className="item-price">₹{(item.price || 0).toFixed(2)}</span>
                        <span className="item-total">₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
                      </div>
                    )
                  })}
                </div>
                
                <div className="order-total">
                  <div className="total-row">
                    <span className="total-label">Grand Total:</span>
                    <span className="total-amount">₹{(selectedOrderDetails.grandTotal || selectedOrderDetails.totalAmount || 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CategorizedOrders