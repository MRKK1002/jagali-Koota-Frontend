import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000)
    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div className={`counter-toast ${type}`}>
      {message}
    </div>
  )
}

const SelfServiceLogin = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [toast, setToast] = useState(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // 🔒 Static credentials for Self Service category
  const SELF_SERVICE_CREDENTIALS = {
    username: "selfservice_user",
    password: "selfservice123"
  }

  // 🔒 CRITICAL: Check if category is set, redirect if not
  useEffect(() => {
    const storedCategory = sessionStorage.getItem("orderCategory")
    
    if (!storedCategory) {
      navigate("/counter/category-selection")
      return
    }
    
    if (storedCategory !== "SELF_SERVICE") {
      navigate("/counter/category-selection")
      return
    }
    
    // 🔒 AUTO-FILL credentials for Self Service category
    setUsername(SELF_SERVICE_CREDENTIALS.username)
    setPassword(SELF_SERVICE_CREDENTIALS.password)
  }, [navigate])

  const showToast = (message, type = "success") => {
    setToast({ message, type })
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    
    // 🔒 Validate static credentials
    if (username !== SELF_SERVICE_CREDENTIALS.username || password !== SELF_SERVICE_CREDENTIALS.password) {
      showToast("Invalid credentials for Self Service", "error")
      return
    }

    setIsLoggingIn(true)
    try {
      // 🔒 MOCK: Simulate successful login for static credentials
      // Using valid MongoDB ObjectId format for compatibility
      const mockUserData = {
        _id: "507f1f77bcf86cd799439012", // Valid ObjectId for self service user
        username: username,
        role: "selfservice_counter",
        category: "SELF_SERVICE"
      }

      // 🔒 CRITICAL: Store login info but DO NOT change category
      localStorage.setItem("counterAuthenticated", "true")
      localStorage.setItem("counterUserId", mockUserData._id)
      localStorage.setItem("counterUserData", JSON.stringify(mockUserData))
      
      // 🔒 VERIFY: Category should still be SELF_SERVICE
      const storedCategory = sessionStorage.getItem("orderCategory")
      
      if (storedCategory !== "SELF_SERVICE") {
        navigate("/counter/category-selection")
        return
      }

      showToast(`Welcome to Self Service!`)
      setTimeout(() => {
        navigate("/counter/branch-selection")
      }, 1000)
    } catch (error) {
      console.error("Error during login:", error)
      showToast("Login failed. Please try again.", "error")
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleBackToCategory = () => {
    // Clear category and go back to selection
    sessionStorage.removeItem("orderCategory")
    sessionStorage.removeItem("orderCategoryName")
    navigate("/counter/category-selection")
  }

  return (
    <div className="counter-container">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      <div className="counter-card">
        <div className="counter-header">
          <img 
            src="/logo.png" 
            alt="Virat Restaurant" 
            style={{ width: '120px', height: '120px', marginBottom: '20px' }}
            onError={(e) => {
              e.target.style.display = 'none'
            }}
          />
          
          {/* Category Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '16px',
            padding: '8px 16px',
            backgroundColor: '#f0fdf4',
            borderRadius: '20px',
            border: '2px solid #10b981'
          }}>
            <span style={{ fontSize: '1.5rem' }}>🥡</span>
            <span style={{ fontWeight: '700', color: '#065f46' }}>Self Service</span>
          </div>
          
          <h1 className="counter-title">Self Service Login</h1>
          <p className="counter-subtitle">Login to access quick counter service</p>
        </div>

        <form className="counter-form" onSubmit={handleLogin}>
          <div className="counter-form-group">
            <label className="counter-label">Username</label>
            <input
              type="text"
              className="counter-input"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isLoggingIn}
              required
              style={{
                backgroundColor: '#f7fafc',
                color: '#4a5568'
              }}
            />
          </div>

          <div className="counter-form-group">
            <label className="counter-label">Password</label>
            <input
              type="password"
              className="counter-input"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoggingIn}
              required
              style={{
                backgroundColor: '#f7fafc',
                color: '#4a5568'
              }}
            />
          </div>

          {/* Credentials Info */}
          <div style={{
            marginBottom: '20px',
            padding: '12px',
            backgroundColor: '#f0fdf4',
            borderRadius: '8px',
            fontSize: '0.875rem',
            color: '#065f46',
            textAlign: 'center'
          }}>
            <strong>Self Service Credentials</strong>
            <br />
            Username: {SELF_SERVICE_CREDENTIALS.username}
            <br />
            Password: {SELF_SERVICE_CREDENTIALS.password}
          </div>

          <button
            type="submit"
            className="counter-button"
            disabled={isLoggingIn}
          >
            {isLoggingIn ? (
              <div className="counter-spinner" style={{ width: '20px', height: '20px' }} />
            ) : (
              "Login to Self Service"
            )}
          </button>
        </form>

        {/* Back to Category Selection */}
        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <button
            type="button"
            className="counter-button-secondary"
            onClick={handleBackToCategory}
            style={{ 
              width: 'auto', 
              padding: '8px 16px',
              fontSize: '0.875rem'
            }}
          >
            ← Change Category
          </button>
        </div>
      </div>
    </div>
  )
}

export default SelfServiceLogin