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

const TempleMealsLogin = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [toast, setToast] = useState(null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // 🔒 Static credentials for Temple Meals category
  const TEMPLE_MEALS_CREDENTIALS = {
    username: "templemeals_user",
    password: "templemeals123"
  }

  // 🔒 CRITICAL: Check if category is set, redirect if not
  useEffect(() => {
    const storedCategory = sessionStorage.getItem("orderCategory")
    
    if (!storedCategory) {
      navigate("/counter/category-selection")
      return
    }
    
    if (storedCategory !== "TEMPLE_MEALS") {
      navigate("/counter/category-selection")
      return
    }
    
    // 🔒 AUTO-FILL credentials for Temple Meals category
    setUsername(TEMPLE_MEALS_CREDENTIALS.username)
    setPassword(TEMPLE_MEALS_CREDENTIALS.password)
  }, [navigate])

  const showToast = (message, type = "success") => {
    setToast({ message, type })
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    
    // 🔒 Validate static credentials
    if (username !== TEMPLE_MEALS_CREDENTIALS.username || password !== TEMPLE_MEALS_CREDENTIALS.password) {
      showToast("Invalid credentials for Temple Meals service", "error")
      return
    }

    setIsLoggingIn(true)
    try {
      // 🔒 MOCK: Simulate successful login for static credentials
      // Using valid MongoDB ObjectId format for compatibility
      const mockUserData = {
        _id: "507f1f77bcf86cd799439013", // Valid ObjectId for temple meals user
        username: username,
        role: "templemeals_counter",
        category: "TEMPLE_MEALS"
      }

      // 🔒 CRITICAL: Store login info but DO NOT change category
      localStorage.setItem("counterAuthenticated", "true")
      localStorage.setItem("counterUserId", mockUserData._id)
      localStorage.setItem("counterUserData", JSON.stringify(mockUserData))
      
      // 🔒 VERIFY: Category should still be TEMPLE_MEALS
      const storedCategory = sessionStorage.getItem("orderCategory")
      
      if (storedCategory !== "TEMPLE_MEALS") {
        navigate("/counter/category-selection")
        return
      }

      showToast(`Welcome to Temple Meals Service!`)
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
            backgroundColor: '#fef3c7',
            borderRadius: '20px',
            border: '2px solid #f59e0b'
          }}>
            <span style={{ fontSize: '1.5rem' }}>🛕</span>
            <span style={{ fontWeight: '700', color: '#92400e' }}>Temple Meals</span>
          </div>
          
          <h1 className="counter-title">Temple Meals Login</h1>
          <p className="counter-subtitle">Login to access temple offerings service</p>
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
            backgroundColor: '#fef3c7',
            borderRadius: '8px',
            fontSize: '0.875rem',
            color: '#92400e',
            textAlign: 'center'
          }}>
            <strong>Temple Meals Credentials</strong>
            <br />
            Username: {TEMPLE_MEALS_CREDENTIALS.username}
            <br />
            Password: {TEMPLE_MEALS_CREDENTIALS.password}
          </div>

          <button
            type="submit"
            className="counter-button"
            disabled={isLoggingIn}
          >
            {isLoggingIn ? (
              <div className="counter-spinner" style={{ width: '20px', height: '20px' }} />
            ) : (
              "Login to Temple Meals"
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

export default TempleMealsLogin