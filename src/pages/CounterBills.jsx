import { useState, useEffect } from "react"
import {
  Search,
  Download,
  X,
  Check,
  AlertCircle,
  Loader,
  Receipt,
  Calendar,
  Eye,
  FileText,
  Filter,
  RefreshCw,
  TrendingUp,
  BarChart3,
  Printer,
} from "lucide-react"
import axios from "axios"
import hotelViratLogo from "../assets/logo4.jpeg"

// Create axios instance
const api = axios.create({
  baseURL: "https://billing.jagalikoota.com/api/v1/hotel",
  headers: {
    "Content-Type": "application/json",
  },
})

const CounterBills = () => {
  const [allBills, setAllBills] = useState([])
  const [displayedBills, setDisplayedBills] = useState([])
  const [filteredBills, setFilteredBills] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [statistics, setStatistics] = useState(null)

  // State for modals
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [statsModalOpen, setStatsModalOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [selectedBill, setSelectedBill] = useState(null)
  const [successMessage, setSuccessMessage] = useState("")

  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [branchFilter, setBranchFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("all")
  const [customerFilter, setCustomerFilter] = useState("")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const billsPerPage = 10

  // Fetch bills and branches on component mount or when filters change
  useEffect(() => {
    fetchBranches()
    fetchBills()
  }, [branchFilter, dateFilter, customerFilter])

  // Fetch all branches
  const fetchBranches = async () => {
    try {
      const response = await api.get("/branch")
      setBranches(response.data)
    } catch (error) {
      console.error("Error fetching branches:", error)
    }
  }

  // Format date to YYYY-MM-DD
  const formatDate = (date) => {
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  }

  // Fetch all counter bills
  const fetchBills = async () => {
    setLoading(true)
    setError("")

    try {
      const params = {}

      if (branchFilter !== "all") {
        params.branchId = branchFilter
      }

      if (customerFilter.trim()) {
        params.customerName = customerFilter.trim()
      }

      if (dateFilter !== "all") {
        const now = new Date()
        const startDate = new Date()

        switch (dateFilter) {
          case "today":
            params.startDate = formatDate(now)
            params.endDate = formatDate(now)
            break
          case "week":
            startDate.setDate(now.getDate() - 7)
            params.startDate = formatDate(startDate)
            params.endDate = formatDate(now)
            break
          case "month":
            startDate.setMonth(now.getMonth() - 1)
            params.startDate = formatDate(startDate)
            params.endDate = formatDate(now)
            break
        }
      }

/*       console.log("API Request Params:", params)
 */
      const response = await api.get("/counter-bill", { params })

      // Handle new API response format {success, count, data}
      let billsData = []
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        // New format: {success, count, data}
        billsData = response.data.data
      } else if (response.data && response.data.bills && Array.isArray(response.data.bills)) {
        // Current format: {bills: [...]}
        billsData = response.data.bills
      } else if (Array.isArray(response.data)) {
        // Direct array format
        billsData = response.data
      } else {
        console.error("❌ Unexpected response format:", response.data)
        throw new Error("Invalid response format")
      }

      const formattedBills = billsData.map((bill, index) => ({
        id: bill.id || `temp-id-${index}`,
        billId: `CB-${bill.id?.slice(-6) || index}`,
        orderId: bill.order?.id || "N/A",
        invoiceNumber: bill.invoice?.invoiceNumber || "N/A",
        customer: bill.customerName || "Unknown Customer",
        customerMobile: bill.phoneNumber || "N/A",
        counterUser: bill.userId?.name || "Unknown Counter",
        counterMobile: bill.userId?.mobile || "N/A",
        date: bill.date || new Date().toLocaleDateString("en-IN"),
        time:
          bill.time ||
          new Date().toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        branch: bill.branch?.name || "Unknown Branch",
        branchId: bill.branch?.id || null,
        branchAddress: bill.branch?.location || "Unknown Address",
        items: bill.items?.length || 0,
        // Use backend values for tax and service charge
        subtotal: bill.subtotal || 0,
        tax: bill.tax || 0,
        serviceCharge: bill.serviceCharge || 0,
        totalAmount: bill.grandTotal || bill.totalAmount || 0,
        amount: `₹${(bill.grandTotal || bill.totalAmount || 0).toFixed(2)}`,
        originalBill: bill,
        createdAt: bill.createdAt || new Date().toISOString(),
      }))

      setAllBills(formattedBills)
      calculateStatistics(formattedBills)
    } catch (error) {
      console.error("Error fetching counter bills:", error)
      setError("Failed to load counter bills. Please refresh the page and try again.")
    } finally {
      setLoading(false)
    }
  }

  // Calculate statistics from bills
  const calculateStatistics = (bills = allBills) => {
    if (bills.length === 0) {
      setStatistics({
        totalBills: 0,
        totalRevenue: 0,
        averageBillValue: 0,
      })
      return
    }

    const totalBills = bills.length
    const totalRevenue = bills.reduce((sum, bill) => sum + bill.totalAmount, 0)
    const averageBillValue = totalRevenue / totalBills

    setStatistics({
      totalBills,
      totalRevenue,
      averageBillValue,
    })
  }

  // Handle search filtering and pagination
  useEffect(() => {
    const filtered = allBills.filter((bill) => {
      if (!searchTerm.trim()) return true

      const searchLower = searchTerm.trim().toLowerCase()
      return (
        bill.billId.toLowerCase().includes(searchLower) ||
        bill.orderId.toLowerCase().includes(searchLower) ||
        bill.customer.toLowerCase().includes(searchLower) ||
        bill.customerMobile.includes(searchTerm.trim()) ||
        bill.invoiceNumber.toLowerCase().includes(searchLower)
      )
    })
    setFilteredBills(filtered)
    setTotalPages(Math.ceil(filtered.length / billsPerPage))
    setCurrentPage(1)
  }, [allBills, searchTerm])

  // Handle pagination
  useEffect(() => {
    const startIndex = (currentPage - 1) * billsPerPage
    const endIndex = startIndex + billsPerPage
    const paginatedBills = filteredBills.slice(startIndex, endIndex)
    setDisplayedBills(paginatedBills)
  }, [filteredBills, currentPage])

  // Convert image to base64
  const getBase64Image = (img) => {
    const canvas = document.createElement("canvas")
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext("2d")
    ctx.drawImage(img, 0, 0)
    return canvas.toDataURL("image/jpeg")
  }

  // Generate PDF for individual bill
  const generateBillPDF = (bill) => {
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

      const billHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Counter Bill ${bill.billId}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ff7e47; padding-bottom: 20px; }
            .logo { width: 80px; height: 80px; margin: 0 auto 15px; border-radius: 8px; display: block; }
            .company-name { font-size: 28px; font-weight: bold; color: #ff7e47; margin: 10px 0; }
            .company-address { font-size: 14px; color: #666; margin: 5px 0; }
            .bill-title { font-size: 20px; font-weight: bold; color: #333; margin-top: 15px; }
            .bill-details { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
            .detail-section h3 { color: #333; margin-bottom: 15px; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 3px 0; }
            .detail-label { font-weight: bold; color: #555; }
            .detail-value { color: #333; }
            .items-section { margin-bottom: 25px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .items-table th, .items-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            .items-table th { background-color: #f8f9fa; font-weight: bold; color: #333; }
            .items-table tbody tr:nth-child(even) { background-color: #f9f9f9; }
            .total-section { margin-top: 25px; border-top: 2px solid #ff7e47; padding-top: 15px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 3px 0; }
            .total-label { font-weight: bold; }
            .grand-total { font-size: 18px; font-weight: bold; color: #ff7e47; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px; }
            .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
            .thank-you { font-size: 16px; color: #ff7e47; font-weight: bold; margin-bottom: 10px; }
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
            <div class="company-address">${bill.branchAddress}</div>
            <div class="bill-title">Counter Bill</div>
            <div style="font-size: 14px; color: #666;">Bill No: ${bill.billId}</div>
          </div>
          
          <div class="bill-details">
            <div class="detail-section">
              <h3>Bill Details</h3>
              <div class="detail-row">
                <span class="detail-label">Bill ID:</span>
                <span class="detail-value">${bill.billId}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Order ID:</span>
                <span class="detail-value">${bill.orderId}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Invoice No:</span>
                <span class="detail-value">${bill.invoiceNumber}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${bill.date}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Time:</span>
                <span class="detail-value">${bill.time}</span>
              </div>
            </div>
            
            <div class="detail-section">
              <h3>Customer & Counter Details</h3>
              <div class="detail-row">
                <span class="detail-label">Customer Name:</span>
                <span class="detail-value">${bill.customer}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Customer Mobile:</span>
                <span class="detail-value">${bill.customerMobile}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Counter User:</span>
                <span class="detail-value">${bill.counterUser}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Branch:</span>
                <span class="detail-value">${bill.branch}</span>
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
                  bill.originalBill?.items
                    ?.map(
                      (item) => `
                    <tr>
                      <td>${item.name}</td>
                      <td style="text-align: center;">${item.quantity}</td>
                      <td style="text-align: right;">₹${item.price.toFixed(2)}</td>
                      <td style="text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                  `,
                    )
                    .join("") || "<tr><td colspan='4' style='text-align: center;'>No items available</td></tr>"
                }
              </tbody>
            </table>
          </div>

          <div class="total-section">
            <div class="total-row">
              <span class="total-label">Subtotal:</span>
              <span>₹${bill.subtotal.toFixed(2)}</span>
            </div>
            ${
              bill.tax > 0
                ? `
            <div class="total-row">
              <span class="total-label">Tax:</span>
              <span>₹${bill.tax.toFixed(2)}</span>
            </div>
            `
                : ""
            }
            ${
              bill.serviceCharge > 0
                ? `
            <div class="total-row">
              <span class="total-label">Service Charge:</span>
              <span>₹${bill.serviceCharge.toFixed(2)}</span>
            </div>
            `
                : ""
            }
            <div class="total-row grand-total">
              <span>Grand Total:</span>
              <span>₹${bill.totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div class="footer">
            <div class="thank-you">Thank you for dining with us!</div>
            <p>We hope you enjoyed your meal. Please visit us again soon.</p>
            <p style="font-size: 12px; margin-top: 15px;">Generated on ${new Date().toLocaleString("en-IN")}</p>
          </div>
        </body>
        </html>
      `

      printWindow.document.write(billHTML)
      printWindow.document.close()
      printWindow.focus()

      // Wait a bit for content to load then print
      setTimeout(() => {
        printWindow.print()
      }, 500)
    }

    img.onerror = () => {
      console.warn("Could not load logo image, generating PDF without logo")
      // Generate PDF without logo (fallback)
      const billHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Counter Bill ${bill.billId}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; color: #333; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ff7e47; padding-bottom: 20px; }
            .company-name { font-size: 28px; font-weight: bold; color: #ff7e47; margin-bottom: 10px; }
            .company-address { font-size: 14px; color: #666; margin: 5px 0; }
            .bill-title { font-size: 20px; font-weight: bold; color: #333; margin-top: 15px; }
            .bill-details { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
            .detail-section h3 { color: #333; margin-bottom: 15px; font-size: 16px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            .detail-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 3px 0; }
            .detail-label { font-weight: bold; color: #555; }
            .detail-value { color: #333; }
            .items-section { margin-bottom: 25px; }
            .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .items-table th, .items-table td { border: 1px solid #ddd; padding: 10px; text-align: left; }
            .items-table th { background-color: #f8f9fa; font-weight: bold; color: #333; }
            .items-table tbody tr:nth-child(even) { background-color: #f9f9f9; }
            .total-section { margin-top: 25px; border-top: 2px solid #ff7e47; padding-top: 15px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 8px; padding: 3px 0; }
            .total-label { font-weight: bold; }
            .grand-total { font-size: 18px; font-weight: bold; color: #ff7e47; border-top: 1px solid #ddd; padding-top: 10px; margin-top: 10px; }
            .footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; }
            .thank-you { font-size: 16px; color: #ff7e47; font-weight: bold; margin-bottom: 10px; }
            @media print { 
              body { margin: 0; } 
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="company-name">Hotel Virat</h1>
            <div class="company-address">${bill.branchAddress}</div>
            <div class="bill-title">Counter Bill</div>
            <div style="font-size: 14px; color: #666;">Bill No: ${bill.billId}</div>
          </div>
          
          <div class="bill-details">
            <div class="detail-section">
              <h3>Bill Details</h3>
              <div class="detail-row">
                <span class="detail-label">Bill ID:</span>
                <span class="detail-value">${bill.billId}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Order ID:</span>
                <span class="detail-value">${bill.orderId}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Invoice No:</span>
                <span class="detail-value">${bill.invoiceNumber}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Date:</span>
                <span class="detail-value">${bill.date}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Time:</span>
                <span class="detail-value">${bill.time}</span>
              </div>
            </div>
            
            <div class="detail-section">
              <h3>Customer & Counter Details</h3>
              <div class="detail-row">
                <span class="detail-label">Customer Name:</span>
                <span class="detail-value">${bill.customer}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Customer Mobile:</span>
                <span class="detail-value">${bill.customerMobile}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Counter User:</span>
                <span class="detail-value">${bill.counterUser}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Branch:</span>
                <span class="detail-value">${bill.branch}</span>
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
                  bill.originalBill?.items
                    ?.map(
                      (item) => `
                    <tr>
                      <td>${item.name}</td>
                      <td style="text-align: center;">${item.quantity}</td>
                      <td style="text-align: right;">₹${item.price.toFixed(2)}</td>
                      <td style="text-align: right;">₹${(item.price * item.quantity).toFixed(2)}</td>
                    </tr>
                  `,
                    )
                    .join("") || "<tr><td colspan='4' style='text-align: center;'>No items available</td></tr>"
                }
              </tbody>
            </table>
          </div>

          <div class="total-section">
            <div class="total-row">
              <span class="total-label">Subtotal:</span>
              <span>₹${bill.subtotal.toFixed(2)}</span>
            </div>
            ${
              bill.tax > 0
                ? `
            <div class="total-row">
              <span class="total-label">Tax:</span>
              <span>₹${bill.tax.toFixed(2)}</span>
            </div>
            `
                : ""
            }
            ${
              bill.serviceCharge > 0
                ? `
            <div class="total-row">
              <span class="total-label">Service Charge:</span>
              <span>₹${bill.serviceCharge.toFixed(2)}</span>
            </div>
            `
                : ""
            }
            <div class="total-row grand-total">
              <span>Grand Total:</span>
              <span>₹${bill.totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div class="footer">
            <div class="thank-you">Thank you for dining with us!</div>
            <p>We hope you enjoyed your meal. Please visit us again soon.</p>
            <p style="font-size: 12px; margin-top: 15px;">Generated on ${new Date().toLocaleString("en-IN")}</p>
          </div>
        </body>
        </html>
      `

      printWindow.document.write(billHTML)
      printWindow.document.close()
      printWindow.focus()

      setTimeout(() => {
        printWindow.print()
      }, 500)
    }

    // Try to load the logo
    img.src = hotelViratLogo
  }

  // Print bill receipt for thermal printer (80mm width)
  const printThermalReceipt = (bill) => {
    const printWindow = window.open("", "_blank", "width=302,height=600")

    // Calculate GST from items
    const items = bill.originalBill?.items || []
    const itemsSubtotal = items.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 1)), 0)
    const itemsGST = items.reduce((sum, item) => {
      const rate = item.gstRate || 0
      return sum + (((item.price || 0) * (item.quantity || 1) * rate) / 100)
    }, 0)
    const hasGST = itemsGST > 0
    const grandTotal = itemsSubtotal + itemsGST
    
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Bill ${bill.billId}</title>
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
          .bill-info { margin-bottom: 10px; }
          .bill-id { font-size: 14px; font-weight: bold; text-align: center; margin: 8px 0; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .info-label { font-weight: bold; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .items-header { font-weight: bold; margin-bottom: 5px; }
          .item-row { margin-bottom: 5px; }
          .item-name { font-weight: bold; }
          .item-details { display: flex; justify-content: space-between; font-size: 11px; }
          .totals { margin-top: 10px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; }
          .grand-total { font-size: 14px; font-weight: bold; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
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
          <div class="hotel-name">JAGALI KOOTA</div>
          <div class="branch-name">${bill.branch}</div>
        </div>
        
        <div class="bill-id">Bill #${bill.billId}</div>
        <div style="text-align: center; font-size: 11px; margin-bottom: 8px;">Invoice: ${bill.invoiceNumber}</div>
        
        <div class="bill-info">
          <div class="info-row">
            <span class="info-label">Date:</span>
            <span>${bill.date}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Time:</span>
            <span>${bill.time}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Customer:</span>
            <span>${bill.customer}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Mobile:</span>
            <span>${bill.customerMobile}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Counter:</span>
            <span>${bill.counterUser}</span>
          </div>
        </div>
        
        <div class="divider"></div>
        
        <div class="items-section">
          <div class="items-header">ITEMS</div>
          ${items.map(item => `
            <div class="item-row">
              <div class="item-name">${item.name}</div>
              <div class="item-details">
                <span>${item.quantity} x ₹${(item.price || 0).toFixed(2)}</span>
                <span>₹${((item.price || 0) * (item.quantity || 1)).toFixed(2)}</span>
              </div>
            </div>
          `).join('') || '<div>No items</div>'}
        </div>
        
        <div class="divider"></div>
        
        <div class="totals">
          <div class="total-row">
            <span>Subtotal:</span>
            <span>₹${itemsSubtotal.toFixed(2)}</span>
          </div>
          ${hasGST ? `
          <div class="total-row">
            <span>GST Amount:</span>
            <span>₹${itemsGST.toFixed(2)}</span>
          </div>
          ` : ''}
          <div class="total-row grand-total">
            <span>GRAND TOTAL:</span>
            <span>₹${(hasGST ? grandTotal : (bill.totalAmount || itemsSubtotal)).toFixed(2)}</span>
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

  // Handle view bill
  const handleViewBill = (bill) => {
    setSelectedBill(bill)
    setViewModalOpen(true)
  }

  // Close modals
  const closeViewModal = () => {
    setViewModalOpen(false)
    setSelectedBill(null)
  }

  const closeStatsModal = () => {
    setStatsModalOpen(false)
  }

  // Reset pagination when filters change
  const handleFilterChange = (type, value) => {
    if (type === "branch") {
      setBranchFilter(value)
    } else if (type === "date") {
      setDateFilter(value)
    } else if (type === "customer") {
      setCustomerFilter(value)
    }
    setCurrentPage(1)
  }

  // Export bills as CSV
  const exportBills = () => {
    let csv =
      "Bill ID,Order ID,Invoice No,Customer,Mobile,Counter User,Date,Time,Branch,Items,Subtotal,Tax,Service Charge,Total Amount\n"

    filteredBills.forEach((bill) => {
      csv += `${bill.billId},${bill.orderId},${bill.invoiceNumber},"${bill.customer}",${bill.customerMobile},"${bill.counterUser}","${bill.date}","${bill.time}","${bill.branch}",${bill.items},₹${bill.subtotal.toFixed(2)},₹${bill.tax.toFixed(2)},₹${bill.serviceCharge.toFixed(2)},₹${bill.totalAmount.toFixed(2)}\n`
    })

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.setAttribute("hidden", "")
    a.setAttribute("href", url)
    a.setAttribute("download", `counter-bills-export-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
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
        <h1>Counter Bills</h1>
        <div className="header-actions">
          <button className="btn btn-outline" onClick={() => setStatsModalOpen(true)}>
            <BarChart3 size={16} />
            <span>Statistics</span>
          </button>
          <button className="btn btn-outline" onClick={exportBills}>
            <Download size={16} />
            <span>Export CSV</span>
          </button>
          <button className="btn btn-outline" onClick={fetchBills}>
            <RefreshCw size={16} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Quick Stats */}
      {statistics && (
        <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)", marginBottom: "24px" }}>
          <div className="stat-card">
            <div className="icon-container orange">
              <Receipt size={20} />
            </div>
            <div className="stat-content">
              <h3>{statistics.totalBills || 0}</h3>
              <p>Total Bills</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="icon-container green">
              <TrendingUp size={20} />
            </div>
            <div className="stat-content">
              <h3>₹{(statistics.totalRevenue || 0).toFixed(0)}</h3>
              <p>Total Revenue</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="icon-container blue">
              <BarChart3 size={20} />
            </div>
            <div className="stat-content">
              <h3>₹{(statistics.averageBillValue || 0).toFixed(0)}</h3>
              <p>Average Bill Value</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="icon-container purple">
              <Calendar size={20} />
            </div>
            <div className="stat-content">
              <h3>{filteredBills.length}</h3>
              <p>Filtered Results</p>
            </div>
          </div>
        </div>
      )}

      <div className="filters-bar">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search bills..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
          <button className="btn btn-outline" onClick={() => setFiltersOpen(!filtersOpen)}>
            <Filter size={16} />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Collapsible Filters */}
      {filtersOpen && (
        <div className="card" style={{ marginBottom: "20px", padding: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            <div>
              <label className="form-label">Branch</label>
              <select
                className="form-select"
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
            <div>
              <label className="form-label">Customer Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Filter by customer name"
                value={customerFilter}
                onChange={(e) => handleFilterChange("customer", e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

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
            <p>Loading counter bills...</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Bill Details</th>
                <th>Customer</th>
                <th>Counter User</th>
                <th>Date & Time</th>
                <th>Branch</th>
                <th>Items</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedBills.length > 0 ? (
                displayedBills.map((bill) => (
                  <tr key={bill.id}>
                    <td>
                      <div style={{ fontWeight: "500" }}>{bill.billId}</div>
                      <div style={{ fontSize: "12px", color: "#666" }}>Order: {bill.orderId}</div>
                      <div style={{ fontSize: "12px", color: "#666" }}>Invoice: {bill.invoiceNumber}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: "500" }}>{bill.customer}</div>
                      <div style={{ fontSize: "12px", color: "#666" }}>{bill.customerMobile}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: "500" }}>{bill.counterUser}</div>
                      <div style={{ fontSize: "12px", color: "#666" }}>{bill.counterMobile}</div>
                    </td>
                    <td>
                      <div>{bill.date}</div>
                      <div style={{ fontSize: "12px", color: "#666" }}>{bill.time}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: "500" }}>{bill.branch}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: "600", color: "#666" }}>{bill.items} items</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: "600", color: "#666" }}>{bill.amount}</div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btn view" onClick={() => handleViewBill(bill)} title="View Details">
                          <Eye size={14} />
                        </button>
                        <button className="action-btn edit" onClick={() => generateBillPDF(bill)} title="Download PDF">
                          <FileText size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="no-orders">
                    No counter bills found matching your criteria
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

      {/* View Bill Modal */}
      {viewModalOpen && selectedBill && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: "800px" }}>
            <div className="modal-header">
              <h3 className="modal-title">Bill Details - {selectedBill.billId}</h3>
              <button className="modal-close" onClick={closeViewModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                <div>
                  <h4 style={{ marginBottom: "10px", color: "#333" }}>Bill Information</h4>
                  <div className="order-detail-row">
                    <div className="order-detail-label">Bill ID</div>
                    <div className="order-detail-value">{selectedBill.billId}</div>
                  </div>
                  <div className="order-detail-row">
                    <div className="order-detail-label">Order ID</div>
                    <div className="order-detail-value">{selectedBill.orderId}</div>
                  </div>
                  <div className="order-detail-row">
                    <div className="order-detail-label">Invoice No</div>
                    <div className="order-detail-value">{selectedBill.invoiceNumber}</div>
                  </div>
                  <div className="order-detail-row">
                    <div className="order-detail-label">Date & Time</div>
                    <div className="order-detail-value">
                      {selectedBill.date} {selectedBill.time}
                    </div>
                  </div>
                  <div className="order-detail-row">
                    <div className="order-detail-label">Branch</div>
                    <div className="order-detail-value">{selectedBill.branch}</div>
                  </div>
                </div>

                <div>
                  <h4 style={{ marginBottom: "10px", color: "#333" }}>Customer & Counter Details</h4>
                  <div className="order-detail-row">
                    <div className="order-detail-label">Customer Name</div>
                    <div className="order-detail-value">{selectedBill.customer}</div>
                  </div>
                  <div className="order-detail-row">
                    <div className="order-detail-label">Customer Mobile</div>
                    <div className="order-detail-value">{selectedBill.customerMobile}</div>
                  </div>
                  <div className="order-detail-row">
                    <div className="order-detail-label">Counter User</div>
                    <div className="order-detail-value">{selectedBill.counterUser}</div>
                  </div>
                  <div className="order-detail-row">
                    <div className="order-detail-label">Counter Mobile</div>
                    <div className="order-detail-value">{selectedBill.counterMobile}</div>
                  </div>
                </div>
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
                      {selectedBill.originalBill?.items?.length > 0 ? (
                        selectedBill.originalBill.items.map((item, index) => (
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
                <h4>Bill Summary</h4>
                <div className="order-items-table">
                  <table className="data-table">
                    <tbody>
                      <tr>
                        <td>Subtotal</td>
                        <td style={{ textAlign: "right" }}>₹{selectedBill.subtotal?.toFixed(2) || "0.00"}</td>
                      </tr>
                      {selectedBill.tax > 0 && (
                        <tr>
                          <td>Tax</td>
                          <td style={{ textAlign: "right" }}>₹{selectedBill.tax?.toFixed(2) || "0.00"}</td>
                        </tr>
                      )}
                      {selectedBill.serviceCharge > 0 && (
                        <tr>
                          <td>Service Charge</td>
                          <td style={{ textAlign: "right" }}>₹{selectedBill.serviceCharge?.toFixed(2) || "0.00"}</td>
                        </tr>
                      )}
                      <tr style={{ fontWeight: "bold", backgroundColor: "#f8f9fa" }}>
                        <td>Grand Total</td>
                        <td style={{ textAlign: "right", color: "#ff7e47" }}>
                          ₹{selectedBill.totalAmount?.toFixed(2) || "0.00"}
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
              <button className="btn btn-print" onClick={() => printThermalReceipt(selectedBill)}>
                <Printer size={16} />
                Print Receipt
              </button>
              <button className="btn btn-outline" onClick={() => generateBillPDF(selectedBill)}>
                <FileText size={16} />
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Modal */}
      {statsModalOpen && statistics && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Counter Bills Statistics</h3>
              <button className="modal-close" onClick={closeStatsModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div
                className="stats-grid"
                style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: "16px", marginBottom: "24px" }}
              >
                <div className="stat-card">
                  <div className="icon-container orange">
                    <Receipt size={24} />
                  </div>
                  <div className="stat-content">
                    <h3>{statistics.totalBills || 0}</h3>
                    <p>Total Bills</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="icon-container green">
                    <TrendingUp size={24} />
                  </div>
                  <div className="stat-content">
                    <h3>₹{(statistics.totalRevenue || 0).toFixed(2)}</h3>
                    <p>Total Revenue</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="icon-container blue">
                    <BarChart3 size={24} />
                  </div>
                  <div className="stat-content">
                    <h3>₹{(statistics.averageBillValue || 0).toFixed(2)}</h3>
                    <p>Average Bill Value</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="icon-container purple">
                    <Calendar size={20} />
                  </div>
                  <div className="stat-content">
                    <h3>
                      {dateFilter === "all"
                        ? "All Time"
                        : dateFilter === "today"
                          ? "Today"
                          : dateFilter === "week"
                            ? "Last 7 Days"
                            : "Last 30 Days"}
                    </h3>
                    <p>Time Period</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeStatsModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CounterBills
