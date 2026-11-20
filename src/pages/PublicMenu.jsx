// import { useState, useEffect, useRef } from "react"
// import {
//   Search,
//   QrCode,
//   Plus,
//   Minus,
//   ShoppingCart,
//   X,
//   User,
//   Phone,
//   Users,
//   CreditCard,
//   Check,
//   Download,
//   AlertCircle,
//   Printer,
//   History,
//   RefreshCw,
//   Clock,
// } from "lucide-react"
// import hotelViratLogo from "../assets/logo4.jpeg"

// // ── Subcategory ordering ─────────────────────────────────────────────────────
// // Menu items carry a subcategory from the admin panel. This lays the filter
// // chips out in natural menu order (starters → mains → dessert) rather than
// // whatever order the API returns. Kept in sync with the Member App's
// // MenuScreen.js so both surfaces read the same way.
// // Anything not listed still appears, appended alphabetically.
// const SUBCATEGORY_ORDER = [
//   "Soup",
//   "Salad",
//   "Appetizers",
//   "International Small Plates",
//   "Bao & Dim Sum",
//   "Sushi",
//   "Tandoor",
//   "Pan-Asian",
//   "North Indian",
//   "South Indian",
//   "Nati Style",
//   "Pasta",
//   "International Big Plates",
//   "Staples",
//   "Dessert",
// ]

// const OTHERS_LABEL = "Others"

// const sortSubcategories = (names) => {
//   const known = []
//   const unknown = []

//   names.forEach((name) => {
//     if (name === OTHERS_LABEL) return // always pinned last
//     if (SUBCATEGORY_ORDER.includes(name)) known.push(name)
//     else unknown.push(name)
//   })

//   known.sort((a, b) => SUBCATEGORY_ORDER.indexOf(a) - SUBCATEGORY_ORDER.indexOf(b))
//   unknown.sort((a, b) => a.localeCompare(b))

//   const result = [...known, ...unknown]
//   if (names.includes(OTHERS_LABEL)) result.push(OTHERS_LABEL)
//   return result
// }

// // subcategoryId comes back populated as { _id, name }; fall back to a plain
// // string for older/unpopulated response shapes.
// const getSubcategoryName = (product) => {
//   const raw =
//     product?.subcategoryId && typeof product.subcategoryId === "object"
//       ? product.subcategoryId.name
//       : product?.subcategoryName || product?.subcategory

//   return raw && typeof raw === "string" && raw.trim() ? raw.trim() : null
// }

// // Turn a raw order reference into a short, customer-friendly code instead of
// // showing the raw Mongo _id (e.g. "6a82bfbf78594f6eb161ae05" → "61AE05").
// // Prefers a real orderNumber if the backend ever provides one.
// const formatOrderRef = (order) => {
//   const raw = order?.orderNumber || order?.orderId || order?._id || ""
//   const s = String(raw)
//   if (/^[a-f0-9]{24}$/i.test(s)) return s.slice(-6).toUpperCase()
//   return s
// }

// // Food-type filter options. "All" = no filter.
// const FOOD_TYPES = [
//   { value: "All", label: "All", color: "#ff7e47" },
//   { value: "veg", label: "Veg", color: "#16a34a" },
//   { value: "non-veg", label: "Non-Veg", color: "#dc2626" },
//   { value: "egg", label: "Egg", color: "#d97706" },
// ]

// const PublicMenu = () => {
//   const [products, setProducts] = useState([])
//   const [categories, setCategories] = useState([])
//   const [selectedCategory, setSelectedCategory] = useState("")
//   // Subcategory filter (Soup, Appetizers, Tandoor…) — same idea as the Member
//   // App's chip row. "All" means no subcategory filter.
//   const [selectedSubcategory, setSelectedSubcategory] = useState("All")
//   // Food-type filter (Veg / Non-Veg / Egg). "All" means no food-type filter.
//   const [selectedFoodType, setSelectedFoodType] = useState("All")
//   // Map of image key -> true for images that failed to load
//   const [brokenImages, setBrokenImages] = useState({})
//   const [searchQuery, setSearchQuery] = useState("")
//   const [loading, setLoading] = useState(true)
//   const [error, setError] = useState("")
//   const [branchId, setBranchId] = useState("")
//   const [branchName, setBranchName] = useState("")
//   const [tableNumber, setTableNumber] = useState("")
//   const [tableStatus, setTableStatus] = useState("") // NEW: Track table status
//   const [tableId, setTableId] = useState("") // NEW: Track table ID
//   const [tableCategoryId, setTableCategoryId] = useState("") // Track table's category for filtering
//   const [tableCategoryName, setTableCategoryName] = useState("") // Track table's category name

//   // Cart state
//   const [cart, setCart] = useState([])
//   const [showCart, setShowCart] = useState(false)
//   const [showCheckout, setShowCheckout] = useState(false)
//   const [orderPlaced, setOrderPlaced] = useState(false)
//   const [lastOrderDetails, setLastOrderDetails] = useState(null)

//   // Customer details
//   const [customerDetails, setCustomerDetails] = useState({
//     name: "",
//     mobile: "",
//     peopleCount: 1,
//   })

//   // Order processing
//   const [processingOrder, setProcessingOrder] = useState(false)

//   // Order history
//   const [showMyOrders, setShowMyOrders] = useState(false)
//   const [myOrders, setMyOrders] = useState([])
//   const [loadingOrders, setLoadingOrders] = useState(false)
//   const isFetchingOrdersRef = useRef(false)

//   // Fetch orders when modal opens
//   useEffect(() => {
//     if (showMyOrders && sessionId) {
//       console.log("🔄 useEffect: Modal opened, fetching orders...")
//       fetchMyOrders()
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [showMyOrders])

//   // API configuration
//   const api = {
//     baseURL: import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel",
//     get: async (endpoint) => {
//       try {
//         const response = await fetch(`${api.baseURL}${endpoint}`)
//         if (!response.ok) {
//           throw new Error(`HTTP error! status: ${response.status}`)
//         }
//         return await response.json()
//       } catch (error) {
//         console.error(`API Error for ${endpoint}:`, error)
//         throw error
//       }
//     },
//     post: async (endpoint, data) => {
//       try {
//         const response = await fetch(`${api.baseURL}${endpoint}`, {
//           method: "POST",
//           headers: {
//             "Content-Type": "application/json",
//           },
//           body: JSON.stringify(data),
//         })
//         if (!response.ok) {
//           throw new Error(`HTTP error! status: ${response.status}`)
//         }
//         return await response.json()
//       } catch (error) {
//         console.error(`API Error for ${endpoint}:`, error)
//         throw error
//       }
//     },
//   }

//   // NEW: Function to check table status and get category
//   const checkTableStatus = async (branchId, tableNumber) => {
//     try {
//       console.log("Checking table status for branch:", branchId, "table:", tableNumber)

//       // Get all tables for the branch
//       const response = await api.get(`/table?branchId=${branchId}`)
      
//       // Handle undefined or null response
//       if (!response) {
//         console.warn("⚠️ API returned undefined/null, assuming table is available")
//         setTableStatus("available")
//         return { status: "available", categoryId: null }
//       }
      
//       // Handle API response - store in new variable to avoid changing data structure elsewhere
//       let tablesData = []
      
//       // The API returns a direct array
//       if (Array.isArray(response)) {
//         console.log("✅ Response is direct array")
//         tablesData = response
//       }
//       // Check if wrapped in {success, count, data} format
//       else if (response.data && response.data.success && Array.isArray(response.data.data)) {
//         console.log("✅ Response has {success, count, data} format")
//         tablesData = response.data.data
//       } 
//       // Check if wrapped in {data} format (old format)
//       else if (Array.isArray(response.data)) {
//         console.log("✅ Response has {data} format")
//         tablesData = response.data
//       } 
//       else {
//         console.warn("⚠️ Unexpected response format, assuming table is available:", response)
//         // Don't return early - set default status to not block customers
//         setTableStatus("available")
//         return { status: "available", categoryId: null }
//       }

//       console.log("📦 Total tables found:", tablesData.length)

//       // Find the specific table by number (case-insensitive comparison for flexibility)
//       const table = tablesData.find((t) => 
//         t.number.toString().toLowerCase() === tableNumber.toString().toLowerCase()
//       )

//       if (table) {
//         console.log("✅ Found table:", table)
//         setTableId(table._id)
//         setTableStatus(table.status || "available")
        
//         // Get category info from table
//         if (table.categoryId) {
//           const catId = typeof table.categoryId === 'object' ? table.categoryId._id : table.categoryId
//           const catName = typeof table.categoryId === 'object' ? table.categoryId.name : ''
//           setTableCategoryId(catId)
//           setTableCategoryName(catName)
//           console.log("📂 Table category:", catId, catName)
//         }
        
//         return { status: table.status || "available", categoryId: table.categoryId }
//       } else {
//         console.log("⚠️ Table '" + tableNumber + "' not found in database, assuming available")
//         setTableStatus("available")
//         return { status: "available", categoryId: null }
//       }
//     } catch (error) {
//       console.error("Error checking table status:", error)
//       // If we can't check status, assume available to not block customers
//       setTableStatus("available")
//       return { status: "available", categoryId: null }
//     }
//   }

//   // Helper functions
//   const getCategoryId = (product) => {
//     try {
//       if (!product) return null
//       if (typeof product.categoryId === "object" && product.categoryId !== null) {
//         return product.categoryId._id || product.categoryId.id
//       }
//       return product.categoryId
//     } catch (error) {
//       console.error('Error getting category ID:', error, 'Product:', product)
//       return null
//     }
//   }

//   const getCategoryName = (product) => {
//     if (!product) return "Unknown Category"
//     if (typeof product.categoryId === "object" && product.categoryId !== null) {
//       return product.categoryId.name || "Unknown Category"
//     }
//     const categoryId = product.categoryId
//     const category = categories.find((cat) => cat._id === categoryId)
//     return category ? category.name : "Unknown Category"
//   }

//   const getImageUrl = (imageUrl) => {
//     `${imageUrl}`
//   }

//   // Cart functions
//   const addToCart = (product) => {
//     // Check if table is available before adding to cart
//     // Allow if table is reserved but current session is the owner (same customer adding more items)
//     if (tableStatus === "reserved") {
//       const sessionKey = `session_${branchId}_${tableNumber}`
//       const existingSession = localStorage.getItem(sessionKey)
//       let isOwner = false
//       if (existingSession) {
//         try {
//           const sessionData = JSON.parse(existingSession)
//           const now = Date.now()
//           isOwner = sessionData.sessionId === sessionId && (now - sessionData.lastActivity < 4 * 60 * 60 * 1000)
//         } catch (e) { /* ignore */ }
//       }
//       if (!isOwner) {
//         alert("This table is currently reserved. Please contact staff for assistance.")
//         return
//       }
//     }

//     setCart((prevCart) => {
//       const existingItem = prevCart.find((item) => item._id === product._id)
//       if (existingItem) {
//         return prevCart.map((item) => (item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item))
//       } else {
//         return [...prevCart, { ...product, quantity: 1 }]
//       }
//     })
//   }

//   const removeFromCart = (productId) => {
//     setCart((prevCart) => {
//       const existingItem = prevCart.find((item) => item._id === productId)
//       if (existingItem && existingItem.quantity > 1) {
//         return prevCart.map((item) => (item._id === productId ? { ...item, quantity: item.quantity - 1 } : item))
//       } else {
//         return prevCart.filter((item) => item._id !== productId)
//       }
//     })
//   }

//   const getCartItemCount = () => {
//     return cart.reduce((total, item) => total + item.quantity, 0)
//   }

//   const getCartTotal = () => {
//     const total = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0)
//     console.log("🔥 TAX REMOVED VERSION - Cart Total (NO TAX/SERVICE):", total)
//     return isNaN(total) ? 0 : total
//   }

//   const getItemQuantityInCart = (productId) => {
//     const item = cart.find((item) => item._id === productId)
//     return item ? item.quantity : 0
//   }

//   // Convert image to base64
//   const getBase64Image = (img) => {
//     const canvas = document.createElement("canvas")
//     canvas.width = img.width
//     canvas.height = img.height
//     const ctx = canvas.getContext("2d")
//     ctx.drawImage(img, 0, 0)
//     return canvas.toDataURL("image/jpeg")
//   }

//   // Professional Invoice Generation (Same as StaffInvoices)
//   const generateInvoicePDF = (orderDetails) => {
//     const printWindow = window.open("", "_blank")

//     // Create image element to get base64
//     const img = new Image()
//     img.crossOrigin = "anonymous"
//     img.onload = () => {
//       let logoBase64 = ""
//       try {
//         logoBase64 = getBase64Image(img)
//       } catch (e) {
//         console.warn("Could not convert logo to base64:", e)
//       }

//       const invoiceHTML = `
//         <!DOCTYPE html>
//         <html>
//         <head>
//           <title>Invoice ${orderDetails.orderId}</title>
//           <style>
//             body { font-family: Arial, sans-serif; margin: 20px; color: #333; line-height: 1.4; }
//             .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ff7e47; padding-bottom: 20px; }
//             .logo { width: 80px; height: 80px; margin: 0 auto 15px; border-radius: 8px; display: block; }
//             .company-name { font-size: 28px; font-weight: bold; color: #ff7e47; margin: 10px 0; }
//             .company-address { font-size: 14px; color: #666; margin: 5px 0; }
//             .invoice-title { font-size: 20px; font-weight: bold; color: #333; margin-top: 15px; }
//             .invoice-details { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
//             .detail-section h3 { color: #333; margin-bottom: 15px; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
//             .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 3px 0; }
//             .detail-label { font-weight: bold; color: #555; }
//             .detail-value { color: #333; }
//             .items-section { margin-bottom: 25px; }
//             .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
//             .items-table th, .items-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
//             .items-table th { background-color: #f8f9fa; font-weight: bold; color: #333; }
//             .items-table tbody tr:nth-child(even) { background-color: #f9f9f9; }
//             .total-section { margin-top: 25px; border-top: 2px solid #ff7e47; padding-top: 15px; }
//             .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 3px 0; }
//             .total-label { font-weight: bold; }
//             .grand-total { font-size: 18px; font-weight: bold; color: #ff7e47; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px; }
//             .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
//             .thank-you { font-size: 16px; color: #ff7e47; font-weight: bold; margin-bottom: 10px; }
//             @media print { 
//               body { margin: 0; } 
//               .no-print { display: none; }
//             }
//           </style>
//         </head>
//         <body>
//           <div class="header">
//             ${logoBase64 ? `<img src="${logoBase64}" alt="Hotel Virat Logo" class="logo">` : ""}
//             <h1 class="company-name">Hotel Virat</h1>
//             <div class="company-address">${orderDetails.branchName}</div>
//             <div class="invoice-title">Invoice</div>
//             <div style="font-size: 14px; color: #666;">Invoice No: ${orderDetails.orderId}</div>
//           </div>
          
//           <div class="invoice-details">
//             <div class="detail-section">
//               <h3>Invoice Details</h3>
//               <div class="detail-row">
//                 <span class="detail-label">Invoice ID:</span>
//                 <span class="detail-value">${orderDetails.orderId}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Order ID:</span>
//                 <span class="detail-value">${orderDetails.orderId}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Date:</span>
//                 <span class="detail-value">${new Date(orderDetails.orderTime).toLocaleDateString("en-IN")}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Time:</span>
//                 <span class="detail-value">${new Date(orderDetails.orderTime).toLocaleTimeString("en-IN", {
//                   hour: "2-digit",
//                   minute: "2-digit",
//                 })}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Table No:</span>
//                 <span class="detail-value">${orderDetails.tableNumber}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Guests:</span>
//                 <span class="detail-value">${orderDetails.peopleCount}</span>
//               </div>
//             </div>
            
//             <div class="detail-section">
//               <h3>Customer & Payment Details</h3>
//               <div class="detail-row">
//                 <span class="detail-label">Customer Name:</span>
//                 <span class="detail-value">${orderDetails.customerName}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Mobile:</span>
//                 <span class="detail-value">${orderDetails.customerMobile}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Branch:</span>
//                 <span class="detail-value">${orderDetails.branchName}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Payment Method:</span>
//                 <span class="detail-value">${orderDetails.paymentMethod.toUpperCase()}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Order Type:</span>
//                 <span class="detail-value">GUEST ORDER</span>
//               </div>
//             </div>
//           </div>

//           <div class="items-section">
//             <h3 style="color: #333; margin-bottom: 15px;">Order Items</h3>
//             <table class="items-table">
//               <thead>
//                 <tr>
//                   <th>Item Name</th>
//                   <th style="text-align: center;">Qty</th>
//                   <th style="text-align: right;">Price</th>
//                   <th style="text-align: right;">Total</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 ${
//                   orderDetails.items
//                     ?.map(
//                       (item) => `
//                   <tr>
//                     <td>${item.name}</td>
//                     <td style="text-align: center;">${item.quantity}</td>
//                     <td style="text-align: right;">₹${(item.price || 0).toFixed(2)}</td>
//                     <td style="text-align: right;">₹${((item.price || 0) * item.quantity).toFixed(2)}</td>
//                   </tr>
//                 `,
//                     )
//                     .join("") || "<tr><td colspan='4' style='text-align: center;'>No items available</td></tr>"
//                 }
//               </tbody>
//             </table>
//           </div>

//           <div class="total-section">
//             <div class="total-row grand-total">
//               <span>Total Amount:</span>
//               <span>₹${(orderDetails.totalAmount || 0).toFixed(2)}</span>
//             </div>
//           </div>

//           ${
//             orderDetails.notes
//               ? `
//             <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
//               <h4 style="margin-bottom: 10px; color: #333;">Notes:</h4>
//               <p style="margin: 0;">${orderDetails.notes}</p>
//             </div>
//           `
//               : ""
//           }

//           <div class="footer">
//             <div class="thank-you">Thank you for dining with us!</div>
//             <p>We hope you enjoyed your meal. Please visit us again soon.</p>
//             <p style="font-size: 12px; margin-top: 15px;">Generated on ${new Date().toLocaleString("en-IN")}</p>
//           </div>
//         </body>
//         </html>
//       `

//       printWindow.document.write(invoiceHTML)
//       printWindow.document.close()
//       printWindow.focus()

//       // Wait a bit for content to load then print
//       setTimeout(() => {
//         printWindow.print()
//       }, 500)
//     }

//     img.onerror = () => {
//       console.warn("Could not load logo image, generating PDF without logo")
//       // Generate PDF without logo (same HTML without logo)
//       const invoiceHTML = `
//         <!DOCTYPE html>
//         <html>
//         <head>
//           <title>Invoice ${orderDetails.orderId}</title>
//           <style>
//             body { font-family: Arial, sans-serif; margin: 20px; color: #333; line-height: 1.4; }
//             .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ff7e47; padding-bottom: 20px; }
//             .company-name { font-size: 28px; font-weight: bold; color: #ff7e47; margin-bottom: 10px; }
//             .company-address { font-size: 14px; color: #666; margin: 5px 0; }
//             .invoice-title { font-size: 20px; font-weight: bold; color: #333; margin-top: 15px; }
//             .invoice-details { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
//             .detail-section h3 { color: #333; margin-bottom: 15px; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
//             .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 3px 0; }
//             .detail-label { font-weight: bold; color: #555; }
//             .detail-value { color: #333; }
//             .items-section { margin-bottom: 25px; }
//             .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
//             .items-table th, .items-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
//             .items-table th { background-color: #f8f9fa; font-weight: bold; color: #333; }
//             .items-table tbody tr:nth-child(even) { background-color: #f9f9f9; }
//             .total-section { margin-top: 25px; border-top: 2px solid #ff7e47; padding-top: 15px; }
//             .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 3px 0; }
//             .total-label { font-weight: bold; }
//             .grand-total { font-size: 18px; font-weight: bold; color: #ff7e47; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px; }
//             .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
//             .thank-you { font-size: 16px; color: #ff7e47; font-weight: bold; margin-bottom: 10px; }
//             @media print { 
//               body { margin: 0; } 
//               .no-print { display: none; }
//             }
//           </style>
//         </head>
//         <body>
//           <div class="header">
//             <h1 class="company-name">Hotel Virat</h1>
//             <div class="company-address">${orderDetails.branchName}</div>
//             <div class="invoice-title">Invoice</div>
//             <div style="font-size: 14px; color: #666;">Invoice No: ${orderDetails.orderId}</div>
//           </div>
          
//           <div class="invoice-details">
//             <div class="detail-section">
//               <h3>Invoice Details</h3>
//               <div class="detail-row">
//                 <span class="detail-label">Invoice ID:</span>
//                 <span class="detail-value">${orderDetails.orderId}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Order ID:</span>
//                 <span class="detail-value">${orderDetails.orderId}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Date:</span>
//                 <span class="detail-value">${new Date(orderDetails.orderTime).toLocaleDateString("en-IN")}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Time:</span>
//                 <span class="detail-value">${new Date(orderDetails.orderTime).toLocaleTimeString("en-IN", {
//                   hour: "2-digit",
//                   minute: "2-digit",
//                 })}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Table No:</span>
//                 <span class="detail-value">${orderDetails.tableNumber}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Guests:</span>
//                 <span class="detail-value">${orderDetails.peopleCount}</span>
//               </div>
//             </div>
            
//             <div class="detail-section">
//               <h3>Customer & Payment Details</h3>
//               <div class="detail-row">
//                 <span class="detail-label">Customer Name:</span>
//                 <span class="detail-value">${orderDetails.customerName}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Mobile:</span>
//                 <span class="detail-value">${orderDetails.customerMobile}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Branch:</span>
//                 <span class="detail-value">${orderDetails.branchName}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Payment Method:</span>
//                 <span class="detail-value">${orderDetails.paymentMethod.toUpperCase()}</span>
//               </div>
//               <div class="detail-row">
//                 <span class="detail-label">Order Type:</span>
//                 <span class="detail-value">GUEST ORDER</span>
//               </div>
//             </div>
//           </div>

//           <div class="items-section">
//             <h3 style="color: #333; margin-bottom: 15px;">Order Items</h3>
//             <table class="items-table">
//               <thead>
//                 <tr>
//                   <th>Item Name</th>
//                   <th style="text-align: center;">Qty</th>
//                   <th style="text-align: right;">Price</th>
//                   <th style="text-align: right;">Total</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 ${
//                   orderDetails.items
//                     ?.map(
//                       (item) => `
//                   <tr>
//                     <td>${item.name}</td>
//                     <td style="text-align: center;">${item.quantity}</td>
//                     <td style="text-align: right;">₹${(item.price || 0).toFixed(2)}</td>
//                     <td style="text-align: right;">₹${((item.price || 0) * item.quantity).toFixed(2)}</td>
//                   </tr>
//                 `,
//                     )
//                     .join("") || "<tr><td colspan='4' style='text-align: center;'>No items available</td></tr>"
//                 }
//               </tbody>
//             </table>
//           </div>

//           <div class="total-section">
//             <div class="total-row grand-total">
//               <span>Total Amount:</span>
//               <span>₹${(orderDetails.totalAmount || 0).toFixed(2)}</span>
//             </div>
//           </div>

//           ${
//             orderDetails.notes
//               ? `
//             <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
//               <h4 style="margin-bottom: 10px; color: #333;">Notes:</h4>
//               <p style="margin: 0;">${orderDetails.notes}</p>
//             </div>
//           `
//               : ""
//           }

//           <div class="footer">
//             <div class="thank-you">Thank you for dining with us!</div>
//             <p>We hope you enjoyed your meal. Please visit us again soon.</p>
//             <p style="font-size: 12px; margin-top: 15px;">Generated on ${new Date().toLocaleString("en-IN")}</p>
//           </div>
//         </body>
//         </html>
//       `

//       printWindow.document.write(invoiceHTML)
//       printWindow.document.close()
//       printWindow.focus()

//       setTimeout(() => {
//         printWindow.print()
//       }, 500)
//     }

//     // Try to load the logo
//     img.src = hotelViratLogo
//   }

//   // Print receipt for thermal printer (80mm width)
//   const printThermalReceipt = (orderDetails) => {
//     const printWindow = window.open("", "_blank", "width=302,height=600")
    
//     const receiptHTML = `
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <title>Order ${orderDetails.orderId}</title>
//         <style>
//           * { margin: 0; padding: 0; box-sizing: border-box; }
//           body { 
//             font-family: 'Courier New', monospace; 
//             width: 80mm; 
//             max-width: 80mm;
//             padding: 5mm;
//             font-size: 12px;
//             line-height: 1.4;
//           }
//           .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
//           .hotel-name { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
//           .branch-name { font-size: 12px; margin-bottom: 3px; }
//           .order-info { margin-bottom: 10px; }
//           .order-id { font-size: 14px; font-weight: bold; text-align: center; margin: 8px 0; }
//           .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
//           .info-label { font-weight: bold; }
//           .divider { border-top: 1px dashed #000; margin: 8px 0; }
//           .items-header { font-weight: bold; margin-bottom: 5px; }
//           .item-row { margin-bottom: 5px; }
//           .item-name { font-weight: bold; }
//           .item-details { display: flex; justify-content: space-between; font-size: 11px; }
//           .totals { margin-top: 10px; }
//           .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
//           .grand-total { font-size: 14px; font-weight: bold; border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px; }
//           .footer { text-align: center; margin-top: 15px; font-size: 11px; border-top: 1px dashed #000; padding-top: 10px; }
//           .thank-you { font-weight: bold; margin-bottom: 5px; }
//           @media print { 
//             body { width: 80mm; }
//             @page { size: 80mm auto; margin: 0; }
//           }
//         </style>
//       </head>
//       <body>
//         <div class="header">
//           <div class="hotel-name">HOTEL VIRAT</div>
//           <div class="branch-name">${orderDetails.branchName || branchName}</div>
//         </div>
        
//         <div class="order-id">Order #${orderDetails.orderId}</div>
        
//         <div class="order-info">
//           <div class="info-row">
//             <span class="info-label">Date:</span>
//             <span>${new Date().toLocaleDateString('en-IN')}</span>
//           </div>
//           <div class="info-row">
//             <span class="info-label">Time:</span>
//             <span>${new Date().toLocaleTimeString('en-IN')}</span>
//           </div>
//           <div class="info-row">
//             <span class="info-label">Table:</span>
//             <span>${orderDetails.tableNumber || tableNumber}</span>
//           </div>
//           <div class="info-row">
//             <span class="info-label">Guests:</span>
//             <span>${orderDetails.peopleCount}</span>
//           </div>
//           <div class="info-row">
//             <span class="info-label">Customer:</span>
//             <span>${orderDetails.customerName}</span>
//           </div>
//           <div class="info-row">
//             <span class="info-label">Mobile:</span>
//             <span>${orderDetails.customerMobile}</span>
//           </div>
//         </div>
        
//         <div class="divider"></div>
        
//         <div class="items-section">
//           <div class="items-header">ITEMS</div>
//           ${orderDetails.items?.map(item => `
//             <div class="item-row">
//               <div class="item-name">${item.name}</div>
//               <div class="item-details">
//                 <span>${item.quantity} x ₹${(item.price || 0).toFixed(2)}</span>
//                 <span>₹${((item.price || 0) * item.quantity).toFixed(2)}</span>
//               </div>
//             </div>
//           `).join('') || '<div>No items</div>'}
//         </div>
        
//         <div class="divider"></div>
        
//         <div class="totals">
//           <div class="total-row grand-total">
//             <span>TOTAL:</span>
//             <span>₹${orderDetails.totalAmount?.toFixed(2) || '0.00'}</span>
//           </div>
//         </div>
        
//         <div class="divider"></div>
        
//         <div class="order-info">
//           <div class="info-row">
//             <span class="info-label">Payment:</span>
//             <span>${orderDetails.paymentMethod?.toUpperCase() || 'CASH'}</span>
//           </div>
//         </div>
        
//         <div class="footer">
//           <div class="thank-you">Thank You!</div>
//           <div>Visit Again</div>
//           <div style="margin-top: 5px; font-size: 10px;">${new Date().toLocaleString('en-IN')}</div>
//         </div>
//       </body>
//       </html>
//     `
    
//     printWindow.document.write(receiptHTML)
//     printWindow.document.close()
//     printWindow.focus()
    
//     setTimeout(() => {
//       printWindow.print()
//     }, 300)
//   }

//   // Order ID is now auto-generated by the backend in format DDMMYYYY-RES-sequence

//   const handlePlaceOrder = async () => {
//     // Check table status before placing order
//     // Allow if table is reserved but current session is the owner (same customer ordering more)
//     if (tableStatus === "reserved") {
//       const sessionKey = `session_${branchId}_${tableNumber}`
//       const existingSession = localStorage.getItem(sessionKey)
//       let isOwner = false
//       if (existingSession) {
//         try {
//           const sessionData = JSON.parse(existingSession)
//           const now = Date.now()
//           isOwner = sessionData.sessionId === sessionId && (now - sessionData.lastActivity < 4 * 60 * 60 * 1000)
//         } catch (e) { /* ignore */ }
//       }
//       if (!isOwner) {
//         alert("This table is currently reserved. Please contact staff for assistance.")
//         return
//       }
//     }

//     if (!customerDetails.name.trim() || !customerDetails.mobile.trim()) {
//       alert("Please fill in your name and mobile number")
//       return
//     }

//     if (customerDetails.mobile.length !== 10) {
//       alert("Please enter a valid 10-digit mobile number")
//       return
//     }

//     if (cart.length === 0) {
//       alert("Your cart is empty")
//       return
//     }

//     setProcessingOrder(true)

//     try {
//       const totalAmount = getCartTotal()

//       // Generate a proper sequential KOT number
//       const now = new Date()
//       const dateKey = `${String(now.getDate()).padStart(2,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getFullYear()).slice(-2)}`
//       const kotCounterKey = `kot-counter-${dateKey}`
//       let kotCounter = parseInt(localStorage.getItem(kotCounterKey) || '0')
//       kotCounter++
//       localStorage.setItem(kotCounterKey, kotCounter.toString())
//       const kotNumber = `KOT-${String(kotCounter).padStart(3, '0')}`

//       const orderData = {
//         // Create as a KOT (counter-order with pending payment)
//         userId: null, // Guest order — no counter user
//         customerName: customerDetails.name.trim(),
//         phoneNumber: customerDetails.mobile.trim(),
//         branchId: branchId,
//         branchName: branchName,
//         categoryId: tableCategoryId || null,
//         categoryName: tableCategoryName || "Restaurant",
//         tableId: tableId || null,
//         tableNumber: tableNumber,
//         kotNumber: kotNumber,
//         kotTime: new Date().toISOString(),
//         serverName: "QR Order", // Identify as QR-based order
//         items: cart.map((item) => ({
//           menuItemId: item._id,
//           name: item.name,
//           price: item.price,
//           quantity: item.quantity,
//         })),
//         subtotal: totalAmount,
//         gstAmount: 0,
//         tax: 0,
//         serviceCharge: 0,
//         totalAmount: totalAmount,
//         grandTotal: totalAmount,
//         paymentMethod: "cash",
//         paymentStatus: "pending", // KOT = pending payment
//         orderStatus: "pending",
//         notes: `Guest order from Table ${tableNumber}${tableCategoryName ? ` - ${tableCategoryName}` : ''} `,
//       }

//       console.log("Placing guest order as KOT:", orderData)

//       // Create as counter-order (KOT) — shows in counter KOT list and kitchen display
//       const response = await api.post("/counter-order/orders-no-stock", orderData)

//       if (response.order || response.success) {
//         const orderResult = response.order || response.data || {}
//         const completedOrder = {
//           ...orderData,
//           _id: orderResult.id || orderResult._id || Date.now().toString(),
//           orderId: orderResult.id || orderResult._id || Date.now().toString(),
//           orderTime: orderResult.createdAt || new Date().toISOString(),
//           createdAt: orderResult.createdAt || new Date().toISOString()
//         }
        
//         console.log("✅ Order placed successfully!")
//         console.log("📋 Order ID:", completedOrder.orderId)
//         console.log("📋 Session ID:", sessionId)

//         // Reserve the table so counter shows it as occupied
//         if (tableId) {
//           try {
//             await api.post(`/table/${tableId}`, { status: "reserved" }).catch(() => {})
//             // Try PUT if POST doesn't work
//             await fetch(`${api.baseURL}/table/${tableId}`, {
//               method: 'PUT',
//               headers: { 'Content-Type': 'application/json' },
//               body: JSON.stringify({ status: 'reserved' })
//             }).catch(() => {})
//             console.log("🪑 Table reserved:", tableNumber)
//           } catch (_) {
//             console.warn("⚠️ Failed to reserve table, continuing anyway")
//           }
//         }
//         console.log("📋 Complete order data:", completedOrder)
        
//         // Store order details for invoice generation
//         setLastOrderDetails(completedOrder)
        
//         // Save to localStorage for order history
//         const storageKey = `orders_${sessionId}`
//         console.log("💾 Saving to localStorage with key:", storageKey)
        
//         // Get existing orders
//         const existingData = localStorage.getItem(storageKey)
//         console.log("📦 Existing localStorage data:", existingData)
        
//         const orders = existingData ? JSON.parse(existingData) : []
//         console.log("📦 Existing orders count:", orders.length)
        
//         // Add new order to beginning
//         orders.unshift(completedOrder)
//         console.log("📦 New orders count:", orders.length)
        
//         // Save back to localStorage
//         const dataToSave = JSON.stringify(orders)
//         localStorage.setItem(storageKey, dataToSave)
//         console.log("✅ Saved to localStorage. Data length:", dataToSave.length)
        
//         // Verify it was saved
//         const verifyData = localStorage.getItem(storageKey)
//         if (verifyData) {
//           const verifyOrders = JSON.parse(verifyData)
//           console.log("✅ VERIFICATION SUCCESS - Orders in storage:", verifyOrders.length)
//           console.log("📋 First order ID:", verifyOrders[0]?.orderId)
//         } else {
//           console.error("❌ VERIFICATION FAILED - Nothing in localStorage!")
//         }
        
//         setOrderPlaced(true)
//         setCart([])
//         setShowCheckout(false)
//         setShowCart(false)

//         // NOTE: customerDetails are deliberately NOT cleared here. They're
//         // captured once on the gate screen before the menu and belong to the
//         // whole table session — the guest is still seated and may order again.
//         // Clearing them would send them back to the details gate after every
//         // order. They're wiped naturally when the 4-hour session expires.

//         // Don't auto-hide - let user manually close or reorder
//       } else {
//         throw new Error(response.message || "Failed to place order")
//       }
//     } catch (error) {
//       console.error("Error placing order:", error)
//       alert("Failed to place order. Please try again.")
//     } finally {
//       setProcessingOrder(false)
//     }
//   }

//   const handleDownloadInvoice = () => {
//     if (lastOrderDetails) {
//       generateInvoicePDF(lastOrderDetails)
//     }
//   }

//   // Fetch order history for THIS table's live bill.
//   //
//   // Reads the same CounterOrder collection the counter POS and member app use
//   // (GET /counter-order/orders), then scopes to this branch + table (+ the
//   // guest's phone when one was provided). This is what makes each KOT (KOT-01
//   // soup, KOT-02 roti…) show while pending, and then roll up into one bill —
//   // with the counter's invoice number and a Completed status — once the
//   // counter settles the table. Previously this read a different collection
//   // (/public-order/session) + localStorage, which never saw the counter's
//   // consolidation, so status never updated. See gotchas #10 (group by
//   // tableNumber + status) and #11 (normalise status).
//   const fetchMyOrders = async () => {
//     if (isFetchingOrdersRef.current) {
//       console.log("⏳ Already fetching orders, skipping...")
//       return
//     }

//     isFetchingOrdersRef.current = true
//     setLoadingOrders(true)

//     const norm = (s) => String(s == null ? "" : s).toLowerCase().trim()
//     const guestPhone = (customerDetails?.mobile || "").trim()

//     try {
//       let all = []
//       try {
//         const response = await api.get(`/counter-order/orders?limit=300`)
//         if (response?.success && Array.isArray(response.orders)) all = response.orders
//         else if (Array.isArray(response?.orders)) all = response.orders
//         else if (Array.isArray(response?.data)) all = response.data
//         else if (Array.isArray(response)) all = response
//       } catch (apiError) {
//         // Offline / server unreachable — fall back to this browser's just-placed
//         // orders so the guest still sees what they ordered this session.
//         console.warn("⚠️ /counter-order/orders unavailable, using localStorage:", apiError.message)
//         const local = sessionId ? localStorage.getItem(`orders_${sessionId}`) : null
//         setMyOrders(local ? JSON.parse(local) : [])
//         return
//       }

//       const scoped = all.filter((o) => {
//         // Same branch
//         const oBranch = typeof o.branch === "object" && o.branch !== null
//           ? (o.branch._id || o.branch.id)
//           : o.branch
//         if (branchId && oBranch && String(oBranch) !== String(branchId)) return false

//         // Same table
//         if (norm(o.tableNumber) !== norm(tableNumber)) return false

//         // Same guest — only when the guest actually entered a real 10-digit
//         // number (walk-ins default to 0000000000, which we don't filter on).
//         if (/^\d{10}$/.test(guestPhone) && o.phoneNumber && o.phoneNumber !== "0000000000") {
//           if (String(o.phoneNumber) !== guestPhone) return false
//         }

//         // Hide the merged originals — they now live inside the comprehensive
//         // bill, so showing them too would duplicate the items.
//         if (norm(o.paymentStatus) === "consolidated") return false

//         // Hide cancelled KOTs
//         if (norm(o.orderStatus) === "cancelled" || norm(o.status) === "cancelled") return false

//         return true
//       })

//       // Newest first
//       scoped.sort(
//         (a, b) =>
//           new Date(b.createdAt || b.orderTime || 0) - new Date(a.createdAt || a.orderTime || 0)
//       )

//       // Split into still-preparing KOTs vs settled bills.
//       const isDoneStatus = (o) => {
//         const s = norm(o.paymentStatus || o.orderStatus || o.status || "pending")
//         return s === "completed" || s === "paid"
//       }
//       const activeKOTs = scoped.filter((o) => !isDoneStatus(o))
//       const doneBills = scoped.filter(isDoneStatus)

//       // The guest should never see raw KOT numbers, and all the KOTs they've
//       // added this visit belong to ONE running order. So merge every active KOT
//       // into a single "Current Order" card with the items combined.
//       const displayList = []
//       if (activeKOTs.length > 0) {
//         const mergedItems = []
//         let grandTotal = 0
//         activeKOTs.forEach((kot) => {
//           grandTotal += Number(kot.grandTotal != null ? kot.grandTotal : (kot.totalAmount || 0))
//           ;(kot.items || []).forEach((it) => {
//             // Combine identical items (same name + price) by summing quantity
//             const existing = mergedItems.find(
//               (m) => m.name === it.name && Number(m.price) === Number(it.price)
//             )
//             if (existing) existing.quantity += it.quantity
//             else mergedItems.push({ ...it })
//           })
//         })
//         displayList.push({
//           _id: "current-order",
//           _isActive: true,
//           items: mergedItems,
//           grandTotal,
//           totalAmount: grandTotal,
//           createdAt: activeKOTs[0].createdAt || activeKOTs[0].orderTime,
//         })
//       }

//       // Settled bills stay as separate cards (each real bill keeps its number)
//       doneBills.forEach((b) => displayList.push(b))

//       setMyOrders(displayList)
//     } catch (error) {
//       console.error("❌ Error fetching orders:", error)
//       setMyOrders([])
//     } finally {
//       setLoadingOrders(false)
//       isFetchingOrdersRef.current = false
//     }
//   }

//   // Derive a friendly label + status for an order card. Pending KOTs show their
//   // KOT number; a settled bill shows the counter's invoice/bill number.
//   const getOrderView = (order) => {
//     const status = String(order.paymentStatus || order.orderStatus || order.status || "pending")
//       .toLowerCase()
//       .trim()
//     const isDone = status === "completed" || status === "paid"
//     // Guests never see KOT numbers. While preparing it's just "Current Order";
//     // once settled it shows the counter's bill number.
//     const label = isDone
//       ? (order.invoiceNumber ? `Bill #${order.invoiceNumber}` : `Order #${formatOrderRef(order)}`)
//       : "Current Order"
//     const amount = Number(order.grandTotal != null ? order.grandTotal : (order.totalAmount || 0))
//     const badge = isDone
//       ? { text: "Completed", bg: "#dcfce7", fg: "#166534" }
//       : { text: "Preparing", bg: "#fef9c3", fg: "#854d0e" }
//     return { status, isDone, label, amount, badge }
//   }



//   // Tracks image URLs that failed to load, so we render a CSS placeholder
//   // instead of retrying. Previously onError swapped src to "/placeholder.svg",
//   // which doesn't exist in public/ — so that 404'd too, fired onError again,
//   // and looped forever, causing the visible flicker.
//   const markImageBroken = (key) => {
//     setBrokenImages((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
//   }

//   // Subcategory chips, built from the loaded products with item counts.
//   // Counts respect the category + search filters that are already applied, but
//   // deliberately ignore the subcategory filter itself — otherwise selecting a
//   // chip would zero out every other chip's count.
//   const subcategoryChips = (() => {
//     const base = products.filter((product) => {
//       if (!product) return false

//       const nameStr = String(product?.name || "")
//       if (/^\d+$/.test(nameStr.trim())) return false // skip numeric-only junk names

//       const matchesCategory =
//         !selectedCategory || selectedCategory === "" || getCategoryId(product) === selectedCategory

//       const term = searchQuery ? String(searchQuery).toLowerCase() : ""
//       const matchesSearch =
//         !searchQuery ||
//         nameStr.toLowerCase().includes(term) ||
//         String(product?.description || "").toLowerCase().includes(term)

//       const matchesFoodType =
//         selectedFoodType === "All" || product?.foodType === selectedFoodType

//       return matchesCategory && matchesSearch && matchesFoodType
//     })

//     const counts = {}
//     base.forEach((product) => {
//       const key = getSubcategoryName(product) || OTHERS_LABEL
//       counts[key] = (counts[key] || 0) + 1
//     })

//     // Nothing worth filtering by if every item landed in "Others"
//     const hasNamed = Object.keys(counts).some((k) => k !== OTHERS_LABEL)
//     if (!hasNamed) return []

//     return [
//       { name: "All", count: base.length },
//       ...sortSubcategories(Object.keys(counts)).map((name) => ({ name, count: counts[name] })),
//     ]
//   })()

//   // Filter products
//   const filteredProducts = products.filter((product) => {
//     try {
//       // First, check if product exists
//       if (!product) {
//         return false
//       }
      
//       // Check if product has a valid name (not just numbers)
//       const productName = product?.name || ''
//       const productNameStr = String(productName)
      
//       // Check if product name is only numbers (like "099", "123", etc.)
//       // This regex checks if the string contains only digits (0-9) and optional whitespace
//       const isOnlyNumbers = /^\d+$/.test(productNameStr.trim())
      
//       // If product name is only numbers, filter it out
//       if (isOnlyNumbers) {
//         return false
//       }
      
//       // Now check category and search filters
//       const matchesCategory = !selectedCategory || selectedCategory === "" || getCategoryId(product) === selectedCategory

//       // Subcategory chip filter — items with no subcategory group under "Others"
//       const matchesSubcategory =
//         selectedSubcategory === "All" ||
//         (getSubcategoryName(product) || OTHERS_LABEL) === selectedSubcategory

//       // Food-type filter (Veg / Non-Veg / Egg)
//       const matchesFoodType =
//         selectedFoodType === "All" || product?.foodType === selectedFoodType

//       const productDescription = product?.description || ''
//       const searchTerm = searchQuery ? String(searchQuery).toLowerCase() : ''
      
//       // Convert to strings to ensure .toLowerCase() works
//       const productNameSafe = String(productNameStr).toLowerCase()
//       const productDescriptionSafe = String(productDescription).toLowerCase()
      
//       const matchesSearch = !searchQuery || 
//         productNameSafe.includes(searchTerm) ||
//         productDescriptionSafe.includes(searchTerm)
      
//       return matchesCategory && matchesSubcategory && matchesFoodType && matchesSearch
//     } catch (error) {
//       console.error('Error filtering product:', error, 'Product:', product)
//       return false
//     }
//   })

//   // Session management state
//   const [sessionId, setSessionId] = useState("")

//   // Guest details are captured up-front (before the menu) and stored on the
//   // existing session object, which already has a 4-hour validity window. That
//   // way a refresh or re-scan mid-meal doesn't re-prompt.
//   // `null` = not yet resolved from storage, so we don't flash the gate before
//   // we know whether details already exist.
//   const [detailsCaptured, setDetailsCaptured] = useState(null)
//   // Set when the guest taps "Edit" from the checkout modal
//   const [editingDetails, setEditingDetails] = useState(false)
//   const [detailsError, setDetailsError] = useState("")

//   // Read previously captured details for this branch+table, if the session is
//   // still valid. Returns null when there's nothing usable.
//   const loadSavedDetails = (branch, table) => {
//     try {
//       const raw = localStorage.getItem(`session_${branch}_${table}`)
//       if (!raw) return null
//       const data = JSON.parse(raw)
//       if (Date.now() - data.lastActivity >= 4 * 60 * 60 * 1000) return null
//       const d = data.customerDetails
//       if (d && d.name && d.mobile) return d
//       return null
//     } catch (e) {
//       return null
//     }
//   }

//   // Persist details onto the session object without disturbing sessionId
//   const saveDetailsToSession = (branch, table, details) => {
//     try {
//       const key = `session_${branch}_${table}`
//       const raw = localStorage.getItem(key)
//       const data = raw ? JSON.parse(raw) : {}
//       data.customerDetails = details
//       data.lastActivity = Date.now()
//       localStorage.setItem(key, JSON.stringify(data))
//     } catch (e) {
//       // Non-fatal: details stay in React state for this page view
//       console.warn("Could not persist customer details:", e?.message)
//     }
//   }

//   // Generate or retrieve session ID
//   const getOrCreateSession = (branch, table) => {
//     const sessionKey = `session_${branch}_${table}`
//     const existingSession = localStorage.getItem(sessionKey)
    
//     if (existingSession) {
//       // Check if session is still valid (within same browsing session)
//       const sessionData = JSON.parse(existingSession)
//       const now = Date.now()
//       // Session expires after 4 hours of inactivity
//       if (now - sessionData.lastActivity < 4 * 60 * 60 * 1000) {
//         // Update last activity
//         sessionData.lastActivity = now
//         localStorage.setItem(sessionKey, JSON.stringify(sessionData))
//         return sessionData.sessionId
//       }
//     }
    
//     // Create new session
//     const newSessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
//     const sessionData = {
//       sessionId: newSessionId,
//       branchId: branch,
//       tableNumber: table,
//       createdAt: Date.now(),
//       lastActivity: Date.now()
//     }
//     localStorage.setItem(sessionKey, JSON.stringify(sessionData))
//     return newSessionId
//   }

//   // Validation shared by the gate and the final place-order check
//   const validateDetails = (d) => {
//     if (!d.name || !d.name.trim()) return "Please enter your full name"
//     if (!/^\d{10}$/.test((d.mobile || "").trim())) return "Please enter a valid 10-digit mobile number"
//     return ""
//   }

//   const handleDetailsSubmit = (e) => {
//     if (e) e.preventDefault()
//     const msg = validateDetails(customerDetails)
//     if (msg) {
//       setDetailsError(msg)
//       return
//     }
//     const cleaned = {
//       name: customerDetails.name.trim(),
//       mobile: customerDetails.mobile.trim(),
//       peopleCount: customerDetails.peopleCount || 1,
//     }
//     setCustomerDetails(cleaned)
//     saveDetailsToSession(branchId, tableNumber, cleaned)
//     setDetailsError("")
//     setEditingDetails(false)
//     setDetailsCaptured(true)
//   }

//   useEffect(() => {
//     const urlParams = new URLSearchParams(window.location.search)
//     const branch = urlParams.get("branch")
//     const name = urlParams.get("name")
//     const table = urlParams.get("table")
//     const categoryFromUrl = urlParams.get("category")
//     const categoryNameFromUrl = urlParams.get("categoryName")

//     if (branch && table) {
//       // Generate or retrieve session ID
//       const currentSessionId = getOrCreateSession(branch, table)
//       setSessionId(currentSessionId)
//       console.log("📱 Session ID:", currentSessionId)
      
//       setBranchId(branch)
//       setBranchName(decodeURIComponent(name || ""))
//       setTableNumber(table)

//       // Restore details from a still-valid session so we don't re-prompt on
//       // refresh; otherwise show the details gate before the menu.
//       const saved = loadSavedDetails(branch, table)
//       if (saved) {
//         setCustomerDetails({
//           name: saved.name || "",
//           mobile: saved.mobile || "",
//           peopleCount: saved.peopleCount || 1,
//         })
//         setDetailsCaptured(true)
//       } else {
//         setDetailsCaptured(false)
//       }

//       // Check table status first, then fetch menu data with category filter
//       checkTableStatus(branch, table).then((result) => {
//         // Handle case where result might be undefined
//         if (!result) {
//           console.warn("⚠️ checkTableStatus returned undefined, using defaults")
//           result = { status: "available", categoryId: null }
//         }
        
//         console.log("Table status:", result.status)
//         // Use category from URL if available, otherwise use category from table data
//         let catId = categoryFromUrl
//         if (!catId && result.categoryId) {
//           catId = typeof result.categoryId === 'object' ? result.categoryId._id : result.categoryId
//         }
        
//         // Set category name from URL if available
//         if (categoryNameFromUrl) {
//           setTableCategoryName(decodeURIComponent(categoryNameFromUrl))
//         }
        
//         fetchMenuData(branch, catId)
//       })
//     } else {
//       setError("Invalid QR code - missing branch or table information")
//       setLoading(false)
//     }
//   }, [])

//   const fetchMenuData = async (branchId, tableCatId = null) => {
//     try {
//       setLoading(true)
//       setError("")
//       // Fetch menu items and categories filtered by branchId from the backend
//       // Add limit parameter to fetch all items (not paginated)
//       const [productsResponse, categoriesResponse] = await Promise.all([
//         api.get(`/menu?branchId=${branchId}&limit=1000`), 
//         api.get(`/category?branchId=${branchId}`)
//       ])

//       // Handle different API response formats
//       let productsData = []
//       let categoriesData = []

//       // Extract products from response
//       if (Array.isArray(productsResponse)) {
//         productsData = productsResponse
//       } else if (productsResponse?.success && Array.isArray(productsResponse.data)) {
//         productsData = productsResponse.data
//       } else if (productsResponse?.data && Array.isArray(productsResponse.data)) {
//         productsData = productsResponse.data
//       } else {
//         console.error("❌ Invalid products data format:", productsResponse)
//         setError("Failed to load menu items. Please contact staff.")
//         return
//       }

//       // Extract categories from response
//       if (Array.isArray(categoriesResponse)) {
//         categoriesData = categoriesResponse
//       } else if (categoriesResponse?.success && Array.isArray(categoriesResponse.data)) {
//         categoriesData = categoriesResponse.data
//       } else if (categoriesResponse?.data && Array.isArray(categoriesResponse.data)) {
//         categoriesData = categoriesResponse.data
//       } else {
//         console.warn("⚠️ Invalid categories data format:", categoriesResponse)
//         categoriesData = []
//       }

//       // Helper function to extract price from product
//       const getProductPrice = (product) => {
//         // If product has direct price field, use it
//         if (product.price && typeof product.price === 'number') {
//           return product.price
//         }
//         // If product has prices object, get the first price
//         if (product.prices && typeof product.prices === 'object') {
//           const priceValues = Object.values(product.prices)
//           if (priceValues.length > 0) {
//             const firstPrice = parseFloat(priceValues[0])
//             if (!isNaN(firstPrice)) return firstPrice
//           }
//         }
//         return 0
//       }

//       // Helper function to clean item names (remove number prefix)
//       const cleanItemName = (name) => {
//         if (!name) return name
//         // Remove patterns like "001 ", "005 ", "102 " etc. from the start
//         return name.replace(/^\d+\s+/, '').trim()
//       }

//       // Process all menu items (no filtering by isActive)
//       let branchProducts = productsData
//         .map(product => ({
//           ...product,
//           name: cleanItemName(product.name || product.itemName), // Clean the name, fallback to itemName
//           price: getProductPrice(product)
//         }))

//       console.log("✅ Total products (no filtering):", branchProducts.length)

//       // Store original count before category filtering
//       const totalProductsBeforeFilter = branchProducts.length

//       // If table has a category, filter products to show only that category
//       if (tableCatId) {
//         console.log("🔍 Filtering products by table category:", tableCatId)
//         console.log("📦 Total products before category filter:", branchProducts.length)
        
//         branchProducts = branchProducts.filter(product => {
//           const productCatId = typeof product.categoryId === "object" && product.categoryId !== null
//             ? product.categoryId._id || product.categoryId.id
//             : product.categoryId
          
//           const matches = productCatId === tableCatId
//           if (!matches) {
//             console.log("⏭️ Product filtered out:", product?.name || 'Unknown', "- Category:", productCatId, "!==", tableCatId)
//           }
//           return matches
//         })
        
//         console.log("✅ Products after category filter:", branchProducts.length)
        
//         // Set the category name for display
//         if (Array.isArray(categoriesData)) {
//           const tableCat = categoriesData.find(cat => cat._id === tableCatId)
//           if (tableCat) {
//             setTableCategoryName(tableCat.name)
//             console.log("📂 Category name set to:", tableCat.name)
//           }
//         }

//         // If no products match the category, show helpful error
//         if (branchProducts.length === 0 && totalProductsBeforeFilter > 0) {
//           console.warn("⚠️ No products match table category. Total products available:", totalProductsBeforeFilter)
//           setError(`No menu items found for this table's category. ${totalProductsBeforeFilter} items are available in other categories. Please contact staff.`)
//         }
//       }

//       const usedCategoryIds = [
//         ...new Set(
//           branchProducts
//             .map((product) => {
//               if (typeof product.categoryId === "object" && product.categoryId !== null) {
//                 return product.categoryId._id || product.categoryId.id
//               }
//               return product.categoryId
//             })
//             .filter(Boolean),
//         ),
//       ]

//       // Show ALL branch categories (like the counter POS) rather than only the
//       // ones the loaded products happen to reference. usedCategoryIds is kept
//       // for the empty-state messaging below.
//       void usedCategoryIds
//       const branchCategories = Array.isArray(categoriesData) ? categoriesData : []

//       setProducts(branchProducts)
//       setCategories(branchCategories)

//       if (branchProducts.length === 0 && !error) {
//         if (tableCatId) {
//           setError("No menu items found for this table's category. Please contact staff for assistance.")
//         } else {
//           setError("No menu items available for this branch. Please contact staff.")
//         }
//       }
//     } catch (error) {
//       console.error("❌ Error fetching menu:", error)
//       console.error("Error details:", error.message, error.stack)
//       setError(`Failed to load menu: ${error.message}. Please try again or contact staff.`)
//     } finally {
//       setLoading(false)
//     }
//   }

//   if (loading) {
//     return (
//       <>
//         <div className="loading-screen">
//           <div className="loading-content">
//             <div className="spinner"></div>
//             <p>Loading menu...</p>
//           </div>
//         </div>
//         <style jsx>{`
//           .loading-screen {
//             height: 100vh;
//             display: flex;
//             align-items: center;
//             justify-content: center;
//             background: #f9fafb;
//           }
//           .loading-content {
//             text-align: center;
//           }
//           .spinner {
//             width: 40px;
//             height: 40px;
//             border: 3px solid #f97316;
//             border-top: 3px solid transparent;
//             border-radius: 50%;
//             animation: spin 1s linear infinite;
//             margin: 0 auto 16px;
//           }
//           @keyframes spin {
//             0% { transform: rotate(0deg); }
//             100% { transform: rotate(360deg); }
//           }
//         `}</style>
//       </>
//     )
//   }

//   if (error) {
//     return (
//       <>
//         <div className="error-screen">
//           <div className="error-content">
//             <QrCode size={48} style={{ marginBottom: "16px", opacity: 0.5 }} />
//             <h3>Oops! Something went wrong</h3>
//             <p>{error}</p>
//             <button onClick={() => fetchMenuData(branchId, tableCategoryId)} className="retry-btn">
//               Try Again
//             </button>
//           </div>
//         </div>
//         <style jsx>{`
//           .error-screen {
//             height: 100vh;
//             display: flex;
//             align-items: center;
//             justify-content: center;
//             background: #f9fafb;
//             padding: 20px;
//           }
//           .error-content {
//             text-align: center;
//             background: white;
//             padding: 40px;
//             border-radius: 12px;
//             box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
//             max-width: 400px;
//             width: 100%;
//           }
//           .retry-btn {
//             background: #f97316;
//             color: white;
//             border: none;
//             padding: 12px 24px;
//             border-radius: 8px;
//             cursor: pointer;
//             margin-top: 16px;
//             font-size: 14px;
//             font-weight: 500;
//           }
//           .retry-btn:hover {
//             background: #ea580c;
//           }
//         `}</style>
//       </>
//     )
//   }
//   const isSessionOwner = (() => {
//     if (!sessionId) return false
//     const sessionKey = `session_${branchId}_${tableNumber}`
//     const existingSession = localStorage.getItem(sessionKey)
//     if (existingSession) {
//       try {
//         const sessionData = JSON.parse(existingSession)
//         const now = Date.now()
//         // Session is valid if within 4 hours
//         return sessionData.sessionId === sessionId && (now - sessionData.lastActivity < 4 * 60 * 60 * 1000)
//       } catch (e) {
//         return false
//       }
//     }
//     return false
//   })()

//   if (tableStatus === "reserved" && !isSessionOwner) {
//     return (
//       <>
//         <div className="reserved-screen">
//           <div className="reserved-content">
//             <AlertCircle size={64} color="#f59e0b" style={{ marginBottom: "24px" }} />
//             <h2>Table Currently Reserved</h2>
//             <p>
//               Table {tableNumber} at {branchName} is currently reserved.
//             </p>
//             <p>Please contact our staff for assistance or try scanning a different table's QR code.</p>
//             <div className="contact-info">
//               <p>
//                 <strong>Need Help?</strong>
//               </p>
//               <p>Please approach our staff members who will be happy to assist you with seating and ordering.</p>
//             </div>
//           </div>
//         </div>
//         <style jsx>{`
//           .reserved-screen {
//             height: 100vh;
//             display: flex;
//             align-items: center;
//             justify-content: center;
//             background: #f9fafb;
//             padding: 20px;
//           }
//           .reserved-content {
//             text-align: center;
//             background: white;
//             padding: 40px;
//             border-radius: 12px;
//             box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
//             max-width: 500px;
//             width: 100%;
//             border: 2px solid #f59e0b;
//           }
//           .reserved-content h2 {
//             color: #f59e0b;
//             margin-bottom: 16px;
//             font-size: 24px;
//           }
//           .reserved-content p {
//             color: #666;
//             margin-bottom: 12px;
//             line-height: 1.5;
//           }
//           .contact-info {
//             margin-top: 24px;
//             padding: 20px;
//             background: #fef3c7;
//             border-radius: 8px;
//             border: 1px solid #f59e0b;
//           }
//           .contact-info p {
//             margin-bottom: 8px;
//           }
//           .contact-info p:last-child {
//             margin-bottom: 0;
//           }
//         `}</style>
//       </>
//     )
//   }
//   if (detailsCaptured === null) {
//     return null
//   }

//   if (!detailsCaptured || editingDetails) {
//     return (
//       <>
//         <div className="details-gate">
//           <div className="details-card">
//             <img src={hotelViratLogo} alt="Jagali Koota" className="details-logo" />
//             <h2 className="details-title">Welcome to {branchName || "Jagali Koota"}</h2>
//             <div className="details-table-chip">
//               <QrCode size={16} />
//               <span>Table {tableNumber}</span>
//             </div>
//             <p className="details-sub">
//               Please share a few details before you view the menu.
//             </p>

//             <form onSubmit={handleDetailsSubmit}>
//               <div className="details-field">
//                 <label>
//                   <User size={16} /> Full Name <span className="req">*</span>
//                 </label>
//                 <input
//                   type="text"
//                   value={customerDetails.name}
//                   onChange={(e) => {
//                     setCustomerDetails({ ...customerDetails, name: e.target.value })
//                     if (detailsError) setDetailsError("")
//                   }}
//                   placeholder="Enter your full name"
//                   autoComplete="name"
//                   autoFocus
//                 />
//               </div>

//               <div className="details-field">
//                 <label>
//                   <Phone size={16} /> Mobile Number <span className="req">*</span>
//                 </label>
//                 <input
//                   type="tel"
//                   inputMode="numeric"
//                   value={customerDetails.mobile}
//                   onChange={(e) => {
//                     // digits only, capped at 10 — mirrors the old checkout field
//                     const digits = e.target.value.replace(/\D/g, "").slice(0, 10)
//                     setCustomerDetails({ ...customerDetails, mobile: digits })
//                     if (detailsError) setDetailsError("")
//                   }}
//                   placeholder="Enter 10-digit mobile number"
//                   maxLength="10"
//                   autoComplete="tel"
//                 />
//               </div>

//               <div className="details-field">
//                 <label>
//                   <Users size={16} /> Number of People
//                 </label>
//                 <select
//                   value={customerDetails.peopleCount}
//                   onChange={(e) =>
//                     setCustomerDetails({ ...customerDetails, peopleCount: Number(e.target.value) })
//                   }
//                 >
//                   {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
//                     <option key={num} value={num}>
//                       {num} {num === 1 ? "Person" : "People"}
//                     </option>
//                   ))}
//                 </select>
//               </div>

//               {detailsError && (
//                 <div className="details-error">
//                   <AlertCircle size={15} />
//                   <span>{detailsError}</span>
//                 </div>
//               )}

//               <button
//                 type="submit"
//                 className="details-submit"
//                 disabled={!customerDetails.name.trim() || customerDetails.mobile.length !== 10}
//               >
//                 View Menu
//               </button>

//               {editingDetails && (
//                 <button
//                   type="button"
//                   className="details-cancel"
//                   onClick={() => {
//                     setEditingDetails(false)
//                     setDetailsError("")
//                   }}
//                 >
//                   Cancel
//                 </button>
//               )}
//             </form>
//           </div>
//         </div>

//         <style jsx>{`
//           .details-gate {
//             min-height: 100vh;
//             display: flex;
//             align-items: center;
//             justify-content: center;
//             background: #f9fafb;
//             padding: 20px;
//           }
//           .details-card {
//             width: 100%;
//             max-width: 420px;
//             background: #fff;
//             border-radius: 16px;
//             padding: 28px 24px 24px;
//             box-shadow: 0 10px 30px rgba(0, 0, 0, 0.08);
//             text-align: center;
//           }
//           .details-logo {
//             width: 68px;
//             height: 68px;
//             object-fit: contain;
//             border-radius: 12px;
//             margin-bottom: 14px;
//           }
//           .details-title {
//             font-size: 20px;
//             font-weight: 700;
//             color: #1f2937;
//             margin-bottom: 10px;
//           }
//           .details-table-chip {
//             display: inline-flex;
//             align-items: center;
//             gap: 6px;
//             background: #fff5f4;
//             color: #6B2219;
//             border: 1px solid #f0dcd7;
//             border-radius: 20px;
//             padding: 5px 14px;
//             font-size: 13px;
//             font-weight: 700;
//             margin-bottom: 12px;
//           }
//           .details-sub {
//             font-size: 13px;
//             color: #6b7280;
//             margin-bottom: 22px;
//             line-height: 1.5;
//           }
//           .details-field {
//             text-align: left;
//             margin-bottom: 16px;
//           }
//           .details-field label {
//             display: flex;
//             align-items: center;
//             gap: 7px;
//             font-size: 12px;
//             font-weight: 700;
//             color: #4b5563;
//             text-transform: uppercase;
//             letter-spacing: 0.4px;
//             margin-bottom: 7px;
//           }
//           .details-field .req {
//             color: #dc2626;
//           }
//           .details-field input,
//           .details-field select {
//             width: 100%;
//             padding: 13px 14px;
//             border: 1.5px solid #e5e7eb;
//             border-radius: 10px;
//             font-size: 15px;
//             color: #1f2937;
//             background: #fff;
//             outline: none;
//             transition: border-color 0.15s ease;
//           }
//           .details-field input:focus,
//           .details-field select:focus {
//             border-color: #6B2219;
//           }
//           .details-error {
//             display: flex;
//             align-items: center;
//             gap: 7px;
//             background: #fef2f2;
//             border: 1px solid #fecaca;
//             color: #b91c1c;
//             font-size: 13px;
//             padding: 10px 12px;
//             border-radius: 8px;
//             margin-bottom: 14px;
//             text-align: left;
//           }
//           .details-submit {
//             width: 100%;
//             padding: 15px;
//             border: none;
//             border-radius: 10px;
//             background: #6B2219;
//             color: #fff;
//             font-size: 16px;
//             font-weight: 700;
//             cursor: pointer;
//             margin-top: 4px;
//             transition: opacity 0.15s ease;
//           }
//           .details-submit:disabled {
//             opacity: 0.45;
//             cursor: not-allowed;
//           }
//           .details-cancel {
//             width: 100%;
//             padding: 12px;
//             border: none;
//             background: transparent;
//             color: #6b7280;
//             font-size: 14px;
//             font-weight: 600;
//             cursor: pointer;
//             margin-top: 8px;
//           }
//         `}</style>
//       </>
//     )
//   }

//   return (
//     <>
//       <div className="menu-app">
//         {/* Success Message */}
//         {orderPlaced && (
//           <div className="success-overlay">
//             <div className="success-message">
//               <Check size={48} color="#10b981" />
//               <h3>Order Placed Successfully!</h3>
//               <p style={{ color: '#6b7280', marginTop: '12px', fontSize: '14px' }}>
//                 Your order has been received. Our staff will prepare it shortly.
//               </p>
//               <button
//                 className="close-success-btn"
//                 onClick={() => {
//                   setOrderPlaced(false)
//                   setLastOrderDetails(null)
//                 }}
//               >
//                 Close
//               </button>
//             </div>
//           </div>
//         )}

//         {/* Fixed Header */}
//         <header className="header">
//           <div className="header-container">
//             {/* Search Section */}
//             <div className="search-section">
//               <div className="search-box">
//                 <Search size={18} className="search-icon" />
//                 <input
//                   type="text"
//                   placeholder="Search menu..."
//                   value={searchQuery}
//                   onChange={(e) => setSearchQuery(e.target.value)}
//                   onKeyDown={(e) => {
//                     // Prevent form submission when Enter is pressed
//                     if (e.key === 'Enter') {
//                       e.preventDefault()
//                     }
//                   }}
//                   onTouchStart={(e) => {
//                     // Prevent any parent touch events from interfering
//                     e.stopPropagation()
//                   }}
//                   onTouchMove={(e) => {
//                     // Prevent scrolling while interacting with input on mobile
//                     e.stopPropagation()
//                   }}
//                   className="search-input"
//                   // Mobile-specific attributes
//                   inputMode="search"
//                   enterKeyHint="search"
//                   autoComplete="off"
//                   autoCorrect="off"
//                   spellCheck="false"
//                 />
//               </div>
//             </div>
//           </div>
//         </header>

//         {/* Floating Cart Button - show for available OR for session owner on reserved table */}
//         {cart.length > 0 && (tableStatus === "available" || (tableStatus === "reserved" && isSessionOwner)) && (
//           <button className="floating-cart" onClick={() => setShowCart(true)}>
//             <ShoppingCart size={24} />
//             <span className="cart-count">{getCartItemCount()}</span>
//           </button>
//         )}

//         {/* Floating My Orders Button - show when customer has a session */}
//         {sessionId && (
//           <button className="floating-my-orders" onClick={() => setShowMyOrders(true)}>
//             <History size={20} />
//             <span>My Orders</span>
//           </button>
//         )}

//         {/* Scrollable Content */}
//         <main className="main-content">
//           <div className="content-container">
//             {/* Table Info Banner */}
//             <div className="table-info-banner">
//               <div className="table-info-content">
//                 <QrCode size={24} color="#ff7e47" />
//                 <div className="table-info-text">
//                   <h3 className="table-info-title">Table {tableNumber}</h3>
//                   <p className="table-info-subtitle">
//                     {branchName}
//                     {tableStatus && (
//                       <span className={`status-badge ${tableStatus}`}>
//                         {tableStatus === "available" ? "Available" : "Reserved"}
//                       </span>
//                     )}
//                   </p>
//                 </div>
//               </div>
//             </div>

//             {/* Food-type chips — Veg / Non-Veg / Egg */}
//             <div className="subcat-row" style={{ marginBottom: "8px" }}>
//               {FOOD_TYPES.map((ft) => {
//                 const active = selectedFoodType === ft.value
//                 return (
//                   <button
//                     key={ft.value}
//                     type="button"
//                     className="subcat-chip"
//                     onClick={() => setSelectedFoodType(ft.value)}
//                     style={{
//                       display: "inline-flex",
//                       alignItems: "center",
//                       gap: "6px",
//                       border: `1px solid ${ft.color}`,
//                       background: active ? ft.color : "white",
//                       color: active ? "white" : ft.color,
//                     }}
//                   >
//                     {ft.value !== "All" && (
//                       <span
//                         style={{
//                           width: "10px",
//                           height: "10px",
//                           borderRadius: "2px",
//                           border: `2px solid ${active ? "white" : ft.color}`,
//                           display: "inline-block",
//                         }}
//                       />
//                     )}
//                     <span className="subcat-chip-label">{ft.label}</span>
//                   </button>
//                 )
//               })}
//             </div>

//             {/* Category chips (cuisines) — only when more than one is available */}
//             {categories.length > 1 && (
//               <div className="subcat-row" style={{ marginBottom: "8px" }}>
//                 <button
//                   type="button"
//                   className={`subcat-chip ${selectedCategory === "" ? "active" : ""}`}
//                   onClick={() => { setSelectedCategory(""); setSelectedSubcategory("All") }}
//                 >
//                   <span className="subcat-chip-label">All</span>
//                 </button>
//                 {categories.map((cat) => (
//                   <button
//                     key={cat._id}
//                     type="button"
//                     className={`subcat-chip ${selectedCategory === cat._id ? "active" : ""}`}
//                     onClick={() => { setSelectedCategory(cat._id); setSelectedSubcategory("All") }}
//                   >
//                     <span className="subcat-chip-label">{cat.name}</span>
//                   </button>
//                 ))}
//               </div>
//             )}

//             {/* Subcategory chips — mirrors the Member App's menu filter */}
//             {subcategoryChips.length > 1 && (
//               <div className="subcat-row">
//                 {subcategoryChips.map((sub) => (
//                   <button
//                     key={sub.name}
//                     type="button"
//                     className={`subcat-chip ${selectedSubcategory === sub.name ? "active" : ""}`}
//                     onClick={() => setSelectedSubcategory(sub.name)}
//                   >
//                     <span className="subcat-chip-label">{sub.name}</span>
//                     <span className="subcat-chip-count">{sub.count}</span>
//                   </button>
//                 ))}
//               </div>
//             )}

//             {/* Results Info */}
//             <div className="results-info">
//               <p>
//                 {filteredProducts.length} item{filteredProducts.length !== 1 ? "s" : ""} found
//                 {selectedFoodType !== "All" && ` · ${FOOD_TYPES.find((f) => f.value === selectedFoodType)?.label}`}
//                 {selectedSubcategory !== "All" && ` in ${selectedSubcategory}`}
//                 {searchQuery && ` for "${searchQuery}"`}
//               </p>
//             </div>

//             {/* Menu Items Grid */}
//             {filteredProducts.length > 0 ? (
//               <div className="menu-grid">
//                 {filteredProducts.map((product) => (
//                   <div key={product._id} className="menu-card">
//                     <div className="card-image">
//                       {/* Render a CSS placeholder when there's no image, or when
//                           the image failed once. No src swapping — that's what
//                           caused the endless 404 -> onError -> 404 flicker. */}
//                       {product.image && !brokenImages[product._id] ? (
//                         <img
//                           src={product.image}
//                           alt={product?.name || 'Menu item'}
//                           loading="lazy"
//                           onError={() => markImageBroken(product._id)}
//                         />
//                       ) : (
//                         <div className="card-image-fallback" aria-hidden="true" />
//                       )}
//                     </div>
//                     <div className="card-content">
//                       <div className="card-header">
//                         <h3 className="product-name">{product?.name || 'Unnamed Item'}</h3>
//                         <span className="product-price">₹{(product.price || 0).toFixed(2)}</span>
//                       </div>
//                       {product?.description && <p className="product-description">{product.description}</p>}

//                       {/* Add to Cart Controls - Show if table is available OR session owner */}
//                       {(tableStatus === "available" || (tableStatus === "reserved" && isSessionOwner)) && (
//                         <div className="cart-controls">
//                           {getItemQuantityInCart(product._id) === 0 ? (
//                             <button className="add-to-cart-btn" onClick={() => addToCart(product)}>
//                               <Plus size={16} />
//                               Add to Cart
//                             </button>
//                           ) : (
//                             <div className="quantity-controls">
//                               <button className="quantity-btn" onClick={() => removeFromCart(product._id)}>
//                                 <Minus size={16} />
//                               </button>
//                               <span className="quantity">{getItemQuantityInCart(product._id)}</span>
//                               <button className="quantity-btn" onClick={() => addToCart(product)}>
//                                 <Plus size={16} />
//                               </button>
//                             </div>
//                           )}
//                         </div>
//                       )}

//                       {/* Show message if table is reserved and NOT the session owner */}
//                       {tableStatus === "reserved" && !isSessionOwner && (
//                         <div className="reserved-message">
//                           <AlertCircle size={16} />
//                           <span>Table Reserved - Contact Staff</span>
//                         </div>
//                       )}
//                     </div>
//                   </div>
//                 ))}
//               </div>
//             ) : (
//               <div className="empty-state">
//                 <QrCode size={48} style={{ opacity: 0.3, marginBottom: "16px" }} />
//                 <h3>No items found</h3>
//                 <p>
//                   {searchQuery || selectedCategory
//                     ? "Try adjusting your search or filter criteria"
//                     : "No menu items available for this branch"}
//                 </p>
//                 {(searchQuery || selectedCategory) && (
//                   <button
//                     onClick={() => {
//                       setSearchQuery("")
//                       setSelectedCategory("")
//                     }}
//                     className="clear-filters"
//                   >
//                     Clear Filters
//                   </button>
//                 )}
//               </div>
//             )}

//             {/* Footer */}
//            {/*  <footer className="footer">
//               <p>Powered by QR Menu System</p>
//               <p className="footer-sub">
//                 Table {tableNumber} • {branchName} • {filteredProducts.length} items available
//                 {tableStatus && ` • Status: ${tableStatus}`}
//               </p>
//             </footer> */}
//           </div>
//         </main>

//         {/* Cart Modal - Show if table is available OR session owner */}
//         {showCart && (tableStatus === "available" || (tableStatus === "reserved" && isSessionOwner)) && (
//           <div className="modal-overlay">
//             <div className="cart-modal">
//               <div className="cart-header">
//                 <h3>Your Order</h3>
//                 <button className="close-btn" onClick={() => setShowCart(false)}>
//                   <X size={24} />
//                 </button>
//               </div>

//               <div className="cart-content">
//                 {cart.length === 0 ? (
//                   <div className="empty-cart">
//                     <ShoppingCart size={48} style={{ opacity: 0.3 }} />
//                     <p>Your cart is empty</p>
//                   </div>
//                 ) : (
//                   <>
//                     <div className="cart-items">
//                       {cart.map((item) => (
//                         <div key={item._id} className="cart-item">
//                           {item.image && !brokenImages[item._id] ? (
//                             <img
//                               src={item.image}
//                               alt={item.name}
//                               className="cart-item-image"
//                               loading="lazy"
//                               onError={() => markImageBroken(item._id)}
//                             />
//                           ) : (
//                             <div className="cart-item-image cart-item-image-fallback" aria-hidden="true" />
//                           )}
//                           <div className="cart-item-details">
//                             <h4>{item.name}</h4>
//                             <p>₹{(item.price || 0).toFixed(2)} each</p>
//                           </div>
//                           <div className="cart-item-controls">
//                             <button onClick={() => removeFromCart(item._id)}>
//                               <Minus size={16} />
//                             </button>
//                             <span>{item.quantity}</span>
//                             <button onClick={() => addToCart(item)}>
//                               <Plus size={16} />
//                             </button>
//                           </div>
//                           <div className="cart-item-total">₹{((item.price || 0) * item.quantity).toFixed(2)}</div>
//                         </div>
//                       ))}
//                     </div>

//                     <div className="cart-summary">
//                       <div className="summary-row total">
//                         <span>Total:</span>
//                         <span>₹{getCartTotal().toFixed(2)}</span>
//                       </div>
//                     </div>
//                   </>
//                 )}
//               </div>

//               {cart.length > 0 && (
//                 <div className="cart-footer">
//                   <button
//                     className="clear-cart-btn"
//                     onClick={() => {
//                       if (window.confirm('Are you sure you want to clear all items from cart?')) {
//                         setCart([])
//                         setShowCart(false)
//                       }
//                     }}
//                     style={{
//                       background: '#ef4444',
//                       color: 'white',
//                       border: 'none',
//                       padding: '12px 20px',
//                       borderRadius: '8px',
//                       cursor: 'pointer',
//                       fontSize: '14px',
//                       fontWeight: '600',
//                       marginBottom: '8px',
//                       width: '100%',
//                       display: 'flex',
//                       alignItems: 'center',
//                       justifyContent: 'center',
//                       gap: '8px'
//                     }}
//                   >
//                     <X size={16} />
//                     Clear Cart
//                   </button>
//                   <button
//                     className="checkout-btn"
//                     onClick={() => {
//                       setShowCart(false)
//                       setShowCheckout(true)
//                     }}
//                   >
//                     Proceed to Checkout
//                   </button>
//                 </div>
//               )}
//             </div>
//           </div>
//         )}

//         {/* Checkout Modal - Show if table is available OR session owner */}
//         {showCheckout && (tableStatus === "available" || (tableStatus === "reserved" && isSessionOwner)) && (
//           <div className="modal-overlay">
//             <div className="checkout-modal">
//               <div className="checkout-header">
//                 <h3>Order Details</h3>
//                 <button className="close-btn" onClick={() => setShowCheckout(false)}>
//                   <X size={24} />
//                 </button>
//               </div>

//               <div className="checkout-content">
//                 {/* Details were captured on the gate screen before the menu.
//                     Shown read-only here for confirmation, with Edit to correct
//                     a typo (reopens the same gate form). */}
//                 <div className="customer-details">
//                   <div className="cust-recap-head">
//                     <h4>Customer Information</h4>
//                     <button
//                       type="button"
//                       className="cust-edit-btn"
//                       onClick={() => {
//                         setShowCheckout(false)
//                         setEditingDetails(true)
//                       }}
//                     >
//                       Edit
//                     </button>
//                   </div>
//                   <div className="cust-recap">
//                     <div className="cust-recap-row">
//                       <span className="cust-recap-label">
//                         <User size={15} /> Name
//                       </span>
//                       <span className="cust-recap-value">{customerDetails.name || "—"}</span>
//                     </div>
//                     <div className="cust-recap-row">
//                       <span className="cust-recap-label">
//                         <Phone size={15} /> Mobile
//                       </span>
//                       <span className="cust-recap-value">{customerDetails.mobile || "—"}</span>
//                     </div>
//                     <div className="cust-recap-row">
//                       <span className="cust-recap-label">
//                         <Users size={15} /> People
//                       </span>
//                       <span className="cust-recap-value">{customerDetails.peopleCount || 1}</span>
//                     </div>
//                   </div>
//                 </div>

//                 <div className="order-summary">
//                   <h4>Order Summary</h4>
//                   <div className="summary-items">
//                     {cart.map((item) => (
//                       <div key={item._id} className="summary-item">
//                         <span>
//                           {item.name} x {item.quantity}
//                         </span>
//                         <span>₹{((item.price || 0) * item.quantity).toFixed(2)}</span>
//                       </div>
//                     ))}
//                   </div>
//                   <div className="summary-totals">
//                     <div className="summary-row total">
//                       <span>Total Amount:</span>
//                       <span>₹{getCartTotal().toFixed(2)}</span>
//                     </div>
//                   </div>
//                 </div>

//                 <div className="payment-info">
//                   <div className="payment-method">
//                     <CreditCard size={16} />
//                     <span>Payment: Cash (Pay at table)</span>
//                   </div>
//                 </div>
//               </div>

//               <div className="checkout-footer">
//                 <button
//                   className="place-order-btn"
//                   onClick={handlePlaceOrder}
//                   disabled={processingOrder || !customerDetails.name.trim() || !customerDetails.mobile.trim()}
//                 >
//                   {processingOrder ? "Placing Order..." : "Place Order"}
//                 </button>
//               </div>
//             </div>
//           </div>
//         )}

//         {/* My Orders Modal */}
//         {showMyOrders && (
//           <div className="modal-overlay" onClick={(e) => {
//             // Only close if clicking the overlay itself (not the modal content)
//             if (e.target === e.currentTarget) {
//               setShowMyOrders(false)
//             }
//           }}>
//             <div className="my-orders-modal" onClick={(e) => e.stopPropagation()}>
//               <div className="cart-header">
//                 <h3>My Orders</h3>
//                 <button className="close-btn" onClick={() => setShowMyOrders(false)}>
//                   <X size={24} />
//                 </button>
//               </div>

//               <div className="cart-content">
//                 {loadingOrders ? (
//                   <div className="loading-orders">
//                     <RefreshCw size={32} className="spin-icon" />
//                     <p>Loading your orders...</p>
//                   </div>
//                 ) : myOrders.length === 0 ? (
//                   <div className="empty-cart">
//                     <History size={48} style={{ opacity: 0.3 }} />
//                     <p>No orders yet</p>
//                     <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: '8px' }}>
//                       Place your first order to see it here
//                     </p>
//                     {/* <div style={{ marginTop: '20px', padding: '16px', background: '#fef3c7', borderRadius: '8px', fontSize: '13px', textAlign: 'left', border: '1px solid #fbbf24' }}>
//                       <p style={{ fontWeight: 'bold', marginBottom: '8px', color: '#92400e' }}>🔍 Debug Information:</p>
//                       <p style={{ marginBottom: '4px', color: '#78350f' }}><strong>Session ID:</strong> {sessionId || '❌ Not set'}</p>
//                       <p style={{ marginBottom: '4px', color: '#78350f' }}><strong>Storage Key:</strong> orders_{sessionId}</p>
//                       <p style={{ marginBottom: '12px', color: '#78350f' }}><strong>Branch:</strong> {branchName}</p>
//                       <button 
//                         onClick={() => {
//                           console.log("=== MANUAL DEBUG CHECK ===")
//                           console.log("Session ID:", sessionId)
//                           const key = `orders_${sessionId}`
//                           console.log("Storage key:", key)
//                           const stored = localStorage.getItem(key)
//                           console.log("Raw data:", stored)
//                           if (stored) {
//                             try {
//                               const parsed = JSON.parse(stored)
//                               console.log("Parsed orders:", parsed)
//                               alert(`Found ${parsed.length} orders in localStorage!\n\nFirst order: ${parsed[0]?.orderId || 'N/A'}`)
//                             } catch (e) {
//                               alert(`Error parsing data: ${e.message}`)
//                             }
//                           } else {
//                             alert('No data found in localStorage for this session')
//                           }
                          
//                           // Check all localStorage keys
//                           console.log("All localStorage keys:", Object.keys(localStorage))
//                           const allOrderKeys = Object.keys(localStorage).filter(k => k.startsWith('orders_'))
//                           console.log("All order keys:", allOrderKeys)
//                           if (allOrderKeys.length > 0) {
//                             alert(`Found ${allOrderKeys.length} order keys in localStorage:\n${allOrderKeys.join('\n')}`)
//                           }
//                         }}
//                         style={{ 
//                           marginTop: '8px', 
//                           padding: '8px 16px', 
//                           background: '#f59e0b', 
//                           color: 'white', 
//                           border: 'none', 
//                           borderRadius: '6px', 
//                           cursor: 'pointer',
//                           fontWeight: '600',
//                           fontSize: '13px',
//                           width: '100%'
//                         }}
//                       >
//                         🔍 Check localStorage
//                       </button>
//                       <button 
//                         onClick={() => {
//                           fetchMyOrders()
//                         }}
//                         style={{ 
//                           marginTop: '8px', 
//                           padding: '8px 16px', 
//                           background: '#10b981', 
//                           color: 'white', 
//                           border: 'none', 
//                           borderRadius: '6px', 
//                           cursor: 'pointer',
//                           fontWeight: '600',
//                           fontSize: '13px',
//                           width: '100%'
//                         }}
//                       >
//                         🔄 Refresh Orders
//                       </button>
//                     </div> */}
//                   </div>
//                 ) : (
//                   <div className="orders-list">
//                     {myOrders.map((order) => {
//                       const view = getOrderView(order)
//                       return (
//                       <div key={order._id || order.orderId} className="order-card">
//                         <div className="order-header">
//                           <div>
//                             <h4 className="order-id">
//                               {view.label}
//                               <span
//                                 style={{
//                                   marginLeft: '8px',
//                                   fontSize: '11px',
//                                   fontWeight: 700,
//                                   padding: '2px 8px',
//                                   borderRadius: '999px',
//                                   background: view.badge.bg,
//                                   color: view.badge.fg,
//                                   verticalAlign: 'middle',
//                                 }}
//                               >
//                                 {view.badge.text}
//                               </span>
//                             </h4>
//                             <p className="order-time">
//                               <Clock size={14} />
//                               {new Date(order.orderTime || order.createdAt).toLocaleString('en-IN', {
//                                 day: '2-digit',
//                                 month: 'short',
//                                 hour: '2-digit',
//                                 minute: '2-digit'
//                               })}
//                             </p>
//                           </div>
//                           <div className="order-total">₹{view.amount.toFixed(2)}</div>
//                         </div>
                        
//                         <div className="order-items">
//                           {order.items?.map((item, idx) => (
//                             <div key={idx} className="order-item-row">
//                               <span>{item.name} x {item.quantity}</span>
//                               <span>₹{((item.price || 0) * item.quantity).toFixed(2)}</span>
//                             </div>
//                           ))}
//                         </div>


//                       </div>
//                       )
//                     })}
//                   </div>
//                 )}
//               </div>
//             </div>
//           </div>
//         )}
//       </div>

//       <style jsx global>{`
//         /* Inline SVG (utensils glyph) used by the image-fallback tiles.
//            Embedded as a data URI so there is no file to 404 — the missing
//            /placeholder.svg is exactly what caused the old flicker loop. */
//         :root {
//           --food-icon: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 2v7a3 3 0 0 0 3 3v10'/%3E%3Cpath d='M6 2v7'/%3E%3Cpath d='M9 2v7a3 3 0 0 1-3 3'/%3E%3Cpath d='M17 2c-1.7 0-3 1.8-3 4s1.3 4 3 4 3-1.8 3-4-1.3-4-3-4z'/%3E%3Cpath d='M17 10v12'/%3E%3C/svg%3E");
//         }

//         * {
//           margin: 0;
//           padding: 0;
//           box-sizing: border-box;
//         }

//         html,
//         body {
//           height: 100%;
//           font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
//           background: #f9fafb;
//           overflow-x: hidden;
//         }

//         .menu-app {
//           display: flex;
//           flex-direction: column;
//           height: 100vh;
//           position: relative;
//         }

//         /* Success Overlay */
//         .success-overlay {
//           position: fixed !important;
//           top: 0 !important;
//           left: 0 !important;
//           right: 0 !important;
//           bottom: 0 !important;
//           width: 100% !important;
//           height: 100% !important;
//           background: rgba(0, 0, 0, 0.8) !important;
//           display: flex !important;
//           align-items: center !important;
//           justify-content: center !important;
//           z-index: 9999 !important;
//           padding: 20px !important;
//           box-sizing: border-box !important;
//           overflow: auto !important;
//         }

//         .success-message {
//           position: relative !important;
//           background: white !important;
//           padding: 40px 30px !important;
//           border-radius: 16px !important;
//           text-align: center !important;
//           width: 100% !important;
//           max-width: 400px !important;
//           min-width: 280px !important;
//           margin: auto !important;
//           box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25) !important;
//           border: 2px solid #10b981 !important;
//           transform: scale(1) !important;
//           animation: successSlideIn 0.3s ease-out !important;
//           display: flex !important;
//           flex-direction: column !important;
//           align-items: center !important;
//         }

//         @keyframes successSlideIn {
//           0% {
//             opacity: 0;
//             transform: scale(0.9) translateY(-20px);
//           }
//           100% {
//             opacity: 1;
//             transform: scale(1) translateY(0);
//           }
//         }

//         .success-message h3 {
//           color: #10b981 !important;
//           margin: 16px 0 24px 0 !important;
//           font-size: 22px !important;
//           font-weight: 700 !important;
//           width: 100% !important;
//         }

//         .success-message p {
//           color: #666 !important;
//           line-height: 1.5 !important;
//           margin-bottom: 20px !important;
//           font-size: 16px !important;
//         }

//         .invoice-section {
//           margin: 0 0 24px 0 !important;
//           padding: 20px !important;
//           background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%) !important;
//           border-radius: 12px !important;
//           border: 1px solid #e9ecef !important;
//           width: 100% !important;
//         }

//         .invoice-text {
//           color: #495057 !important;
//           font-size: 14px !important;
//           margin-bottom: 16px !important;
//           font-weight: 500 !important;
//           text-align: center !important;
//         }

//         .invoice-buttons {
//           display: flex !important;
//           flex-direction: column !important;
//           gap: 12px !important;
//           width: 100% !important;
//         }

//         .download-invoice-btn {
//           display: flex !important;
//           align-items: center !important;
//           justify-content: center !important;
//           gap: 8px !important;
//           width: 100% !important;
//           padding: 14px 20px !important;
//           background: linear-gradient(135deg, #f97316 0%, #ea580c 100%) !important;
//           color: white !important;
//           border: none !important;
//           border-radius: 10px !important;
//           font-size: 15px !important;
//           font-weight: 600 !important;
//           cursor: pointer !important;
//           transition: all 0.2s ease !important;
//           box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3) !important;
//         }

//         .download-invoice-btn:hover {
//           background: linear-gradient(135deg, #ea580c 0%, #dc2626 100%) !important;
//           transform: translateY(-1px) !important;
//           box-shadow: 0 6px 16px rgba(249, 115, 22, 0.4) !important;
//         }

//         .close-success-btn {
//           margin-top: 0 !important;
//           padding: 14px 32px !important;
//           background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%) !important;
//           color: white !important;
//           border: none !important;
//           border-radius: 10px !important;
//           cursor: pointer !important;
//           font-size: 15px !important;
//           font-weight: 600 !important;
//           transition: all 0.2s ease !important;
//           width: 100% !important;
//           max-width: 180px !important;
//           text-align: center !important;
//           display: flex !important;
//           align-items: center !important;
//           justify-content: center !important;
//         }

//         .close-success-btn:hover {
//           background: linear-gradient(135deg, #4b5563 0%, #374151 100%) !important;
//           transform: translateY(-1px) !important;
//         }

//         /* Mobile Responsive for Success Message */
//         @media (max-width: 640px) {
//           .success-overlay {
//             padding: 20px !important;
//             align-items: center !important;
//             justify-content: center !important;
//           }
          
//           .success-message {
//             padding: 30px 20px !important;
//             max-width: calc(100vw - 40px) !important;
//             min-width: unset !important;
//             width: auto !important;
//             margin: auto !important;
//           }
          
//           .success-message h3 {
//             font-size: 20px !important;
//             margin: 12px 0 16px 0 !important;
//           }
          
//           .success-message p {
//             font-size: 14px !important;
//             margin-bottom: 20px !important;
//           }

//           .close-success-btn {
//             padding: 12px 24px !important;
//             font-size: 14px !important;
//             max-width: 100% !important;
//           }
//             padding: 16px !important;
//           }

//           .close-success-btn {
//             max-width: 100% !important;
//           }
//         }

//         /* Tablet Responsive for Success Message */
//         @media (min-width: 641px) and (max-width: 1024px) {
//           .success-message {
//             max-width: 400px !important;
//             padding: 35px !important;
//           }
//         }

//         /* Header - Fixed */
//         .header {
//           background: white;
//           border-bottom: 1px solid #e5e7eb;
//           box-shadow: 0 2px 4px rgba(0, 0, 0, 0.06);
//           flex-shrink: 0;
//           z-index: 10;
//           position: sticky;
//           top: 0;
//         }

//         .header-container {
//           max-width: 1200px;
//           margin: 0 auto;
//           padding: 12px 16px;
//         }

//         .search-section {
//           display: flex;
//           gap: 12px;
//           width: 100%;
//           align-items: center;
//         }

//         .search-box {
//           position: relative;
//           flex: 1;
//         }

//         .search-icon {
//           position: absolute;
//           left: 10px;
//           top: 50%;
//           transform: translateY(-50%);
//           color: #9ca3af;
//           pointer-events: none;
//           z-index: 1;
//         }

//         .search-input {
//           width: 100%;
//           padding: 10px 10px 10px 36px;
//           border: 1px solid #d1d5db;
//           border-radius: 8px;
//           font-size: 14px;
//           outline: none;
//           background: #f9fafb;
//           transition: all 0.2s ease;
//           box-sizing: border-box;
//         }

//         .search-input:focus {
//           border-color: #f97316;
//           background: white;
//           box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
//         }

//         /* Mobile-specific search improvements */
//         @media (max-width: 640px) {
//           .search-input {
//             font-size: 16px; /* Prevents iOS zoom on focus */
//             -webkit-appearance: none;
//             -moz-appearance: none;
//             appearance: none;
//             touch-action: manipulation;
//           }
          
//           .search-section {
//             gap: 8px;
//           }
//         }

//         /* Floating Cart Button */
//         .floating-cart {
//           position: fixed;
//           bottom: 20px;
//           right: 20px;
//           width: 60px;
//           height: 60px;
//           background: #f97316;
//           color: white;
//           border: none;
//           border-radius: 50%;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           box-shadow: 0 4px 12px rgba(249, 115, 22, 0.3);
//           cursor: pointer;
//           z-index: 100;
//           transition: transform 0.2s ease;
//         }

//         .floating-cart:hover {
//           transform: scale(1.1);
//         }

//         .cart-count {
//           position: absolute;
//           top: -5px;
//           right: -5px;
//           background: #dc2626;
//           color: white;
//           border-radius: 50%;
//           width: 24px;
//           height: 24px;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           font-size: 12px;
//           font-weight: bold;
//         }

//         /* Floating My Orders Button */
//         .floating-my-orders {
//           position: fixed;
//           bottom: 20px;
//           left: 20px;
//           height: 44px;
//           padding: 0 16px;
//           background: #1f2937;
//           color: white;
//           border: none;
//           border-radius: 22px;
//           display: flex;
//           align-items: center;
//           gap: 8px;
//           box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
//           cursor: pointer;
//           z-index: 100;
//           transition: transform 0.2s ease;
//           font-size: 14px;
//           font-weight: 500;
//         }

//         .floating-my-orders:hover {
//           transform: scale(1.05);
//         }

//         /* Main Content - Scrollable */
//         .main-content {
//           flex: 1;
//           overflow-y: auto;
//           -webkit-overflow-scrolling: touch;
//         }

//         .content-container {
//           max-width: 1200px;
//           margin: 0 auto;
//           padding: 20px;
//         }

//         /* Table Info Banner */
//         .table-info-banner {
//           background: rgba(255, 126, 71, 0.1);
//           border: 1px solid rgba(255, 126, 71, 0.2);
//           border-radius: 12px;
//           padding: 16px 20px;
//           margin-bottom: 24px;
//         }

//         .table-info-content {
//           display: flex;
//           align-items: center;
//           gap: 12px;
//         }

//         .table-info-text {
//           display: flex;
//           flex-direction: column;
//         }

//         .table-info-title {
//           font-size: 18px;
//           font-weight: 600;
//           color: #ff7e47;
//           margin: 0;
//         }

//         .table-info-subtitle {
//           font-size: 14px;
//           color: #666;
//           margin: 0;
//         }

//         .results-info {
//           text-align: center;
//           margin-bottom: 30px;
//           color: #6b7280;
//           font-size: 14px;
//           font-weight: 500;
//         }

//         /* Menu Grid */
//         .menu-grid {
//           display: grid;
//           grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
//           gap: 20px;
//           margin-bottom: 40px;
//         }

//         .menu-card {
//           background: white;
//           border-radius: 12px;
//           overflow: hidden;
//           box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
//           transition: transform 0.2s ease, box-shadow 0.2s ease;
//         }

//         .menu-card:hover {
//           transform: translateY(-2px);
//           box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
//         }

//         .card-image {
//           width: 100%;
//           height: 140px;
//           overflow: hidden;
//         }

//         .card-image img {
//           width: 100%;
//           height: 100%;
//           object-fit: contain;
//           transition: transform 0.3s ease;
//         }

//         .menu-card:hover .card-image img {
//           transform: scale(1.05);
//         }

//         /* Fallback shown when a menu item has no image, or its image 404s.
//            Pure CSS — no network request, so it cannot fail or flicker. */
//         .card-image-fallback {
//           width: 100%;
//           height: 100%;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           background: linear-gradient(135deg, #f5efec 0%, #e8dcd7 100%);
//         }

//         .card-image-fallback::after {
//           content: "";
//           width: 34px;
//           height: 34px;
//           opacity: 0.45;
//           background-color: #b08d80;
//           -webkit-mask: var(--food-icon) center / contain no-repeat;
//           mask: var(--food-icon) center / contain no-repeat;
//         }

//         /* Subcategory filter chips */
//         .subcat-row {
//           display: flex;
//           gap: 8px;
//           overflow-x: auto;
//           padding: 4px 0 10px;
//           margin-bottom: 4px;
//           -webkit-overflow-scrolling: touch;
//           scrollbar-width: none;
//         }

//         .subcat-row::-webkit-scrollbar {
//           display: none;
//         }

//         .subcat-chip {
//           flex: 0 0 auto;
//           display: inline-flex;
//           align-items: center;
//           gap: 6px;
//           height: 34px;
//           padding: 0 14px;
//           border-radius: 17px;
//           border: 1px solid #e5ddd9;
//           background: #fff;
//           color: #6b5b53;
//           font-size: 13px;
//           font-weight: 600;
//           cursor: pointer;
//           white-space: nowrap;
//           transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
//         }

//         .subcat-chip:hover {
//           border-color: #d3bdb4;
//         }

//         .subcat-chip.active {
//           background: #6B2219;
//           border-color: #6B2219;
//           color: #fff;
//         }

//         .subcat-chip-count {
//           font-size: 11px;
//           font-weight: 700;
//           opacity: 0.75;
//         }

//         .card-content {
//           padding: 12px;
//         }

//         .card-header {
//           display: flex;
//           justify-content: space-between;
//           align-items: flex-start;
//           margin-bottom: 8px;
//           gap: 10px;
//         }

//         .product-name {
//           font-size: 14px;
//           font-weight: 600;
//           color: #111827;
//           flex: 1;
//           line-height: 1.3;
//         }

//         .product-price {
//           font-size: 14px;
//           font-weight: 700;
//           color: #f97316;
//           flex-shrink: 0;
//         }

//         .category-tag {
//           display: inline-block;
//           background: rgba(249, 115, 22, 0.1);
//           color: #f97316;
//           font-size: 11px;
//           padding: 4px 8px;
//           border-radius: 12px;
//           font-weight: 500;
//           margin-bottom: 8px;
//         }

//         .product-description {
//           font-size: 12px;
//           color: #6b7280;
//           line-height: 1.4;
//           display: -webkit-box;
//           -webkit-line-clamp: 2;
//           -webkit-box-orient: vertical;
//           overflow: hidden;
//           margin-bottom: 10px;
//         }

//         /* Cart Controls */
//         .cart-controls {
//           margin-top: 10px;
//         }

//         .add-to-cart-btn {
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           gap: 6px;
//           width: 100%;
//           padding: 8px;
//           background: #f97316;
//           color: white;
//           border: none;
//           border-radius: 8px;
//           font-size: 13px;
//           font-weight: 500;
//           cursor: pointer;
//           transition: background 0.2s ease;
//         }

//         .add-to-cart-btn:hover {
//           background: #ea580c;
//         }

//         .quantity-controls {
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           gap: 12px;
//         }

//         .quantity-btn {
//           width: 32px;
//           height: 32px;
//           border: 1px solid #d1d5db;
//           background: white;
//           border-radius: 6px;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           cursor: pointer;
//           transition: all 0.2s ease;
//         }

//         .quantity-btn:hover {
//           background: #f97316;
//           color: white;
//           border-color: #f97316;
//         }

//         .quantity {
//           font-weight: 600;
//           font-size: 16px;
//           min-width: 30px;
//           text-align: center;
//         }

//         /* NEW: Reserved message styling */
//         .reserved-message {
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           gap: 8px;
//           margin-top: 12px;
//           padding: 10px;
//           background: rgba(245, 158, 11, 0.1);
//           color: #f59e0b;
//           border-radius: 8px;
//           font-size: 14px;
//           font-weight: 500;
//         }

//         /* Modal Styles */
//         .modal-overlay {
//           position: fixed;
//           top: 0;
//           left: 0;
//           right: 0;
//           bottom: 0;
//           width: 100%;
//           height: 100%;
//           background: rgba(0, 0, 0, 0.5);
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           z-index: 1000;
//           padding: 20px;
//           box-sizing: border-box;
//           overflow: auto;
//         }

//         .cart-modal, .checkout-modal {
//           background: white;
//           border-radius: 12px;
//           max-width: 500px;
//           width: 100%;
//           max-height: 90vh;
//           display: flex;
//           flex-direction: column;
//           margin: auto;
//           position: relative;
//         }

//         .cart-header, .checkout-header {
//           display: flex;
//           justify-content: space-between;
//           align-items: center;
//           padding: 20px;
//           border-bottom: 1px solid #e5e7eb;
//         }

//         .cart-header h3, .checkout-header h3 {
//           font-size: 20px;
//           font-weight: 600;
//           color: #111827;
//         }

//         .close-btn {
//           background: none;
//           border: none;
//           cursor: pointer;
//           color: #6b7280;
//           padding: 4px;
//         }

//         .close-btn:hover {
//           color: #111827;
//         }

//         .cart-content, .checkout-content {
//           flex: 1;
//           overflow-y: auto;
//           padding: 20px;
//         }

//         .empty-cart {
//           text-align: center;
//           padding: 40px 20px;
//           color: #6b7280;
//         }

//         .cart-items {
//           margin-bottom: 20px;
//         }

//         .cart-item {
//           display: flex;
//           align-items: center;
//           gap: 12px;
//           padding: 12px 0;
//           border-bottom: 1px solid #f3f4f6;
//         }

//         .cart-item:last-child {
//           border-bottom: none;
//         }

//         .cart-item-image {
//           width: 50px;
//           height: 50px;
//           object-fit: cover;
//           border-radius: 6px;
//         }

//         .cart-item-image-fallback {
//           flex: 0 0 auto;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           background: linear-gradient(135deg, #f5efec 0%, #e8dcd7 100%);
//         }

//         .cart-item-image-fallback::after {
//           content: "";
//           width: 20px;
//           height: 20px;
//           opacity: 0.45;
//           background-color: #b08d80;
//           -webkit-mask: var(--food-icon) center / contain no-repeat;
//           mask: var(--food-icon) center / contain no-repeat;
//         }

//         /* Read-only customer recap in the checkout modal */
//         .cust-recap-head {
//           display: flex;
//           align-items: center;
//           justify-content: space-between;
//           gap: 10px;
//         }

//         .cust-edit-btn {
//           background: transparent;
//           border: 1px solid #e5ddd9;
//           color: #6B2219;
//           font-size: 12px;
//           font-weight: 700;
//           padding: 5px 12px;
//           border-radius: 14px;
//           cursor: pointer;
//         }

//         .cust-edit-btn:hover {
//           background: #fff5f4;
//         }

//         .cust-recap {
//           background: #f9fafb;
//           border: 1px solid #eef0f2;
//           border-radius: 10px;
//           padding: 4px 12px;
//           margin-top: 10px;
//         }

//         .cust-recap-row {
//           display: flex;
//           align-items: center;
//           justify-content: space-between;
//           gap: 12px;
//           padding: 10px 0;
//           border-bottom: 1px solid #eef0f2;
//         }

//         .cust-recap-row:last-child {
//           border-bottom: none;
//         }

//         .cust-recap-label {
//           display: inline-flex;
//           align-items: center;
//           gap: 7px;
//           font-size: 13px;
//           color: #6b7280;
//         }

//         .cust-recap-value {
//           font-size: 14px;
//           font-weight: 700;
//           color: #1f2937;
//           text-align: right;
//           word-break: break-word;
//         }

//         .cart-item-details {
//           flex: 1;
//         }

//         .cart-item-details h4 {
//           font-size: 14px;
//           font-weight: 600;
//           color: #111827;
//           margin-bottom: 4px;
//         }

//         .cart-item-details p {
//           font-size: 12px;
//           color: #6b7280;
//         }

//         .cart-item-controls {
//           display: flex;
//           align-items: center;
//           gap: 8px;
//         }

//         .cart-item-controls button {
//           width: 28px;
//           height: 28px;
//           border: 1px solid #d1d5db;
//           background: white;
//           border-radius: 4px;
//           display: flex;
//           align-items: center;
//           justify-content: center;
//           cursor: pointer;
//         }

//         .cart-item-controls button:hover {
//           background: #f97316;
//           color: white;
//           border-color: #f97316;
//         }

//         .cart-item-controls span {
//           font-weight: 600;
//           min-width: 20px;
//           text-align: center;
//         }

//         .cart-item-total {
//           font-weight: 600;
//           color: #f97316;
//           min-width: 60px;
//           text-align: right;
//         }

//         .cart-summary, .summary-totals {
//           border-top: 1px solid #e5e7eb;
//           padding-top: 16px;
//         }

//         .summary-row {
//           display: flex;
//           justify-content: space-between;
//           margin-bottom: 8px;
//           font-size: 14px;
//         }

//         .summary-row.total {
//           font-weight: 700;
//           font-size: 16px;
//           color: #111827;
//           border-top: 1px solid #e5e7eb;
//           padding-top: 8px;
//           margin-top: 8px;
//         }

//         .cart-footer, .checkout-footer {
//           padding: 20px;
//           border-top: 1px solid #e5e7eb;
//         }

//         .checkout-btn, .place-order-btn {
//           width: 100%;
//           padding: 14px;
//           background: #f97316;
//           color: white;
//           border: none;
//           border-radius: 8px;
//           font-size: 16px;
//           font-weight: 600;
//           cursor: pointer;
//           transition: background 0.2s ease;
//         }

//         .checkout-btn:hover, .place-order-btn:hover {
//           background: #ea580c;
//         }

//         .clear-cart-btn:hover {
//           background: #dc2626 !important;
//         }

//         .place-order-btn:disabled {
//           background: #d1d5db;
//           cursor: not-allowed;
//         }

//         /* My Orders Modal Styles */
//         .my-orders-modal {
//           background: white;
//           border-radius: 12px;
//           max-width: 600px;
//           width: 100%;
//           max-height: 90vh;
//           display: flex;
//           flex-direction: column;
//           margin: auto;
//         }

//         .loading-orders {
//           text-align: center;
//           padding: 60px 20px;
//           color: #6b7280;
//         }

//         .spin-icon {
//           animation: spin 1s linear infinite;
//           margin-bottom: 16px;
//         }

//         @keyframes spin {
//           from { transform: rotate(0deg); }
//           to { transform: rotate(360deg); }
//         }

//         .orders-list {
//           display: flex;
//           flex-direction: column;
//           gap: 16px;
//         }

//         .order-card {
//           background: #f9fafb;
//           border: 1px solid #e5e7eb;
//           border-radius: 12px;
//           padding: 16px;
//         }

//         .order-header {
//           display: flex;
//           justify-content: space-between;
//           align-items: flex-start;
//           margin-bottom: 12px;
//           padding-bottom: 12px;
//           border-bottom: 1px solid #e5e7eb;
//         }

//         .order-id {
//           font-size: 16px;
//           font-weight: 600;
//           color: #111827;
//           margin-bottom: 4px;
//         }

//         .order-time {
//           display: flex;
//           align-items: center;
//           gap: 4px;
//           font-size: 12px;
//           color: #6b7280;
//         }

//         .order-total {
//           font-size: 18px;
//           font-weight: 700;
//           color: #f97316;
//         }

//         .order-items {
//           margin-bottom: 12px;
//         }

//         .order-item-row {
//           display: flex;
//           justify-content: space-between;
//           padding: 6px 0;
//           font-size: 14px;
//           color: #4b5563;
//         }



//         /* Checkout Specific Styles */
//         .customer-details, .order-summary, .payment-info {
//           margin-bottom: 24px;
//         }

//         .customer-details h4, .order-summary h4 {
//           font-size: 16px;
//           font-weight: 600;
//           color: #111827;
//           margin-bottom: 16px;
//         }

//         .form-group {
//           margin-bottom: 16px;
//         }

//         .form-group label {
//           display: flex;
//           align-items: center;
//           gap: 8px;
//           font-size: 14px;
//           font-weight: 500;
//           color: #374151;
//           margin-bottom: 6px;
//         }

//         .form-group input, .form-group select {
//           width: 100%;
//           padding: 10px 12px;
//           border: 1px solid #d1d5db;
//           border-radius: 6px;
//           font-size: 14px;
//           outline: none;
//         }

//         .form-group input:focus, .form-group select:focus {
//           border-color: #f97316;
//           box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
//         }

//         .summary-items {
//           margin-bottom: 16px;
//         }

//         .summary-item {
//           display: flex;
//           justify-content: space-between;
//           margin-bottom: 8px;
//           font-size: 14px;
//         }

//         .payment-method {
//           display: flex;
//           align-items: center;
//           gap: 8px;
//           padding: 12px;
//           background: #f3f4f6;
//           border-radius: 6px;
//           font-size: 14px;
//           color: #374151;
//         }

//         /* Empty State */
//         .empty-state {
//           text-align: center;
//           padding: 60px 20px;
//           color: #6b7280;
//         }

//         .empty-state h3 {
//           color: #111827;
//           margin-bottom: 8px;
//           font-size: 18px;
//         }

//         .empty-state p {
//           margin-bottom: 20px;
//         }

//         .clear-filters {
//           background: #f97316;
//           color: white;
//           border: none;
//           padding: 10px 20px;
//           border-radius: 6px;
//           cursor: pointer;
//           font-size: 14px;
//           font-weight: 500;
//         }

//         .clear-filters:hover {
//           background: #ea580c;
//         }

//         /* Footer */
//        .footer {
//   padding: 16px;
//   background-color: #f8f8f8; /* Light background for contrast */
//   text-align: center;
//   border-top: 1px solid #ddd; /* Optional: visual separation */
//   width: 100%;
//   box-sizing: border-box;
//   position: relative; /* Ensure footer respects parent container */
//   z-index: 10; /* Ensure footer is above most elements but below modals */
// }

// .footer-sub {
//   font-size: 0.875rem; /* Smaller font size for mobile */
//   color: #666;
//   margin-top: 8px;
// }

// /* Ensure the parent container has enough padding to keep footer visible */
// .scrollable-content { /* Adjust class name based on your actual container */
//   padding-bottom: 80px; /* Enough space for footer and floating button */
//   min-height: 100vh; /* Ensure content takes full viewport height */
//   box-sizing: border-box;
// }

//         /* Mobile Responsive */
//         @media (max-width: 640px) {
//           .content-container {
//             padding: 16px;
//           }

//           .menu-grid {
//             grid-template-columns: 1fr;
//             gap: 16px;
//           }

//           .card-header {
//             flex-direction: column;
//             align-items: flex-start;
//             gap: 4px;
//           }

//           .floating-cart {
//             bottom: 80px;
//           }

//           .floating-my-orders {
//             bottom: 80px;
//           }

//           .modal-overlay {
//             padding: 15px;
//             align-items: center;
//             justify-content: center;
//           }

//           .cart-modal, .checkout-modal {
//             margin: auto;
//             max-height: calc(100vh - 30px);
//             max-width: calc(100vw - 30px);
//             width: 100%;
//           }

//           .success-message {
//             margin: auto;
//             padding: 30px 20px;
//           }
//         }

//         /* Tablet and Desktop */
//         @media (min-width: 641px) {
//           .header-container {
//             padding: 16px 20px;
//           }
//         }

//         /* Tablet */
//         @media (min-width: 641px) and (max-width: 1024px) {
//           .menu-grid {
//             grid-template-columns: repeat(2, 1fr);
//           }
//         }

//         /* Large Desktop */
//         @media (min-width: 1200px) {
//           .menu-grid {
//             grid-template-columns: repeat(4, 1fr);
//           }
//         }

//         /* Custom Scrollbar */
//         .main-content::-webkit-scrollbar, .cart-content::-webkit-scrollbar, .checkout-content::-webkit-scrollbar {
//           width: 8px;
//         }

//         .main-content::-webkit-scrollbar-track, .cart-content::-webkit-scrollbar-track, .checkout-content::-webkit-scrollbar-track {
//           background: #f1f5f9;
//         }

//         .main-content::-webkit-scrollbar-thumb, .cart-content::-webkit-scrollbar-thumb, .checkout-content::-webkit-scrollbar-thumb {
//           background: #cbd5e1;
//           border-radius: 4px;
//         }

//         .main-content::-webkit-scrollbar-thumb:hover, .cart-content::-webkit-scrollbar-thumb:hover, .checkout-content::-webkit-scrollbar-thumb:hover {
//           background: #94a3b8;
//         }
//       `}</style>
//     </>
//   )
// }
// export default PublicMenu 
 
 
import { useState, useEffect, useRef } from "react"
import {
  Search,
  QrCode,
  Plus,
  Minus,
  ShoppingCart,
  X,
  User,
  Phone,
  Users,
  CreditCard,
  Check,
  Download,
  AlertCircle,
  Printer,
  History,
  RefreshCw,
  Clock,
  ArrowRight,
  UtensilsCrossed,
  BadgeCheck,
  ChefHat,
  Trash2,
} from "lucide-react"
import hotelViratLogo from "../assets/logo4.jpeg"

// ── Subcategory ordering ─────────────────────────────────────────────────────
// Menu items carry a subcategory from the admin panel. This lays the filter
// chips out in natural menu order (starters → mains → dessert) rather than
// whatever order the API returns. Kept in sync with the Member App's
// MenuScreen.js so both surfaces read the same way.
// Anything not listed still appears, appended alphabetically.
const SUBCATEGORY_ORDER = [
  "Soup",
  "Salad",
  "Appetizers",
  "International Small Plates",
  "Bao & Dim Sum",
  "Sushi",
  "Tandoor",
  "Pan-Asian",
  "North Indian",
  "South Indian",
  "Nati Style",
  "Pasta",
  "International Big Plates",
  "Staples",
  "Dessert",
]

const OTHERS_LABEL = "Others"

const sortSubcategories = (names) => {
  const known = []
  const unknown = []

  names.forEach((name) => {
    if (name === OTHERS_LABEL) return // always pinned last
    if (SUBCATEGORY_ORDER.includes(name)) known.push(name)
    else unknown.push(name)
  })

  known.sort((a, b) => SUBCATEGORY_ORDER.indexOf(a) - SUBCATEGORY_ORDER.indexOf(b))
  unknown.sort((a, b) => a.localeCompare(b))

  const result = [...known, ...unknown]
  if (names.includes(OTHERS_LABEL)) result.push(OTHERS_LABEL)
  return result
}

// subcategoryId comes back populated as { _id, name }; fall back to a plain
// string for older/unpopulated response shapes.
const getSubcategoryName = (product) => {
  const raw =
    product?.subcategoryId && typeof product.subcategoryId === "object"
      ? product.subcategoryId.name
      : product?.subcategoryName || product?.subcategory

  return raw && typeof raw === "string" && raw.trim() ? raw.trim() : null
}

// Turn a raw order reference into a short, customer-friendly code instead of
// showing the raw Mongo _id (e.g. "6a82bfbf78594f6eb161ae05" → "61AE05").
// Prefers a real orderNumber if the backend ever provides one.
const formatOrderRef = (order) => {
  const raw = order?.orderNumber || order?.orderId || order?._id || ""
  const s = String(raw)
  if (/^[a-f0-9]{24}$/i.test(s)) return s.slice(-6).toUpperCase()
  return s
}

// Food-type filter options. "All" = no filter.
const FOOD_TYPES = [
  { value: "All", label: "All", color: "#6B2219" },
  { value: "veg", label: "Veg", color: "#16a34a" },
  { value: "non-veg", label: "Non-Veg", color: "#dc2626" },
  { value: "egg", label: "Egg", color: "#c9860a" },
]

const PublicMenu = () => {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState("")
  // Subcategory filter (Soup, Appetizers, Tandoor…) — same idea as the Member
  // App's chip row. "All" means no subcategory filter.
  const [selectedSubcategory, setSelectedSubcategory] = useState("All")
  // Food-type filter (Veg / Non-Veg / Egg). "All" means no food-type filter.
  const [selectedFoodType, setSelectedFoodType] = useState("All")
  // Map of image key -> true for images that failed to load
  const [brokenImages, setBrokenImages] = useState({})
  const [searchQuery, setSearchQuery] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [branchId, setBranchId] = useState("")
  const [branchName, setBranchName] = useState("")
  const [tableNumber, setTableNumber] = useState("")
  const [tableStatus, setTableStatus] = useState("") // NEW: Track table status
  const [tableId, setTableId] = useState("") // NEW: Track table ID
  const [tableCategoryId, setTableCategoryId] = useState("") // Track table's category for filtering
  const [tableCategoryName, setTableCategoryName] = useState("") // Track table's category name

  // Cart state
  const [cart, setCart] = useState([])
  const [showCart, setShowCart] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [lastOrderDetails, setLastOrderDetails] = useState(null)

  // Customer details
  const [customerDetails, setCustomerDetails] = useState({
    name: "",
    mobile: "",
    peopleCount: 1,
  })

  // Order processing
  const [processingOrder, setProcessingOrder] = useState(false)

  // Order history
  const [showMyOrders, setShowMyOrders] = useState(false)
  const [myOrders, setMyOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const isFetchingOrdersRef = useRef(false)

  // Fetch orders when modal opens
  useEffect(() => {
    if (showMyOrders && sessionId) {
      console.log("🔄 useEffect: Modal opened, fetching orders...")
      fetchMyOrders()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMyOrders])

  // Scroll fix: this page can be mounted inside shells that set
  // `overflow: hidden` / fixed height on <body>/#root for other routes. Tag
  // the body while this component is mounted so the global stylesheet (see
  // .public-menu-active rules below) can restore normal scrolling, and undo
  // it on unmount so we don't leak the override to other pages.
  useEffect(() => {
    document.body.classList.add("public-menu-active")
    return () => {
      document.body.classList.remove("public-menu-active")
    }
  }, [])

  // API configuration
  const api = {
    baseURL: import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel",
    get: async (endpoint) => {
      try {
        const response = await fetch(`${api.baseURL}${endpoint}`)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return await response.json()
      } catch (error) {
        console.error(`API Error for ${endpoint}:`, error)
        throw error
      }
    },
    post: async (endpoint, data) => {
      try {
        const response = await fetch(`${api.baseURL}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(data),
        })
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return await response.json()
      } catch (error) {
        console.error(`API Error for ${endpoint}:`, error)
        throw error
      }
    },
  }

  // NEW: Function to check table status and get category
  const checkTableStatus = async (branchId, tableNumber) => {
    try {
      console.log("Checking table status for branch:", branchId, "table:", tableNumber)

      // Get all tables for the branch
      const response = await api.get(`/table?branchId=${branchId}`)

      // Handle undefined or null response
      if (!response) {
        console.warn("⚠️ API returned undefined/null, assuming table is available")
        setTableStatus("available")
        return { status: "available", categoryId: null }
      }

      // Handle API response - store in new variable to avoid changing data structure elsewhere
      let tablesData = []

      // The API returns a direct array
      if (Array.isArray(response)) {
        console.log("✅ Response is direct array")
        tablesData = response
      }
      // Check if wrapped in {success, count, data} format
      else if (response.data && response.data.success && Array.isArray(response.data.data)) {
        console.log("✅ Response has {success, count, data} format")
        tablesData = response.data.data
      }
      // Check if wrapped in {data} format (old format)
      else if (Array.isArray(response.data)) {
        console.log("✅ Response has {data} format")
        tablesData = response.data
      }
      else {
        console.warn("⚠️ Unexpected response format, assuming table is available:", response)
        // Don't return early - set default status to not block customers
        setTableStatus("available")
        return { status: "available", categoryId: null }
      }

      console.log("📦 Total tables found:", tablesData.length)

      // Find the specific table by number (case-insensitive comparison for flexibility)
      const table = tablesData.find((t) =>
        t.number.toString().toLowerCase() === tableNumber.toString().toLowerCase()
      )

      if (table) {
        console.log("✅ Found table:", table)
        setTableId(table._id)
        setTableStatus(table.status || "available")

        // Get category info from table
        if (table.categoryId) {
          const catId = typeof table.categoryId === 'object' ? table.categoryId._id : table.categoryId
          const catName = typeof table.categoryId === 'object' ? table.categoryId.name : ''
          setTableCategoryId(catId)
          setTableCategoryName(catName)
          console.log("📂 Table category:", catId, catName)
        }

        return { status: table.status || "available", categoryId: table.categoryId }
      } else {
        console.log("⚠️ Table '" + tableNumber + "' not found in database, assuming available")
        setTableStatus("available")
        return { status: "available", categoryId: null }
      }
    } catch (error) {
      console.error("Error checking table status:", error)
      // If we can't check status, assume available to not block customers
      setTableStatus("available")
      return { status: "available", categoryId: null }
    }
  }

  // Helper functions
  const getCategoryId = (product) => {
    try {
      if (!product) return null
      if (typeof product.categoryId === "object" && product.categoryId !== null) {
        return product.categoryId._id || product.categoryId.id
      }
      return product.categoryId
    } catch (error) {
      console.error('Error getting category ID:', error, 'Product:', product)
      return null
    }
  }

  const getCategoryName = (product) => {
    if (!product) return "Unknown Category"
    if (typeof product.categoryId === "object" && product.categoryId !== null) {
      return product.categoryId.name || "Unknown Category"
    }
    const categoryId = product.categoryId
    const category = categories.find((cat) => cat._id === categoryId)
    return category ? category.name : "Unknown Category"
  }

  const getImageUrl = (imageUrl) => {
    `${imageUrl}`
  }

  // Cart functions
  const addToCart = (product) => {
    // Check if table is available before adding to cart
    // Allow if table is reserved but current session is the owner (same customer adding more items)
    if (tableStatus === "reserved") {
      const sessionKey = `session_${branchId}_${tableNumber}`
      const existingSession = localStorage.getItem(sessionKey)
      let isOwner = false
      if (existingSession) {
        try {
          const sessionData = JSON.parse(existingSession)
          const now = Date.now()
          isOwner = sessionData.sessionId === sessionId && (now - sessionData.lastActivity < 4 * 60 * 60 * 1000)
        } catch (e) { /* ignore */ }
      }
      if (!isOwner) {
        alert("This table is currently reserved. Please contact staff for assistance.")
        return
      }
    }

    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item._id === product._id)
      if (existingItem) {
        return prevCart.map((item) => (item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item))
      } else {
        return [...prevCart, { ...product, quantity: 1 }]
      }
    })
  }

  const removeFromCart = (productId) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item._id === productId)
      if (existingItem && existingItem.quantity > 1) {
        return prevCart.map((item) => (item._id === productId ? { ...item, quantity: item.quantity - 1 } : item))
      } else {
        return prevCart.filter((item) => item._id !== productId)
      }
    })
  }

  const getCartItemCount = () => {
    return cart.reduce((total, item) => total + item.quantity, 0)
  }

  const getCartTotal = () => {
    const total = cart.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0)
    return isNaN(total) ? 0 : total
  }

  const getItemQuantityInCart = (productId) => {
    const item = cart.find((item) => item._id === productId)
    return item ? item.quantity : 0
  }

  // Convert image to base64
  const getBase64Image = (img) => {
    const canvas = document.createElement("canvas")
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext("2d")
    ctx.drawImage(img, 0, 0)
    return canvas.toDataURL("image/jpeg")
  }

  // Professional Invoice Generation (Same as StaffInvoices)
  const generateInvoicePDF = (orderDetails) => {
    const printWindow = window.open("", "_blank")

    // Create image element to get base64
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      let logoBase64 = ""
      try {
        logoBase64 = getBase64Image(img)
      } catch (e) {
        console.warn("Could not convert logo to base64:", e)
      }

      const invoiceHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invoice ${orderDetails.orderId}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #6B2219; padding-bottom: 20px; }
            .logo { width: 80px; height: 80px; margin: 0 auto 15px; border-radius: 8px; display: block; }
            .company-name { font-size: 28px; font-weight: bold; color: #6B2219; margin: 10px 0; }
            .company-address { font-size: 14px; color: #666; margin: 5px 0; }
            .invoice-title { font-size: 20px; font-weight: bold; color: #333; margin-top: 15px; }
            .invoice-details { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
            .detail-section h3 { color: #333; margin-bottom: 15px; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 3px 0; }
            .detail-label { font-weight: bold; color: #555; }
            .detail-value { color: #333; }
            .items-section { margin-bottom: 25px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .items-table th, .items-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            .items-table th { background-color: #f8f9fa; font-weight: bold; color: #333; }
            .items-table tbody tr:nth-child(even) { background-color: #f9f9f9; }
            .total-section { margin-top: 25px; border-top: 2px solid #6B2219; padding-top: 15px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 3px 0; }
            .total-label { font-weight: bold; }
            .grand-total { font-size: 18px; font-weight: bold; color: #6B2219; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px; }
            .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
            .thank-you { font-size: 16px; color: #6B2219; font-weight: bold; margin-bottom: 10px; }
            @media print { 
              body { margin: 0; } 
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${logoBase64 ? `<img src="${logoBase64}" alt="Hotel Virat Logo" class="logo">` : ""}
            <h1 class="company-name">Hotel Virat</h1>
            <div class="company-address">${orderDetails.branchName}</div>
            <div class="invoice-title">Invoice</div>
            <div style="font-size: 14px; color: #666;">Invoice No: ${orderDetails.orderId}</div>
          </div>
          
          <div class="invoice-details">
            <div class="detail-section">
              <h3>Invoice Details</h3>
              <div class="detail-row">
                <span class="detail-label">Invoice ID:</span>
                <span class="detail-value">${orderDetails.orderId}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Order ID:</span>
                <span class="detail-value">${orderDetails.orderId}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${new Date(orderDetails.orderTime).toLocaleDateString("en-IN")}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Time:</span>
                <span class="detail-value">${new Date(orderDetails.orderTime).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Table No:</span>
                <span class="detail-value">${orderDetails.tableNumber}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Guests:</span>
                <span class="detail-value">${orderDetails.peopleCount}</span>
              </div>
            </div>
            
            <div class="detail-section">
              <h3>Customer & Payment Details</h3>
              <div class="detail-row">
                <span class="detail-label">Customer Name:</span>
                <span class="detail-value">${orderDetails.customerName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Mobile:</span>
                <span class="detail-value">${orderDetails.customerMobile}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Branch:</span>
                <span class="detail-value">${orderDetails.branchName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Payment Method:</span>
                <span class="detail-value">${orderDetails.paymentMethod.toUpperCase()}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Order Type:</span>
                <span class="detail-value">GUEST ORDER</span>
              </div>
            </div>
          </div>

          <div class="items-section">
            <h3 style="color: #333; margin-bottom: 15px;">Order Items</h3>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th style="text-align: center;">Qty</th>
                  <th style="text-align: right;">Price</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${
                  orderDetails.items
                    ?.map(
                      (item) => `
                  <tr>
                    <td>${item.name}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: right;">₹${(item.price || 0).toFixed(2)}</td>
                    <td style="text-align: right;">₹${((item.price || 0) * item.quantity).toFixed(2)}</td>
                  </tr>
                `,
                    )
                    .join("") || "<tr><td colspan='4' style='text-align: center;'>No items available</td></tr>"
                }
              </tbody>
            </table>
          </div>

          <div class="total-section">
            <div class="total-row grand-total">
              <span>Total Amount:</span>
              <span>₹${(orderDetails.totalAmount || 0).toFixed(2)}</span>
            </div>
          </div>

          ${
            orderDetails.notes
              ? `
            <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
              <h4 style="margin-bottom: 10px; color: #333;">Notes:</h4>
              <p style="margin: 0;">${orderDetails.notes}</p>
            </div>
          `
              : ""
          }

          <div class="footer">
            <div class="thank-you">Thank you for dining with us!</div>
            <p>We hope you enjoyed your meal. Please visit us again soon.</p>
            <p style="font-size: 12px; margin-top: 15px;">Generated on ${new Date().toLocaleString("en-IN")}</p>
          </div>
        </body>
        </html>
      `

      printWindow.document.write(invoiceHTML)
      printWindow.document.close()
      printWindow.focus()

      // Wait a bit for content to load then print
      setTimeout(() => {
        printWindow.print()
      }, 500)
    }

    img.onerror = () => {
      console.warn("Could not load logo image, generating PDF without logo")
      // Generate PDF without logo (same HTML without logo)
      const invoiceHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invoice ${orderDetails.orderId}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #6B2219; padding-bottom: 20px; }
            .company-name { font-size: 28px; font-weight: bold; color: #6B2219; margin-bottom: 10px; }
            .company-address { font-size: 14px; color: #666; margin: 5px 0; }
            .invoice-title { font-size: 20px; font-weight: bold; color: #333; margin-top: 15px; }
            .invoice-details { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
            .detail-section h3 { color: #333; margin-bottom: 15px; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 3px 0; }
            .detail-label { font-weight: bold; color: #555; }
            .detail-value { color: #333; }
            .items-section { margin-bottom: 25px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .items-table th, .items-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            .items-table th { background-color: #f8f9fa; font-weight: bold; color: #333; }
            .items-table tbody tr:nth-child(even) { background-color: #f9f9f9; }
            .total-section { margin-top: 25px; border-top: 2px solid #6B2219; padding-top: 15px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 3px 0; }
            .total-label { font-weight: bold; }
            .grand-total { font-size: 18px; font-weight: bold; color: #6B2219; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px; }
            .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
            .thank-you { font-size: 16px; color: #6B2219; font-weight: bold; margin-bottom: 10px; }
            @media print { 
              body { margin: 0; } 
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="company-name">Hotel Virat</h1>
            <div class="company-address">${orderDetails.branchName}</div>
            <div class="invoice-title">Invoice</div>
            <div style="font-size: 14px; color: #666;">Invoice No: ${orderDetails.orderId}</div>
          </div>
          
          <div class="invoice-details">
            <div class="detail-section">
              <h3>Invoice Details</h3>
              <div class="detail-row">
                <span class="detail-label">Invoice ID:</span>
                <span class="detail-value">${orderDetails.orderId}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Order ID:</span>
                <span class="detail-value">${orderDetails.orderId}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${new Date(orderDetails.orderTime).toLocaleDateString("en-IN")}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Time:</span>
                <span class="detail-value">${new Date(orderDetails.orderTime).toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Table No:</span>
                <span class="detail-value">${orderDetails.tableNumber}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Guests:</span>
                <span class="detail-value">${orderDetails.peopleCount}</span>
              </div>
            </div>
            
            <div class="detail-section">
              <h3>Customer & Payment Details</h3>
              <div class="detail-row">
                <span class="detail-label">Customer Name:</span>
                <span class="detail-value">${orderDetails.customerName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Mobile:</span>
                <span class="detail-value">${orderDetails.customerMobile}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Branch:</span>
                <span class="detail-value">${orderDetails.branchName}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Payment Method:</span>
                <span class="detail-value">${orderDetails.paymentMethod.toUpperCase()}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Order Type:</span>
                <span class="detail-value">GUEST ORDER</span>
              </div>
            </div>
          </div>

          <div class="items-section">
            <h3 style="color: #333; margin-bottom: 15px;">Order Items</h3>
            <table class="items-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th style="text-align: center;">Qty</th>
                  <th style="text-align: right;">Price</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${
                  orderDetails.items
                    ?.map(
                      (item) => `
                  <tr>
                    <td>${item.name}</td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: right;">₹${(item.price || 0).toFixed(2)}</td>
                    <td style="text-align: right;">₹${((item.price || 0) * item.quantity).toFixed(2)}</td>
                  </tr>
                `,
                    )
                    .join("") || "<tr><td colspan='4' style='text-align: center;'>No items available</td></tr>"
                }
              </tbody>
            </table>
          </div>

          <div class="total-section">
            <div class="total-row grand-total">
              <span>Total Amount:</span>
              <span>₹${(orderDetails.totalAmount || 0).toFixed(2)}</span>
            </div>
          </div>

          ${
            orderDetails.notes
              ? `
            <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-radius: 5px;">
              <h4 style="margin-bottom: 10px; color: #333;">Notes:</h4>
              <p style="margin: 0;">${orderDetails.notes}</p>
            </div>
          `
              : ""
          }

          <div class="footer">
            <div class="thank-you">Thank you for dining with us!</div>
            <p>We hope you enjoyed your meal. Please visit us again soon.</p>
            <p style="font-size: 12px; margin-top: 15px;">Generated on ${new Date().toLocaleString("en-IN")}</p>
          </div>
        </body>
        </html>
      `

      printWindow.document.write(invoiceHTML)
      printWindow.document.close()
      printWindow.focus()

      setTimeout(() => {
        printWindow.print()
      }, 500)
    }

    // Try to load the logo
    img.src = hotelViratLogo
  }

  // Print receipt for thermal printer (80mm width)
  const printThermalReceipt = (orderDetails) => {
    const printWindow = window.open("", "_blank", "width=302,height=600")

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Order ${orderDetails.orderId}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Courier New', monospace; 
            width: 80mm; 
            max-width: 80mm;
            padding: 5mm;
            font-size: 12px;
            line-height: 1.4;
          }
          .header { text-align: center; margin-bottom: 10px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
          .hotel-name { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
          .branch-name { font-size: 12px; margin-bottom: 3px; }
          .order-info { margin-bottom: 10px; }
          .order-id { font-size: 14px; font-weight: bold; text-align: center; margin: 8px 0; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .info-label { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .items-header { font-weight: bold; margin-bottom: 5px; }
          .item-row { margin-bottom: 5px; }
          .item-name { font-weight: bold; }
          .item-details { display: flex; justify-content: space-between; font-size: 11px; }
          .totals { margin-top: 10px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .grand-total { font-size: 14px; font-weight: bold; border-top: 1px dashed #000; padding-top: 5px; margin-top: 5px; }
          .footer { text-align: center; margin-top: 15px; font-size: 11px; border-top: 1px dashed #000; padding-top: 10px; }
          .thank-you { font-weight: bold; margin-bottom: 5px; }
          @media print { 
            body { width: 80mm; }
            @page { size: 80mm auto; margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="hotel-name">HOTEL VIRAT</div>
          <div class="branch-name">${orderDetails.branchName || branchName}</div>
        </div>
        
        <div class="order-id">Order #${orderDetails.orderId}</div>
        
        <div class="order-info">
          <div class="info-row">
            <span class="info-label">Date:</span>
            <span>${new Date().toLocaleDateString('en-IN')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Time:</span>
            <span>${new Date().toLocaleTimeString('en-IN')}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Table:</span>
            <span>${orderDetails.tableNumber || tableNumber}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Guests:</span>
            <span>${orderDetails.peopleCount}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Customer:</span>
            <span>${orderDetails.customerName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Mobile:</span>
            <span>${orderDetails.customerMobile}</span>
          </div>
        </div>
        
        <div class="divider"></div>
        
        <div class="items-section">
          <div class="items-header">ITEMS</div>
          ${orderDetails.items?.map(item => `
            <div class="item-row">
              <div class="item-name">${item.name}</div>
              <div class="item-details">
                <span>${item.quantity} x ₹${(item.price || 0).toFixed(2)}</span>
                <span>₹${((item.price || 0) * item.quantity).toFixed(2)}</span>
              </div>
            </div>
          `).join('') || '<div>No items</div>'}
        </div>
        
        <div class="divider"></div>
        
        <div class="totals">
          <div class="total-row grand-total">
            <span>TOTAL:</span>
            <span>₹${orderDetails.totalAmount?.toFixed(2) || '0.00'}</span>
          </div>
        </div>
        
        <div class="divider"></div>
        
        <div class="order-info">
          <div class="info-row">
            <span class="info-label">Payment:</span>
            <span>${orderDetails.paymentMethod?.toUpperCase() || 'CASH'}</span>
          </div>
        </div>
        
        <div class="footer">
          <div class="thank-you">Thank You!</div>
          <div>Visit Again</div>
          <div style="margin-top: 5px; font-size: 10px;">${new Date().toLocaleString('en-IN')}</div>
        </div>
      </body>
      </html>
    `

    printWindow.document.write(receiptHTML)
    printWindow.document.close()
    printWindow.focus()

    setTimeout(() => {
      printWindow.print()
    }, 300)
  }

  // Order ID is now auto-generated by the backend in format DDMMYYYY-RES-sequence

  const handlePlaceOrder = async () => {
    // Check table status before placing order
    // Allow if table is reserved but current session is the owner (same customer ordering more)
    if (tableStatus === "reserved") {
      const sessionKey = `session_${branchId}_${tableNumber}`
      const existingSession = localStorage.getItem(sessionKey)
      let isOwner = false
      if (existingSession) {
        try {
          const sessionData = JSON.parse(existingSession)
          const now = Date.now()
          isOwner = sessionData.sessionId === sessionId && (now - sessionData.lastActivity < 4 * 60 * 60 * 1000)
        } catch (e) { /* ignore */ }
      }
      if (!isOwner) {
        alert("This table is currently reserved. Please contact staff for assistance.")
        return
      }
    }

    if (!customerDetails.name.trim() || !customerDetails.mobile.trim()) {
      alert("Please fill in your name and mobile number")
      return
    }

    if (customerDetails.mobile.length !== 10) {
      alert("Please enter a valid 10-digit mobile number")
      return
    }

    if (cart.length === 0) {
      alert("Your cart is empty")
      return
    }

    setProcessingOrder(true)

    try {
      const totalAmount = getCartTotal()

      // Generate a proper sequential KOT number.
      // Keyed on the BUSINESS day (3 AM cutoff), not the calendar day — a
      // calendar key reset the counter to 001 at midnight while the same
      // trading session was still running.
      const now = new Date()
      if (now.getHours() < 3) {
        now.setDate(now.getDate() - 1)
      }
      const dateKey = `${String(now.getDate()).padStart(2,'0')}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getFullYear()).slice(-2)}`
      const kotCounterKey = `kot-counter-${dateKey}`
      let kotCounter = parseInt(localStorage.getItem(kotCounterKey) || '0')
      kotCounter++
      localStorage.setItem(kotCounterKey, kotCounter.toString())
      const kotNumber = `KOT-${String(kotCounter).padStart(3, '0')}`

      const orderData = {
        // Create as a KOT (counter-order with pending payment)
        userId: null, // Guest order — no counter user
        customerName: customerDetails.name.trim(),
        phoneNumber: customerDetails.mobile.trim(),
        branchId: branchId,
        branchName: branchName,
        categoryId: tableCategoryId || null,
        categoryName: tableCategoryName || "Restaurant",
        tableId: tableId || null,
        tableNumber: tableNumber,
        kotNumber: kotNumber,
        kotTime: new Date().toISOString(),
        serverName: "QR Order", // Identify as QR-based order
        items: cart.map((item) => ({
          menuItemId: item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        subtotal: totalAmount,
        gstAmount: 0,
        tax: 0,
        serviceCharge: 0,
        totalAmount: totalAmount,
        grandTotal: totalAmount,
        paymentMethod: "cash",
        paymentStatus: "pending", // KOT = pending payment
        orderStatus: "pending",
        notes: `Guest order from Table ${tableNumber}${tableCategoryName ? ` - ${tableCategoryName}` : ''} `,
      }

      console.log("Placing guest order as KOT:", orderData)
      const response = await api.post("/counter-order/orders-no-stock", orderData)

      if (response.order || response.success) {
        const orderResult = response.order || response.data || {}
        const completedOrder = {
          ...orderData,
          _id: orderResult.id || orderResult._id || Date.now().toString(),
          orderId: orderResult.id || orderResult._id || Date.now().toString(),
          orderTime: orderResult.createdAt || new Date().toISOString(),
          createdAt: orderResult.createdAt || new Date().toISOString()
        }

        console.log("✅ Order placed successfully!")
        console.log("📋 Order ID:", completedOrder.orderId)
        console.log("📋 Session ID:", sessionId)

        // Reserve the table so counter shows it as occupied
        if (tableId) {
          try {
            await api.post(`/table/${tableId}`, { status: "reserved" }).catch(() => {})
            // Try PUT if POST doesn't work
            await fetch(`${api.baseURL}/table/${tableId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'reserved' })
            }).catch(() => {})
            console.log("🪑 Table reserved:", tableNumber)
          } catch (_) {
            console.warn("⚠️ Failed to reserve table, continuing anyway")
          }
        }
        console.log("📋 Complete order data:", completedOrder)

        // Store order details for invoice generation
        setLastOrderDetails(completedOrder)

        // Save to localStorage for order history
        const storageKey = `orders_${sessionId}`
        console.log("💾 Saving to localStorage with key:", storageKey)

        // Get existing orders
        const existingData = localStorage.getItem(storageKey)
        console.log("📦 Existing localStorage data:", existingData)

        const orders = existingData ? JSON.parse(existingData) : []
        console.log("📦 Existing orders count:", orders.length)

        // Add new order to beginning
        orders.unshift(completedOrder)
        console.log("📦 New orders count:", orders.length)

        // Save back to localStorage
        const dataToSave = JSON.stringify(orders)
        localStorage.setItem(storageKey, dataToSave)
        console.log("✅ Saved to localStorage. Data length:", dataToSave.length)

        // Verify it was saved
        const verifyData = localStorage.getItem(storageKey)
        if (verifyData) {
          const verifyOrders = JSON.parse(verifyData)
          console.log("✅ VERIFICATION SUCCESS - Orders in storage:", verifyOrders.length)
          console.log("📋 First order ID:", verifyOrders[0]?.orderId)
        } else {
          console.error("❌ VERIFICATION FAILED - Nothing in localStorage!")
        }

        setOrderPlaced(true)
        setCart([])
        setShowCheckout(false)
        setShowCart(false)

        // NOTE: customerDetails are deliberately NOT cleared here. They're
        // captured once on the gate screen before the menu and belong to the
        // whole table session — the guest is still seated and may order again.
        // Clearing them would send them back to the details gate after every
        // order. They're wiped naturally when the 4-hour session expires.

        // Don't auto-hide - let user manually close or reorder
      } else {
        throw new Error(response.message || "Failed to place order")
      }
    } catch (error) {
      console.error("Error placing order:", error)
      alert("Failed to place order. Please try again.")
    } finally {
      setProcessingOrder(false)
    }
  }

  const handleDownloadInvoice = () => {
    if (lastOrderDetails) {
      generateInvoicePDF(lastOrderDetails)
    }
  }

  // Fetch order history for THIS table's live bill.
  //
  // Reads the same CounterOrder collection the counter POS and member app use
  // (GET /counter-order/orders), then scopes to this branch + table (+ the
  // guest's phone when one was provided). This is what makes each KOT (KOT-01
  // soup, KOT-02 roti…) show while pending, and then roll up into one bill —
  // with the counter's invoice number and a Completed status — once the
  // counter settles the table. Previously this read a different collection
  // (/public-order/session) + localStorage, which never saw the counter's
  // consolidation, so status never updated. See gotchas #10 (group by
  // tableNumber + status) and #11 (normalise status).
  const fetchMyOrders = async () => {
    if (isFetchingOrdersRef.current) {
      console.log("⏳ Already fetching orders, skipping...")
      return
    }

    isFetchingOrdersRef.current = true
    setLoadingOrders(true)

    const norm = (s) => String(s == null ? "" : s).toLowerCase().trim()
    const guestPhone = (customerDetails?.mobile || "").trim()

    try {
      let all = []
      try {
        const response = await api.get(`/counter-order/orders?limit=300`)
        if (response?.success && Array.isArray(response.orders)) all = response.orders
        else if (Array.isArray(response?.orders)) all = response.orders
        else if (Array.isArray(response?.data)) all = response.data
        else if (Array.isArray(response)) all = response
      } catch (apiError) {
        // Offline / server unreachable — fall back to this browser's just-placed
        // orders so the guest still sees what they ordered this session.
        console.warn("⚠️ /counter-order/orders unavailable, using localStorage:", apiError.message)
        const local = sessionId ? localStorage.getItem(`orders_${sessionId}`) : null
        setMyOrders(local ? JSON.parse(local) : [])
        return
      }

      const scoped = all.filter((o) => {
        // Same branch
        const oBranch = typeof o.branch === "object" && o.branch !== null
          ? (o.branch._id || o.branch.id)
          : o.branch
        if (branchId && oBranch && String(oBranch) !== String(branchId)) return false

        // Same table
        if (norm(o.tableNumber) !== norm(tableNumber)) return false

        // Same guest — only when the guest actually entered a real 10-digit
        // number (walk-ins default to 0000000000, which we don't filter on).
        if (/^\d{10}$/.test(guestPhone) && o.phoneNumber && o.phoneNumber !== "0000000000") {
          if (String(o.phoneNumber) !== guestPhone) return false
        }

        // Hide the merged originals — they now live inside the comprehensive
        // bill, so showing them too would duplicate the items.
        if (norm(o.paymentStatus) === "consolidated") return false

        // Hide cancelled KOTs
        if (norm(o.orderStatus) === "cancelled" || norm(o.status) === "cancelled") return false

        return true
      })

      // Newest first
      scoped.sort(
        (a, b) =>
          new Date(b.createdAt || b.orderTime || 0) - new Date(a.createdAt || a.orderTime || 0)
      )

      // Split into still-preparing KOTs vs settled bills.
      const isDoneStatus = (o) => {
        const s = norm(o.paymentStatus || o.orderStatus || o.status || "pending")
        return s === "completed" || s === "paid"
      }
      const activeKOTs = scoped.filter((o) => !isDoneStatus(o))
      const doneBills = scoped.filter(isDoneStatus)

      // The guest should never see raw KOT numbers, and all the KOTs they've
      // added this visit belong to ONE running order. So merge every active KOT
      // into a single "Current Order" card with the items combined.
      const displayList = []
      if (activeKOTs.length > 0) {
        const mergedItems = []
        let grandTotal = 0
        activeKOTs.forEach((kot) => {
          grandTotal += Number(kot.grandTotal != null ? kot.grandTotal : (kot.totalAmount || 0))
          ;(kot.items || []).forEach((it) => {
            // Combine identical items (same name + price) by summing quantity
            const existing = mergedItems.find(
              (m) => m.name === it.name && Number(m.price) === Number(it.price)
            )
            if (existing) existing.quantity += it.quantity
            else mergedItems.push({ ...it })
          })
        })
        displayList.push({
          _id: "current-order",
          _isActive: true,
          items: mergedItems,
          grandTotal,
          totalAmount: grandTotal,
          createdAt: activeKOTs[0].createdAt || activeKOTs[0].orderTime,
        })
      }

      // Settled bills stay as separate cards (each real bill keeps its number)
      doneBills.forEach((b) => displayList.push(b))

      setMyOrders(displayList)
    } catch (error) {
      console.error("❌ Error fetching orders:", error)
      setMyOrders([])
    } finally {
      setLoadingOrders(false)
      isFetchingOrdersRef.current = false
    }
  }

  // Derive a friendly label + status for an order card. Pending KOTs show their
  // KOT number; a settled bill shows the counter's invoice/bill number.
  const getOrderView = (order) => {
    const status = String(order.paymentStatus || order.orderStatus || order.status || "pending")
      .toLowerCase()
      .trim()
    const isDone = status === "completed" || status === "paid"
    // Guests never see KOT numbers. While preparing it's just "Current Order";
    // once settled it shows the counter's bill number.
    const label = isDone
      ? (order.invoiceNumber ? `Bill #${order.invoiceNumber}` : `Order #${formatOrderRef(order)}`)
      : "Current Order"
    const amount = Number(order.grandTotal != null ? order.grandTotal : (order.totalAmount || 0))
    const badge = isDone
      ? { text: "Completed", bg: "#dcfce7", fg: "#166534" }
      : { text: "Preparing", bg: "#fef3c7", fg: "#92400e" }
    return { status, isDone, label, amount, badge }
  }

  // Tracks image URLs that failed to load, so we render a CSS placeholder
  // instead of retrying. Previously onError swapped src to "/placeholder.svg",
  // which doesn't exist in public/ — so that 404'd too, fired onError again,
  // and looped forever, causing the visible flicker.
  const markImageBroken = (key) => {
    setBrokenImages((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
  }

  // Subcategory chips, built from the loaded products with item counts.
  // Counts respect the category + search filters that are already applied, but
  // deliberately ignore the subcategory filter itself — otherwise selecting a
  // chip would zero out every other chip's count.
  const subcategoryChips = (() => {
    const base = products.filter((product) => {
      if (!product) return false

      const nameStr = String(product?.name || "")
      if (/^\d+$/.test(nameStr.trim())) return false // skip numeric-only junk names

      const matchesCategory =
        !selectedCategory || selectedCategory === "" || getCategoryId(product) === selectedCategory

      const term = searchQuery ? String(searchQuery).toLowerCase() : ""
      const matchesSearch =
        !searchQuery ||
        nameStr.toLowerCase().includes(term) ||
        String(product?.description || "").toLowerCase().includes(term)

      const matchesFoodType =
        selectedFoodType === "All" || product?.foodType === selectedFoodType

      return matchesCategory && matchesSearch && matchesFoodType
    })

    const counts = {}
    base.forEach((product) => {
      const key = getSubcategoryName(product) || OTHERS_LABEL
      counts[key] = (counts[key] || 0) + 1
    })

    // Nothing worth filtering by if every item landed in "Others"
    const hasNamed = Object.keys(counts).some((k) => k !== OTHERS_LABEL)
    if (!hasNamed) return []

    return [
      { name: "All", count: base.length },
      ...sortSubcategories(Object.keys(counts)).map((name) => ({ name, count: counts[name] })),
    ]
  })()

  // Filter products
  const filteredProducts = products.filter((product) => {
    try {
      // First, check if product exists
      if (!product) {
        return false
      }

      // Check if product has a valid name (not just numbers)
      const productName = product?.name || ''
      const productNameStr = String(productName)

      // Check if product name is only numbers (like "099", "123", etc.)
      // This regex checks if the string contains only digits (0-9) and optional whitespace
      const isOnlyNumbers = /^\d+$/.test(productNameStr.trim())

      // If product name is only numbers, filter it out
      if (isOnlyNumbers) {
        return false
      }

      // Now check category and search filters
      const matchesCategory = !selectedCategory || selectedCategory === "" || getCategoryId(product) === selectedCategory

      // Subcategory chip filter — items with no subcategory group under "Others"
      const matchesSubcategory =
        selectedSubcategory === "All" ||
        (getSubcategoryName(product) || OTHERS_LABEL) === selectedSubcategory

      // Food-type filter (Veg / Non-Veg / Egg)
      const matchesFoodType =
        selectedFoodType === "All" || product?.foodType === selectedFoodType

      const productDescription = product?.description || ''
      const searchTerm = searchQuery ? String(searchQuery).toLowerCase() : ''

      // Convert to strings to ensure .toLowerCase() works
      const productNameSafe = String(productNameStr).toLowerCase()
      const productDescriptionSafe = String(productDescription).toLowerCase()

      const matchesSearch = !searchQuery ||
        productNameSafe.includes(searchTerm) ||
        productDescriptionSafe.includes(searchTerm)

      return matchesCategory && matchesSubcategory && matchesFoodType && matchesSearch
    } catch (error) {
      console.error('Error filtering product:', error, 'Product:', product)
      return false
    }
  })

  // Session management state
  const [sessionId, setSessionId] = useState("")

  // Guest details are captured up-front (before the menu) and stored on the
  // existing session object, which already has a 4-hour validity window. That
  // way a refresh or re-scan mid-meal doesn't re-prompt.
  // `null` = not yet resolved from storage, so we don't flash the gate before
  // we know whether details already exist.
  const [detailsCaptured, setDetailsCaptured] = useState(null)
  // Set when the guest taps "Edit" from the checkout modal
  const [editingDetails, setEditingDetails] = useState(false)
  const [detailsError, setDetailsError] = useState("")

  // Read previously captured details for this branch+table, if the session is
  // still valid. Returns null when there's nothing usable.
  const loadSavedDetails = (branch, table) => {
    try {
      const raw = localStorage.getItem(`session_${branch}_${table}`)
      if (!raw) return null
      const data = JSON.parse(raw)
      if (Date.now() - data.lastActivity >= 4 * 60 * 60 * 1000) return null
      const d = data.customerDetails
      if (d && d.name && d.mobile) return d
      return null
    } catch (e) {
      return null
    }
  }

  // Persist details onto the session object without disturbing sessionId
  const saveDetailsToSession = (branch, table, details) => {
    try {
      const key = `session_${branch}_${table}`
      const raw = localStorage.getItem(key)
      const data = raw ? JSON.parse(raw) : {}
      data.customerDetails = details
      data.lastActivity = Date.now()
      localStorage.setItem(key, JSON.stringify(data))
    } catch (e) {
      // Non-fatal: details stay in React state for this page view
      console.warn("Could not persist customer details:", e?.message)
    }
  }

  // Generate or retrieve session ID
  const getOrCreateSession = (branch, table) => {
    const sessionKey = `session_${branch}_${table}`
    const existingSession = localStorage.getItem(sessionKey)

    if (existingSession) {
      // Check if session is still valid (within same browsing session)
      const sessionData = JSON.parse(existingSession)
      const now = Date.now()
      // Session expires after 4 hours of inactivity
      if (now - sessionData.lastActivity < 4 * 60 * 60 * 1000) {
        // Update last activity
        sessionData.lastActivity = now
        localStorage.setItem(sessionKey, JSON.stringify(sessionData))
        return sessionData.sessionId
      }
    }

    // Create new session
    const newSessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const sessionData = {
      sessionId: newSessionId,
      branchId: branch,
      tableNumber: table,
      createdAt: Date.now(),
      lastActivity: Date.now()
    }
    localStorage.setItem(sessionKey, JSON.stringify(sessionData))
    return newSessionId
  }

  // Validation shared by the gate and the final place-order check
  const validateDetails = (d) => {
    if (!d.name || !d.name.trim()) return "Please enter your full name"
    if (!/^\d{10}$/.test((d.mobile || "").trim())) return "Please enter a valid 10-digit mobile number"
    return ""
  }

  const handleDetailsSubmit = (e) => {
    if (e) e.preventDefault()
    const msg = validateDetails(customerDetails)
    if (msg) {
      setDetailsError(msg)
      return
    }
    const cleaned = {
      name: customerDetails.name.trim(),
      mobile: customerDetails.mobile.trim(),
      peopleCount: customerDetails.peopleCount || 1,
    }
    setCustomerDetails(cleaned)
    saveDetailsToSession(branchId, tableNumber, cleaned)
    setDetailsError("")
    setEditingDetails(false)
    setDetailsCaptured(true)
  }

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const branch = urlParams.get("branch")
    const name = urlParams.get("name")
    const table = urlParams.get("table")
    const categoryFromUrl = urlParams.get("category")
    const categoryNameFromUrl = urlParams.get("categoryName")

    if (branch && table) {
      // Generate or retrieve session ID
      const currentSessionId = getOrCreateSession(branch, table)
      setSessionId(currentSessionId)
      console.log("📱 Session ID:", currentSessionId)

      setBranchId(branch)
      setBranchName(decodeURIComponent(name || ""))
      setTableNumber(table)

      // Restore details from a still-valid session so we don't re-prompt on
      // refresh; otherwise show the details gate before the menu.
      const saved = loadSavedDetails(branch, table)
      if (saved) {
        setCustomerDetails({
          name: saved.name || "",
          mobile: saved.mobile || "",
          peopleCount: saved.peopleCount || 1,
        })
        setDetailsCaptured(true)
      } else {
        setDetailsCaptured(false)
      }

      // Check table status first, then fetch menu data with category filter
      checkTableStatus(branch, table).then((result) => {
        // Handle case where result might be undefined
        if (!result) {
          console.warn("⚠️ checkTableStatus returned undefined, using defaults")
          result = { status: "available", categoryId: null }
        }

        console.log("Table status:", result.status)
        // Use category from URL if available, otherwise use category from table data
        let catId = categoryFromUrl
        if (!catId && result.categoryId) {
          catId = typeof result.categoryId === 'object' ? result.categoryId._id : result.categoryId
        }

        // Set category name from URL if available
        if (categoryNameFromUrl) {
          setTableCategoryName(decodeURIComponent(categoryNameFromUrl))
        }

        fetchMenuData(branch, catId)
      })
    } else {
      setError("Invalid QR code - missing branch or table information")
      setLoading(false)
    }
  }, [])

  const fetchMenuData = async (branchId, tableCatId = null) => {
    try {
      setLoading(true)
      setError("")
      // Fetch menu items and categories filtered by branchId from the backend
      // Add limit parameter to fetch all items (not paginated)
      const [productsResponse, categoriesResponse] = await Promise.all([
        api.get(`/menu?branchId=${branchId}&limit=1000`),
        api.get(`/category?branchId=${branchId}`)
      ])

      // Handle different API response formats
      let productsData = []
      let categoriesData = []

      // Extract products from response
      if (Array.isArray(productsResponse)) {
        productsData = productsResponse
      } else if (productsResponse?.success && Array.isArray(productsResponse.data)) {
        productsData = productsResponse.data
      } else if (productsResponse?.data && Array.isArray(productsResponse.data)) {
        productsData = productsResponse.data
      } else {
        console.error("❌ Invalid products data format:", productsResponse)
        setError("Failed to load menu items. Please contact staff.")
        return
      }

      // Extract categories from response
      if (Array.isArray(categoriesResponse)) {
        categoriesData = categoriesResponse
      } else if (categoriesResponse?.success && Array.isArray(categoriesResponse.data)) {
        categoriesData = categoriesResponse.data
      } else if (categoriesResponse?.data && Array.isArray(categoriesResponse.data)) {
        categoriesData = categoriesResponse.data
      } else {
        console.warn("⚠️ Invalid categories data format:", categoriesResponse)
        categoriesData = []
      }

      // Helper function to extract price from product
      const getProductPrice = (product) => {
        // If product has direct price field, use it
        if (product.price && typeof product.price === 'number') {
          return product.price
        }
        // If product has prices object, get the first price
        if (product.prices && typeof product.prices === 'object') {
          const priceValues = Object.values(product.prices)
          if (priceValues.length > 0) {
            const firstPrice = parseFloat(priceValues[0])
            if (!isNaN(firstPrice)) return firstPrice
          }
        }
        return 0
      }

      // Helper function to clean item names (remove number prefix)
      const cleanItemName = (name) => {
        if (!name) return name
        // Remove patterns like "001 ", "005 ", "102 " etc. from the start
        return name.replace(/^\d+\s+/, '').trim()
      }

      // Process all menu items (no filtering by isActive)
      let branchProducts = productsData
        .map(product => ({
          ...product,
          name: cleanItemName(product.name || product.itemName), // Clean the name, fallback to itemName
          price: getProductPrice(product)
        }))

      console.log("✅ Total products (no filtering):", branchProducts.length)

      // Store original count before category filtering
      const totalProductsBeforeFilter = branchProducts.length

      // If table has a category, filter products to show only that category
      if (tableCatId) {
        console.log("🔍 Filtering products by table category:", tableCatId)
        console.log("📦 Total products before category filter:", branchProducts.length)

        branchProducts = branchProducts.filter(product => {
          const productCatId = typeof product.categoryId === "object" && product.categoryId !== null
            ? product.categoryId._id || product.categoryId.id
            : product.categoryId

          const matches = productCatId === tableCatId
          if (!matches) {
            console.log("⏭️ Product filtered out:", product?.name || 'Unknown', "- Category:", productCatId, "!==", tableCatId)
          }
          return matches
        })

        console.log("✅ Products after category filter:", branchProducts.length)

        // Set the category name for display
        if (Array.isArray(categoriesData)) {
          const tableCat = categoriesData.find(cat => cat._id === tableCatId)
          if (tableCat) {
            setTableCategoryName(tableCat.name)
            console.log("📂 Category name set to:", tableCat.name)
          }
        }

        // If no products match the category, show helpful error
        if (branchProducts.length === 0 && totalProductsBeforeFilter > 0) {
          console.warn("⚠️ No products match table category. Total products available:", totalProductsBeforeFilter)
          setError(`No menu items found for this table's category. ${totalProductsBeforeFilter} items are available in other categories. Please contact staff.`)
        }
      }

      const usedCategoryIds = [
        ...new Set(
          branchProducts
            .map((product) => {
              if (typeof product.categoryId === "object" && product.categoryId !== null) {
                return product.categoryId._id || product.categoryId.id
              }
              return product.categoryId
            })
            .filter(Boolean),
        ),
      ]

      // Show ALL branch categories (like the counter POS) rather than only the
      // ones the loaded products happen to reference. usedCategoryIds is kept
      // for the empty-state messaging below.
      void usedCategoryIds
      const branchCategories = Array.isArray(categoriesData) ? categoriesData : []

      setProducts(branchProducts)
      setCategories(branchCategories)

      if (branchProducts.length === 0 && !error) {
        if (tableCatId) {
          setError("No menu items found for this table's category. Please contact staff for assistance.")
        } else {
          setError("No menu items available for this branch. Please contact staff.")
        }
      }
    } catch (error) {
      console.error("❌ Error fetching menu:", error)
      console.error("Error details:", error.message, error.stack)
      setError(`Failed to load menu: ${error.message}. Please try again or contact staff.`)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <>
        <div className="loading-screen">
          <div className="loading-content">
            <div className="loading-badge">
              <ChefHat size={30} />
            </div>
            <div className="spinner"></div>
            <p>Preparing your menu…</p>
          </div>
        </div>
        <style jsx>{`
          .loading-screen {
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(180deg, #fbf7f4 0%, #f6efe9 100%);
          }
          .loading-content {
            text-align: center;
            color: #6b5b53;
          }
          .loading-badge {
            width: 56px;
            height: 56px;
            margin: 0 auto 18px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #6B2219;
            color: #f4e9c9;
            box-shadow: 0 10px 24px rgba(107, 34, 25, 0.28);
          }
          .spinner {
            width: 34px;
            height: 34px;
            border: 3px solid rgba(107, 34, 25, 0.15);
            border-top: 3px solid #6B2219;
            border-radius: 50%;
            animation: spin 0.9s linear infinite;
            margin: 0 auto 14px;
          }
          .loading-content p {
            font-weight: 600;
            font-size: 14px;
            letter-spacing: 0.2px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </>
    )
  }

  if (error) {
    return (
      <>
        <div className="error-screen">
          <div className="error-content">
            <div className="error-icon-badge">
              <QrCode size={30} />
            </div>
            <h3>Something went wrong</h3>
            <p>{error}</p>
            <button onClick={() => fetchMenuData(branchId, tableCategoryId)} className="retry-btn">
              <RefreshCw size={16} />
              Try Again
            </button>
          </div>
        </div>
        <style jsx>{`
          .error-screen {
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(180deg, #fbf7f4 0%, #f6efe9 100%);
            padding: 20px;
          }
          .error-content {
            text-align: center;
            background: white;
            padding: 40px 32px;
            border-radius: 18px;
            box-shadow: 0 16px 40px rgba(107, 34, 25, 0.1);
            max-width: 400px;
            width: 100%;
          }
          .error-icon-badge {
            width: 56px;
            height: 56px;
            margin: 0 auto 18px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fdf1ef;
            color: #b3401f;
          }
          .error-content h3 {
            color: #1f2937;
            font-size: 18px;
            margin-bottom: 8px;
          }
          .error-content p {
            color: #6b7280;
            font-size: 14px;
            line-height: 1.5;
          }
          .retry-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: #6B2219;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 10px;
            cursor: pointer;
            margin-top: 20px;
            font-size: 14px;
            font-weight: 600;
            transition: background 0.15s ease, transform 0.15s ease;
          }
          .retry-btn:hover {
            background: #551a13;
            transform: translateY(-1px);
          }
        `}</style>
      </>
    )
  }
  const isSessionOwner = (() => {
    if (!sessionId) return false
    const sessionKey = `session_${branchId}_${tableNumber}`
    const existingSession = localStorage.getItem(sessionKey)
    if (existingSession) {
      try {
        const sessionData = JSON.parse(existingSession)
        const now = Date.now()
        // Session is valid if within 4 hours
        return sessionData.sessionId === sessionId && (now - sessionData.lastActivity < 4 * 60 * 60 * 1000)
      } catch (e) {
        return false
      }
    }
    return false
  })()

  if (tableStatus === "reserved" && !isSessionOwner) {
    return (
      <>
        <div className="reserved-screen">
          <div className="reserved-content">
            <div className="reserved-icon-badge">
              <AlertCircle size={32} />
            </div>
            <h2>Table Currently Reserved</h2>
            <p>
              Table {tableNumber} at {branchName} is currently reserved.
            </p>
            <p>Please contact our staff for assistance or try scanning a different table's QR code.</p>
            <div className="contact-info">
              <p className="contact-info-title">
                <Users size={15} /> Need Help?
              </p>
              <p>Please approach our staff members who will be happy to assist you with seating and ordering.</p>
            </div>
          </div>
        </div>
        <style jsx>{`
          .reserved-screen {
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(180deg, #fbf7f4 0%, #f6efe9 100%);
            padding: 20px;
          }
          .reserved-content {
            text-align: center;
            background: white;
            padding: 40px 32px;
            border-radius: 18px;
            box-shadow: 0 16px 40px rgba(107, 34, 25, 0.1);
            max-width: 480px;
            width: 100%;
            border-top: 4px solid #c9860a;
          }
          .reserved-icon-badge {
            width: 60px;
            height: 60px;
            margin: 0 auto 20px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #fef3c7;
            color: #b45309;
          }
          .reserved-content h2 {
            color: #1f2937;
            margin-bottom: 14px;
            font-size: 22px;
            font-weight: 700;
          }
          .reserved-content p {
            color: #666;
            margin-bottom: 12px;
            line-height: 1.55;
            font-size: 14px;
          }
          .contact-info {
            margin-top: 22px;
            padding: 18px 20px;
            background: #fdf7ec;
            border-radius: 12px;
            border: 1px solid #f0dcb0;
            text-align: left;
          }
          .contact-info-title {
            display: flex;
            align-items: center;
            gap: 7px;
            font-weight: 700;
            color: #92400e;
            margin-bottom: 6px !important;
          }
          .contact-info p:last-child {
            margin-bottom: 0 !important;
          }
        `}</style>
      </>
    )
  }
  if (detailsCaptured === null) {
    return null
  }

  if (!detailsCaptured || editingDetails) {
    return (
      <>
        <div className="details-gate">
          <div className="details-card">
            <div className="details-logo-ring">
              <img src={hotelViratLogo} alt="Jagali Koota" className="details-logo" />
            </div>
            <h2 className="details-title">Welcome to {branchName || "Jagali Koota"}</h2>
            <div className="details-table-chip">
              <QrCode size={16} />
              <span>Table {tableNumber}</span>
            </div>
            <p className="details-sub">
              Please share a few details before you view the menu.
            </p>

            <form onSubmit={handleDetailsSubmit}>
              <div className="details-field">
                <label>
                  <User size={16} /> Full Name <span className="req">*</span>
                </label>
                <input
                  type="text"
                  value={customerDetails.name}
                  onChange={(e) => {
                    setCustomerDetails({ ...customerDetails, name: e.target.value })
                    if (detailsError) setDetailsError("")
                  }}
                  placeholder="Enter your full name"
                  autoComplete="name"
                  autoFocus
                />
              </div>

              <div className="details-field">
                <label>
                  <Phone size={16} /> Mobile Number <span className="req">*</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={customerDetails.mobile}
                  onChange={(e) => {
                    // digits only, capped at 10 — mirrors the old checkout field
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 10)
                    setCustomerDetails({ ...customerDetails, mobile: digits })
                    if (detailsError) setDetailsError("")
                  }}
                  placeholder="Enter 10-digit mobile number"
                  maxLength="10"
                  autoComplete="tel"
                />
              </div>

              <div className="details-field">
                <label>
                  <Users size={16} /> Number of People
                </label>
                <select
                  value={customerDetails.peopleCount}
                  onChange={(e) =>
                    setCustomerDetails({ ...customerDetails, peopleCount: Number(e.target.value) })
                  }
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? "Person" : "People"}
                    </option>
                  ))}
                </select>
              </div>

              {detailsError && (
                <div className="details-error">
                  <AlertCircle size={15} />
                  <span>{detailsError}</span>
                </div>
              )}

              <button
                type="submit"
                className="details-submit"
                disabled={!customerDetails.name.trim() || customerDetails.mobile.length !== 10}
              >
                <UtensilsCrossed size={17} />
                View Menu
              </button>

              {editingDetails && (
                <button
                  type="button"
                  className="details-cancel"
                  onClick={() => {
                    setEditingDetails(false)
                    setDetailsError("")
                  }}
                >
                  Cancel
                </button>
              )}
            </form>
          </div>
        </div>

        <style jsx>{`
          .details-gate {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: radial-gradient(circle at top, #fbf3ea 0%, #f4ece4 55%, #efe3d7 100%);
            padding: 20px;
          }
          .details-card {
            width: 100%;
            max-width: 420px;
            background: #fff;
            border-radius: 20px;
            padding: 32px 26px 26px;
            box-shadow: 0 20px 50px rgba(107, 34, 25, 0.16);
            text-align: center;
          }
          .details-logo-ring {
            width: 84px;
            height: 84px;
            margin: 0 auto 16px;
            border-radius: 50%;
            padding: 4px;
            background: linear-gradient(135deg, #6B2219, #c9860a);
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .details-logo {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 50%;
            border: 3px solid #fff;
          }
          .details-title {
            font-size: 21px;
            font-weight: 800;
            color: #1f2937;
            margin-bottom: 12px;
            letter-spacing: -0.2px;
          }
          .details-table-chip {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: #fff5f4;
            color: #6B2219;
            border: 1px solid #f0dcd7;
            border-radius: 20px;
            padding: 6px 15px;
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 14px;
          }
          .details-sub {
            font-size: 13px;
            color: #6b7280;
            margin-bottom: 24px;
            line-height: 1.5;
          }
          .details-field {
            text-align: left;
            margin-bottom: 16px;
          }
          .details-field label {
            display: flex;
            align-items: center;
            gap: 7px;
            font-size: 12px;
            font-weight: 700;
            color: #4b5563;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            margin-bottom: 7px;
          }
          .details-field .req {
            color: #dc2626;
          }
          .details-field input,
          .details-field select {
            width: 100%;
            padding: 13px 14px;
            border: 1.5px solid #e5e7eb;
            border-radius: 10px;
            font-size: 15px;
            color: #1f2937;
            background: #fbfbfb;
            outline: none;
            transition: border-color 0.15s ease, background 0.15s ease;
          }
          .details-field input:focus,
          .details-field select:focus {
            border-color: #6B2219;
            background: #fff;
          }
          .details-error {
            display: flex;
            align-items: center;
            gap: 7px;
            background: #fef2f2;
            border: 1px solid #fecaca;
            color: #b91c1c;
            font-size: 13px;
            padding: 10px 12px;
            border-radius: 8px;
            margin-bottom: 14px;
            text-align: left;
          }
          .details-submit {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            padding: 15px;
            border: none;
            border-radius: 12px;
            background: linear-gradient(135deg, #6B2219, #8a2f22);
            color: #fff;
            font-size: 16px;
            font-weight: 700;
            cursor: pointer;
            margin-top: 4px;
            box-shadow: 0 10px 22px rgba(107, 34, 25, 0.28);
            transition: opacity 0.15s ease, transform 0.15s ease;
          }
          .details-submit:hover:not(:disabled) {
            transform: translateY(-1px);
          }
          .details-submit:disabled {
            opacity: 0.45;
            cursor: not-allowed;
            box-shadow: none;
          }
          .details-cancel {
            width: 100%;
            padding: 12px;
            border: none;
            background: transparent;
            color: #6b7280;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            margin-top: 8px;
          }
        `}</style>
      </>
    )
  }

  return (
    <>
      <div className="public-menu-root">
      <div className="menu-app public-menu-container">
        {/* Success Message */}
        {orderPlaced && (
          <div className="success-overlay">
            <div className="success-message">
              <div className="success-icon-badge">
                <Check size={30} strokeWidth={3} color="#fff" />
              </div>
              <h3>Order Placed Successfully!</h3>
              <p style={{ color: '#6b7280', marginTop: '4px', fontSize: '14px' }}>
                Your order has been received. Our staff will prepare it shortly.
              </p>
              <button
                className="close-success-btn"
                onClick={() => {
                  setOrderPlaced(false)
                  setLastOrderDetails(null)
                }}
              >
                <Check size={16} />
                Close
              </button>
            </div>
          </div>
        )}

        {/* Fixed Header */}
        <header className="header">
          <div className="header-container">
            <div className="brand-row">
              <div className="brand-mark">
                <img src={hotelViratLogo} alt="Logo" />
              </div>
              <div className="brand-text">
                <span className="brand-name">{branchName || "Hotel Virat"}</span>
                <span className="brand-tag">
                  <QrCode size={12} /> Table {tableNumber}
                </span>
              </div>
            </div>
            {/* Search Section */}
            <div style={{ padding: '0 16px', marginBottom: '16px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'white',
                borderRadius: '14px',
                border: '2px solid #e8ddd8',
                boxShadow: '0 2px 8px rgba(105,34,27,0.06)',
                padding: '4px 8px',
              }}>
                <Search size={20} color="#9ca3af" style={{ flexShrink: 0, marginLeft: '8px' }} />
                <input
                  type="text"
                  placeholder="Search for dishes, drinks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                    }
                  }}
                  onTouchStart={(e) => { e.stopPropagation() }}
                  onTouchMove={(e) => { e.stopPropagation() }}
                  style={{
                    flex: 1,
                    border: 'none',
                    outline: 'none',
                    padding: '12px 12px',
                    fontSize: '0.95rem',
                    fontWeight: '500',
                    color: '#1e293b',
                    background: 'transparent',
                    WebkitAppearance: 'none',
                    minWidth: 0,
                  }}
                  inputMode="search"
                  enterKeyHint="search"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      padding: '8px', background: '#f3f4f6', border: 'none',
                      borderRadius: '8px', cursor: 'pointer', color: '#6b7280',
                      flexShrink: 0,
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Floating Cart Button - show for available OR for session owner on reserved table */}
        {cart.length > 0 && (tableStatus === "available" || (tableStatus === "reserved" && isSessionOwner)) && (
          <button className="floating-cart" onClick={() => setShowCart(true)}>
            <ShoppingCart size={22} />
            <span className="cart-count">{getCartItemCount()}</span>
          </button>
        )}

        {/* Floating My Orders Button - show when customer has a session */}
        {sessionId && (
          <button className="floating-my-orders" onClick={() => setShowMyOrders(true)}>
            <History size={18} />
            <span>My Orders</span>
          </button>
        )}

        {/* Scrollable Content */}
        <main className="main-content">
          <div className="content-container">
            {/* Table Info Banner */}
            <div className="table-info-banner">
              <div className="table-info-content">
                <div className="table-info-icon">
                  <UtensilsCrossed size={22} />
                </div>
                <div className="table-info-text">
                  <h3 className="table-info-title">Table {tableNumber}</h3>
                  <p className="table-info-subtitle">
                    {branchName}
                    {tableStatus && (
                      <span className={`status-badge ${tableStatus}`}>
                        <span className="status-dot" />
                        {tableStatus === "available" ? "Available" : "Reserved"}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Food-type chips — Veg / Non-Veg / Egg */}
            <div className="subcat-row" style={{ marginBottom: "8px" }}>
              {FOOD_TYPES.map((ft) => {
                const active = selectedFoodType === ft.value
                return (
                  <button
                    key={ft.value}
                    type="button"
                    className="subcat-chip"
                    onClick={() => setSelectedFoodType(ft.value)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      border: `1.5px solid ${ft.color}`,
                      background: active ? ft.color : "white",
                      color: active ? "white" : ft.color,
                      fontWeight: "600",
                    }}
                  >
                    {ft.value !== "All" && (
                      <span
                        style={{
                          width: "14px",
                          height: "14px",
                          borderRadius: "3px",
                          border: `2px solid ${active ? "white" : ft.color}`,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span style={{
                          width: "7px",
                          height: "7px",
                          borderRadius: "50%",
                          background: active ? "white" : ft.color,
                        }} />
                      </span>
                    )}
                    <span className="subcat-chip-label">{ft.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Category chips (cuisines) — only when more than one is available */}
            {categories.length > 1 && (
              <div className="subcat-row" style={{ marginBottom: "8px" }}>
                <button
                  type="button"
                  className={`subcat-chip ${selectedCategory === "" ? "active" : ""}`}
                  onClick={() => { setSelectedCategory(""); setSelectedSubcategory("All") }}
                >
                  <span className="subcat-chip-label">All</span>
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat._id}
                    type="button"
                    className={`subcat-chip ${selectedCategory === cat._id ? "active" : ""}`}
                    onClick={() => { setSelectedCategory(cat._id); setSelectedSubcategory("All") }}
                  >
                    <span className="subcat-chip-label">{cat.name}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Subcategory chips — mirrors the Member App's menu filter */}
            {subcategoryChips.length > 1 && (
              <div className="subcat-row">
                {subcategoryChips.map((sub) => (
                  <button
                    key={sub.name}
                    type="button"
                    className={`subcat-chip ${selectedSubcategory === sub.name ? "active" : ""}`}
                    onClick={() => setSelectedSubcategory(sub.name)}
                  >
                    <span className="subcat-chip-label">{sub.name}</span>
                    <span className="subcat-chip-count">{sub.count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Results Info */}
            <div className="results-info">
              <p>
                {filteredProducts.length} item{filteredProducts.length !== 1 ? "s" : ""} found
                {selectedFoodType !== "All" && ` · ${FOOD_TYPES.find((f) => f.value === selectedFoodType)?.label}`}
                {selectedSubcategory !== "All" && ` in ${selectedSubcategory}`}
                {searchQuery && ` for "${searchQuery}"`}
              </p>
            </div>

            {/* Menu Items Grid */}
            {filteredProducts.length > 0 ? (
              <div className="menu-grid">
                {filteredProducts.map((product) => (
                  <div key={product._id} className="menu-card">
                    <div className="card-image">
                      {/* Render a CSS placeholder when there's no image, or when
                          the image failed once. No src swapping — that's what
                          caused the endless 404 -> onError -> 404 flicker. */}
                      {product.image && !brokenImages[product._id] ? (
                        <img
                          src={product.image}
                          alt={product?.name || 'Menu item'}
                          loading="lazy"
                          onError={() => markImageBroken(product._id)}
                        />
                      ) : (
                        <div className="card-image-fallback" aria-hidden="true" />
                      )}
                      {product?.foodType && (
                        <span
                          className="card-foodtype-badge"
                          style={{
                            borderColor: FOOD_TYPES.find((f) => f.value === product.foodType)?.color || "#6B2219",
                          }}
                        >
                          <span
                            className="card-foodtype-dot"
                            style={{
                              background: FOOD_TYPES.find((f) => f.value === product.foodType)?.color || "#6B2219",
                            }}
                          />
                        </span>
                      )}
                    </div>
                    <div className="card-content">
                      <div className="card-header">
                        <h3 className="product-name">{product?.name || 'Unnamed Item'}</h3>
                        <span className="product-price">₹{(product.price || 0).toFixed(2)}</span>
                      </div>
                      {product?.description && <p className="product-description">{product.description}</p>}

                      {/* Add to Cart Controls - Show if table is available OR session owner */}
                      {(tableStatus === "available" || (tableStatus === "reserved" && isSessionOwner)) && (
                        <div className="cart-controls">
                          {getItemQuantityInCart(product._id) === 0 ? (
                            <button className="add-to-cart-btn" onClick={() => addToCart(product)}>
                              <Plus size={16} />
                              Add to Cart
                            </button>
                          ) : (
                            <div className="quantity-controls">
                              <button className="quantity-btn" onClick={() => removeFromCart(product._id)}>
                                <Minus size={16} />
                              </button>
                              <span className="quantity">{getItemQuantityInCart(product._id)}</span>
                              <button className="quantity-btn" onClick={() => addToCart(product)}>
                                <Plus size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Show message if table is reserved and NOT the session owner */}
                      {tableStatus === "reserved" && !isSessionOwner && (
                        <div className="reserved-message">
                          <AlertCircle size={16} />
                          <span>Table Reserved - Contact Staff</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <Search size={28} />
                </div>
                <h3>No items found</h3>
                <p>
                  {searchQuery || selectedCategory
                    ? "Try adjusting your search or filter criteria"
                    : "No menu items available for this branch"}
                </p>
                {(searchQuery || selectedCategory) && (
                  <button
                    onClick={() => {
                      setSearchQuery("")
                      setSelectedCategory("")
                    }}
                    className="clear-filters"
                  >
                    <X size={15} />
                    Clear Filters
                  </button>
                )}
              </div>
            )}
          </div>
        </main>

        {/* Cart Modal - Show if table is available OR session owner */}
        {showCart && (tableStatus === "available" || (tableStatus === "reserved" && isSessionOwner)) && (
          <div className="modal-overlay">
            <div className="cart-modal">
              <div className="cart-header">
                <h3>
                  <ShoppingCart size={19} />
                  Your Order
                </h3>
                <button className="close-btn" onClick={() => setShowCart(false)}>
                  <X size={22} />
                </button>
              </div>

              <div className="cart-content">
                {cart.length === 0 ? (
                  <div className="empty-cart">
                    <div className="empty-cart-icon">
                      <ShoppingCart size={30} />
                    </div>
                    <p>Your cart is empty</p>
                  </div>
                ) : (
                  <>
                    <div className="cart-items">
                      {cart.map((item) => (
                        <div key={item._id} className="cart-item">
                          {item.image && !brokenImages[item._id] ? (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="cart-item-image"
                              loading="lazy"
                              onError={() => markImageBroken(item._id)}
                            />
                          ) : (
                            <div className="cart-item-image cart-item-image-fallback" aria-hidden="true" />
                          )}
                          <div className="cart-item-details">
                            <h4>{item.name}</h4>
                            <p>₹{(item.price || 0).toFixed(2)} each</p>
                          </div>
                          <div className="cart-item-controls">
                            <button onClick={() => removeFromCart(item._id)}>
                              <Minus size={16} />
                            </button>
                            <span>{item.quantity}</span>
                            <button onClick={() => addToCart(item)}>
                              <Plus size={16} />
                            </button>
                          </div>
                          <div className="cart-item-total">₹{((item.price || 0) * item.quantity).toFixed(2)}</div>
                        </div>
                      ))}
                    </div>

                    <div className="cart-summary">
                      <div className="summary-row total">
                        <span>Total:</span>
                        <span>₹{getCartTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {cart.length > 0 && (
                <div className="cart-footer">
                  <button
                    className="clear-cart-btn"
                    onClick={() => {
                      if (window.confirm('Are you sure you want to clear all items from cart?')) {
                        setCart([])
                        setShowCart(false)
                      }
                    }}
                  >
                    <Trash2 size={16} />
                    Clear Cart
                  </button>
                  <button
                    className="checkout-btn"
                    onClick={() => {
                      setShowCart(false)
                      setShowCheckout(true)
                    }}
                  >
                    Proceed to Checkout
                    <ArrowRight size={17} />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Checkout Modal - Show if table is available OR session owner */}
        {showCheckout && (tableStatus === "available" || (tableStatus === "reserved" && isSessionOwner)) && (
          <div className="modal-overlay">
            <div className="checkout-modal">
              <div className="checkout-header">
                <h3>
                  <CreditCard size={19} />
                  Order Details
                </h3>
                <button className="close-btn" onClick={() => setShowCheckout(false)}>
                  <X size={22} />
                </button>
              </div>

              <div className="checkout-content">
                {/* Details were captured on the gate screen before the menu.
                    Shown read-only here for confirmation, with Edit to correct
                    a typo (reopens the same gate form). */}
                <div className="customer-details">
                  <div className="cust-recap-head">
                    <h4>Customer Information</h4>
                    <button
                      type="button"
                      className="cust-edit-btn"
                      onClick={() => {
                        setShowCheckout(false)
                        setEditingDetails(true)
                      }}
                    >
                      Edit
                    </button>
                  </div>
                  <div className="cust-recap">
                    <div className="cust-recap-row">
                      <span className="cust-recap-label">
                        <User size={15} /> Name
                      </span>
                      <span className="cust-recap-value">{customerDetails.name || "—"}</span>
                    </div>
                    <div className="cust-recap-row">
                      <span className="cust-recap-label">
                        <Phone size={15} /> Mobile
                      </span>
                      <span className="cust-recap-value">{customerDetails.mobile || "—"}</span>
                    </div>
                    <div className="cust-recap-row">
                      <span className="cust-recap-label">
                        <Users size={15} /> People
                      </span>
                      <span className="cust-recap-value">{customerDetails.peopleCount || 1}</span>
                    </div>
                  </div>
                </div>

                <div className="order-summary">
                  <h4>Order Summary</h4>
                  <div className="summary-items">
                    {cart.map((item) => (
                      <div key={item._id} className="summary-item">
                        <span>
                          {item.name} x {item.quantity}
                        </span>
                        <span>₹{((item.price || 0) * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="summary-totals">
                    <div className="summary-row total">
                      <span>Total Amount:</span>
                      <span>₹{getCartTotal().toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="payment-info">
                  <div className="payment-method">
                    <CreditCard size={16} />
                    <span>Payment: Cash (Pay at table)</span>
                  </div>
                </div>
              </div>

              <div className="checkout-footer">
                <button
                  className="place-order-btn"
                  onClick={handlePlaceOrder}
                  disabled={processingOrder || !customerDetails.name.trim() || !customerDetails.mobile.trim()}
                >
                  {processingOrder ? (
                    <>
                      <RefreshCw size={17} className="spin-icon-inline" />
                      Placing Order...
                    </>
                  ) : (
                    <>
                      <BadgeCheck size={18} />
                      Place Order
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* My Orders Modal */}
        {showMyOrders && (
          <div className="modal-overlay" onClick={(e) => {
            // Only close if clicking the overlay itself (not the modal content)
            if (e.target === e.currentTarget) {
              setShowMyOrders(false)
            }
          }}>
            <div className="my-orders-modal" onClick={(e) => e.stopPropagation()}>
              <div className="cart-header">
                <h3>
                  <History size={19} />
                  My Orders
                </h3>
                <button className="close-btn" onClick={() => setShowMyOrders(false)}>
                  <X size={22} />
                </button>
              </div>

              <div className="cart-content">
                {loadingOrders ? (
                  <div className="loading-orders">
                    <RefreshCw size={30} className="spin-icon" />
                    <p>Loading your orders...</p>
                  </div>
                ) : myOrders.length === 0 ? (
                  <div className="empty-cart">
                    <div className="empty-cart-icon">
                      <History size={30} />
                    </div>
                    <p>No orders yet</p>
                    <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '6px' }}>
                      Place your first order to see it here
                    </p>
                  </div>
                ) : (
                  <div className="orders-list">
                    {myOrders.map((order) => {
                      const view = getOrderView(order)
                      return (
                      <div key={order._id || order.orderId} className="order-card">
                        <div className="order-header">
                          <div>
                            <h4 className="order-id">
                              {view.label}
                              <span
                                className="order-status-badge"
                                style={{
                                  background: view.badge.bg,
                                  color: view.badge.fg,
                                }}
                              >
                                {view.badge.text}
                              </span>
                            </h4>
                            <p className="order-time">
                              <Clock size={14} />
                              {new Date(order.orderTime || order.createdAt).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                          <div className="order-total">₹{view.amount.toFixed(2)}</div>
                        </div>

                        <div className="order-items">
                          {order.items?.map((item, idx) => (
                            <div key={idx} className="order-item-row">
                              <span>{item.name} x {item.quantity}</span>
                              <span>₹{((item.price || 0) * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      <style jsx global>{`
        /* Inline SVG (utensils glyph) used by the image-fallback tiles.
           Embedded as a data URI so there is no file to 404 — the missing
           /placeholder.svg is exactly what caused the old flicker loop. */
        :root {
          --food-icon: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23000' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 2v7a3 3 0 0 0 3 3v10'/%3E%3Cpath d='M6 2v7'/%3E%3Cpath d='M9 2v7a3 3 0 0 1-3 3'/%3E%3Cpath d='M17 2c-1.7 0-3 1.8-3 4s1.3 4 3 4 3-1.8 3-4-1.3-4-3-4z'/%3E%3Cpath d='M17 10v12'/%3E%3C/svg%3E");
          --brand: #6B2219;
          --brand-dark: #4a170f;
          --brand-light: #fff5f4;
          --accent: #c9860a;
        }

        /* ── Scroll / overflow fixes ─────────────────────────────────────── */
        .public-menu-root {
          height: auto !important;
          overflow: visible !important;
        }

        .public-menu-container {
          min-height: 100vh;
          height: auto;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          background-color: #f9f6f3;
          padding-bottom: 20px;
        }

        body.public-menu-active {
          overflow: auto !important;
          height: auto !important;
        }

        body.public-menu-active #root {
          overflow: visible !important;
          height: auto !important;
        }

        @media (max-width: 768px) {
          .public-menu-container {
            overflow-y: scroll;
            -webkit-overflow-scrolling: touch;
            position: relative;
          }

          body.public-menu-active {
            position: relative;
            overflow-y: scroll !important;
          }
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        html,
        body {
          height: 100%;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f9f6f3;
        }

        .menu-app {
          display: flex;
          flex-direction: column;
          position: relative;
        }

        /* Success Overlay */
        .success-overlay {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100% !important;
          height: 100% !important;
          background: rgba(31, 20, 15, 0.65) !important;
          backdrop-filter: blur(2px);
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          z-index: 9999 !important;
          padding: 20px !important;
          box-sizing: border-box !important;
          overflow: auto !important;
        }

        .success-message {
          position: relative !important;
          background: white !important;
          padding: 36px 30px !important;
          border-radius: 20px !important;
          text-align: center !important;
          width: 100% !important;
          max-width: 380px !important;
          min-width: 280px !important;
          margin: auto !important;
          box-shadow: 0 25px 60px -12px rgba(107, 34, 25, 0.35) !important;
          transform: scale(1) !important;
          animation: successSlideIn 0.3s ease-out !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
        }

        .success-icon-badge {
          width: 60px !important;
          height: 60px !important;
          border-radius: 50% !important;
          background: linear-gradient(135deg, #10b981, #059669) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin-bottom: 6px !important;
          box-shadow: 0 8px 20px rgba(16, 185, 129, 0.35) !important;
        }

        @keyframes successSlideIn {
          0% {
            opacity: 0;
            transform: scale(0.9) translateY(-20px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .success-message h3 {
          color: #111827 !important;
          margin: 14px 0 2px 0 !important;
          font-size: 20px !important;
          font-weight: 800 !important;
          width: 100% !important;
        }

        .success-message p {
          color: #666 !important;
          line-height: 1.5 !important;
          margin-bottom: 4px !important;
          font-size: 14px !important;
        }

        .close-success-btn {
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 7px !important;
          margin-top: 22px !important;
          padding: 13px 32px !important;
          background: var(--brand) !important;
          color: white !important;
          border: none !important;
          border-radius: 10px !important;
          cursor: pointer !important;
          font-size: 14px !important;
          font-weight: 700 !important;
          transition: all 0.2s ease !important;
          width: 100% !important;
          text-align: center !important;
        }

        .close-success-btn:hover {
          background: var(--brand-dark) !important;
          transform: translateY(-1px) !important;
        }

        /* Mobile Responsive for Success Message */
        @media (max-width: 640px) {
          .success-overlay {
            padding: 20px !important;
            align-items: center !important;
            justify-content: center !important;
          }

          .success-message {
            padding: 30px 22px !important;
            max-width: calc(100vw - 40px) !important;
            min-width: unset !important;
            width: auto !important;
            margin: auto !important;
          }

          .success-message h3 {
            font-size: 18px !important;
          }

          .success-message p {
            font-size: 13px !important;
          }
        }

        /* Header - Fixed */
        .header {
          background: white;
          border-bottom: 1px solid #eee2db;
          box-shadow: 0 2px 10px rgba(107, 34, 25, 0.05);
          flex-shrink: 0;
          z-index: 10;
          position: sticky;
          top: 0;
        }

        .header-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 12px 16px;
        }

        .brand-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 10px;
        }

        .brand-mark {
          width: 38px;
          height: 38px;
          border-radius: 10px;
          overflow: hidden;
          flex-shrink: 0;
          border: 1.5px solid #eee2db;
        }

        .brand-mark img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .brand-text {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .brand-name {
          font-size: 15px;
          font-weight: 800;
          color: #1f2937;
          letter-spacing: -0.2px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .brand-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 11px;
          font-weight: 700;
          color: var(--brand);
        }

        .search-section {
          display: flex;
          gap: 12px;
          width: 100%;
          align-items: center;
        }

        .search-box {
          position: relative;
          flex: 1;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #b3a49c;
          pointer-events: none;
          z-index: 1;
        }

        .search-clear {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: none;
          background: #eee2db;
          color: #6b5b53;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .search-input {
          width: 100%;
          padding: 11px 34px 11px 38px;
          border: 1.5px solid #eee2db;
          border-radius: 10px;
          font-size: 14px;
          outline: none;
          background: #faf6f2;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        .search-input:focus {
          border-color: var(--brand);
          background: white;
          box-shadow: 0 0 0 3px rgba(107, 34, 25, 0.08);
        }

        /* Mobile-specific search improvements */
        @media (max-width: 640px) {
          .search-input {
            font-size: 16px; /* Prevents iOS zoom on focus */
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            touch-action: manipulation;
          }

          .search-section {
            gap: 8px;
          }
        }

        /* Floating Cart Button */
        .floating-cart {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 58px;
          height: 58px;
          background: linear-gradient(135deg, var(--brand), var(--brand-dark));
          color: white;
          border: none;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 22px rgba(107, 34, 25, 0.35);
          cursor: pointer;
          z-index: 100;
          transition: transform 0.2s ease;
        }

        .floating-cart:hover {
          transform: scale(1.08);
        }

        .cart-count {
          position: absolute;
          top: -4px;
          right: -4px;
          background: var(--accent);
          color: white;
          border-radius: 50%;
          width: 23px;
          height: 23px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 800;
          border: 2px solid #fff;
        }

        /* Floating My Orders Button */
        .floating-my-orders {
          position: fixed;
          bottom: 20px;
          left: 20px;
          height: 44px;
          padding: 0 16px;
          background: #1f2937;
          color: white;
          border: none;
          border-radius: 22px;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.22);
          cursor: pointer;
          z-index: 100;
          transition: transform 0.2s ease;
          font-size: 13px;
          font-weight: 700;
        }

        .floating-my-orders:hover {
          transform: scale(1.05);
        }

        /* Main Content */
        .main-content {
          flex: 1;
        }

        .content-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }

        /* Table Info Banner */
        .table-info-banner {
          background: linear-gradient(135deg, #fff8f3 0%, #fdf1ec 100%);
          border: 1px solid #f3ddd2;
          border-radius: 14px;
          padding: 16px 18px;
          margin-bottom: 20px;
        }

        .table-info-content {
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .table-info-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: var(--brand);
          color: #f4e9c9;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .table-info-text {
          display: flex;
          flex-direction: column;
        }

        .table-info-title {
          font-size: 17px;
          font-weight: 800;
          color: #1f2937;
          margin: 0;
        }

        .table-info-subtitle {
          font-size: 13px;
          color: #7a6a61;
          margin: 2px 0 0;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          font-weight: 800;
          padding: 3px 9px;
          border-radius: 12px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }

        .status-badge.available {
          background: #dcfce7;
          color: #166534;
        }
        .status-badge.available .status-dot {
          background: #16a34a;
        }

        .status-badge.reserved {
          background: #fef3c7;
          color: #92400e;
        }
        .status-badge.reserved .status-dot {
          background: #d97706;
        }

        .results-info {
          text-align: center;
          margin-bottom: 22px;
          color: #8a7a71;
          font-size: 13px;
          font-weight: 600;
        }

        /* Menu Grid */
        .menu-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 18px;
          margin-bottom: 40px;
        }

        .menu-card {
          background: white;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(107, 34, 25, 0.06);
          border: 1px solid #f2e9e2;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .menu-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 28px rgba(107, 34, 25, 0.14);
        }

        .card-image {
          width: 100%;
          height: 150px;
          overflow: hidden;
          position: relative;
        }

        .card-image img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.35s ease;
        }

        .menu-card:hover .card-image img {
          transform: scale(1.06);
        }

        .card-foodtype-badge {
          position: absolute;
          top: 8px;
          left: 8px;
          width: 20px;
          height: 20px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.92);
          border: 1.5px solid;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-foodtype-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        /* Fallback shown when a menu item has no image, or its image 404s.
           Pure CSS — no network request, so it cannot fail or flicker. */
        .card-image-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #f5efec 0%, #e8dcd7 100%);
        }

        .card-image-fallback::after {
          content: "";
          width: 34px;
          height: 34px;
          opacity: 0.45;
          background-color: #b08d80;
          -webkit-mask: var(--food-icon) center / contain no-repeat;
          mask: var(--food-icon) center / contain no-repeat;
        }

        /* Subcategory filter chips */
        .subcat-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding: 4px 0 10px;
          margin-bottom: 4px;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }

        .subcat-row::-webkit-scrollbar {
          display: none;
        }

        .subcat-chip {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 34px;
          padding: 0 14px;
          border-radius: 17px;
          border: 1px solid #e5ddd9;
          background: #fff;
          color: #6b5b53;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
        }

        .subcat-chip:hover {
          border-color: #d3bdb4;
        }

        .subcat-chip.active {
          background: var(--brand);
          border-color: var(--brand);
          color: #fff;
        }

        .subcat-chip-count {
          font-size: 11px;
          font-weight: 700;
          opacity: 0.75;
        }

        .card-content {
          padding: 14px;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 8px;
          gap: 10px;
        }

        .product-name {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          flex: 1;
          line-height: 1.35;
        }

        .product-price {
          font-size: 14px;
          font-weight: 800;
          color: var(--brand);
          flex-shrink: 0;
        }

        .product-description {
          font-size: 12px;
          color: #8a7a71;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-bottom: 10px;
        }

        /* Cart Controls */
        .cart-controls {
          margin-top: 10px;
        }

        .add-to-cart-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          padding: 9px;
          background: var(--brand);
          color: white;
          border: none;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .add-to-cart-btn:hover {
          background: var(--brand-dark);
        }

        .quantity-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          background: #faf6f2;
          border-radius: 9px;
          padding: 4px;
        }

        .quantity-btn {
          width: 30px;
          height: 30px;
          border: 1px solid #eee2db;
          background: white;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          color: var(--brand);
        }

        .quantity-btn:hover {
          background: var(--brand);
          color: white;
          border-color: var(--brand);
        }

        .quantity {
          font-weight: 700;
          font-size: 15px;
          min-width: 26px;
          text-align: center;
        }

        /* NEW: Reserved message styling */
        .reserved-message {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 12px;
          padding: 10px;
          background: #fef3c7;
          color: #92400e;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          height: 100%;
          background: rgba(31, 20, 15, 0.55);
          backdrop-filter: blur(1px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
          box-sizing: border-box;
          overflow: auto;
        }

        .cart-modal, .checkout-modal {
          background: white;
          border-radius: 16px;
          max-width: 500px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          margin: auto;
          position: relative;
        }

        .cart-header, .checkout-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 18px 20px;
          border-bottom: 1px solid #f2e9e2;
        }

        .cart-header h3, .checkout-header h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 18px;
          font-weight: 800;
          color: #111827;
        }

        .close-btn {
          background: #f5efec;
          border: none;
          cursor: pointer;
          color: #6b5b53;
          padding: 6px;
          border-radius: 8px;
          display: flex;
        }

        .close-btn:hover {
          background: #eee2db;
          color: #111827;
        }

        .cart-content, .checkout-content {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
        }

        .empty-cart {
          text-align: center;
          padding: 50px 20px;
          color: #8a7a71;
        }

        .empty-cart-icon, .empty-state-icon {
          width: 56px;
          height: 56px;
          margin: 0 auto 14px;
          border-radius: 50%;
          background: #f5efec;
          color: #b08d80;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cart-items {
          margin-bottom: 20px;
        }

        .cart-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid #f5efec;
        }

        .cart-item:last-child {
          border-bottom: none;
        }

        .cart-item-image {
          width: 50px;
          height: 50px;
          object-fit: cover;
          border-radius: 8px;
        }

        .cart-item-image-fallback {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #f5efec 0%, #e8dcd7 100%);
        }

        .cart-item-image-fallback::after {
          content: "";
          width: 20px;
          height: 20px;
          opacity: 0.45;
          background-color: #b08d80;
          -webkit-mask: var(--food-icon) center / contain no-repeat;
          mask: var(--food-icon) center / contain no-repeat;
        }

        /* Read-only customer recap in the checkout modal */
        .cust-recap-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .cust-edit-btn {
          background: transparent;
          border: 1px solid #e5ddd9;
          color: var(--brand);
          font-size: 12px;
          font-weight: 700;
          padding: 5px 12px;
          border-radius: 14px;
          cursor: pointer;
        }

        .cust-edit-btn:hover {
          background: var(--brand-light);
        }

        .cust-recap {
          background: #faf6f2;
          border: 1px solid #f2e9e2;
          border-radius: 12px;
          padding: 4px 12px;
          margin-top: 10px;
        }

        .cust-recap-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid #f2e9e2;
        }

        .cust-recap-row:last-child {
          border-bottom: none;
        }

        .cust-recap-label {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 13px;
          color: #8a7a71;
        }

        .cust-recap-value {
          font-size: 14px;
          font-weight: 700;
          color: #1f2937;
          text-align: right;
          word-break: break-word;
        }

        .cart-item-details {
          flex: 1;
        }

        .cart-item-details h4 {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 4px;
        }

        .cart-item-details p {
          font-size: 12px;
          color: #8a7a71;
        }

        .cart-item-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .cart-item-controls button {
          width: 28px;
          height: 28px;
          border: 1px solid #eee2db;
          background: white;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: var(--brand);
        }

        .cart-item-controls button:hover {
          background: var(--brand);
          color: white;
          border-color: var(--brand);
        }

        .cart-item-controls span {
          font-weight: 700;
          min-width: 20px;
          text-align: center;
        }

        .cart-item-total {
          font-weight: 700;
          color: var(--brand);
          min-width: 60px;
          text-align: right;
        }

        .cart-summary, .summary-totals {
          border-top: 1px solid #f2e9e2;
          padding-top: 16px;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .summary-row.total {
          font-weight: 800;
          font-size: 17px;
          color: #111827;
          border-top: 1px solid #f2e9e2;
          padding-top: 10px;
          margin-top: 8px;
        }

        .cart-footer, .checkout-footer {
          padding: 18px 20px;
          border-top: 1px solid #f2e9e2;
        }

        .checkout-btn, .place-order-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, var(--brand), var(--brand-dark));
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
          box-shadow: 0 8px 18px rgba(107, 34, 25, 0.25);
        }

        .checkout-btn:hover, .place-order-btn:hover {
          transform: translateY(-1px);
        }

        .clear-cart-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #fdf1ef;
          color: #b3401f;
          border: 1px solid #f6dbd4;
          padding: 12px 20px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 700;
          margin-bottom: 10px;
          width: 100%;
        }

        .clear-cart-btn:hover {
          background: #fbe3de;
        }

        .place-order-btn:disabled {
          background: #d1d5db;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .spin-icon-inline {
          animation: spin 1s linear infinite;
        }

        /* My Orders Modal Styles */
        .my-orders-modal {
          background: white;
          border-radius: 16px;
          max-width: 600px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          margin: auto;
        }

        .loading-orders {
          text-align: center;
          padding: 60px 20px;
          color: #8a7a71;
        }

        .spin-icon {
          animation: spin 1s linear infinite;
          margin-bottom: 16px;
          color: var(--brand);
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .orders-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .order-card {
          background: #faf6f2;
          border: 1px solid #f2e9e2;
          border-radius: 14px;
          padding: 16px;
        }

        .order-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f2e9e2;
        }

        .order-id {
          display: flex;
          align-items: center;
          font-size: 16px;
          font-weight: 700;
          color: #111827;
          margin-bottom: 4px;
        }

        .order-status-badge {
          margin-left: 8px;
          font-size: 11px;
          font-weight: 800;
          padding: 2px 9px;
          border-radius: 999px;
        }

        .order-time {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          color: #8a7a71;
        }

        .order-total {
          font-size: 18px;
          font-weight: 800;
          color: var(--brand);
        }

        .order-items {
          margin-bottom: 4px;
        }

        .order-item-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          font-size: 14px;
          color: #4b5563;
        }

        /* Checkout Specific Styles */
        .customer-details, .order-summary, .payment-info {
          margin-bottom: 24px;
        }

        .customer-details h4, .order-summary h4 {
          font-size: 15px;
          font-weight: 800;
          color: #111827;
          margin-bottom: 14px;
        }

        .summary-items {
          margin-bottom: 16px;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
          color: #4b5563;
        }

        .payment-method {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px;
          background: var(--brand-light);
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          color: var(--brand);
        }

        /* Empty State */
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #8a7a71;
        }

        .empty-state h3 {
          color: #111827;
          margin-bottom: 8px;
          font-size: 17px;
          font-weight: 800;
        }

        .empty-state p {
          margin-bottom: 20px;
          font-size: 14px;
        }

        .clear-filters {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--brand);
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 9px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 700;
        }

        .clear-filters:hover {
          background: var(--brand-dark);
        }

        /* Mobile Responsive */
        @media (max-width: 640px) {
          .content-container {
            padding: 16px;
          }

          .menu-grid {
            grid-template-columns: 1fr;
            gap: 14px;
          }

          .card-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
          }

          .floating-cart {
            bottom: 80px;
          }

          .floating-my-orders {
            bottom: 80px;
          }

          .modal-overlay {
            padding: 15px;
            align-items: center;
            justify-content: center;
          }

          .cart-modal, .checkout-modal {
            margin: auto;
            max-height: calc(100vh - 30px);
            max-width: calc(100vw - 30px);
            width: 100%;
          }

          .success-message {
            margin: auto;
            padding: 30px 20px;
          }
        }

        /* Tablet and Desktop */
        @media (min-width: 641px) {
          .header-container {
            padding: 16px 20px;
          }
        }

        /* Tablet */
        @media (min-width: 641px) and (max-width: 1024px) {
          .menu-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        /* Large Desktop */
        @media (min-width: 1200px) {
          .menu-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }

        /* Custom Scrollbar */
        .main-content::-webkit-scrollbar, .cart-content::-webkit-scrollbar, .checkout-content::-webkit-scrollbar {
          width: 8px;
        }

        .main-content::-webkit-scrollbar-track, .cart-content::-webkit-scrollbar-track, .checkout-content::-webkit-scrollbar-track {
          background: #f5efec;
        }

        .main-content::-webkit-scrollbar-thumb, .cart-content::-webkit-scrollbar-thumb, .checkout-content::-webkit-scrollbar-thumb {
          background: #d9c7bd;
          border-radius: 4px;
        }

        .main-content::-webkit-scrollbar-thumb:hover, .cart-content::-webkit-scrollbar-thumb:hover, .checkout-content::-webkit-scrollbar-thumb:hover {
          background: #c2a89a;
        }
      `}</style>
    </>
  )
}
export default PublicMenu