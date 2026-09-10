import { useState, useEffect } from "react"
import { Search, Download, X, Check, AlertCircle, Plus, Upload, Loader, Store, QrCode } from "lucide-react"
import axios from "axios"

// Create axios instance using environment variables
const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel",
  headers: {
    "Content-Type": "application/json",
  },
})

const Tables = () => {
  const [allTables, setAllTables] = useState([])
  const [displayedTables, setDisplayedTables] = useState([]) 
  const [filteredTables, setFilteredTables] = useState([]) 
  const [branches, setBranches] = useState([])
  const [categories, setCategories] = useState([]) 
  const [filteredAddCategories, setFilteredAddCategories] = useState([])
  const [filteredEditCategories, setFilteredEditCategories] = useState([]) 
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // State for modals
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [selectedTable, setSelectedTable] = useState(null)
  const [addFormData, setAddFormData] = useState({
    branchId: "",
    categoryId: "",
    number: "",
    capacity: "", // Initialize as empty string instead of undefined
    status: "available",
    image: null,
  })
  const [editFormData, setEditFormData] = useState({
    branchId: "",
    categoryId: "",
    number: "",
    capacity: "", // Initialize as empty string instead of undefined
    status: "available",
    image: null,
  })
  const [successMessage, setSuccessMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Bulk-add state — create a whole range of tables in one go (e.g. C-01 … C-50)
  const [bulkModalOpen, setBulkModalOpen] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    branchId: "",
    categoryId: "",
    prefix: "",       // e.g. "C-" or "G-", blank for plain numbers
    from: "1",
    to: "10",
    padTo: "2",       // 2 -> 01, 3 -> 001
    capacity: "4",
    status: "available",
  })
  const [bulkProgress, setBulkProgress] = useState(null) // { done, total, failed[] }
  const [filteredBulkCategories, setFilteredBulkCategories] = useState([])

  // State for filters
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [branchFilter, setBranchFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const tablesPerPage = 10

  // Image preview states
  const [addImagePreview, setAddImagePreview] = useState(null)
  const [editImagePreview, setEditImagePreview] = useState(null)

  // Fetch tables, branches, and categories on component mount or when filters change
  useEffect(() => {
    fetchBranches()
    fetchCategories()
    fetchTables()
  }, [statusFilter, branchFilter, categoryFilter])

  // Fetch all branches
  const fetchBranches = async () => {
    try {
      const response = await api.get("/branch")
      setBranches(response.data)
    } catch (error) {
      console.error("Error fetching branches:", error)
      setError("Failed to load branches. Some filter options may not be available.")
    }
  }

  // Fetch all categories
  const fetchCategories = async () => {
    try {
      const response = await api.get("/category")
      console.log("Categories API response:", response.data)
      setCategories(response.data || [])
    } catch (error) {
      console.error("Error fetching categories:", error)
      setCategories([])
    }
  }

  // Fetch all tables
  const fetchTables = async () => {
    setLoading(true)
    setError("")
    setAllTables([]) // Clear all tables before fetching
    setFilteredTables([]) // Clear filtered tables
    setDisplayedTables([]) // Clear displayed tables

    try {
      // Build query parameters
      const params = {}

      // Add filters if they're not set to "all"
      if (branchFilter !== "all") {
        params.branchId = branchFilter
      }

     /*  console.log("Fetching tables with params:", params) */ // Debug log
      const response = await api.get("/table", { params })
      console.log("Full API response:", response) // Debug log
      console.log("Response data:", response.data) // Debug log
      console.log("Response data type:", typeof response.data) // Debug log
      console.log("Response data keys:", Object.keys(response.data || {})) // Debug log

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
      
      console.log("Extracted tablesData:", tablesData) // Debug log
      console.log("tablesData type:", typeof tablesData) // Debug log
      console.log("tablesData is array:", Array.isArray(tablesData)) // Debug log

      // Format and validate tables for display
      const formattedTables = tablesData
        .map((table, index) => {
          return {
            id: table._id || `temp-id-${index}`, // Fallback ID if _id is missing
            number: table.number || 0,
            capacity: table.capacity || "", // Initialize as empty string instead of null
            status: table.status || "available",
            branchId: table.branchId?._id || table.branchId || null,
            branchName: table.branchId?.name || "Unknown Branch",
            categoryId: table.categoryId?._id || table.categoryId || null,
            categoryName: table.categoryId?.name || "All Categories",
            image: table.image || null,
            qrCode: table.qrCode || null,
            createdAt: new Date(table.createdAt || Date.now()).toLocaleString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }),
            // Include the original table for reference
            originalTable: table,
          }
        })
        .filter((table) => table.id) // Remove any invalid tables

      setAllTables(formattedTables)
    } catch (error) {
      console.error("Error fetching tables:", error)
      setError("Failed to load tables. Please refresh the page and try again.")
    } finally {
      setLoading(false)
    }
  }

  // Handle search filtering and pagination
  useEffect(() => {
    // Apply client-side search filter with defensive checks
    let filtered = allTables

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((table) => table.status === statusFilter)
    }

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.trim().toLowerCase()
      filtered = filtered.filter((table) => {
        const number = table.number?.toString() || ""
        const branchName = table.branchName || ""
        const status = table.status || ""

        return (
          number.toLowerCase().includes(searchLower) ||
          branchName.toLowerCase().includes(searchLower) ||
          status.toLowerCase().includes(searchLower)
        )
      })
    }

    setFilteredTables(filtered)
    setTotalPages(Math.ceil(filtered.length / tablesPerPage))
    setCurrentPage(1) // Reset to first page on search or filter change
  }, [allTables, searchTerm, statusFilter])

  // Handle pagination
  useEffect(() => {
    // Slice filtered tables for the current page
    const startIndex = (currentPage - 1) * tablesPerPage
    const endIndex = startIndex + tablesPerPage
    const paginatedTables = filteredTables.slice(startIndex, endIndex)
    setDisplayedTables(paginatedTables)
  }, [filteredTables, currentPage])

  // Handle view table
  const handleViewTable = (table) => {
    setSelectedTable(table)
    setViewModalOpen(true)
  }

  // Handle add table
  const handleAddTable = () => {
    setAddFormData({
      branchId: "",
      categoryId: "",
      number: "",
      status: "available",
      image: null,
    })
    setAddImagePreview(null)
    setFilteredAddCategories([]) // Reset filtered categories
    setAddModalOpen(true)
  }

  // Handle edit table
  const handleEditTable = (table) => {
    setSelectedTable(table)
    setEditFormData({
      branchId: table.branchId || "",
      categoryId: table.categoryId || "",
      number: table.number || "",
      capacity: table.capacity || "",
      status: table.status || "available",
      image: null,
    })
    setEditImagePreview(table.image ? `${table.image}` : null)
    
    // Filter categories for the selected branch
    if (table.branchId) {
      const filtered = categories.filter(cat => 
        cat.branch?.id === table.branchId || cat.branchId === table.branchId
      )
      setFilteredEditCategories(filtered)
    } else {
      setFilteredEditCategories([])
    }
    
    setEditModalOpen(true)
  }

  // Handle delete table
  const handleDeleteTable = (table) => {
    setSelectedTable(table)
    setDeleteModalOpen(true)
  }

  // Handle form input change
  const handleAddInputChange = (e) => {
    const { name, value } = e.target
    setAddFormData({
      ...addFormData,
      [name]: value,
    })
    
    // Filter categories when branch is selected
    if (name === 'branchId') {
      if (value) {
        const filtered = categories.filter(cat => 
          cat.branch?.id === value || cat.branchId === value
        )
        setFilteredAddCategories(filtered)
      } else {
        setFilteredAddCategories([])
      }
      // Reset category selection when branch changes
      setAddFormData(prev => ({
        ...prev,
        branchId: value,
        categoryId: ''
      }))
    }
  }

  const handleEditInputChange = (e) => {
    const { name, value } = e.target
    setEditFormData({
      ...editFormData,
      [name]: value,
    })
    
    // Filter categories when branch is selected
    if (name === 'branchId') {
      if (value) {
        const filtered = categories.filter(cat => 
          cat.branch?.id === value || cat.branchId === value
        )
        setFilteredEditCategories(filtered)
      } else {
        setFilteredEditCategories([])
      }
      // Reset category selection when branch changes
      setEditFormData(prev => ({
        ...prev,
        branchId: value,
        categoryId: ''
      }))
    }
  }

  // Handle image upload
  const handleAddImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setAddFormData({
        ...addFormData,
        image: file,
      })
      // Create preview URL
      const reader = new FileReader()
      reader.onload = (e) => setAddImagePreview(e.target.result)
      reader.readAsDataURL(file)
    }
  }

  const handleEditImageChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setEditFormData({
        ...editFormData,
        image: file,
      })
      // Create preview URL
      const reader = new FileReader()
      reader.onload = (e) => setEditImagePreview(e.target.result)
      reader.readAsDataURL(file)
    }
  }

  // Handle save new table
  const handleSaveNewTable = async () => {
    setIsSubmitting(true)

    try {
      // Validate required fields
      if (!addFormData.branchId || !addFormData.number) {
        alert("Please fill in all required fields")
        return
      }

      // Create FormData for file upload
      const formData = new FormData()
      formData.append("branchId", addFormData.branchId)
      if (addFormData.categoryId) {
        formData.append("categoryId", addFormData.categoryId)
      }
      formData.append("number", addFormData.number)
      formData.append("status", addFormData.status)
      if (addFormData.image) {
        formData.append("image", addFormData.image)
      }

      // Create table
      await api.post("/table", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })

      // Refresh tables
      await fetchTables()

      setAddModalOpen(false)
      setSuccessMessage("Table created successfully")

      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage("")
      }, 3000)
    } catch (error) {
      console.error("Error creating table:", error)
      alert("Failed to create table. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // ─── Bulk add ─────────────────────────────────────────────────────────────

  // Build the list of table numbers the current bulk settings would produce.
  // Used both for the live preview and for the actual create loop, so what the
  // user sees is exactly what gets created.
  const buildBulkNumbers = (form = bulkForm) => {
    const from = parseInt(form.from, 10)
    const to = parseInt(form.to, 10)
    const pad = Math.max(0, parseInt(form.padTo, 10) || 0)
    if (Number.isNaN(from) || Number.isNaN(to) || to < from) return []
    const out = []
    for (let i = from; i <= to; i++) {
      out.push(`${form.prefix || ""}${String(i).padStart(pad, "0")}`)
    }
    return out
  }

  // Numbers that already exist for the chosen branch — skipped, not duplicated
  const existingNumbersForBranch = (branchId) => {
    const set = new Set()
    allTables.forEach((t) => {
      const tb = typeof t.branchId === "object" ? t.branchId?._id : t.branchId
      if (String(tb) === String(branchId)) {
        set.add(String(t.number ?? t.tableNumber ?? "").trim().toUpperCase())
      }
    })
    return set
  }

  const handleOpenBulk = () => {
    setBulkForm({
      branchId: "",
      categoryId: "",
      prefix: "",
      from: "1",
      to: "10",
      padTo: "2",
      capacity: "4",
      status: "available",
    })
    setBulkProgress(null)
    setFilteredBulkCategories([])
    setBulkModalOpen(true)
  }

  const handleBulkInputChange = (e) => {
    const { name, value } = e.target
    setBulkForm((prev) => {
      const next = { ...prev, [name]: value }
      // Branch drives which categories are selectable
      if (name === "branchId") {
        next.categoryId = ""
        setFilteredBulkCategories(
          categories.filter((c) => {
            const cb = c.branch?.id || c.branchId
            return String(cb) === String(value)
          })
        )
      }
      return next
    })
  }

  const handleBulkCreate = async () => {
    const numbers = buildBulkNumbers()

    if (!bulkForm.branchId) {
      alert("Please select a branch")
      return
    }
    if (numbers.length === 0) {
      alert('Invalid range — "To" must be greater than or equal to "From"')
      return
    }
    if (numbers.length > 200) {
      alert(`That would create ${numbers.length} tables. Please keep a single batch under 200.`)
      return
    }

    // Skip anything that already exists on this branch
    const existing = existingNumbersForBranch(bulkForm.branchId)
    const toCreate = numbers.filter((n) => !existing.has(n.toUpperCase()))
    const skipped = numbers.length - toCreate.length

    if (toCreate.length === 0) {
      alert(`All ${numbers.length} table numbers already exist on this branch. Nothing to create.`)
      return
    }

    const confirmMsg =
      `Create ${toCreate.length} tables?\n\n` +
      `${toCreate[0]} … ${toCreate[toCreate.length - 1]}` +
      (skipped > 0 ? `\n\n${skipped} already exist and will be skipped.` : "")
    if (!window.confirm(confirmMsg)) return

    setIsSubmitting(true)
    const failed = []
    setBulkProgress({ done: 0, total: toCreate.length, failed })

    // Sequential on purpose — keeps server load predictable and lets a partial
    // failure be reported precisely instead of failing the whole batch.
    for (let i = 0; i < toCreate.length; i++) {
      const number = toCreate[i]
      try {
        const fd = new FormData()
        fd.append("branchId", bulkForm.branchId)
        if (bulkForm.categoryId) fd.append("categoryId", bulkForm.categoryId)
        fd.append("number", number)
        fd.append("status", bulkForm.status)
        if (bulkForm.capacity) fd.append("capacity", bulkForm.capacity)

        await api.post("/table", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      } catch (err) {
        failed.push({ number, reason: err?.response?.data?.message || err.message })
      }
      setBulkProgress({ done: i + 1, total: toCreate.length, failed: [...failed] })
    }

    await fetchTables()
    setIsSubmitting(false)

    const created = toCreate.length - failed.length
    if (failed.length === 0) {
      setBulkModalOpen(false)
      setSuccessMessage(
        `Created ${created} tables${skipped > 0 ? ` (${skipped} already existed)` : ""}`
      )
      setTimeout(() => setSuccessMessage(""), 4000)
    }
    // On partial failure the modal stays open so the failed list is visible
  }

  // Handle save changes
  const handleSaveChanges = async () => {
    setIsSubmitting(true)

    try {
      // Validate required fields
      if (!editFormData.branchId || !editFormData.number) {
        alert("Please fill in all required fields")
        return
      }

      // Create FormData for file upload
      const formData = new FormData()
      formData.append("branchId", editFormData.branchId)
      if (editFormData.categoryId) {
        formData.append("categoryId", editFormData.categoryId)
      }
      formData.append("number", editFormData.number)
      formData.append("status", editFormData.status)
      if (editFormData.image) {
        formData.append("image", editFormData.image)
      }

      // Update table
      await api.put(`/table/${selectedTable.id}`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      })

      // Refresh tables
      await fetchTables()

      setEditModalOpen(false)
      setSuccessMessage(`Table ${selectedTable.number} updated successfully`)

      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage("")
      }, 3000)
    } catch (error) {
      console.error("Error updating table:", error)
      alert("Failed to update table. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle delete confirmation
  const handleConfirmDelete = async () => {
    setIsSubmitting(true)

    try {
      // Delete table
      await api.delete(`/table/${selectedTable.id}`)

      // Refresh tables
      await fetchTables()

      setDeleteModalOpen(false)
      setSuccessMessage(`Table ${selectedTable.number} deleted successfully`)

      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage("")
      }, 3000)
    } catch (error) {
      console.error("Error deleting table:", error)
      alert("Failed to delete table. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  // Close modals
  const closeViewModal = () => {
    setViewModalOpen(false)
    setSelectedTable(null)
  }

  const closeAddModal = () => {
    setAddModalOpen(false)
    setAddImagePreview(null)
  }

  const closeEditModal = () => {
    setEditModalOpen(false)
    setSelectedTable(null)
    setEditImagePreview(null)
  }

  const closeDeleteModal = () => {
    setDeleteModalOpen(false)
    setSelectedTable(null)
  }

  // Reset pagination when filters change
  const handleFilterChange = (type, value) => {
    if (type === "status") {
      setStatusFilter(value)
    } else if (type === "branch") {
      setBranchFilter(value)
    }
    setCurrentPage(1)
  }

  // Generate QR code URL for a table
  const generateQRCodeUrl = (table) => {
    // Always use production domain for QR codes
    const baseUrl = "https://billing.jagalikoota.com"
    // Include categoryId in URL if table has a category assigned
    let menuUrl = `${baseUrl}/menu?branch=${table.branchId}&name=${encodeURIComponent(table.branchName)}&table=${table.number}`
    if (table.categoryId) {
      menuUrl += `&category=${table.categoryId}&categoryName=${encodeURIComponent(table.categoryName || '')}`
    }
    // Use QR code API to generate QR code image
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(menuUrl)}`
  }

  // Download QR code for a table
  const downloadQRCode = async (table) => {
    const qrUrl = generateQRCodeUrl(table)
    try {
      const response = await fetch(qrUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `table-${table.number}-${table.branchName}-qr.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Error downloading QR code:", error)
      alert("Failed to download QR code")
    }
  }

  // Export tables as CSV
  const exportTables = () => {
    // Create CSV header
    let csv = "Table Number,Capacity,Branch,Status,Created At\n"

    // Add each table as a row
    filteredTables.forEach((table) => {
      const capacity = table.capacity ? `${table.capacity} people` : 'Not set'
      csv += `${table.number},"${capacity}","${table.branchName}",${table.status},"${table.createdAt}"\n`
    })

    // Create download link
    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.setAttribute("hidden", "")
    a.setAttribute("href", url)
    a.setAttribute("download", `tables-export-${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="tables-page">
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

      <div className="page-header" style={{ position: 'relative', zIndex: 100 }}>
        <h1>
          Table Management</h1>
        <div className="header-actions" style={{ position: 'relative', zIndex: 101 }}>
          <button className="btn btn-outline" onClick={exportTables}>
            <Download size={16} />
            <span>Export</span>
          </button>
          <button className="btn btn-outline" onClick={handleOpenBulk} style={{ position: 'relative', zIndex: 102 }}>
            <Upload size={16} />
            <span>Bulk Add</span>
          </button>
          <button className="btn btn-primary" onClick={handleAddTable} style={{ position: 'relative', zIndex: 102 }}>
            <Plus size={16} />
            <span>Add Table</span>
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-container">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search by table number, branch, or status..."
            className="search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-buttons">
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => handleFilterChange("status", e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="available">Available</option>
            <option value="reserved">Reserved</option>
          </select>
          <select
            className="filter-select"
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
      </div>

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
            <p>Loading tables...</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Table Number</th>
                <th>Capacity</th>
                <th>Branch</th>
                <th>Category</th>
                {/* <th>Status</th> */}
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayedTables.length > 0 ? (
                displayedTables.map((table) => (
                  <tr key={table.id}>
                    <td>
                      {table.image ? (
                        <img
                          src={`${table.image}`}
                          alt={`Table ${table.number}`}
                          className="table-image"
                          style={{
                            width: "50px",
                            height: "50px",
                            objectFit: "cover",
                            borderRadius: "4px",
                          }}
                        />
                      ) : (
                        <div
                          className="table-image-placeholder"
                          style={{
                            width: "50px",
                            height: "50px",
                            backgroundColor: "#f3f4f6",
                            borderRadius: "4px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#9ca3af",
                          }}
                        >
                          <Store size={20} />
                        </div>
                      )}
                    </td>
                    <td>Table {table.number}</td>
                    <td>{table.capacity ? `${table.capacity} people` : 'Not set'}</td>
                    <td>{table.branchName}</td>
                    <td>{table.categoryName}</td>
                    {/* <td>
                      <span className={`status-badge ${table.status}`}>
                        {table.status.charAt(0).toUpperCase() + table.status.slice(1)}
                      </span>
                    </td> */}
                    <td>{table.createdAt}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btn view" onClick={() => handleViewTable(table)}>
                          View
                        </button>
                        <button className="action-btn edit" onClick={() => handleEditTable(table)}>
                          Edit
                        </button>
                        {/* <button 
                          className="action-btn" 
                          onClick={() => downloadQRCode(table)}
                          style={{ backgroundColor: "#8b5cf6", color: "white" }}
                          title="Download QR Code"
                        >
                          <QrCode size={14} />
                        </button> */}
                        <button className="action-btn delete" onClick={() => handleDeleteTable(table)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="no-tables">
                    No tables found matching your criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

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

      {/* View Table Modal */}
      {viewModalOpen && selectedTable && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Table Details - Table {selectedTable.number}</h3>
              <button className="modal-close" onClick={closeViewModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="order-details">
                <div className="order-detail-row">
                  <div className="order-detail-label">Table Number</div>
                  <div className="order-detail-value">Table {selectedTable.number}</div>
                </div>
                <div className="order-detail-row">
                  <div className="order-detail-label">Table Capacity</div>
                  <div className="order-detail-value">{selectedTable.capacity ? `${selectedTable.capacity} people` : 'Not set'}</div>
                </div>
                <div className="order-detail-row">
                  <div className="order-detail-label">Branch</div>
                  <div className="order-detail-value">{selectedTable.branchName}</div>
                </div>
                <div className="order-detail-row">
                  <div className="order-detail-label">Category</div>
                  <div className="order-detail-value">{selectedTable.categoryName}</div>
                </div>
                <div className="order-detail-row">
                  <div className="order-detail-label">Status</div>
                  <div className="order-detail-value">
                    <span className={`status-badge ${selectedTable.status}`}>
                      {selectedTable.status.charAt(0).toUpperCase() + selectedTable.status.slice(1)}
                    </span>
                  </div>
                </div>
                <div className="order-detail-row">
                  <div className="order-detail-label">Created At</div>
                  <div className="order-detail-value">{selectedTable.createdAt}</div>
                </div>
                {selectedTable.image && (
                  <div className="order-detail-row">
                    <div className="order-detail-label">Image</div>
                    <div className="order-detail-value">
                      <img
                        src={`${selectedTable.image}`}
                        alt={`Table ${selectedTable.number}`}
                        style={{
                          width: "200px",
                          height: "150px",
                          objectFit: "cover",
                          borderRadius: "8px",
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="order-detail-row">
                  <div className="order-detail-label">QR Code</div>
                  <div className="order-detail-value">
                    {/* <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                      <img
                        src={generateQRCodeUrl(selectedTable)}
                        alt={`QR Code for Table ${selectedTable.number}`}
                        style={{
                          width: "200px",
                          height: "200px",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                        }}
                      />
                      <button
                        className="btn btn-outline"
                        onClick={() => downloadQRCode(selectedTable)}
                        style={{ display: "flex", alignItems: "center", gap: "5px" }}
                      >
                        <Download size={16} />
                        Download QR Code
                      </button>
                    </div> */}
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeViewModal}>
                Close
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  closeViewModal()
                  handleEditTable(selectedTable)
                }}
              >
                Edit Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Tables Modal */}
      {bulkModalOpen && (() => {
        const preview = buildBulkNumbers()
        const existing = bulkForm.branchId ? existingNumbersForBranch(bulkForm.branchId) : new Set()
        const dupCount = preview.filter((n) => existing.has(n.toUpperCase())).length
        const newCount = preview.length - dupCount

        return (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '560px' }}>
              <div className="modal-header">
                <h3>Bulk Add Tables</h3>
                <button
                  className="modal-close"
                  onClick={() => setBulkModalOpen(false)}
                  disabled={isSubmitting}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="modal-body">
                {/* Branch + Category */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Branch *</label>
                    <select
                      name="branchId"
                      className="form-select"
                      value={bulkForm.branchId}
                      onChange={handleBulkInputChange}
                    >
                      <option value="">Select Branch</option>
                      {branches.map((b) => (
                        <option key={b._id} value={b._id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Category (optional)</label>
                    <select
                      name="categoryId"
                      className="form-select"
                      value={bulkForm.categoryId}
                      onChange={handleBulkInputChange}
                      disabled={!bulkForm.branchId}
                    >
                      <option value="">None</option>
                      {filteredBulkCategories.map((c) => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Prefix + range */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Prefix</label>
                    <input
                      type="text"
                      name="prefix"
                      className="form-input"
                      placeholder="C-  (blank = plain)"
                      value={bulkForm.prefix}
                      onChange={handleBulkInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">From</label>
                    <input
                      type="number" min="0" name="from" className="form-input"
                      value={bulkForm.from} onChange={handleBulkInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">To</label>
                    <input
                      type="number" min="0" name="to" className="form-input"
                      value={bulkForm.to} onChange={handleBulkInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Digits</label>
                    <select
                      name="padTo" className="form-select"
                      value={bulkForm.padTo} onChange={handleBulkInputChange}
                    >
                      <option value="0">1, 2, 3</option>
                      <option value="2">01, 02</option>
                      <option value="3">001, 002</option>
                      <option value="4">0001</option>
                    </select>
                  </div>
                </div>

                {/* Capacity + status */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label className="form-label">Capacity (each)</label>
                    <input
                      type="number" min="1" name="capacity" className="form-input"
                      value={bulkForm.capacity} onChange={handleBulkInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select
                      name="status" className="form-select"
                      value={bulkForm.status} onChange={handleBulkInputChange}
                    >
                      <option value="available">Available</option>
                      <option value="reserved">Reserved</option>
                    </select>
                  </div>
                </div>

                {/* Live preview */}
                <div style={{
                  background: '#faf5f5', border: '1px solid #ede4e4',
                  borderRadius: '10px', padding: '14px', marginTop: '4px'
                }}>
                  <div style={{
                    fontSize: '0.72rem', fontWeight: 700, color: '#8a6b6b',
                    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px'
                  }}>
                    Preview — {preview.length} table{preview.length !== 1 ? 's' : ''}
                    {dupCount > 0 && (
                      <span style={{ color: '#b45309', marginLeft: '6px', textTransform: 'none' }}>
                        · {dupCount} already exist (will be skipped)
                      </span>
                    )}
                  </div>

                  {preview.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: '#b5482f' }}>
                      Invalid range — "To" must be ≥ "From"
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {preview.slice(0, 14).map((n) => {
                        const dup = existing.has(n.toUpperCase())
                        return (
                          <span key={n} style={{
                            padding: '3px 9px', borderRadius: '6px',
                            fontSize: '0.75rem', fontWeight: 600,
                            background: dup ? '#fbeae5' : '#fff',
                            color: dup ? '#b5482f' : '#5c3030',
                            border: `1px solid ${dup ? '#f3c4b8' : '#ede4e4'}`,
                            textDecoration: dup ? 'line-through' : 'none',
                          }}>
                            {n}
                          </span>
                        )
                      })}
                      {preview.length > 14 && (
                        <span style={{ padding: '3px 9px', fontSize: '0.75rem', color: '#8a6b6b' }}>
                          … +{preview.length - 14} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress / failures */}
                {bulkProgress && (
                  <div style={{ marginTop: '14px' }}>
                    <div style={{ fontSize: '0.82rem', color: '#5c3030', fontWeight: 600, marginBottom: '6px' }}>
                      Creating {bulkProgress.done} of {bulkProgress.total}…
                    </div>
                    <div style={{ height: '6px', background: '#ede4e4', borderRadius: '999px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${(bulkProgress.done / bulkProgress.total) * 100}%`,
                        background: '#7a1f1f',
                        transition: 'width 0.2s'
                      }} />
                    </div>
                    {bulkProgress.failed.length > 0 && (
                      <div style={{
                        marginTop: '10px', padding: '10px 12px', background: '#fbeae5',
                        borderRadius: '8px', fontSize: '0.78rem', color: '#b5482f'
                      }}>
                        <strong>{bulkProgress.failed.length} failed:</strong>
                        <div style={{ marginTop: '4px', maxHeight: '90px', overflowY: 'auto' }}>
                          {bulkProgress.failed.map((f) => (
                            <div key={f.number}>{f.number} — {f.reason}</div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-outline"
                  onClick={() => setBulkModalOpen(false)}
                  disabled={isSubmitting}
                >
                  {bulkProgress && bulkProgress.failed.length > 0 ? 'Close' : 'Cancel'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleBulkCreate}
                  disabled={isSubmitting || preview.length === 0 || newCount === 0 || !bulkForm.branchId}
                >
                  {isSubmitting
                    ? <><Loader size={16} className="spin" /> Creating…</>
                    : <>Create {newCount > 0 ? newCount : ''} Tables</>}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Add Table Modal */}
      {addModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Add New Table</h3>
              <button className="modal-close" onClick={closeAddModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Branch *</label>
                  <select
                    name="branchId"
                    value={addFormData.branchId}
                    onChange={handleAddInputChange}
                    className="form-select"
                    required
                  >
                    <option value="">Select Branch</option>
                    {branches.map((branch) => (
                      <option key={branch._id} value={branch._id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Category (Optional)</label>
                  <select
                    name="categoryId"
                    value={addFormData.categoryId}
                    onChange={handleAddInputChange}
                    className="form-select"
                    disabled={!addFormData.branchId}
                  >
                    <option value="">All Categories (No Filter)</option>
                    {filteredAddCategories.map((category) => (
                      <option key={category._id} value={category._id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {!addFormData.branchId && (
                    <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      Please select a branch first
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Table Number *</label>
                  <input
                    type="text"
                    name="number"
                    value={addFormData.number}
                    onChange={handleAddInputChange}
                    className="form-input"
                    placeholder="Enter table number (e.g., A1, B2, VIP1)"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Table Capacity *</label>
                  <input
                    type="number"
                    name="capacity"
                    value={addFormData.capacity}
                    onChange={handleAddInputChange}
                    className="form-input"
                    placeholder="Number of people (e.g., 4, 6, 8)"
                    min="1"
                    max="20"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  name="status"
                  value={addFormData.status}
                  onChange={handleAddInputChange}
                  className="form-select"
                >
                  <option value="available">Available</option>
                  <option value="reserved">Reserved</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Table Image</label>
                <div className="image-upload-container">
                  <label htmlFor="add-image-upload" className="image-upload-label">
                    {addImagePreview ? (
                      <div className="image-preview-wrapper">
                        <img src={addImagePreview || "/placeholder.svg"} alt="Preview" className="image-preview" />
                        <div className="image-overlay">
                          <Upload size={24} />
                          <span>Change Image</span>
                        </div>
                      </div>
                    ) : (
                      <div className="image-upload-placeholder">
                        <Upload size={24} />
                        <span>Click to upload table image</span>
                      </div>
                    )}
                  </label>
                  <input
                    id="add-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleAddImageChange}
                    className="image-upload-input"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeAddModal} disabled={isSubmitting}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveNewTable} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  "Create Table"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Table Modal */}
      {editModalOpen && selectedTable && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Edit Table - Table {selectedTable.number}</h3>
              <button className="modal-close" onClick={closeEditModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Branch *</label>
                  <select
                    name="branchId"
                    value={editFormData.branchId}
                    onChange={handleEditInputChange}
                    className="form-select"
                    required
                  >
                    <option value="">Select Branch</option>
                    {branches.map((branch) => (
                      <option key={branch._id} value={branch._id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Category (Optional)</label>
                  <select
                    name="categoryId"
                    value={editFormData.categoryId}
                    onChange={handleEditInputChange}
                    className="form-select"
                    disabled={!editFormData.branchId}
                  >
                    <option value="">All Categories (No Filter)</option>
                    {filteredEditCategories.map((category) => (
                      <option key={category._id} value={category._id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  {!editFormData.branchId && (
                    <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      Please select a branch first
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Table Number *</label>
                  <input
                    type="text"
                    name="number"
                    value={editFormData.number}
                    onChange={handleEditInputChange}
                    className="form-input"
                    placeholder="Enter table number (e.g., A1, B2, VIP1)"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Table Capacity *</label>
                  <input
                    type="number"
                    name="capacity"
                    value={editFormData.capacity}
                    onChange={handleEditInputChange}
                    className="form-input"
                    placeholder="Number of people (e.g., 4, 6, 8)"
                    min="1"
                    max="20"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  name="status"
                  value={editFormData.status}
                  onChange={handleEditInputChange}
                  className="form-select"
                >
                  <option value="available">Available</option>
                  <option value="reserved">Reserved</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Table Image</label>
                <div className="image-upload-container">
                  <label htmlFor="edit-image-upload" className="image-upload-label">
                    {editImagePreview ? (
                      <div className="image-preview-wrapper">
                        <img src={editImagePreview || "/placeholder.svg"} alt="Preview" className="image-preview" />
                        <div className="image-overlay">
                          <Upload size={24} />
                          <span>Change Image</span>
                        </div>
                      </div>
                    ) : (
                      <div className="image-upload-placeholder">
                        <Upload size={24} />
                        <span>Click to upload table image</span>
                      </div>
                    )}
                  </label>
                  <input
                    id="edit-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleEditImageChange}
                    className="image-upload-input"
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeEditModal} disabled={isSubmitting}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSaveChanges} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Table Modal */}
      {deleteModalOpen && selectedTable && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">Delete Table</h3>
              <button className="modal-close" onClick={closeDeleteModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <AlertCircle size={48} color="#dc2626" style={{ marginBottom: "16px" }} />
                <h4 style={{ marginBottom: "8px", color: "#dc2626" }}>Are you sure?</h4>
                <p style={{ color: "#666", marginBottom: "16px" }}>
                  Do you want to delete Table {selectedTable.number} from {selectedTable.branchName}?
                </p>
                <p style={{ color: "#dc2626", fontSize: "14px" }}>This action cannot be undone.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={closeDeleteModal} disabled={isSubmitting}>
                Cancel
              </button>
              <button
                className="btn"
                onClick={handleConfirmDelete}
                disabled={isSubmitting}
                style={{
                  backgroundColor: "#dc2626",
                  color: "white",
                  border: "1px solid #dc2626",
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  "Delete Table"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Tables
