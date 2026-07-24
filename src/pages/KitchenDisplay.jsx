import { useState, useEffect, useRef, useCallback } from "react"
import { FiRefreshCw, FiClock, FiCheckCircle, FiPrinter } from "react-icons/fi"
import { MdRestaurant, MdTableBar, MdPerson } from "react-icons/md"
import { HiOutlineClipboardList } from "react-icons/hi"

const API_BASE = "https://billing.jagalikoota.com/api/v1/hotel"

const KitchenDisplay = () => {
  const [kots, setKots] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [selectedBranch, setSelectedBranch] = useState("")
  const [branches, setBranches] = useState([])
  // Track completed items per KOT: { kotId: Set([itemIndex, ...]) }
  const [completedItems, setCompletedItems] = useState(() => {
    try {
      const saved = localStorage.getItem("kitchenCompletedItems")
      if (saved) {
        const parsed = JSON.parse(saved)
        // Convert arrays back to Sets
        const result = {}
        Object.keys(parsed).forEach(k => { result[k] = new Set(parsed[k]) })
        return result
      }
    } catch (_) {}
    return {}
  })
  const intervalRef = useRef(null)

  // Save completed items to localStorage
  useEffect(() => {
    const toSave = {}
    Object.keys(completedItems).forEach(k => { toSave[k] = [...completedItems[k]] })
    localStorage.setItem("kitchenCompletedItems", JSON.stringify(toSave))
  }, [completedItems])

  // Fetch branches on mount
  useEffect(() => {
    fetchBranches()
  }, [])

  // Auto-refresh every 5 seconds (background, no loading flash)
  useEffect(() => {
    if (!selectedBranch) return
    fetchKOTs(true) // initial load with loading state

    intervalRef.current = setInterval(() => {
      fetchKOTs(false) // background refresh, no loading flash
    }, 5000)

    return () => clearInterval(intervalRef.current)
  }, [selectedBranch])

  const fetchBranches = async () => {
    try {
      const response = await fetch(`${API_BASE}/branch`)
      if (!response.ok) return
      const data = await response.json()
      setBranches(data || [])
      if (data && data.length > 0) {
        setSelectedBranch(data[0]._id)
      }
    } catch (_) {}
  }

  const fetchKOTs = async (showLoading = false) => {
    if (!selectedBranch) return
    if (showLoading) setLoading(true)

    try {
      const response = await fetch(
        `${API_BASE}/counter-order/orders?branchId=${selectedBranch}&paymentStatus=pending&includeComplimentary=true&limit=100`
      )
      if (!response.ok) return

      const data = await response.json()
      let orders = data.data || data.orders || (Array.isArray(data) ? data : [])

      // Filter: pending payment, not completed/cancelled in kitchen
      const pendingKOTs = orders.filter(order => {
        const paymentStatus = (order.paymentStatus || "").toLowerCase()
        const orderStatus = (order.orderStatus || "").toLowerCase()
        if (paymentStatus !== "pending") return false
        if (orderStatus === "completed" || orderStatus === "cancelled") return false
        return true
      }).map(order => ({ ...order, _id: order._id || order.id }))

      // Sort oldest first
      pendingKOTs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

      // Filter out KOTs where ALL items are already completed locally
      const visibleKOTs = pendingKOTs.filter(kot => {
        const completedSet = completedItems[kot._id]
        if (!completedSet) return true
        // If all items are completed, hide this KOT
        return kot.items && kot.items.length > 0 && completedSet.size < kot.items.length
      })

      setKots(visibleKOTs)
      setLastUpdated(new Date())
    } catch (_) {}
    finally {
      if (showLoading) setLoading(false)
    }
  }

  const getTimeElapsed = (dateString) => {
    try {
      const created = new Date(dateString)
      const now = new Date()
      const diffMinutes = Math.floor((now - created) / 60000)
      if (diffMinutes < 1) return "Just now"
      if (diffMinutes < 60) return `${diffMinutes}m`
      const hours = Math.floor(diffMinutes / 60)
      return `${hours}h ${diffMinutes % 60}m`
    } catch (_) { return "" }
  }

  // Mark a single item as complete and trigger bump print
  const handleItemComplete = (kot, itemIndex) => {
    const item = kot.items[itemIndex]
    const cleanName = item.name ? item.name.replace(/^\d+\s+/, "").trim() : "Unknown"

    // Update completed items state
    setCompletedItems(prev => {
      const newState = { ...prev }
      if (!newState[kot._id]) newState[kot._id] = new Set()
      newState[kot._id] = new Set([...newState[kot._id], itemIndex])

      // If all items complete, remove KOT from view
      if (kot.items && newState[kot._id].size >= kot.items.length) {
        setKots(prevKots => prevKots.filter(k => k._id !== kot._id))
        // Clean up from localStorage after a minute
        setTimeout(() => {
          setCompletedItems(p => {
            const cleaned = { ...p }
            delete cleaned[kot._id]
            return cleaned
          })
        }, 60000)
      }

      return newState
    })

    // Trigger bump print
    bumpPrint({
      itemName: `${item.quantity}x ${cleanName}`,
      serverName: kot.serverName || "N/A",
      tableNumber: kot.tableNumber || "N/A",
      kotNumber: kot.kotNumber || kot.invoiceNumber || ""
    })
  }

  // Bump print — opens print dialog with item details
  const bumpPrint = ({ itemName, serverName, tableNumber, kotNumber }) => {
    const printWindow = window.open("", "_blank", "width=300,height=200")
    if (!printWindow) return

    printWindow.document.write(`
      <html>
      <head><title>Bump</title>
      <style>
        body { font-family: monospace; padding: 10px; font-size: 14px; }
        .line { margin: 6px 0; }
        .title { font-weight: bold; font-size: 16px; text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 10px; }
      </style>
      </head>
      <body>
        <div class="title">BUMP - READY</div>
        <div class="line"><b>Item:</b> ${itemName}</div>
        <div class="line"><b>Table:</b> ${tableNumber}</div>
        <div class="line"><b>Server:</b> ${serverName}</div>
        <div class="line"><b>KOT:</b> ${kotNumber}</div>
        <div class="line" style="text-align:center; margin-top:10px; font-size:11px">${new Date().toLocaleTimeString()}</div>
      </body>
      </html>
    `)
    printWindow.document.close()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 300)
  }

  const newOrdersCount = kots.length

  return (
    <div style={{ minHeight: "100vh", background: "#faf5f0", padding: "20px", fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", background: "#69221b", padding: "16px 24px", borderRadius: "12px", color: "white" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <MdRestaurant size={28} />
          <div>
            <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: "700" }}>Kitchen Display</h1>
            <p style={{ margin: 0, fontSize: "0.8rem", opacity: 0.8 }}>Live Order Tickets</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: "6px", border: "none", fontSize: "0.85rem", fontWeight: "600" }}
          >
            <option value="">Select Branch</option>
            {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
          </select>
          <button
            onClick={() => fetchKOTs(false)}
            style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", color: "white", borderRadius: "6px", padding: "6px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", fontWeight: "600" }}
          >
            <FiRefreshCw size={14} /> Refresh
          </button>
          <span style={{ fontSize: "0.75rem", opacity: 0.7 }}>
            Updated: {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Stats - Only New Orders */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <div style={{ background: "white", borderRadius: "10px", padding: "14px 24px", display: "flex", alignItems: "center", gap: "12px", border: "2px solid #69221b", boxShadow: "0 2px 8px rgba(105,34,27,0.1)" }}>
          <HiOutlineClipboardList size={24} color="#69221b" />
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "#69221b" }}>{newOrdersCount}</div>
            <div style={{ fontSize: "0.75rem", color: "#718096", fontWeight: "600" }}>New Orders</div>
          </div>
        </div>
      </div>

      {/* KOT Grid */}
      {loading && kots.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#718096" }}>
          <FiRefreshCw size={32} style={{ animation: "spin 1s linear infinite" }} />
          <p>Loading orders...</p>
        </div>
      ) : kots.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px", background: "white", borderRadius: "12px", border: "2px dashed #e2e8f0" }}>
          <FiCheckCircle size={48} color="#48bb78" />
          <h2 style={{ margin: "12px 0 4px", color: "#2d3748" }}>All Clear!</h2>
          <p style={{ color: "#718096", margin: 0 }}>No pending orders in the kitchen</p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {kots.map(kot => {
            const completedSet = completedItems[kot._id] || new Set()
            const elapsed = getTimeElapsed(kot.createdAt)

            return (
              <div key={kot._id} style={{ background: "white", borderRadius: "12px", border: "2px solid #e2e8f0", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                {/* KOT Header */}
                <div style={{ background: "#69221b", color: "white", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ fontWeight: "700", fontSize: "0.95rem" }}>
                    {kot.kotNumber || kot.invoiceNumber || "KOT"}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", opacity: 0.8 }}>
                    <FiClock size={12} /> {elapsed}
                  </div>
                </div>

                {/* KOT Meta */}
                <div style={{ padding: "10px 16px", display: "flex", gap: "16px", borderBottom: "1px solid #f0f0f0", fontSize: "0.82rem", color: "#4a5568" }}>
                  {kot.tableNumber && (
                    <span style={{ display: "flex", alignItems: "center", gap: "4px", fontWeight: "600" }}>
                      <MdTableBar size={14} color="#69221b" /> Table {kot.tableNumber}
                    </span>
                  )}
                  {kot.serverName && (
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <MdPerson size={14} color="#69221b" /> {kot.serverName}
                    </span>
                  )}
                </div>

                {/* Items with individual complete buttons */}
                <div style={{ padding: "12px 16px" }}>
                  {kot.items && kot.items.map((item, index) => {
                    const isCompleted = completedSet.has(index)
                    const cleanName = item.name ? item.name.replace(/^\d+\s+/, "").trim() : "Unknown"

                    return (
                      <div key={index} style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 0",
                        borderBottom: index < kot.items.length - 1 ? "1px solid #f7f7f7" : "none",
                        opacity: isCompleted ? 0.4 : 1,
                        textDecoration: isCompleted ? "line-through" : "none",
                        transition: "all 0.2s"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                          <span style={{ background: "#69221b", color: "white", borderRadius: "4px", padding: "2px 6px", fontSize: "0.75rem", fontWeight: "700", minWidth: "24px", textAlign: "center" }}>
                            {item.quantity}
                          </span>
                          <span style={{ fontSize: "0.9rem", fontWeight: "500", color: "#1a202c" }}>
                            {cleanName}
                          </span>
                        </div>

                        {!isCompleted ? (
                          <button
                            onClick={() => handleItemComplete(kot, index)}
                            style={{
                              background: "#10b981",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              padding: "5px 10px",
                              fontSize: "0.7rem",
                              fontWeight: "600",
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              transition: "all 0.15s"
                            }}
                            onMouseOver={e => e.currentTarget.style.background = "#059669"}
                            onMouseOut={e => e.currentTarget.style.background = "#10b981"}
                          >
                            <FiCheckCircle size={12} /> Done
                          </button>
                        ) : (
                          <span style={{ fontSize: "0.7rem", color: "#10b981", fontWeight: "600", display: "flex", alignItems: "center", gap: "3px" }}>
                            <FiCheckCircle size={12} /> Ready
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default KitchenDisplay
