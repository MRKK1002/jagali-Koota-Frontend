"use client"

import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { Mail, Lock, Eye, EyeOff, User } from "lucide-react"
import axios from "axios"
import hotelViratLogo from "../assets/logo4.jpeg"
import "../styles/Login.css"

const Login = () => {
  const [loginType, setLoginType] = useState("admin")
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    const API_BASE_URL = import.meta.env.VITE_BACKEND_PRIMARY || 'https://billing.jagalikoota.com/api/v1/hotel'

    try {
      if (loginType === "admin") {
        // Try admin login first
        let loginSuccess = false
        try {
          const response = await axios.post(`${API_BASE_URL}/admin-auth/login`, {
            email,
            password,
          })

          const { token } = response.data

          localStorage.setItem("authToken", token)
          localStorage.setItem("isAuthenticated", "true")
          localStorage.setItem("userType", "admin")
          // Clear any module-access data (super admin via legacy login)
          localStorage.removeItem("adminAccessUser")
          localStorage.removeItem("adminAccessToken")

          navigate("/admin/branches")
          loginSuccess = true
        } catch (adminErr) {
          // Admin login failed — try module-access login
          try {
            const response = await axios.post(`${API_BASE_URL}/admin-access/login`, {
              email,
              password,
            })

            const { token, user } = response.data

            localStorage.setItem("authToken", token)
            localStorage.setItem("isAuthenticated", "true")
            localStorage.setItem("userType", "module-user")
            localStorage.setItem("adminAccessUser", JSON.stringify(user))
            localStorage.setItem("adminAccessToken", token)

            navigate("/admin/branches")
            loginSuccess = true
          } catch (moduleErr) {
            // Both failed — show original admin error
            throw adminErr
          }
        }
        if (loginSuccess) return
      } else if (loginType === "category") {
        const response = await axios.post(`${API_BASE_URL}/category-access/login`, {
          username,
          password,
        })

        const { token, user } = response.data

        localStorage.setItem("authToken", token)
        localStorage.setItem("isAuthenticated", "true")
        localStorage.setItem("userType", "category-staff")
        localStorage.setItem("categoryStaffData", JSON.stringify(user))

        navigate("/category-orders")
      } else if (loginType === "receptionist") {
        const response = await axios.post(`${API_BASE_URL}/receptionist-access/login`, {
          username,
          password,
        })

        const { token, user } = response.data

        localStorage.setItem("authToken", token)
        localStorage.setItem("isAuthenticated", "true")
        localStorage.setItem("userType", "receptionist")
        localStorage.setItem("receptionistData", JSON.stringify(user))

        navigate("/receptionist-dashboard")
      }
    } catch (err) {
      setError(err.response?.data?.message || "An error occurred during login")
      setIsLoading(false)
    }
  }

  const handlePrivacyPolicyClick = () => {
    navigate("/privacy-policy")
  }

  const handleTermsConditionsClick = () => {
    navigate("/terms-conditions")
  }

  return (
    <div className="login-container-centered">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <img src={hotelViratLogo || "/placeholder.svg"} alt="Jagali Koota Logo" className="logo-image" />
            <h1>JAGALI KOOTA</h1>
          </div>
          <p>Admin Portal</p>
        </div>

        {/* Login Type Toggle */}
        <div className="login-type-toggle" style={{ 
          display: "flex", 
          marginBottom: "20px", 
          borderRadius: "8px", 
          overflow: "hidden",
          border: "1.5px solid #e8ddd8"
        }}>
          <button
            type="button"
            onClick={() => { setLoginType("admin"); setError(""); }}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              cursor: "pointer",
              backgroundColor: loginType === "admin" ? "#69221b" : "#faf8f6",
              color: loginType === "admin" ? "white" : "#69221b",
              fontWeight: "600",
              transition: "all 0.2s",
              fontSize: "13px"
            }}
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => { setLoginType("category"); setError(""); }}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              cursor: "pointer",
              backgroundColor: loginType === "category" ? "#69221b" : "#faf8f6",
              color: loginType === "category" ? "white" : "#69221b",
              fontWeight: "600",
              transition: "all 0.2s",
              fontSize: "13px"
            }}
          >
            Category
          </button>
          {/* Receptionist tab commented out
          <button
            type="button"
            onClick={() => { setLoginType("receptionist"); setError(""); }}
            style={{
              flex: 1,
              padding: "10px",
              border: "none",
              cursor: "pointer",
              backgroundColor: loginType === "receptionist" ? "#69221b" : "#faf8f6",
              color: loginType === "receptionist" ? "white" : "#69221b",
              fontWeight: "600",
              transition: "all 0.2s",
              fontSize: "13px"
            }}
          >
            Receptionist
          </button>
          */}
        </div>

        {error && <div className="login-error">{error}</div>}

        <form className="login-form" onSubmit={handleSubmit}>
          {loginType === "admin" ? (
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <div className="input-with-icon">
                <span className="input-icon">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  id="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{ paddingLeft: "40px" }}
                />
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <div className="input-with-icon">
                <span className="input-icon">
                  <User size={16} />
                </span>
                <input
                  type="text"
                  id="username"
                  placeholder={loginType === "category" ? "Enter category staff username" : "Enter receptionist username"}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  style={{ paddingLeft: "40px" }}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-with-icon">
              <span className="input-icon">
                <Lock size={16} />
              </span>
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingLeft: "40px" }}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="login-footer-links">
          <button type="button" className="footer-link" onClick={handlePrivacyPolicyClick}>
            Privacy Policy
          </button>
          <span className="link-separator">|</span>
          <button type="button" className="footer-link" onClick={handleTermsConditionsClick}>
            Terms & Conditions
          </button>
        </div>
      </div>
    </div>
  )
}

export default Login
