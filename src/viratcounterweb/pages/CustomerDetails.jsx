import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import counterApi from "../services/counterApi"

const CustomerDetails = () => {
  const navigate = useNavigate()
  const [customerName, setCustomerName] = useState("")
  const [phoneNumber, setPhoneNumber] = useState("")
  const [selectedBranch, setSelectedBranch] = useState(null)
  const [invoiceData, setInvoiceData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Get selected branch from localStorage
    const branchData = localStorage.getItem("selectedBranch")
    if (branchData) {
      setSelectedBranch(JSON.parse(branchData))
    } else {
      navigate("/counter/branch-selection")
    }

    // Generate invoice data
    generateInvoiceData()
  }, [navigate])

  const generateInvoiceData = async () => {
    try {
      const invoice = await counterApi.generateInvoice()
      setInvoiceData(invoice)
    } catch (error) {
      console.error("Error generating invoice:", error)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    // Validate phone number only if it's provided
    if (phoneNumber.trim() && (phoneNumber.length !== 10 || !/^\d{10}$/.test(phoneNumber))) {
      alert("Please enter a valid 10-digit phone number or leave it blank")
      return
    }
    
    // Use default values if fields are empty
    const finalCustomerName = customerName.trim() || "Walk-in Customer"
    const finalPhoneNumber = phoneNumber.trim() || "0000000000"

    if (!selectedBranch || !invoiceData) {
      alert("Missing required data. Please try again.")
      return
    }

    // Navigate to menu screen with customer details (or defaults)
    navigate("/counter/menu", {
      state: {
        customerName: finalCustomerName,
        phoneNumber: finalPhoneNumber,
        selectedBranch,
        ...invoiceData
      }
    })
  }

  const handleSkip = () => {
    if (!selectedBranch || !invoiceData) {
      alert("Missing required data. Please try again.")
      return
    }

    // Navigate to menu screen with default customer details
    navigate("/counter/menu", {
      state: {
        customerName: "Walk-in Customer",
        phoneNumber: "0000000000",
        selectedBranch,
        ...invoiceData
      }
    })
  }

  const handleBack = () => {
    navigate("/counter/branch-selection")
  }

  if (!selectedBranch || !invoiceData) {
    return (
      <div className="counter-container">
        <div className="counter-card">
          <div className="counter-loading">
            <div className="counter-spinner"></div>
            <p>Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="counter-container">
      <div className="counter-card">
        <div className="counter-header">
          <h1 className="counter-title">Customer Details</h1>
          <p className="counter-subtitle">Enter customer information (optional for walk-in customers)</p>
        </div>

        <div style={{ 
          background: '#f7fafc', 
          padding: '16px', 
          borderRadius: '8px', 
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#1a202c' }}>
            {selectedBranch.name}
          </h3>
          <p style={{ margin: '0 0 8px 0', color: '#718096', fontSize: '0.875rem' }}>
            Invoice: {invoiceData.invoiceNumber}
          </p>
          <p style={{ margin: '0', color: '#718096', fontSize: '0.875rem' }}>
            {invoiceData.date} • {invoiceData.time}
          </p>
        </div>

        <form className="counter-form" onSubmit={handleSubmit}>
          <div style={{ 
            background: '#e6fffa', 
            padding: '12px', 
            borderRadius: '8px', 
            marginBottom: '20px',
            border: '1px solid #81e6d9'
          }}>
            <div style={{ fontSize: '0.875rem', color: '#2d3748' }}>
              💡 <strong>Quick Tip:</strong> You can skip customer details for walk-in customers or fill them for regular customers who want receipts.
            </div>
          </div>

          <div className="counter-form-group">
            <label className="counter-label">Customer Name (Optional)</label>
            <input
              type="text"
              className="counter-input"
              placeholder="Enter customer name or leave blank for walk-in"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>

          <div className="counter-form-group">
            <label className="counter-label">Phone Number (Optional)</label>
            <input
              type="tel"
              className="counter-input"
              placeholder="Enter 10 digit phone number (optional)"
              maxLength={10}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
            />
            {phoneNumber && phoneNumber.length > 0 && phoneNumber.length !== 10 && (
              <div style={{ fontSize: '0.75rem', color: '#e53e3e', marginTop: '4px' }}>
                Please enter a valid 10-digit phone number
              </div>
            )}
          </div>

          <div className="counter-button-grid">
            <button
              type="button"
              className="counter-button-secondary"
              onClick={handleBack}
            >
              ← Back
            </button>
            <button
              type="button"
              className="counter-button-secondary"
              onClick={handleSkip}
              style={{ 
                background: '#f7fafc',
                color: '#4a5568',
                border: '2px solid #e2e8f0'
              }}
            >
              Skip →
            </button>
            <button
              type="submit"
              className="counter-button"
              disabled={loading}
            >
              {loading ? (
                <div className="counter-spinner" style={{ width: '20px', height: '20px' }} />
              ) : (
                "Continue to Menu"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CustomerDetails