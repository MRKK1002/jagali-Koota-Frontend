import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import counterApi from "../services/counterApi"
import hotelViratLogo from "../../assets/logo4.jpeg"
import { Phone, KeyRound } from "lucide-react"


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

const CounterLogin = () => {
  const navigate = useNavigate()
  const [phoneNumber, setPhoneNumber] = useState("")
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [toast, setToast] = useState(null)
  const [resendDisabled, setResendDisabled] = useState(false)
  const [resendTimer, setResendTimer] = useState(30)
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)

  useEffect(() => {
    let timer
    if (resendDisabled && resendTimer > 0) {
      timer = setTimeout(() => {
        setResendTimer(resendTimer - 1)
      }, 1000)
    } else if (resendTimer === 0) {
      setResendDisabled(false)
    }
    return () => clearTimeout(timer)
  }, [resendDisabled, resendTimer])

  const showToast = (message, type = "success") => {
    setToast({ message, type })
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    
    if (phoneNumber.length !== 10 || !/^\d{10}$/.test(phoneNumber)) {
      showToast("Please enter a valid 10-digit mobile number", "error")
      return
    }

    setIsSendingOtp(true)
    try {
      const response = await counterApi.sendOtp(phoneNumber)
      setOtpSent(true)
      setResendDisabled(true)
      setResendTimer(30)
      showToast(response.message)
      
      if (response.otp) {
        setTimeout(() => {
          showToast(`Your OTP is ${response.otp}`, "success")
        }, 3000)
      }
    } catch (error) {
      console.error("Error sending OTP:", error)
      showToast(error.message || "Error sending OTP", "error")
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleResendOtp = async () => {
    if (phoneNumber.length !== 10 || !/^\d{10}$/.test(phoneNumber)) {
      showToast("Please enter a valid 10-digit mobile number", "error")
      return
    }

    setIsSendingOtp(true)
    try {
      const response = await counterApi.resendOtp(phoneNumber)
      setResendDisabled(true)
      setResendTimer(30)
      showToast(response.message)
      
      if (response.otp) {
        setTimeout(() => {
          showToast(`Your new OTP is ${response.otp}`, "success")
        }, 3000)
      }
    } catch (error) {
      console.error("Error resending OTP:", error)
      showToast(error.message || "Error resending OTP", "error")
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    
    if (!otp || otp.length !== 6) {
      showToast("Please enter a valid 6-digit OTP", "error")
      return
    }

    setIsVerifyingOtp(true)
    try {
      const response = await counterApi.verifyOtp(phoneNumber, otp)
      
      const userId = response.counter._id

      localStorage.setItem("counterAuthenticated", "true")
      localStorage.setItem("counterUserId", userId)
      localStorage.setItem("counterUserData", JSON.stringify(response.counter))

      showToast(response.message)

      // Go to branch selection
      setTimeout(() => {
        navigate("/counter/branch-selection")
      }, 1000)
    } catch (error) {
      console.error("Error verifying OTP:", error)
      showToast(error.message || "Error during login", "error")
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  return (
    <div className="counter-login-page">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      <div className="counter-login-card">
        {/* Logo & Branding */}
        <div className="counter-login-header">
          <div className="counter-login-logo-wrap">
            <img
              src={hotelViratLogo}
              alt="Hotel Virat"
              className="counter-login-logo"
            />
          </div>
          <h1 className="counter-login-title">JAGALI KOOTA</h1>
          <p className="counter-login-subtitle">Counter Login</p>
        </div>

        {/* Divider */}
        <div className="counter-login-divider" />

        <form className="counter-login-form" onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
          <div className="counter-login-form-group">
            <label className="counter-login-label">Mobile Number</label>
            <div className="counter-login-input-wrap">
              <span className="counter-login-input-icon">
                <Phone size={18} strokeWidth={2} />
              </span>
              <input
                type="tel"
                className="counter-login-input counter-login-input-padded"
                placeholder="Enter 10-digit mobile number"
                maxLength={10}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={otpSent || isSendingOtp}
                required
              />
            </div>
          </div>

          {otpSent && (
            <>
              <div className="counter-login-form-group">
                <label className="counter-login-label">OTP</label>
                <div className="counter-login-input-wrap">
                  <span className="counter-login-input-icon">
                    <KeyRound size={18} strokeWidth={2} />
                  </span>
                  <input
                    type="text"
                    className="counter-login-input counter-login-input-padded"
                    placeholder="Enter 6-digit OTP"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                <button
                  type="button"
                  className="counter-login-resend"
                  onClick={handleResendOtp}
                  disabled={resendDisabled || isSendingOtp}
                >
                  {resendDisabled ? `Resend OTP in ${resendTimer}s` : "Resend OTP"}
                  {isSendingOtp && <div className="counter-spinner-brand" />}
                </button>
              </div>
            </>
          )}

          <button
            type="submit"
            className="counter-login-btn"
            disabled={isSendingOtp || isVerifyingOtp}
          >
            {(isSendingOtp || isVerifyingOtp) ? (
              <div className="counter-spinner-white" />
            ) : (
              otpSent ? "Verify & Login" : "Send OTP"
            )}
          </button>
        </form>

      
      </div>
    </div>
  )
}

export default CounterLogin