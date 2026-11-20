import { useState, useEffect } from "react"
import { BarChart2, Download, RefreshCw, Calendar } from "lucide-react"
import { fetchDualBackend } from "../utils/apiHelpers"
import * as XLSX from "xlsx"

const SalesReports = () => {
  const [activeTab, setActiveTab] = useState("category") // 'category' | 'item'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [data, setData] = useState([])
  const [totals, setTotals] = useState(null)
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState("")
  const [pagination, setPagination] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Date range state
  const today = new Date().toISOString().split("T")[0]
  const [startDate, setStartDate] = useState(today)
  const [endDate, setEndDate] = useState(today)

  // Load branches on mount
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const data = await fetchDualBackend("/branch", {}, true)
        setBranches(data)
        if (data.length > 0) {
          setSelectedBranch(data[0]._id)
        }
      } catch (err) {
        console.error("Failed to load branches:", err)
      }
    }
    loadBranches()
  }, [])

  // Auto-fetch when branch is selected
  useEffect(() => {
    if (selectedBranch) {
      fetchReport()
    }
  }, [selectedBranch, activeTab])

  const fetchReport = async (pageOverride = null) => {
    if (!selectedBranch) return
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams({
        branchId: selectedBranch,
        startDate,
        endDate,
        groupBy: activeTab,
      })
      // Add pagination for item-wise
      if (activeTab === 'item') {
        params.set('page', String(pageOverride || currentPage))
        params.set('limit', String(itemsPerPage))
      }
      const primaryUrl = import.meta.env.VITE_BACKEND_PRIMARY || 'https://billing.jagalikoota.com/api/v1/hotel'
      const rawRes = await fetch(`${primaryUrl}/counter-order/sales-report?${params.toString()}`)
      if (!rawRes.ok) {
        const errData = await rawRes.json().catch(() => ({}))
        throw new Error(errData.message || `HTTP ${rawRes.status}`)
      }
      const res = await rawRes.json()
      if (res.success) {
        setData(res.data || [])
        setTotals(res.totals || null)
        setPagination(res.pagination || null)
      } else {
        setError(res.message || "Failed to fetch report")
        setData([])
        setTotals(null)
        setPagination(null)
      }
    } catch (err) {
      setError(err.message || "Failed to fetch report")
      setData([])
      setTotals(null)
    } finally {
      setLoading(false)
    }
  }
  // Quick date presets
  const setPreset = (preset) => {
    const now = new Date()
    let start, end
    switch (preset) {
      case "today":
        start = end = today
        break
      case "yesterday": {
        const y = new Date(now)
        y.setDate(y.getDate() - 1)
        start = end = y.toISOString().split("T")[0]
        break
      }
      case "thisWeek": {
        const day = now.getDay()
        const diff = now.getDate() - day + (day === 0 ? -6 : 1)
        const mon = new Date(now)
        mon.setDate(diff)
        start = mon.toISOString().split("T")[0]
        end = today
        break
      }
      case "thisMonth": {
        start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`
        end = today
        break
      }
      case "lastMonth": {
        const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        const lmEnd = new Date(now.getFullYear(), now.getMonth(), 0)
        start = lm.toISOString().split("T")[0]
        end = lmEnd.toISOString().split("T")[0]
        break
      }
      default:
        return
    }
    setStartDate(start)
    setEndDate(end)
    // Fetch immediately with the new dates
    fetchReportWithDates(start, end)
  }
  // Fetch with explicit dates (used by presets to avoid stale state)
  const fetchReportWithDates = async (fromDate, toDate) => {
    if (!selectedBranch) return
    setLoading(true)
    setError("")
    setCurrentPage(1)
    try {
      const params = new URLSearchParams({
        branchId: selectedBranch,
        startDate: fromDate,
        endDate: toDate,
        groupBy: activeTab,
      })
      if (activeTab === 'item') {
        params.set('page', '1')
        params.set('limit', String(itemsPerPage))
      }
      const primaryUrl = import.meta.env.VITE_BACKEND_PRIMARY || 'https://billing.jagalikoota.com/api/v1/hotel'
      const rawRes = await fetch(`${primaryUrl}/counter-order/sales-report?${params.toString()}`)
      if (!rawRes.ok) {
        const errData = await rawRes.json().catch(() => ({}))
        throw new Error(errData.message || `HTTP ${rawRes.status}`)
      }
      const res = await rawRes.json()
      if (res.success) {
        setData(res.data || [])
        setTotals(res.totals || null)
        setPagination(res.pagination || null)
      } else {
        setError(res.message || "Failed to fetch report")
        setData([])
        setTotals(null)
        setPagination(null)
      }
    } catch (err) {
      setError(err.message || "Failed to fetch report")
      setData([])
      setTotals(null)
    } finally {
      setLoading(false)
    }
  }
  // Export to Excel — fetches ALL items (no pagination) for complete export
  const exportToExcel = async () => {
    if (!selectedBranch) return

    let allData = data
    let fileName = ""

    // For item-wise, fetch all data without pagination
    if (activeTab === "item") {
      try {
        const params = new URLSearchParams({
          branchId: selectedBranch,
          startDate,
          endDate,
          groupBy: 'item',
          page: '1',
          limit: '100000', // Fetch all
        })
        const primaryUrl = import.meta.env.VITE_BACKEND_PRIMARY || 'https://billing.jagalikoota.com/api/v1/hotel'
        const rawRes = await fetch(`${primaryUrl}/counter-order/sales-report?${params.toString()}`)
        if (rawRes.ok) {
          const res = await rawRes.json()
          if (res.success) allData = res.data || []
        }
      } catch (_) {
        // Fallback to current page data
      }
    }

    if (!allData || allData.length === 0) return

    let worksheetData = []

    if (activeTab === "category") {
      worksheetData = allData.map((row) => ({
        Category: row.category,
        Orders: row.orders,
        "Items Sold": row.itemsSold,
        "Revenue (₹)": row.revenue,
        "GST (₹)": row.gst,
        "Net Revenue (₹)": row.netRevenue,
      }))
      if (totals) {
        worksheetData.push({
          Category: "TOTAL",
          Orders: totals.orders,
          "Items Sold": totals.itemsSold,
          "Revenue (₹)": totals.revenue,
          "GST (₹)": totals.gst,
          "Net Revenue (₹)": totals.netRevenue,
        })
      }
      fileName = `Category_Sales_Report_${startDate}_to_${endDate}.xlsx`
    } else {
      worksheetData = allData.map((row) => ({
        "Item Name": row.itemName,
        Category: row.category,
        "Qty Sold": row.qtySold,
        "Unit Price (₹)": row.unitPrice,
        "Total Revenue (₹)": row.totalRevenue,
        "GST (₹)": row.gst,
      }))
      if (totals) {
        worksheetData.push({
          "Item Name": "TOTAL",
          Category: "",
          "Qty Sold": totals.qtySold,
          "Unit Price (₹)": "",
          "Total Revenue (₹)": totals.totalRevenue,
          "GST (₹)": totals.gst,
        })
      }
      fileName = `Item_Sales_Report_${startDate}_to_${endDate}.xlsx`
    }

    const ws = XLSX.utils.json_to_sheet(worksheetData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, activeTab === "category" ? "Category Report" : "Item Report")

    // Auto-size columns
    const colWidths = Object.keys(worksheetData[0] || {}).map((key) => ({
      wch: Math.max(key.length, ...worksheetData.map((r) => String(r[key] || "").length)) + 2,
    }))
    ws["!cols"] = colWidths

    XLSX.writeFile(wb, fileName)
  }
  const formatCurrency = (val) => {
    return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0)
  }
  return (
    <div className="categories-page">
      <div className="page-header">
        <h1 style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <BarChart2 size={24} /> Sales Reports
        </h1>
      </div>

      {/* Filters Section */}
      <div style={{
        background: "#f8fafc",
        borderRadius: "12px",
        padding: "20px",
        marginBottom: "24px",
        border: "1px solid #e2e8f0"
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-end" }}>
          {/* Branch */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Branch</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{
                padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #e2e8f0",
                fontSize: "0.85rem", fontWeight: "500", minWidth: "140px"
              }}
            >
              {branches.map((b) => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>From</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{
                padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #e2e8f0",
                fontSize: "0.85rem", fontWeight: "500"
              }}
            />
          </div>

          {/* To Date */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "0.75rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>To</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{
                padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #e2e8f0",
                fontSize: "0.85rem", fontWeight: "500"
              }}
            />
          </div>

          {/* Fetch Button */}
          <button
            onClick={fetchReport}
            disabled={loading}
            style={{
              padding: "8px 20px", borderRadius: "8px", border: "none",
              background: "#69221b", color: "white", fontSize: "0.85rem",
              fontWeight: "600", cursor: loading ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: "6px",
              opacity: loading ? 0.7 : 1
            }}
          >
            <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            {loading ? "Loading..." : "Fetch Report"}
          </button>
        </div>

        {/* Quick Presets */}
        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap" }}>
          {[
            { label: "Today", value: "today" },
            { label: "Yesterday", value: "yesterday" },
            { label: "This Week", value: "thisWeek" },
            { label: "This Month", value: "thisMonth" },
            { label: "Last Month", value: "lastMonth" },
          ].map((preset) => (
            <button
              key={preset.value}
              onClick={() => setPreset(preset.value)}
              style={{
                padding: "4px 12px", borderRadius: "6px",
                border: "1px solid #e2e8f0", background: "white",
                fontSize: "0.75rem", fontWeight: "600", color: "#475569",
                cursor: "pointer"
              }}
            >
              <Calendar size={10} style={{ marginRight: "4px" }} />
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0", marginBottom: "20px", borderBottom: "2px solid #e2e8f0" }}>
        <button
          onClick={() => { setActiveTab("category"); setCurrentPage(1) }}
          style={{
            padding: "12px 24px", border: "none", background: "none",
            fontSize: "0.9rem", fontWeight: "700", cursor: "pointer",
            color: activeTab === "category" ? "#69221b" : "#64748b",
            borderBottom: activeTab === "category" ? "3px solid #69221b" : "3px solid transparent",
            marginBottom: "-2px"
          }}
        >
          Category-wise Report
        </button>
        <button
          onClick={() => { setActiveTab("item"); setCurrentPage(1) }}
          style={{
            padding: "12px 24px", border: "none", background: "none",
            fontSize: "0.9rem", fontWeight: "700", cursor: "pointer",
            color: activeTab === "item" ? "#69221b" : "#64748b",
            borderBottom: activeTab === "item" ? "3px solid #69221b" : "3px solid transparent",
            marginBottom: "-2px"
          }}
        >
          Item-wise Report
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: "8px",
          padding: "12px 16px", marginBottom: "16px", color: "#dc2626", fontSize: "0.85rem"
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
          <div className="counter-spinner" style={{ margin: "0 auto 12px" }} />
          <p>Loading sales report...</p>
        </div>
      )}

      {/* No Data */}
      {!loading && data.length === 0 && !error && (
        <div style={{ textAlign: "center", padding: "60px", color: "#94a3b8" }}>
          <BarChart2 size={48} strokeWidth={1} style={{ marginBottom: "12px", opacity: 0.4 }} />
          <p style={{ fontSize: "1rem", fontWeight: "600", color: "#475569" }}>No sales data found</p>
          <p style={{ fontSize: "0.82rem" }}>Select a date range and click "Fetch Report"</p>
        </div>
      )}

      {/* Category-wise Table */}
      {!loading && activeTab === "category" && data.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
            <button
              onClick={() => exportToExcel()}
              style={{
                padding: "8px 16px", borderRadius: "8px", border: "1.5px solid #16a34a",
                background: "#f0fdf4", color: "#16a34a",
                fontSize: "0.82rem", fontWeight: "600", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "6px"
              }}
            >
              <Download size={14} /> Export Category Report
            </button>
          </div>
          <div className="data-card" style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.78rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>Category</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.78rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>Orders</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.78rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>Items Sold</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.78rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>Revenue (₹)</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.78rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>GST (₹)</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.78rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>Net Revenue (₹)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 16px", fontWeight: "600", color: "#1e293b" }}>{row.category}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#475569" }}>{row.orders}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#475569" }}>{row.itemsSold}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#475569", fontWeight: "500" }}>₹{formatCurrency(row.revenue)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#475569" }}>₹{formatCurrency(row.gst)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#16a34a", fontWeight: "700" }}>₹{formatCurrency(row.netRevenue)}</td>
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot>
                <tr style={{ background: "#fef2f2", borderTop: "2px solid #69221b" }}>
                  <td style={{ padding: "12px 16px", fontWeight: "800", color: "#69221b", fontSize: "0.9rem" }}>TOTAL</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700", color: "#69221b" }}>{totals.orders}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700", color: "#69221b" }}>{totals.itemsSold}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700", color: "#69221b" }}>₹{formatCurrency(totals.revenue)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700", color: "#69221b" }}>₹{formatCurrency(totals.gst)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "800", color: "#69221b", fontSize: "0.95rem" }}>₹{formatCurrency(totals.netRevenue)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        </div>
      )}

      {/* Item-wise Table */}
      {!loading && activeTab === "item" && data.length > 0 && (
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
            <button
              onClick={() => exportToExcel()}
              style={{
                padding: "8px 16px", borderRadius: "8px", border: "1.5px solid #16a34a",
                background: "#f0fdf4", color: "#16a34a",
                fontSize: "0.82rem", fontWeight: "600", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "6px"
              }}
            >
              <Download size={14} /> Export Item Report
            </button>
          </div>
          <div className="data-card" style={{ overflowX: "auto" }}>
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.78rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>Item Name</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "0.78rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>Category</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.78rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>Qty Sold</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.78rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>Unit Price (₹)</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.78rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>Total Revenue (₹)</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "0.78rem", fontWeight: "700", color: "#64748b", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>GST (₹)</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 16px", fontWeight: "600", color: "#1e293b" }}>{row.itemName}</td>
                  <td style={{ padding: "12px 16px", color: "#64748b", fontSize: "0.82rem" }}>{row.category}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#475569", fontWeight: "600" }}>{row.qtySold}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#475569" }}>₹{formatCurrency(row.unitPrice)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#475569", fontWeight: "500" }}>₹{formatCurrency(row.totalRevenue)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", color: "#475569" }}>₹{formatCurrency(row.gst)}</td>
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot>
                <tr style={{ background: "#fef2f2", borderTop: "2px solid #69221b" }}>
                  <td style={{ padding: "12px 16px", fontWeight: "800", color: "#69221b", fontSize: "0.9rem" }}>TOTAL</td>
                  <td style={{ padding: "12px 16px" }}></td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700", color: "#69221b" }}>{totals.qtySold}</td>
                  <td style={{ padding: "12px 16px" }}></td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "800", color: "#69221b", fontSize: "0.95rem" }}>₹{formatCurrency(totals.totalRevenue)}</td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700", color: "#69221b" }}>₹{formatCurrency(totals.gst)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination Controls */}
        {pagination && pagination.totalPages > 1 && (
          <div style={{
            display: "flex", justifyContent: "center", alignItems: "center",
            gap: "8px", marginTop: "16px", padding: "12px"
          }}>
            <button
              onClick={() => { setCurrentPage(prev => prev - 1); fetchReport(currentPage - 1) }}
              disabled={!pagination.hasPrevPage || loading}
              style={{
                padding: "6px 14px", borderRadius: "6px", border: "1px solid #e2e8f0",
                background: pagination.hasPrevPage ? "white" : "#f3f4f6",
                color: pagination.hasPrevPage ? "#475569" : "#9ca3af",
                fontSize: "0.82rem", fontWeight: "600",
                cursor: pagination.hasPrevPage ? "pointer" : "not-allowed"
              }}
            >
              ← Prev
            </button>
            <span style={{ fontSize: "0.82rem", color: "#64748b", fontWeight: "500" }}>
              Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalItems} items)
            </span>
            <button
              onClick={() => { setCurrentPage(prev => prev + 1); fetchReport(currentPage + 1) }}
              disabled={!pagination.hasNextPage || loading}
              style={{
                padding: "6px 14px", borderRadius: "6px", border: "1px solid #e2e8f0",
                background: pagination.hasNextPage ? "white" : "#f3f4f6",
                color: pagination.hasNextPage ? "#475569" : "#9ca3af",
                fontSize: "0.82rem", fontWeight: "600",
                cursor: pagination.hasNextPage ? "pointer" : "not-allowed"
              }}
            >
              Next →
            </button>
          </div>
        )}
        </div>
      )}

      {/* Date range info */}
      {!loading && data.length > 0 && (
        <div style={{
          marginTop: "16px", padding: "12px 16px",
          background: "#f8fafc", borderRadius: "8px",
          fontSize: "0.78rem", color: "#64748b",
          display: "flex", justifyContent: "space-between"
        }}>
          <span>Report period: {startDate} to {endDate}</span>
          <span>{data.length} {activeTab === "category" ? "categories" : "items"} found</span>
        </div>
      )}
    </div>
  )
}

export default SalesReports
