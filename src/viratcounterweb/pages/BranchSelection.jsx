import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import counterApi from "../services/counterApi"
import hotelViratLogo from "../../assets/logo4.jpeg"
import { MapPin, LogOut, ChevronRight } from "lucide-react"

const BRANCHES_CACHE_KEY = 'cachedBranches'

const BranchSelection = () => {
  const navigate = useNavigate()
  const [branches, setBranches] = useState([])
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isOffline, setIsOffline] = useState(false)
  const [seeding, setSeeding] = useState(false)

  useEffect(() => {
    loadBranches()
  }, [])

  const loadBranches = async () => {
    try {
      setLoading(true)
      setError(null)
      setIsOffline(false)

      const response = await counterApi.getBranches()
      const branchList = response.branches || response.data || response || []
      setBranches(branchList)
      if (branchList.length > 0) {
        localStorage.setItem(BRANCHES_CACHE_KEY, JSON.stringify(branchList))
      }
    } catch (error) {
      console.warn("Error loading branches from server, trying cache:", error)
      try {
        const cached = localStorage.getItem(BRANCHES_CACHE_KEY)
        if (cached) {
          const branchList = JSON.parse(cached)
          if (branchList.length > 0) {
            setBranches(branchList)
            setIsOffline(true)
            return
          }
        }
      } catch (_) {}
      try {
        const storedBranch = localStorage.getItem('selectedBranch')
        if (storedBranch) {
          const branch = JSON.parse(storedBranch)
          if (branch?._id) {
            setBranches([branch])
            setSelectedBranch(branch)
            setIsOffline(true)
            setTimeout(() => {
              localStorage.setItem("selectedBranch", JSON.stringify(branch))
              navigate("/counter/menu", {
                state: {
                  selectedBranch: branch,
                  customerName: "Walk-in Customer",
                  phoneNumber: "0000000000",
                  invoiceNumber: null,
                  date: new Date().toLocaleDateString('en-IN'),
                  time: new Date().toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit' }),
                  cartItems: []
                }
              })
            }, 800)
            return
          }
        }
      } catch (_) {}
      setError("Failed to load branches. Please check your connection.")
    } finally {
      setLoading(false)
    }
  }

  const handleBranchSelect = (branch) => {
    setSelectedBranch(branch)
  }

  const handleContinue = async () => {
    if (!selectedBranch) return

    localStorage.setItem("selectedBranch", JSON.stringify(selectedBranch))

    if (navigator.onLine) {
      setSeeding(true)
      try {
        const categories = ['Restaurant']
        const now = new Date()
        const day = String(now.getDate()).padStart(2, '0')
        const month = String(now.getMonth() + 1).padStart(2, '0')
        const year = String(now.getFullYear()).slice(-2)
        const dateKey = `${day}-${month}-${year}`
        await Promise.all(categories.map(async cat => {
          try {
            const res = await counterApi.request(
              `/counter-invoice/last-bill-number/${selectedBranch._id}?category=${encodeURIComponent(cat)}`,
              { _timeout: 5000 }
            )
            if (res?.success && typeof res.lastBillNumber === 'number' && res.lastBillNumber > 0) {
              const key = `unified-bill-counter-${cat}-${dateKey}`
              const localVal = parseInt(localStorage.getItem(key) || '0')
              if (res.lastBillNumber > localVal) {
                localStorage.setItem(key, String(res.lastBillNumber))
              }
            }
          } catch (_) {}
        }))
      } catch (_) {}
      finally {
        setSeeding(false)
      }
    }

    navigate("/counter/menu", {
      state: {
        selectedBranch: selectedBranch,
        customerName: "Walk-in Customer",
        phoneNumber: "0000000000",
        invoiceNumber: null,
        date: new Date().toLocaleDateString('en-IN'),
        time: new Date().toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit' }),
        cartItems: []
      }
    })
  }

  const handleLogout = () => {
    localStorage.removeItem("counterAuthenticated")
    localStorage.removeItem("counterUserId")
    localStorage.removeItem("counterUserData")
    localStorage.removeItem("selectedBranch")
    navigate("/counter/login")
  }

  if (loading) {
    return (
      <div className="branch-page">
        <div className="branch-card">
          <div className="counter-loading">
            <div className="counter-spinner"></div>
            <p style={{ color: '#69221b', fontWeight: 500 }}>Loading branches...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="branch-page">
        <div className="branch-card">
          <div className="counter-error">
            <p>{error}</p>
            <button className="counter-button" onClick={loadBranches}>Retry</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="branch-page">
      <div className="branch-card">

        {/* Header */}
        <div className="branch-header">
          <div className="branch-logo-wrap">
            <img src={hotelViratLogo} alt="Hotel Virat" className="branch-logo" />
          </div>
          <h1 className="branch-brand">Jagali Koota</h1>
          <p className="branch-tagline">Billing System</p>

          <button className="branch-logout-btn" onClick={handleLogout}>
            <LogOut size={15} strokeWidth={2} />
            Logout
          </button>
        </div>

        {/* Divider */}
        <div className="branch-divider" />

        {/* Section title */}
        <div className="branch-section-title">
          <MapPin size={16} strokeWidth={2} />
          Select Your Branch
        </div>

        {isOffline && (
          <div className="branch-offline-badge">
            ⚠️ Offline — showing cached branches
          </div>
        )}

        {branches.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#a07060', padding: '24px 0' }}>
            No branches available. Please contact administrator.
          </p>
        ) : (
          <div className="branch-list">
            {branches.map((branch) => (
              <div
                key={branch._id}
                className={`branch-item ${selectedBranch?._id === branch._id ? 'branch-item-selected' : ''}`}
                onClick={() => handleBranchSelect(branch)}
              >
                <div className="branch-item-icon">
                  <MapPin size={18} strokeWidth={2} />
                </div>
                <span className="branch-item-name">{branch.name}</span>
                {selectedBranch?._id === branch._id && (
                  <span className="branch-item-check">✓</span>
                )}
              </div>
            ))}
          </div>
        )}

        <button
          className="branch-continue-btn"
          onClick={handleContinue}
          disabled={!selectedBranch || seeding}
        >
          {seeding ? (
            <div className="counter-spinner-white" />
          ) : (
            <>
              Continue
              <ChevronRight size={18} strokeWidth={2.5} />
            </>
          )}
        </button>

      </div>
    </div>
  )
}
export default BranchSelection