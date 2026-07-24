import { useState, useEffect } from "react"
import { QrCode, Download, Eye, Trash2, Search } from "lucide-react"
import { useNavigate } from "react-router-dom"

// QR Code generation function using external API
const generateQRCode = (text, size = 200) => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`
}

// API configuration using environment variables
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
}

// Local Storage utilities
const STORAGE_KEY = "qr_table_codes"

const saveQRCodesToStorage = (qrCodes) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        codes: qrCodes,
        timestamp: Date.now(),
      }),
    )
  } catch (error) {
    console.error("Error saving QR codes to localStorage:", error)
  }
}

const loadQRCodesFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      const isRecent = Date.now() - data.timestamp < 24 * 60 * 60 * 1000
      if (isRecent && data.codes) {
        return data.codes
      }
    }
  } catch (error) {
    console.error("Error loading QR codes from localStorage:", error)
  }
  return []
}

const clearQRCodesFromStorage = () => {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error("Error clearing QR codes from localStorage:", error)
  }
}

const QRGenerator = () => {
  const [branches, setBranches] = useState([])
  const [tables, setTables] = useState([])
  const [selectedBranch, setSelectedBranch] = useState("")
  const [qrCodes, setQrCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [branchFilter, setBranchFilter] = useState("all")

  useEffect(() => {
    fetchBranches()
    fetchTables()
    const savedQRCodes = loadQRCodesFromStorage()
    if (savedQRCodes.length > 0) {
      setQrCodes(savedQRCodes)
    }
  }, [])

  useEffect(() => {
    if (qrCodes.length > 0) {
      saveQRCodesToStorage(qrCodes)
    }
  }, [qrCodes])

  const fetchBranches = async () => {
    try {
      setLoading(true)
      setError("")
      const branchesData = await api.get("/branch")
      setBranches(branchesData)
      if (branchesData.length > 0) {
        setSelectedBranch(branchesData[0]._id)
      }
    } catch (error) {
      console.error("Error fetching branches:", error)
      setError("Failed to load branches. Please check your internet connection.")
    } finally {
      setLoading(false)
    }
  }

  const fetchTables = async () => {
    try {
      const response = await api.get("/table")
      
      // Handle new API response format {success, count, data}
      let tablesData = []
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        // New format: {success, count, data}
        tablesData = response.data.data
      } else if (Array.isArray(response.data)) {
        // Old format: direct array
        tablesData = response.data
      } else {
        console.error("❌ Unexpected response format:", response.data)
        throw new Error("Invalid response format: tables array missing")
      }
      
      const formattedTables = tablesData.map((table) => ({
        id: table._id,
        number: table.number,
        status: table.status,
        branchId: table.branchId?._id || table.branchId,
        branchName: table.branchId?.name || "Unknown Branch",
        image: table.image,
        createdAt: new Date(table.createdAt).toLocaleString(),
      }))
      setTables(formattedTables)
    } catch (error) {
      console.error("Error fetching tables:", error)
      setError("Failed to load tables.")
    }
  }

  const generateQRCodes = async () => {
    if (!selectedBranch) return

    setGenerating(true)
    try {
      const branchesToGenerate =
        selectedBranch === "all" ? branches : branches.filter((branch) => branch._id === selectedBranch)

      const newCodes = []

      for (const branch of branchesToGenerate) {
        // Check if QR codes already exist for this branch
        const existingCodesForBranch = qrCodes.filter((code) => code.branchId === branch._id)

        // If codes already exist for this branch, skip generation
        if (existingCodesForBranch.length > 0) {
          console.log(`QR codes already exist for branch: ${branch.name}`)
          continue
        }

        // Get tables for this branch
        const branchTables = tables.filter((table) => table.branchId === branch._id)

        if (branchTables.length === 0) {
          // If no tables exist, create a default table entry
          const menuUrl = `${window.location.origin}/public-menu?branch=${branch._id}&name=${encodeURIComponent(branch.name)}&table=1`
          newCodes.push({
            id: `${branch._id}-default`,
            branchId: branch._id,
            branchName: branch.name,
            tableNumber: 1,
            url: menuUrl,
            qrCode: generateQRCode(menuUrl, 300),
            generatedAt: new Date().toISOString(),
          })
        } else {
          // Create QR code for each table
          branchTables.forEach((table) => {
            const menuUrl = `${window.location.origin}/public-menu?branch=${branch._id}&name=${encodeURIComponent(branch.name)}&table=${table.number}`

            newCodes.push({
              id: `${branch._id}-${table.number}`,
              branchId: branch._id,
              branchName: branch.name,
              tableNumber: table.number,
              tableId: table.id,
              url: menuUrl,
              qrCode: generateQRCode(menuUrl, 300),
              generatedAt: new Date().toISOString(),
            })
          })
        }
      }

      // Add new codes to existing codes instead of replacing them
      if (newCodes.length > 0) {
        setQrCodes((prevCodes) => [...prevCodes, ...newCodes])
      }
    } catch (error) {
      console.error("Error generating QR codes:", error)
      setError("Failed to generate QR codes.")
    } finally {
      setGenerating(false)
    }
  }

  const clearAllQRCodes = () => {
    if (window.confirm("Are you sure you want to clear all generated QR codes? This action cannot be undone.")) {
      setQrCodes([])
      clearQRCodesFromStorage()
    }
  }

  const clearBranchQRCodes = (branchId) => {
    const branchName = branches.find((b) => b._id === branchId)?.name || "this branch"
    if (window.confirm(`Are you sure you want to clear QR codes for ${branchName}?`)) {
      setQrCodes((prevCodes) => prevCodes.filter((code) => code.branchId !== branchId))
    }
  }

  const downloadQRCode = async (qrCode) => {
    try {
      const response = await fetch(qrCode.qrCode)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${qrCode.branchName.replace(/\s+/g, "-")}-table-${qrCode.tableNumber}-qr.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading QR code:", error)
      alert("Failed to download QR code. Please try again.")
    }
  }

  const navigate = useNavigate()
  const previewMenu = (qrCode) => {
    try {
      const url = new URL(qrCode.url)
      const relativePath = `${url.pathname}${url.search}`
      navigate(relativePath)
    } catch (error) {
      console.error("Invalid URL in previewMenu:", error)
      alert("Failed to preview menu. Invalid URL.")
    }
  }

  // Filter QR codes for display
  const filteredQRCodes = qrCodes.filter((qrCode) => {
    const matchesSearch =
      !searchTerm ||
      qrCode.branchName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      qrCode.tableNumber.toString().includes(searchTerm)

    const matchesBranch = branchFilter === "all" || qrCode.branchId === branchFilter

    return matchesSearch && matchesBranch
  })

  // Get unique branches that have QR codes
  const branchesWithQRCodes = branches.filter((branch) => qrCodes.some((code) => code.branchId === branch._id))

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.loadingContent}>
          <div style={styles.spinner}></div>
          <p>Loading branches...</p>
        </div>
      </div>
    )
  }

  if (error && !branches.length) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorContent}>
          <QrCode size={48} style={{ marginBottom: "16px", opacity: 0.5 }} />
          <h3>Error Loading Data</h3>
          <p>{error}</p>
          <button onClick={fetchBranches} style={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.adminContainer}>
      <div style={styles.adminContent}>
        {/* Header */}
        <div style={styles.adminHeader}>
          <div style={styles.adminHeaderTitle}>
            <div style={styles.logoContainer}>
              <QrCode size={24} color="#ff7e47" />
            </div>
            <div>
              <h1 style={styles.adminTitle}>Table QR Menu Generator</h1>
              <p style={styles.adminSubtitle}>Generate unique QR codes for each table</p>
            </div>
          </div>

          {/* Controls */}
          <div style={styles.controlsContainer}>
            <div style={styles.branchSelectContainer}>
              <label style={styles.label}>Select Branch</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                style={styles.branchSelect}
              >
                <option value="">Choose a branch...</option>
                <option value="all">All Branches</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.buttonGroup}>
              <button
                onClick={generateQRCodes}
                disabled={generating || !selectedBranch}
                style={{
                  ...styles.generateButton,
                  opacity: generating || !selectedBranch ? 0.7 : 1,
                  cursor: generating || !selectedBranch ? "not-allowed" : "pointer",
                }}
              >
                <QrCode size={16} />
                {generating ? "Generating..." : "Generate QR Codes"}
              </button>
              {qrCodes.length > 0 && (
                <button onClick={clearAllQRCodes} style={styles.clearButton}>
                  <Trash2 size={16} />
                  Clear All
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Status Card */}
        {qrCodes.length > 0 && (
          <div style={styles.statusCard}>
            <div style={styles.statusContent}>
              <div style={styles.statusInfo}>
                <QrCode size={20} color="#ff7e47" />
                <span>
                  <strong>{qrCodes.length}</strong> QR code{qrCodes.length !== 1 ? "s" : ""} generated for tables
                  {qrCodes[0]?.generatedAt && (
                    <span style={styles.statusTime}>
                      {" • Generated on "}
                      {new Date(qrCodes[0].generatedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  )}
                </span>
              </div>
              <div style={styles.statusNote}>
                Branches with QR codes: {branchesWithQRCodes.map((b) => b.name).join(", ")}
              </div>
            </div>
          </div>
        )}

        {/* QR Codes Filter */}
        {qrCodes.length > 0 && (
          <div style={styles.filtersBar}>
            <div style={styles.searchContainer}>
              <Search size={18} style={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search QR codes..."
                style={styles.searchInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div style={styles.filterButtons}>
              <select
                style={styles.filterSelect}
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
              >
                <option value="all">All Branches</option>
                {branchesWithQRCodes.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* QR Codes Display */}
        {qrCodes.length > 0 && (
          <div style={styles.qrCodesGrid}>
            {filteredQRCodes.map((qrCode) => (
              <div key={qrCode.id} style={styles.qrCodeCard}>
                <h3 style={styles.qrCodeTitle}>
                  {qrCode.branchName} - Table {qrCode.tableNumber}
                </h3>
                <div style={styles.qrCodeImageContainer}>
                  <img
                    src={qrCode.qrCode || "/placeholder.svg"}
                    alt={`QR Code for ${qrCode.branchName} Table ${qrCode.tableNumber}`}
                    style={styles.qrCodeImage}
                  />
                </div>
                <div style={styles.qrCodeActions}>
                  <button onClick={() => downloadQRCode(qrCode)} style={styles.downloadButton}>
                    <Download size={14} />
                    Download
                  </button>
                  <button onClick={() => previewMenu(qrCode)} style={styles.previewButton}>
                    <Eye size={14} />
                    Preview
                  </button>
                </div>
                <div style={styles.urlDisplay}>{qrCode.url}</div>
              </div>
            ))}
          </div>
        )}

        {/* Instructions */}
        <div style={styles.instructionsCard}>
          <h3 style={styles.instructionsTitle}>How to use:</h3>
          <ol style={styles.instructionsList}>
            <li>Select a branch or choose "All Branches" to generate QR codes</li>
            <li>Click "Generate QR Codes" to create unique QR codes for each table</li>
            <li>QR codes are preserved when switching between branches - no need to regenerate</li>
            <li>Each QR code will show the specific table number when scanned</li>
            <li>Download the QR code images and print them</li>
            <li>Place each QR code on its corresponding table</li>
            <li>When customers scan the QR code, they'll see the menu with the table number displayed</li>
            <li>Use "Preview" to see how the menu will look to customers</li>
          </ol>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

// Styles
const styles = {
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingContent: {
    textAlign: "center",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "4px solid #ff7e47",
    borderTop: "4px solid transparent",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    margin: "0 auto 16px",
  },
  errorContainer: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f9fa",
  },
  errorContent: {
    textAlign: "center",
    padding: "40px",
    backgroundColor: "white",
    borderRadius: "12px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  },
  retryButton: {
    padding: "12px 24px",
    backgroundColor: "#ff7e47",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    marginTop: "16px",
  },
  adminContainer: {
    minHeight: "100vh",
    backgroundColor: "#f8f9fa",
    fontFamily: "Inter, sans-serif",
    padding: "24px",
  },
  adminContent: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  adminHeader: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "24px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  },
  adminHeaderTitle: {
    display: "flex",
    alignItems: "center",
    marginBottom: "20px",
  },
  logoContainer: {
    width: "50px",
    height: "50px",
    backgroundColor: "rgba(255, 126, 71, 0.1)",
    borderRadius: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginRight: "16px",
  },
  adminTitle: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#333",
    margin: 0,
  },
  adminSubtitle: {
    color: "#666",
    margin: 0,
    fontSize: "16px",
  },
  controlsContainer: {
    display: "flex",
    gap: "16px",
    alignItems: "end",
    flexWrap: "wrap",
  },
  branchSelectContainer: {
    flex: "1",
    minWidth: "200px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    fontWeight: "500",
    color: "#333",
  },
  branchSelect: {
    width: "100%",
    padding: "12px 16px",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
    fontSize: "14px",
    backgroundColor: "white",
  },
  buttonGroup: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
  },
  generateButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 24px",
    backgroundColor: "#ff7e47",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
  },
  clearButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 20px",
    backgroundColor: "#dc3545",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
  },
  statusCard: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "20px",
    marginBottom: "24px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
    border: "1px solid rgba(255, 126, 71, 0.2)",
  },
  statusContent: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  statusInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    fontSize: "16px",
    color: "#333",
  },
  statusTime: {
    color: "#666",
    fontSize: "14px",
    fontWeight: "normal",
  },
  statusNote: {
    fontSize: "14px",
    color: "#666",
    fontStyle: "italic",
  },
  filtersBar: {
    display: "flex",
    gap: "16px",
    alignItems: "center",
    marginBottom: "20px",
    flexWrap: "wrap",
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "16px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.05)",
  },
  searchContainer: {
    position: "relative",
    flex: "1",
    minWidth: "200px",
  },
  searchIcon: {
    position: "absolute",
    left: "12px",
    top: "50%",
    transform: "translateY(-50%)",
    color: "#9ca3af",
    pointerEvents: "none",
  },
  searchInput: {
    width: "100%",
    padding: "10px 10px 10px 40px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "14px",
    outline: "none",
  },
  filterButtons: {
    display: "flex",
    gap: "12px",
  },
  filterSelect: {
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "14px",
    backgroundColor: "white",
    minWidth: "120px",
  },
  qrCodesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
    gap: "24px",
    marginBottom: "24px",
  },
  qrCodeCard: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    textAlign: "center",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
  },
  qrCodeTitle: {
    fontSize: "20px",
    fontWeight: "600",
    marginBottom: "16px",
    color: "#333",
  },
  qrCodeImageContainer: {
    marginBottom: "20px",
    padding: "16px",
    backgroundColor: "#f8f9fa",
    borderRadius: "8px",
  },
  qrCodeImage: {
    width: "250px",
    height: "250px",
    border: "1px solid #e5e5e5",
    borderRadius: "8px",
  },
  qrCodeActions: {
    display: "flex",
    gap: "12px",
    justifyContent: "center",
    marginBottom: "16px",
  },
  downloadButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    backgroundColor: "#ff7e47",
    color: "white",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    cursor: "pointer",
  },
  previewButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    backgroundColor: "white",
    color: "#ff7e47",
    border: "1px solid #ff7e47",
    borderRadius: "6px",
    fontSize: "14px",
    cursor: "pointer",
  },
  urlDisplay: {
    padding: "12px",
    backgroundColor: "#f8f9fa",
    borderRadius: "6px",
    fontSize: "12px",
    color: "#666",
    wordBreak: "break-all",
  },
  instructionsCard: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    marginTop: "24px",
  },
  instructionsTitle: {
    fontSize: "18px",
    fontWeight: "600",
    marginBottom: "16px",
    color: "#333",
  },
  instructionsList: {
    color: "#666",
    lineHeight: "1.6",
    paddingLeft: "20px",
  },
}

export default QRGenerator