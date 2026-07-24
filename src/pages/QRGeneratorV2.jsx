import { useState, useEffect } from "react"
import { QrCode, Download, Eye, Search, AlertCircle, Loader } from "lucide-react"
import { useNavigate } from "react-router-dom"

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
}

// QR Code generation function
const generateQRCode = (text, size = 300) => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`
}

const QRGeneratorV2 = () => {
  const navigate = useNavigate()
  
  // State
  const [branches, setBranches] = useState([])
  const [tables, setTables] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedBranch, setSelectedBranch] = useState("")
  const [selectedTable, setSelectedTable] = useState("")
  const [generatedQR, setGeneratedQR] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Fetch data on mount
  useEffect(() => {
    fetchInitialData()
  }, [])

  // Fetch branches, tables, and categories
  const fetchInitialData = async () => {
    try {
      setLoading(true)
      setError("")

      const [branchesData, tablesResponse, categoriesData] = await Promise.all([
        api.get("/branch"),
        api.get("/table"),
        api.get("/category"),
      ])

      setBranches(branchesData)
      setCategories(categoriesData)

      // Handle different API response formats for tables
      let tablesData = []
      
      // Check if response is directly an array
      if (Array.isArray(tablesResponse)) {
        tablesData = tablesResponse
      } 
      // Check if wrapped in {success, data} format
      else if (tablesResponse && tablesResponse.success && Array.isArray(tablesResponse.data)) {
        tablesData = tablesResponse.data
      } 
      // Check if wrapped in {data} format
      else if (tablesResponse && tablesResponse.data && Array.isArray(tablesResponse.data)) {
        tablesData = tablesResponse.data
      }
      // Fallback: try to use response as-is
      else if (tablesResponse && typeof tablesResponse === 'object') {
        console.warn("Unexpected response format, attempting to use as-is:", tablesResponse)
        tablesData = []
      }

      console.log("✅ Tables loaded successfully:", tablesData.length, "tables")
      setTables(tablesData)
    } catch (error) {
      console.error("❌ Error fetching data:", error)
      setError("Failed to load data. Please refresh the page.")
    } finally {
      setLoading(false)
    }
  }

  // Get filtered tables for selected branch
  const getFilteredTables = () => {
    if (!selectedBranch) return []
    
    return tables.filter((table) => {
      const tableBranchId = table.branchId?._id || table.branchId
      return tableBranchId === selectedBranch
    })
  }

  // Get selected table details
  const getSelectedTableDetails = () => {
    if (!selectedTable) return null
    
    const table = tables.find((t) => t._id === selectedTable)
    if (!table) return null

    const branchId = table.branchId?._id || table.branchId
    const branch = branches.find((b) => b._id === branchId)
    
    const categoryId = table.categoryId?._id || table.categoryId
    const category = categories.find((c) => c._id === categoryId)

    return {
      ...table,
      branchName: branch?.name || "Unknown Branch",
      categoryName: category?.name || "No Category",
      categoryId: categoryId,
    }
  }

  // Generate QR Code
  const handleGenerateQR = () => {
    const tableDetails = getSelectedTableDetails()
    if (!tableDetails) {
      alert("Please select a table")
      return
    }

    // Use frontend URL from environment variable (defaults to production)
    const baseUrl = import.meta.env.VITE_FRONTEND_URL || "https://billing.jagalikoota.com"
    let menuUrl = `${baseUrl}/public-menu?branch=${tableDetails.branchId?._id || tableDetails.branchId}&name=${encodeURIComponent(tableDetails.branchName)}&table=${tableDetails.number}`

    // Add category if table has one assigned
    if (tableDetails.categoryId) {
      menuUrl += `&category=${tableDetails.categoryId}&categoryName=${encodeURIComponent(tableDetails.categoryName)}`
    }

    const qrCodeUrl = generateQRCode(menuUrl, 300)

    setGeneratedQR({
      url: menuUrl,
      qrCode: qrCodeUrl,
      tableNumber: tableDetails.number,
      branchName: tableDetails.branchName,
      categoryName: tableDetails.categoryName,
      capacity: tableDetails.capacity,
    })
  }

  // Download QR Code
  const downloadQRCode = async () => {
    if (!generatedQR) return

    try {
      const response = await fetch(generatedQR.qrCode)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `${generatedQR.branchName.replace(/\s+/g, "-")}-table-${generatedQR.tableNumber}-qr.png`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading QR code:", error)
      alert("Failed to download QR code. Please try again.")
    }
  }

  // Preview Menu
  const previewMenu = () => {
    if (!generatedQR) return
    
    try {
      const url = new URL(generatedQR.url)
      const relativePath = `${url.pathname}${url.search}`
      navigate(relativePath)
    } catch (error) {
      console.error("Invalid URL:", error)
      alert("Failed to preview menu. Invalid URL.")
    }
  }

  // Reset selection
  const handleReset = () => {
    setSelectedTable("")
    setGeneratedQR(null)
  }

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <Loader size={40} className="animate-spin" style={{ color: "#667eea" }} />
        <p style={{ marginTop: "16px", color: "#666" }}>Loading data...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <AlertCircle size={48} color="#dc2626" />
        <h3 style={{ marginTop: "16px", color: "#dc2626" }}>Error</h3>
        <p style={{ color: "#666", marginTop: "8px" }}>{error}</p>
        <button onClick={fetchInitialData} style={styles.retryButton}>
          Retry
        </button>
      </div>
    )
  }

  const filteredTables = getFilteredTables()
  const tableDetails = getSelectedTableDetails()

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <QrCode size={32} color="#667eea" />
            <div>
              <h1 style={styles.title}>Table QR Code Generator</h1>
              <p style={styles.subtitle}>Generate QR codes for individual tables</p>
            </div>
          </div>
        </div>

        {/* Selection Form */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Select Table</h2>
          
          <div style={styles.formGrid}>
            {/* Branch Selection */}
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Branch <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                value={selectedBranch}
                onChange={(e) => {
                  setSelectedBranch(e.target.value)
                  setSelectedTable("")
                  setGeneratedQR(null)
                }}
                style={styles.select}
              >
                <option value="">Select a branch...</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Table Selection */}
            <div style={styles.formGroup}>
              <label style={styles.label}>
                Table <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <select
                value={selectedTable}
                onChange={(e) => {
                  setSelectedTable(e.target.value)
                  setGeneratedQR(null)
                }}
                style={styles.select}
                disabled={!selectedBranch}
              >
                <option value="">Select a table...</option>
                {filteredTables.map((table) => (
                  <option key={table._id} value={table._id}>
                    Table {table.number}
                    {table.capacity ? ` (${table.capacity} people)` : ""}
                  </option>
                ))}
              </select>
              {selectedBranch && filteredTables.length === 0 && (
                <p style={styles.helperText}>No tables found for this branch</p>
              )}
            </div>
          </div>

          {/* Table Details */}
          {tableDetails && (
            <div style={styles.detailsCard}>
              <h3 style={styles.detailsTitle}>Table Details</h3>
              <div style={styles.detailsGrid}>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Table Number:</span>
                  <span style={styles.detailValue}>{tableDetails.number}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Branch:</span>
                  <span style={styles.detailValue}>{tableDetails.branchName}</span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Category:</span>
                  <span style={styles.detailValue}>{tableDetails.categoryName}</span>
                </div>
                {tableDetails.capacity && (
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Capacity:</span>
                    <span style={styles.detailValue}>{tableDetails.capacity} people</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Generate Button */}
          <div style={styles.buttonGroup}>
            <button
              onClick={handleGenerateQR}
              disabled={!selectedTable}
              style={{
                ...styles.generateButton,
                opacity: !selectedTable ? 0.5 : 1,
                cursor: !selectedTable ? "not-allowed" : "pointer",
              }}
            >
              <QrCode size={18} />
              Generate QR Code
            </button>
            {generatedQR && (
              <button onClick={handleReset} style={styles.resetButton}>
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Generated QR Code Display */}
        {generatedQR && (
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Generated QR Code</h2>
            
            <div style={styles.qrDisplay}>
              <div style={styles.qrInfo}>
                <h3 style={styles.qrTitle}>
                  {generatedQR.branchName} - Table {generatedQR.tableNumber}
                </h3>
                <p style={styles.qrCategory}>Category: {generatedQR.categoryName}</p>
              </div>

              <div style={styles.qrImageContainer}>
                <img
                  src={generatedQR.qrCode}
                  alt={`QR Code for Table ${generatedQR.tableNumber}`}
                  style={styles.qrImage}
                />
              </div>

              <div style={styles.qrActions}>
                <button onClick={downloadQRCode} style={styles.downloadButton}>
                  <Download size={16} />
                  Download QR Code
                </button>
                <button onClick={previewMenu} style={styles.previewButton}>
                  <Eye size={16} />
                  Preview Menu
                </button>
              </div>

              <div style={styles.urlDisplay}>
                <p style={styles.urlLabel}>QR Code URL:</p>
                <code style={styles.urlCode}>{generatedQR.url}</code>
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div style={styles.instructionsCard}>
          <h3 style={styles.instructionsTitle}>How to use:</h3>
          <ol style={styles.instructionsList}>
            <li>Select a branch from the dropdown</li>
            <li>Select a specific table for that branch</li>
            <li>Review the table details (number, category, capacity)</li>
            <li>Click "Generate QR Code" to create the QR code</li>
            <li>Download the QR code image</li>
            <li>Print and place the QR code on the corresponding table</li>
            <li>When customers scan the QR code, they'll see the menu filtered by the table's category</li>
            <li>Orders will automatically include the table number</li>
            <li>If you lose a QR code, simply select the same table and regenerate it</li>
          </ol>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  )
}

// Styles
const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f8f9fa",
    padding: "24px",
  },
  content: {
    maxWidth: "1000px",
    margin: "0 auto",
  },
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f9fa",
  },
  errorContainer: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f9fa",
    padding: "40px",
  },
  retryButton: {
    marginTop: "16px",
    padding: "12px 24px",
    backgroundColor: "#667eea",
    color: "white",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
  },
  header: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "24px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  },
  headerTitle: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  title: {
    fontSize: "28px",
    fontWeight: "700",
    color: "#1a202c",
    margin: 0,
  },
  subtitle: {
    fontSize: "14px",
    color: "#718096",
    margin: "4px 0 0 0",
  },
  card: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "24px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  },
  cardTitle: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#1a202c",
    marginBottom: "20px",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "20px",
    marginBottom: "20px",
  },
  formGroup: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#374151",
    marginBottom: "8px",
  },
  select: {
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "8px",
    fontSize: "14px",
    backgroundColor: "white",
    cursor: "pointer",
    outline: "none",
  },
  helperText: {
    fontSize: "12px",
    color: "#9ca3af",
    marginTop: "4px",
  },
  detailsCard: {
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
    padding: "16px",
    marginBottom: "20px",
  },
  detailsTitle: {
    fontSize: "16px",
    fontWeight: "600",
    color: "#374151",
    marginBottom: "12px",
  },
  detailsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "12px",
  },
  detailItem: {
    display: "flex",
    flexDirection: "column",
  },
  detailLabel: {
    fontSize: "12px",
    color: "#6b7280",
    marginBottom: "4px",
  },
  detailValue: {
    fontSize: "14px",
    fontWeight: "500",
    color: "#1f2937",
  },
  buttonGroup: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
  },
  generateButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 24px",
    backgroundColor: "#667eea",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
  },
  resetButton: {
    padding: "12px 24px",
    backgroundColor: "#6b7280",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
  },
  qrDisplay: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  qrInfo: {
    textAlign: "center",
    marginBottom: "20px",
  },
  qrTitle: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#1a202c",
    margin: 0,
  },
  qrCategory: {
    fontSize: "14px",
    color: "#6b7280",
    marginTop: "4px",
  },
  qrImageContainer: {
    padding: "20px",
    backgroundColor: "#f9fafb",
    borderRadius: "12px",
    marginBottom: "20px",
  },
  qrImage: {
    width: "300px",
    height: "300px",
    border: "2px solid #e5e7eb",
    borderRadius: "8px",
  },
  qrActions: {
    display: "flex",
    gap: "12px",
    marginBottom: "20px",
  },
  downloadButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 20px",
    backgroundColor: "#667eea",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
  },
  previewButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 20px",
    backgroundColor: "white",
    color: "#667eea",
    border: "2px solid #667eea",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "500",
    cursor: "pointer",
  },
  urlDisplay: {
    width: "100%",
    padding: "16px",
    backgroundColor: "#f9fafb",
    borderRadius: "8px",
  },
  urlLabel: {
    fontSize: "12px",
    fontWeight: "500",
    color: "#6b7280",
    marginBottom: "8px",
  },
  urlCode: {
    display: "block",
    fontSize: "12px",
    color: "#374151",
    wordBreak: "break-all",
    backgroundColor: "white",
    padding: "8px",
    borderRadius: "4px",
    border: "1px solid #e5e7eb",
  },
  instructionsCard: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "24px",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
  },
  instructionsTitle: {
    fontSize: "18px",
    fontWeight: "600",
    color: "#1a202c",
    marginBottom: "16px",
  },
  instructionsList: {
    color: "#4b5563",
    lineHeight: "1.8",
    paddingLeft: "20px",
  },
}

export default QRGeneratorV2
