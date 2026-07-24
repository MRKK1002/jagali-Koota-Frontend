import { useEffect, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import thermalPrinter from "../services/thermalPrinter"
import orderStorage from "../services/orderStorage"

const PaymentSuccess = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const paymentData = location.state
  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState(null)

  useEffect(() => {
    // Save the order to localStorage when payment is successful
    if (paymentData) {
      try {
        const savedOrder = orderStorage.saveOrder(paymentData)
        console.log('Order saved to storage:', savedOrder.invoiceNumber)
      } catch (error) {
        console.error('Failed to save order:', error)
      }
    }

    // Auto redirect after 10 seconds
    const timer = setTimeout(() => {
      navigate("/counter/branch-selection")
    }, 10000)

    return () => clearTimeout(timer)
  }, [navigate, paymentData]) // Add paymentData to dependencies

  if (!paymentData) {
    return (
      <div className="counter-container">
        <div className="counter-card">
          <div className="counter-error">
            <p>Payment data not found. Please start over.</p>
            <button className="counter-button" onClick={() => navigate("/counter/branch-selection")}>
              New Order
            </button>
          </div>
        </div>
      </div>
    )
  }

  const handleNewOrder = () => {
    navigate("/counter/branch-selection")
  }

  const handlePrintReceipt = async () => {
    if (printing) return // Prevent multiple simultaneous print attempts
    
    setPrinting(true)
    setPrintError(null)
    
    try {
      // Get printer settings from localStorage or use defaults
      const printerSettings = JSON.parse(localStorage.getItem('thermalPrinterSettings') || '{}')
      
      const options = {
        method: printerSettings.method || 'auto',
        printerIP: printerSettings.ip || '192.168.1.100',
        port: printerSettings.port || 9100
      }

      // Use a shorter timeout to prevent hanging
      const result = await Promise.race([
        thermalPrinter.printReceipt(paymentData, options),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Print operation timed out after 5 seconds')), 5000)
        )
      ])
      
      // Show success message with method used
      if (result && result.method) {
        const methodMessages = {
          'popup-window': 'Receipt printed using browser (thermal printer not found)',
          'current-window': 'Receipt printed using browser (thermal printer not found)', 
          'current-window-fallback': 'Receipt printed using browser (thermal printer not found)',
          'network': 'Receipt printed to thermal printer successfully!',
          'usb': 'Receipt printed to USB thermal printer successfully!'
        };
        const message = methodMessages[result.method] || 'Receipt printed successfully!';
        setPrintError({ type: 'success', message });
      } else {
        setPrintError({ type: 'success', message: 'Receipt printed successfully!' });
      }
      
      // Clear success message after 3 seconds
      setTimeout(() => setPrintError(null), 3000)
      
    } catch (error) {
      console.error('Print error:', error)
      setPrintError({ 
        type: 'error', 
        message: error.message || 'Failed to print receipt. Please try again.' 
      })
      
      // Clear error message after 5 seconds
      setTimeout(() => setPrintError(null), 5000)
    } finally {
      setPrinting(false)
    }
  }

  const handlePrintSettings = () => {
    // Open print settings modal/page
    navigate("/counter/print-settings", { 
      state: { returnTo: "/counter/payment-success", paymentData } 
    })
  }

  const handleViewOrders = () => {
    navigate("/counter/orders")
  }

  return (
    <div className="counter-container">
      <div className="counter-card">
        {/* Success Header */}
        <div className="counter-header">
          <div style={{ 
            fontSize: '4rem', 
            color: '#48bb78', 
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            ✅
          </div>
          <h1 className="counter-title" style={{ color: '#48bb78' }}>
            Payment Successful!
          </h1>
          <p className="counter-subtitle">
            Order has been processed successfully
          </p>
        </div>

        {/* Receipt */}
        <div style={{ 
          background: '#f7fafc', 
          padding: '24px', 
          borderRadius: '12px', 
          marginBottom: '24px',
          border: '2px solid #48bb78'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: '#1a202c' }}>
              {paymentData.selectedBranch.name}
            </h2>
            <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: '#718096' }}>
              {paymentData.selectedBranch.address}
            </p>
            <p style={{ margin: '0', fontSize: '0.875rem', color: '#718096' }}>
              📞 {paymentData.selectedBranch.phone}
            </p>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '16px 0' }} />

          {/* Transaction Details */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr', 
            gap: '16px',
            marginBottom: '16px'
          }}>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: '#718096' }}>
                Invoice No:
              </p>
              <p style={{ margin: '0', fontWeight: '600', color: '#1a202c' }}>
                {paymentData.invoiceNumber}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: '#718096' }}>
                Date & Time:
              </p>
              <p style={{ margin: '0', fontWeight: '600', color: '#1a202c' }}>
                {paymentData.date} {paymentData.time}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: '#718096' }}>
                Customer:
              </p>
              <p style={{ margin: '0', fontWeight: '600', color: '#1a202c' }}>
                {paymentData.customerName}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: '#718096' }}>
                Phone:
              </p>
              <p style={{ margin: '0', fontWeight: '600', color: '#1a202c' }}>
                {paymentData.phoneNumber}
              </p>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '16px 0' }} />

          {/* Items */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#1a202c' }}>
              Items Ordered
            </h3>
            {paymentData.cartItems.map((item, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: index < paymentData.cartItems.length - 1 ? '1px solid #e2e8f0' : 'none'
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0', fontWeight: '500', color: '#1a202c' }}>
                    {item.name}
                  </p>
                  <p style={{ margin: '0', fontSize: '0.875rem', color: '#718096' }}>
                    ₹{item.price.toFixed(2)} × {item.quantity}
                  </p>
                </div>
                <div style={{ fontWeight: '600', color: '#1a202c' }}>
                  ₹{(item.price * item.quantity).toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '16px 0' }} />

          {/* Payment Details */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '8px'
            }}>
              <span style={{ color: '#718096' }}>Subtotal:</span>
              <span style={{ fontWeight: '500' }}>₹{(paymentData.total - paymentData.total * 0.05).toFixed(2)}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '8px'
            }}>
              <span style={{ color: '#718096' }}>Tax (5%):</span>
              <span style={{ fontWeight: '500' }}>₹{(paymentData.total * 0.05).toFixed(2)}</span>
            </div>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: '12px'
            }}>
              <span style={{ color: '#718096' }}>Payment Method:</span>
              <span style={{ fontWeight: '500', textTransform: 'capitalize' }}>
                {paymentData.paymentMethod}
              </span>
            </div>
            
            {paymentData.paymentMethod === 'cash' && (
              <>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: '8px'
                }}>
                  <span style={{ color: '#718096' }}>Amount Received:</span>
                  <span style={{ fontWeight: '500' }}>₹{paymentData.amountReceived.toFixed(2)}</span>
                </div>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  marginBottom: '12px'
                }}>
                  <span style={{ color: '#718096' }}>Change:</span>
                  <span style={{ fontWeight: '500' }}>₹{paymentData.change.toFixed(2)}</span>
                </div>
              </>
            )}
            
            <hr style={{ border: 'none', borderTop: '2px solid #1a202c', margin: '12px 0' }} />
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              fontSize: '1.25rem',
              fontWeight: '700',
              color: '#1a202c'
            }}>
              <span>Total Paid:</span>
              <span>₹{paymentData.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Success Message */}
          <div style={{ 
            background: '#f0fff4', 
            padding: '12px', 
            borderRadius: '8px',
            border: '1px solid #68d391',
            textAlign: 'center'
          }}>
            <div style={{ color: '#22543d', fontWeight: '600' }}>
              ✅ Payment Completed Successfully
            </div>
            <div style={{ color: '#2f855a', fontSize: '0.875rem', marginTop: '4px' }}>
              Thank you for your business!
            </div>
          </div>
        </div>

        {/* Print Error/Success Message */}
        {printError && (
          <div style={{ 
            background: printError.type === 'success' ? '#f0fff4' : '#fed7d7', 
            padding: '12px', 
            borderRadius: '8px',
            border: `1px solid ${printError.type === 'success' ? '#68d391' : '#fc8181'}`,
            marginBottom: '16px',
            textAlign: 'center'
          }}>
            <div style={{ 
              color: printError.type === 'success' ? '#22543d' : '#742a2a', 
              fontWeight: '600' 
            }}>
              {printError.type === 'success' ? '✅' : '❌'} {printError.message}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr 1fr 1fr', 
          gap: '12px',
          marginBottom: '20px'
        }}>
          <button
            className="counter-button-secondary"
            onClick={handlePrintReceipt}
            disabled={printing}
            style={{ 
              opacity: printing ? 0.6 : 1,
              cursor: printing ? 'not-allowed' : 'pointer'
            }}
            title="Print receipt to thermal printer"
          >
            {printing ? '🔄 Printing...' : '🖨️ Print Receipt'}
          </button>
          <button
            className="counter-button-secondary"
            onClick={handlePrintSettings}
            title="Configure thermal printer settings"
          >
            ⚙️ Print Settings
          </button>
          <button
            className="counter-button-secondary"
            onClick={handleViewOrders}
          >
            📋 View Orders
          </button>
          <button
            className="counter-button"
            onClick={handleNewOrder}
          >
            ➕ New Order
          </button>
        </div>

        {/* Auto Redirect Notice */}
        <div style={{ 
          textAlign: 'center', 
          fontSize: '0.875rem', 
          color: '#718096',
          fontStyle: 'italic'
        }}>
          Automatically redirecting to new order in 10 seconds...
        </div>
      </div>
    </div>
  )
}

export default PaymentSuccess