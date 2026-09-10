import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import counterApi from "../services/counterApi"

const PaymentScreen = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const orderData = location.state

  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [amountReceived, setAmountReceived] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Auto-fill amount received when component loads or total changes
  useEffect(() => {
    if (orderData) {
      const subtotal = orderData.totalAmount || 0
      // Calculate GST from items dynamically (respects per-item gstRate)
      const tax = orderData.cartItems?.reduce((sum, item) => {
        if (item.isComplimentary) return sum
        const rate = item.gstRate || 0
        return sum + ((item.price * item.quantity * rate) / 100)
      }, 0) || orderData.gstAmount || 0
      const calculatedTotal = subtotal + tax
      setAmountReceived(calculatedTotal.toFixed(2))
    }
  }, [orderData])

  if (!orderData) {
    return (
      <div className="counter-container">
        <div className="counter-card">
          <div className="counter-error">
            <p>Order data not found. Please start over.</p>
            <button className="counter-button" onClick={() => navigate("/counter/bill-generation")}>
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  const subtotal = orderData.totalAmount || 0
  // Use per-item GST calculation (same as BillGeneration) instead of hardcoded 5%
  const tax = orderData.cartItems?.reduce((sum, item) => {
    if (item.isComplimentary) return sum
    const rate = item.gstRate || 0
    return sum + ((item.price * item.quantity * rate) / 100)
  }, 0) || orderData.gstAmount || 0
  const total = subtotal + tax
  const change = paymentMethod === "cash" && amountReceived ? Math.max(0, parseFloat(amountReceived) - total) : 0

  const handlePaymentMethodChange = (method) => {
    setPaymentMethod(method)
    // Auto-fill amount received with total amount for all payment methods
    setAmountReceived(total.toFixed(2))
    setError("")
  }

  const handleAmountReceivedChange = (value) => {
    setAmountReceived(value)
    setError("")
  }

  const validatePayment = () => {
    if (paymentMethod === "cash") {
      const received = parseFloat(amountReceived)
      if (!amountReceived || isNaN(received)) {
        setError("Amount received is required for cash payments")
        return false
      }
      if (received < total) {
        setError("Amount received is less than total amount")
        return false
      }
    }
    // For card and UPI, amount received should equal total
    if (paymentMethod === "card" || paymentMethod === "upi") {
      const received = parseFloat(amountReceived)
      if (!received || received !== total) {
        // Auto-correct the amount for digital payments
        setAmountReceived(total.toFixed(2))
      }
    }
    return true
  }

  const handleProcessPayment = async () => {
    if (!validatePayment()) return

    setLoading(true)
    setError("")
    
    try {
      // Create order
      const orderPayload = {
        customerName: orderData.customerName,
        phoneNumber: orderData.phoneNumber,
        branchId: orderData.selectedBranch._id,
        branchName: orderData.selectedBranch?.name || 'Unknown Branch', // Add branch name for easier filtering
        categoryId: orderData.selectedCategory?._id || null, // Add category ID
        categoryName: orderData.selectedCategory?.name || 'Self Service', // Add category name for sales report filtering
        invoiceNumber: orderData.invoiceNumber,
        invoiceId: orderData.invoiceId,
        items: orderData.cartItems.map(item => ({
          menuItemId: item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity
        })),
        subtotal: subtotal,
        tax: tax,
        total: total,
        paymentMethod: paymentMethod,
        amountReceived: paymentMethod === "cash" ? parseFloat(amountReceived) : total,
        change: change,
        status: "completed",
        orderDate: new Date().toISOString(),
        counterUserId: localStorage.getItem("counterUserId")
      }

      // Add timeout to API calls to prevent hanging
      const createOrderWithTimeout = (payload) => {
        return Promise.race([
          counterApi.createOrder(payload),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Order creation timed out')), 10000)
          )
        ]);
      };

      const createBillWithTimeout = (payload) => {
        return Promise.race([
          counterApi.createBill(payload),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Bill creation timed out')), 10000)
          )
        ]);
      };

      const processPaymentWithTimeout = (payload) => {
        return Promise.race([
          counterApi.processPayment(payload),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Payment processing timed out')), 10000)
          )
        ]);
      };

      const orderResponse = await createOrderWithTimeout(orderPayload)

      // Create bill
      const billPayload = {
        orderId: orderResponse.order?._id || orderResponse._id,
        ...orderPayload
      }

      const billResponse = await createBillWithTimeout(billPayload)

      // Process payment
      const paymentPayload = {
        orderId: orderResponse.order?._id || orderResponse._id,
        billId: billResponse.bill?._id || billResponse._id,
        amount: total,
        paymentMethod: paymentMethod,
        amountReceived: paymentMethod === "cash" ? parseFloat(amountReceived) : total,
        change: change,
        status: "completed",
        paymentDate: new Date().toISOString()
      }

      const paymentResponse = await processPaymentWithTimeout(paymentPayload)

      // Navigate to success page with a small delay to ensure state is set
      setTimeout(() => {
        navigate("/counter/payment-success", {
          state: {
            ...orderData,
            orderId: orderResponse.order?._id || orderResponse._id,
            billId: billResponse.bill?._id || billResponse._id,
            paymentId: paymentResponse.payment?._id || paymentResponse._id,
            paymentMethod,
            amountReceived: paymentMethod === "cash" ? parseFloat(amountReceived) : total,
            change,
            total
          }
        })
      }, 100)

    } catch (error) {
      console.error("Error processing payment:", error)
      setError(error.message || "Failed to process payment. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    navigate("/counter/bill-generation", { state: orderData })
  }

  return (
    <div className="counter-container">
      <div className="counter-card">
        <div className="counter-header">
          <h1 className="counter-title">Payment</h1>
          <p className="counter-subtitle">Process customer payment</p>
        </div>

        {/* Order Summary */}
        <div style={{ 
          background: '#f7fafc', 
          padding: '16px', 
          borderRadius: '8px', 
          marginBottom: '24px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem' }}>Order Summary</h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Subtotal:</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span>Tax (5%):</span>
            <span>₹{tax.toFixed(2)}</span>
          </div>
          <hr style={{ margin: '12px 0', border: 'none', borderTop: '2px solid #1a202c' }} />
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            fontSize: '1.25rem',
            fontWeight: '700'
          }}>
            <span>Total:</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
        </div>

        {/* Payment Method Selection */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>Payment Method</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <button
              className={`counter-item ${paymentMethod === 'cash' ? 'selected' : ''}`}
              onClick={() => handlePaymentMethodChange('cash')}
              style={{ padding: '16px', textAlign: 'center' }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💵</div>
              <div style={{ fontWeight: '600' }}>Cash</div>
            </button>
            <button
              className={`counter-item ${paymentMethod === 'card' ? 'selected' : ''}`}
              onClick={() => handlePaymentMethodChange('card')}
              style={{ padding: '16px', textAlign: 'center' }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>💳</div>
              <div style={{ fontWeight: '600' }}>Card</div>
            </button>
            <button
              className={`counter-item ${paymentMethod === 'upi' ? 'selected' : ''}`}
              onClick={() => handlePaymentMethodChange('upi')}
              style={{ padding: '16px', textAlign: 'center' }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📱</div>
              <div style={{ fontWeight: '600' }}>UPI</div>
            </button>
          </div>
        </div>

        {/* Cash Payment Details */}
        {paymentMethod === "cash" && (
          <div style={{ marginBottom: '24px' }}>
            <div className="counter-form-group">
              <label className="counter-label">Amount Received * (Auto-filled)</label>
              <input
                type="number"
                className="counter-input"
                placeholder="Amount auto-filled with total"
                value={amountReceived}
                onChange={(e) => handleAmountReceivedChange(e.target.value)}
                min={total}
                step="0.01"
              />
              <div style={{ 
                fontSize: '0.75rem', 
                color: '#6b7280', 
                marginTop: '4px',
                fontStyle: 'italic'
              }}>
                💡 Amount is automatically filled with the total (₹{total.toFixed(2)}). You can adjust if needed.
              </div>
            </div>
            
            {amountReceived && !isNaN(parseFloat(amountReceived)) && (
              <div style={{ 
                background: change > 0 ? '#f0fff4' : '#fff5f5', 
                padding: '12px', 
                borderRadius: '8px',
                border: `1px solid ${change > 0 ? '#68d391' : '#fc8181'}`
              }}>
                <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                  Change to Return: ₹{change.toFixed(2)}
                </div>
                {change < 0 && (
                  <div style={{ color: '#e53e3e', fontSize: '0.875rem' }}>
                    Insufficient amount received
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Digital Payment Info */}
        {(paymentMethod === "card" || paymentMethod === "upi") && (
          <div style={{ 
            background: '#e6fffa', 
            padding: '16px', 
            borderRadius: '8px', 
            marginBottom: '24px',
            border: '1px solid #81e6d9'
          }}>
            <div style={{ fontWeight: '600', marginBottom: '8px' }}>
              {paymentMethod === "card" ? "Card Payment" : "UPI Payment"}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#2d3748' }}>
              Amount: ₹{total.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#2d3748', marginTop: '4px' }}>
              Please complete the payment on the {paymentMethod === "card" ? "card terminal" : "UPI app"}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="counter-error" style={{ marginBottom: '24px' }}>
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <button
            className="counter-button-secondary"
            onClick={handleBack}
            disabled={loading}
            style={{ flex: 1 }}
          >
            ← Back
          </button>
          <button
            className="counter-button"
            onClick={handleProcessPayment}
            disabled={loading}
            style={{ flex: 2 }}
          >
            {loading ? (
              <div className="counter-spinner" style={{ width: '20px', height: '20px' }} />
            ) : (
              "Complete Payment"
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PaymentScreen