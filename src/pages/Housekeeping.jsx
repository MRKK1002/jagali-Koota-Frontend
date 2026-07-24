import { useState, useEffect } from "react"
import { Search, RefreshCw, Check, AlertCircle, Clock, XCircle } from "lucide-react"
import axios from "axios"

const API_BASE = import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"

const Housekeeping = () => {
  const [schedule, setSchedule] = useState({
    clean: [],
    dirty: [],
    inProgress: [],
    inspected: [],
    outOfOrder: []
  })
  const [summary, setSummary] = useState({
    total: 0,
    clean: 0,
    dirty: 0,
    inProgress: 0,
    inspected: 0,
    outOfOrder: 0
  })
  const [branches, setBranches] = useState([])
  const [filterBranch, setFilterBranch] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [selectedRooms, setSelectedRooms] = useState([])
  const [bulkStatus, setBulkStatus] = useState("")
  const [cleanerName, setCleanerName] = useState("")

  useEffect(() => {
    fetchBranches()
    fetchHousekeepingSchedule()
  }, [filterBranch])

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API_BASE}/branch`)
      setBranches(res.data)
    } catch (err) {
      console.error("Error fetching branches:", err)
    }
  }

  const fetchHousekeepingSchedule = async () => {
    setLoading(true)
    try {
      const url = filterBranch 
        ? `${API_BASE}/housekeeping/schedule?branchId=${filterBranch}`
        : `${API_BASE}/housekeeping/schedule`
      
      const res = await axios.get(url)
      setSchedule(res.data.schedule)
      setSummary(res.data.summary)
    } catch (err) {
      setError("Failed to load housekeeping schedule")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const updateRoomStatus = async (roomId, status) => {
    try {
      await axios.put(`${API_BASE}/housekeeping/room/${roomId}/status`, {
        status,
        cleanedBy: cleanerName || 'Admin',
        notes: ''
      })
      setSuccessMessage(`Room status updated to ${status}`)
      setTimeout(() => setSuccessMessage(""), 3000)
      fetchHousekeepingSchedule()
    } catch (err) {
      setError("Failed to update room status")
      setTimeout(() => setError(""), 3000)
    }
  }

  const bulkUpdateStatus = async () => {
    if (selectedRooms.length === 0) {
      setError("Please select at least one room")
      setTimeout(() => setError(""), 3000)
      return
    }

    if (!bulkStatus) {
      setError("Please select a status")
      setTimeout(() => setError(""), 3000)
      return
    }

    try {
      await axios.put(`${API_BASE}/housekeeping/bulk-update`, {
        roomIds: selectedRooms,
        status: bulkStatus,
        cleanedBy: cleanerName || 'Admin',
        notes: ''
      })
      setSuccessMessage(`${selectedRooms.length} rooms updated successfully`)
      setTimeout(() => setSuccessMessage(""), 3000)
      setSelectedRooms([])
      setBulkStatus("")
      fetchHousekeepingSchedule()
    } catch (err) {
      setError("Failed to bulk update rooms")
      setTimeout(() => setError(""), 3000)
    }
  }

  const toggleRoomSelection = (roomId) => {
    setSelectedRooms(prev => 
      prev.includes(roomId) 
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    )
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'clean': return { bg: '#f0fdf4', border: '#86efac', text: '#166534' }
      case 'dirty': return { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' }
      case 'in-progress': return { bg: '#fef3c7', border: '#fcd34d', text: '#92400e' }
      case 'inspected': return { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' }
      case 'out-of-order': return { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' }
      default: return { bg: '#f3f4f6', border: '#d1d5db', text: '#6b7280' }
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'clean': return <Check size={16} />
      case 'dirty': return <AlertCircle size={16} />
      case 'in-progress': return <Clock size={16} />
      case 'inspected': return <Check size={16} />
      case 'out-of-order': return <XCircle size={16} />
      default: return null
    }
  }

  const RoomCard = ({ room }) => {
    const colors = getStatusColor(room.housekeepingStatus)
    const isSelected = selectedRooms.includes(room._id)

    return (
      <div 
        style={{
          border: `2px solid ${isSelected ? '#3b82f6' : colors.border}`,
          borderRadius: "8px",
          padding: "12px",
          backgroundColor: isSelected ? '#eff6ff' : colors.bg,
          cursor: "pointer",
          transition: "all 0.2s ease"
        }}
        onClick={() => toggleRoomSelection(room._id)}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "8px" }}>
          <div>
            <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>
              Room {room.roomNumber}
            </h4>
            <p style={{ margin: "4px 0", fontSize: "12px", color: "#6b7280" }}>
              {room.floor} • {room.roomType}
            </p>
          </div>
          <input 
            type="checkbox" 
            checked={isSelected}
            onChange={() => toggleRoomSelection(room._id)}
            style={{ width: "18px", height: "18px", cursor: "pointer" }}
          />
        </div>

        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "6px",
          padding: "6px 10px",
          backgroundColor: "white",
          borderRadius: "6px",
          marginBottom: "8px"
        }}>
          {getStatusIcon(room.housekeepingStatus)}
          <span style={{ fontSize: "12px", fontWeight: "600", color: colors.text }}>
            {room.housekeepingStatus === 'in-progress' ? 'Cleaning' : 
             room.housekeepingStatus === 'out-of-order' ? 'Out of Order' :
             room.housekeepingStatus.charAt(0).toUpperCase() + room.housekeepingStatus.slice(1)}
          </span>
        </div>

        {room.lastCleanedAt && (
          <p style={{ fontSize: "10px", color: "#6b7280", margin: "4px 0" }}>
            Last cleaned: {new Date(room.lastCleanedAt).toLocaleDateString('en-IN', { 
              day: '2-digit', 
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </p>
        )}

        {room.lastCleanedBy && (
          <p style={{ fontSize: "10px", color: "#6b7280", margin: "4px 0" }}>
            By: {room.lastCleanedBy}
          </p>
        )}

        {room.cleaningNotes && (
          <p style={{ fontSize: "10px", color: "#6b7280", margin: "4px 0", fontStyle: "italic" }}>
            Note: {room.cleaningNotes}
          </p>
        )}

        <div style={{ display: "flex", gap: "4px", marginTop: "8px", flexWrap: "wrap" }}>
          {room.housekeepingStatus !== 'clean' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                updateRoomStatus(room._id, 'clean')
              }}
              style={{
                flex: 1,
                padding: "6px 10px",
                fontSize: "11px",
                backgroundColor: "#10b981",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              Mark Clean
            </button>
          )}
          {room.housekeepingStatus !== 'in-progress' && room.housekeepingStatus !== 'out-of-order' && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                updateRoomStatus(room._id, 'in-progress')
              }}
              style={{
                flex: 1,
                padding: "6px 10px",
                fontSize: "11px",
                backgroundColor: "#f59e0b",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "500"
              }}
            >
              Start Cleaning
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="housekeeping-page" style={{ padding: "20px" }}>
      {successMessage && (
        <div style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          backgroundColor: "#10b981",
          color: "white",
          padding: "12px 20px",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          zIndex: 1000,
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
        }}>
          <Check size={18} />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div style={{
          position: "fixed",
          top: "20px",
          right: "20px",
          backgroundColor: "#ef4444",
          color: "white",
          padding: "12px 20px",
          borderRadius: "8px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          zIndex: 1000,
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <h1 style={{ margin: 0 }}>Housekeeping Schedule</h1>
        <button
          onClick={fetchHousekeepingSchedule}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 16px",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "500"
          }}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "15px", marginBottom: "20px" }}>
        <div style={{ padding: "15px", backgroundColor: "#f3f4f6", borderRadius: "8px", border: "2px solid #d1d5db" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>Total Rooms</p>
          <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "700" }}>{summary.total}</p>
        </div>
        <div style={{ padding: "15px", backgroundColor: "#f0fdf4", borderRadius: "8px", border: "2px solid #86efac" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#166534" }}>Clean</p>
          <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "700", color: "#166534" }}>{summary.clean}</p>
        </div>
        <div style={{ padding: "15px", backgroundColor: "#fef2f2", borderRadius: "8px", border: "2px solid #fca5a5" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#991b1b" }}>Needs Cleaning</p>
          <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "700", color: "#991b1b" }}>{summary.dirty}</p>
        </div>
        <div style={{ padding: "15px", backgroundColor: "#fef3c7", borderRadius: "8px", border: "2px solid #fcd34d" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#92400e" }}>In Progress</p>
          <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "700", color: "#92400e" }}>{summary.inProgress}</p>
        </div>
        <div style={{ padding: "15px", backgroundColor: "#eff6ff", borderRadius: "8px", border: "2px solid #93c5fd" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#1e40af" }}>Inspected</p>
          <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "700", color: "#1e40af" }}>{summary.inspected}</p>
        </div>
        <div style={{ padding: "15px", backgroundColor: "#fef2f2", borderRadius: "8px", border: "2px solid #fca5a5" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#991b1b" }}>Out of Order</p>
          <p style={{ margin: "4px 0 0 0", fontSize: "24px", fontWeight: "700", color: "#991b1b" }}>{summary.outOfOrder}</p>
        </div>
      </div>

      {/* Filters and Bulk Actions */}
      <div style={{ 
        display: "flex", 
        gap: "15px", 
        marginBottom: "20px", 
        padding: "15px", 
        backgroundColor: "#f9fafb", 
        borderRadius: "8px",
        flexWrap: "wrap"
      }}>
        <select 
          value={filterBranch} 
          onChange={(e) => setFilterBranch(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
            fontSize: "14px"
          }}
        >
          <option value="">All Branches</option>
          {branches.map(b => <option key={b._id} value={b._id}>{b.name}</option>)}
        </select>

        <input
          type="text"
          placeholder="Cleaner Name"
          value={cleanerName}
          onChange={(e) => setCleanerName(e.target.value)}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
            fontSize: "14px",
            flex: 1,
            minWidth: "150px"
          }}
        />

        {selectedRooms.length > 0 && (
          <>
            <select 
              value={bulkStatus} 
              onChange={(e) => setBulkStatus(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #d1d5db",
                fontSize: "14px"
              }}
            >
              <option value="">Select Status</option>
              <option value="clean">Clean</option>
              <option value="dirty">Dirty</option>
              <option value="in-progress">In Progress</option>
              <option value="inspected">Inspected</option>
              <option value="out-of-order">Out of Order</option>
            </select>

            <button
              onClick={bulkUpdateStatus}
              style={{
                padding: "8px 16px",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "14px"
              }}
            >
              Update {selectedRooms.length} Room{selectedRooms.length > 1 ? 's' : ''}
            </button>

            <button
              onClick={() => setSelectedRooms([])}
              style={{
                padding: "8px 16px",
                backgroundColor: "#6b7280",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: "500",
                fontSize: "14px"
              }}
            >
              Clear Selection
            </button>
          </>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p>Loading housekeeping schedule...</p>
        </div>
      ) : (
        <div>
          {/* Dirty Rooms - Priority */}
          {schedule.dirty.length > 0 && (
            <div style={{ marginBottom: "30px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "15px", color: "#991b1b" }}>
                🚨 Needs Cleaning ({schedule.dirty.length})
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "15px" }}>
                {schedule.dirty.map(room => <RoomCard key={room._id} room={room} />)}
              </div>
            </div>
          )}

          {/* In Progress */}
          {schedule.inProgress.length > 0 && (
            <div style={{ marginBottom: "30px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "15px", color: "#92400e" }}>
                🧹 Cleaning in Progress ({schedule.inProgress.length})
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "15px" }}>
                {schedule.inProgress.map(room => <RoomCard key={room._id} room={room} />)}
              </div>
            </div>
          )}

          {/* Clean Rooms */}
          {schedule.clean.length > 0 && (
            <div style={{ marginBottom: "30px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "15px", color: "#166534" }}>
                ✅ Clean Rooms ({schedule.clean.length})
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "15px" }}>
                {schedule.clean.map(room => <RoomCard key={room._id} room={room} />)}
              </div>
            </div>
          )}

          {/* Inspected */}
          {schedule.inspected.length > 0 && (
            <div style={{ marginBottom: "30px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "15px", color: "#1e40af" }}>
                🔍 Inspected ({schedule.inspected.length})
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "15px" }}>
                {schedule.inspected.map(room => <RoomCard key={room._id} room={room} />)}
              </div>
            </div>
          )}

          {/* Out of Order */}
          {schedule.outOfOrder.length > 0 && (
            <div style={{ marginBottom: "30px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "15px", color: "#991b1b" }}>
                ⚠️ Out of Order ({schedule.outOfOrder.length})
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: "15px" }}>
                {schedule.outOfOrder.map(room => <RoomCard key={room._id} room={room} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Housekeeping
