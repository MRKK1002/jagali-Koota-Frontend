import { useState, useEffect, useRef } from "react"
import { FiRefreshCw, FiClock, FiCheckCircle, FiPrinter } from "react-icons/fi"
import { MdRestaurant, MdTableBar, MdPerson } from "react-icons/md"
import { HiOutlineClipboardList } from "react-icons/hi"
import { io } from "socket.io-client"

const API_BASE = import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"
// Socket URL is the backend root (without /api/v1/hotel path)
const SOCKET_URL = (import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel").replace(/\/api\/v1\/hotel$/, '')

const KitchenDisplay = () => {
  const [kots, setKots] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [selectedBranch, setSelectedBranch] = useState("")
  const selectedBranchRef = useRef("")
  const [branches, setBranches] = useState([])
  const previousKotIdsRef = useRef(new Set())
  const isFirstFetchRef = useRef(true)
  const lastSocketAlertRef = useRef(0) // timestamp of last socket-triggered alert
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
  const completedItemsRef = useRef(completedItems)
  const [newOrderFlash, setNewOrderFlash] = useState(false)
  const audioRef = useRef(null)
  const [notificationPermission, setNotificationPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  )


  useEffect(() => {
    const audio = new Audio('/ringtone.mp3')
    audio.preload = 'auto'
    audio.loop = false
    audioRef.current = audio
    return () => { audio.pause(); audio.src = '' }
  }, [])

 

  useEffect(() => {
    if (typeof Notification === 'undefined') return
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        setNotificationPermission(permission)
        // Unlock audio after user grants permission (counts as user interaction)
        if (permission === 'granted' && audioRef.current) {
          audioRef.current.play().then(() => {
            audioRef.current.pause()
            audioRef.current.currentTime = 0
          }).catch(() => {})
        }
      })
    }
  }, [])

  // Also unlock audio on any click/touch on the page
  useEffect(() => {
    let unlocked = false
    const unlock = () => {
      if (unlocked) return
      const audio = audioRef.current
      if (audio) {
        audio.play().then(() => { audio.pause(); audio.currentTime = 0 }).catch(() => {})
      }
      unlocked = true
    }
    document.addEventListener('click', unlock)
    document.addEventListener('touchstart', unlock)
    return () => {
      document.removeEventListener('click', unlock)
      document.removeEventListener('touchstart', unlock)
    }
  }, [])

  const playRingtone = () => {
    console.log('🔊 playRingtone called')
    const audio = audioRef.current
    if (!audio) {
      console.log('🔊 ERROR: audioRef.current is null')
      return
    }
    console.log('🔊 Audio element found, readyState:', audio.readyState, 'src:', audio.src)
    audio.currentTime = 0
    audio.play().then(() => {
      console.log('🔊 ✅ Ringtone playing successfully!')
    }).catch((err) => {
      console.log('� ❌ Audio play FAILED:', err.name, err.message)
    })
    
    // Also show browser notification
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('🍽️ New Order!', {
          body: 'A new KOT has arrived in the kitchen',
          icon: '/favicon.ico',
          tag: 'new-kot-' + Date.now(),
          requireInteraction: true,
        })
      } catch (_) {}
    }
  }

  useEffect(() => {
    const socket = io(SOCKET_URL, { 
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    })
    
    socket.on('connect', () => {
      console.log('🔌 Kitchen Display connected to socket:', socket.id)
    })

    socket.on('new-kot', (data) => {
      console.log('🔔 New KOT received via socket:', data)
      lastSocketAlertRef.current = Date.now()
      // Play ringtone
      playRingtone()
      // Flash header
      setNewOrderFlash(true)
      setTimeout(() => setNewOrderFlash(false), 5000)
      // Refresh KOT list (don't trigger ringtone again from poll)
      fetchKOTs(false)
    })

    // Order updated/cancelled/completed — refresh list silently
    socket.on('order-updated', () => {
      fetchKOTs(false)
    })

    socket.on('disconnect', () => {
      console.log('🔌 Kitchen Display socket disconnected')
    })

    return () => { socket.disconnect() }
  }, [])

  useEffect(() => {
    completedItemsRef.current = completedItems
    const toSave = {}
    Object.keys(completedItems).forEach(k => { toSave[k] = [...completedItems[k]] })
    localStorage.setItem("kitchenCompletedItems", JSON.stringify(toSave))
  }, [completedItems])

  useEffect(() => {
    fetchBranches()
  }, [])

  useEffect(() => {
    if (!selectedBranch) return
    selectedBranchRef.current = selectedBranch
    fetchKOTs(true) // initial load

    // Lightweight fallback poll every 10s (in case socket events are missed)
    const fallbackInterval = setInterval(() => {
      fetchKOTs(false)
    }, 10000)

    return () => clearInterval(fallbackInterval)
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
    const branch = selectedBranch || selectedBranchRef.current
    if (!branch) return
    if (showLoading) setLoading(true)

    try {
      const response = await fetch(
        `${API_BASE}/counter-order/orders?branchId=${branch}&paymentStatus=pending&includeComplimentary=true&limit=100`
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
      // This is aggressive — if localStorage says it's done, it stays gone
      const currentCompleted = completedItemsRef.current
      const visibleKOTs = pendingKOTs.filter(kot => {
        const completedSet = currentCompleted[kot._id]
        if (!completedSet || completedSet.size === 0) return true
        // If all items are completed, ALWAYS hide — no exceptions
        if (kot.items && completedSet.size >= kot.items.length) return false
        return true
      })

      setKots(visibleKOTs)
      setLastUpdated(new Date())

      // Detect new KOTs (poll-based detection as backup for socket)
      const currentIds = new Set(visibleKOTs.map(k => k._id))
      if (isFirstFetchRef.current) {
        // First fetch — just record IDs, don't alert
        previousKotIdsRef.current = currentIds
        isFirstFetchRef.current = false
      } else {
        // Check if there are new IDs not seen before
        let hasNew = false
        for (const id of currentIds) {
          if (!previousKotIdsRef.current.has(id)) {
            hasNew = true
            break
          }
        }
        if (hasNew) {
          // Only play ringtone if socket didn't already handle it recently
          const timeSinceSocketAlert = Date.now() - lastSocketAlertRef.current
          if (timeSinceSocketAlert > 15000) {
            console.log('🔊 Poll detected new KOT (socket missed it) — playing ringtone')
            playRingtone()
            setNewOrderFlash(true)
            setTimeout(() => setNewOrderFlash(false), 5000)
          } else {
            console.log('🔊 Poll detected new KOT but socket already alerted recently — skipping ringtone')
          }
        }
        previousKotIdsRef.current = currentIds
      }
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
  const handleItemComplete = (kot, itemIndex) => {
    const item = kot.items[itemIndex]
    const cleanName = item.name ? item.name.replace(/^\d+\s+/, "").trim() : "Unknown"

    // Update completed items state — immediately remove item from view
    setCompletedItems(prev => {
      const newState = { ...prev }
      if (!newState[kot._id]) newState[kot._id] = new Set()
      newState[kot._id] = new Set([...newState[kot._id], itemIndex])

      // If all items complete, remove KOT from view AND update backend
      if (kot.items && newState[kot._id].size >= kot.items.length) {
        // Remove from view immediately
        setKots(prevKots => prevKots.filter(k => k._id !== kot._id))
        
        // Update backend — mark order as completed so it never comes back
        fetch(`${API_BASE}/counter-order/orders/${kot._id}/order-status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderStatus: 'completed' })
        }).catch(() => {})

        // Clean up localStorage entry after 5 minutes
        setTimeout(() => {
          setCompletedItems(p => {
            const cleaned = { ...p }
            delete cleaned[kot._id]
            return cleaned
          })
        }, 300000)
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
  const bumpPrint = ({ itemName, serverName, tableNumber, kotNumber }) => {
    const printWindow = window.open("", "_blank", "width=300,height=200")
    if (!printWindow) return

    printWindow.document.write(`
      <html>
      <head><title>Bump</title>
      <style>
        @page {
          size: 80mm auto;
          margin: 2mm;
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: monospace; 
          padding: 4mm; 
          font-size: 12px; 
          width: 76mm;
          max-width: 76mm;
        }
        .title { 
          font-weight: bold; 
          font-size: 16px; 
          text-align: center; 
          border-bottom: 1px dashed #000; 
          padding-bottom: 4px; 
          margin-bottom: 8px; 
        }
        .line { margin: 4px 0; font-size: 13px; }
        .line b { display: inline-block; width: 55px; }
        .item-name { font-size: 16px; font-weight: bold; margin: 8px 0; text-align: center; }
        .time { text-align: center; margin-top: 8px; font-size: 10px; border-top: 1px dashed #000; padding-top: 4px; }
      </style>
      </head>
      <body>
        <div class="title">BUMP - READY</div>
        <div class="item-name">${itemName}</div>
        <div class="line"><b>Table:</b> ${tableNumber}</div>
        <div class="line"><b>Server:</b> ${serverName}</div>
        <div class="line"><b>KOT:</b> ${kotNumber}</div>
        <div class="time">${new Date().toLocaleTimeString()}</div>
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
  const [audioActivated, setAudioActivated] = useState(false)

  const activateAudio = () => {
    const audio = audioRef.current
    if (audio) {
      audio.play().then(() => { audio.pause(); audio.currentTime = 0 }).catch(() => {})
    }
    setAudioActivated(true)
  }

  if (!audioActivated) {
    return (
      <div 
        onClick={activateAudio}
        style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          justifyContent: 'center', alignItems: 'center', gap: '20px',
          background: '#69221b', color: 'white', cursor: 'pointer',
          fontFamily: "'Segoe UI', sans-serif"
        }}
      >
        <div style={{ fontSize: '4rem' }}>🍽️</div>
        <h1 style={{ fontSize: '2rem', margin: 0 }}>Kitchen Display</h1>
        <p style={{ fontSize: '1.2rem', opacity: 0.9 }}>Tap anywhere to start receiving orders</p>
        <div style={{ 
          padding: '16px 40px', background: 'white', color: '#69221b', 
          borderRadius: '12px', fontSize: '1.1rem', fontWeight: '700',
          marginTop: '20px'
        }}>
          ▶ START
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", background: "#faf5f0", padding: "20px", fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Notification permission banner */}
      {notificationPermission === 'denied' && (
        <div style={{ 
          background: "#fee2e2", color: "#991b1b", padding: "10px 20px", 
          borderRadius: "8px", marginBottom: "12px", textAlign: "center",
          fontWeight: "600", fontSize: "0.9rem"
        }}>
          🔇 Notifications blocked — enable them in browser settings to receive sound alerts
        </div>
      )}
      {/* Header */}
      <div style={{ 
        display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", 
        background: newOrderFlash ? "#16a34a" : "#69221b", 
        padding: "16px 24px", borderRadius: "12px", color: "white",
        transition: "background-color 0.3s ease"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <MdRestaurant size={28} />
          <div>
            <h1 style={{ margin: 0, fontSize: "1.3rem", fontWeight: "700" }}>
              {newOrderFlash ? "🔔 NEW ORDER!" : "Kitchen Display"}
            </h1>
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
                          <div>
                            <span style={{ fontSize: "0.9rem", fontWeight: "500", color: "#1a202c" }}>
                              {cleanName}
                            </span>
                            {item.remark && (
                              <div style={{ fontSize: "0.75rem", color: "#dc2626", fontWeight: "600", marginTop: "2px", background: "#fef2f2", padding: "3px 8px", borderRadius: "4px", border: "1px solid #fecaca" }}>
                                📝 Note: {item.remark}
                              </div>
                            )}
                          </div>
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
