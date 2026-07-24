import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import thermalPrinter from "../services/thermalPrinter"
import counterApi from "../services/counterApi"

const KOTGeneration = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const orderData = location.state

  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState(null)
  const [cartItems, setCartItems] = useState(orderData?.cartItems || [])
  const [kotSaved, setKotSaved] = useState(false)
  const [kotPrinted, setKotPrinted] = useState(false)
  const [showKOTModal, setShowKOTModal] = useState(false)
  const [serverName, setServerName] = useState('') // Server/Waiter name (optional)

  // Add Enter key listener to print KOT automatically
  useEffect(() => {
    const handleKeyPress = async (event) => {
      // Check if Enter key is pressed
      if (event.key === 'Enter') {
        // Don't trigger if user is typing in an input field
        const activeElement = document.activeElement
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          return
        }

        // Don't trigger if already printing or if KOT already printed
        if (printing || kotPrinted) {
          return
        }

        // Print KOT automatically
        await handlePrintKOT()
      }
      
      // Check if K key is pressed to show KOT modal
      if (event.key.toLowerCase() === 'k') {
        // Don't trigger if user is typing in an input field
        const activeElement = document.activeElement
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          return
        }

        // Toggle KOT modal
        setShowKOTModal(!showKOTModal)
      }
    }

    // Add event listener
    window.addEventListener('keydown', handleKeyPress)

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [printing, kotPrinted, showKOTModal]) // Re-run when dependencies change

  if (!orderData) {
    return (
      <div className="counter-container">
        <div className="counter-card">
          <div className="counter-error">
            <p>Order data not found. Please start over.</p>
            <button className="counter-button" onClick={() => navigate("/counter/menu")}>
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  const handleSaveKOT = async () => {
    try {
      console.log('💾 Starting KOT save process...')
      
      // Get counter user info from localStorage
      const counterUserData = localStorage.getItem("counterUserData")
      const counterUser = counterUserData ? JSON.parse(counterUserData) : null
      
      if (!counterUser || !counterUser._id) {
        console.error('❌ Counter user not found in localStorage')
        throw new Error('User session expired. Please login again.')
      }
      
      console.log('✅ Counter user found:', counterUser._id)
      
      // Step 1: Create invoice first
      console.log('📄 Creating KOT invoice...')
      const invoiceData = {
        customerName: orderData.customerName || "Walk-in Customer",
        phoneNumber: orderData.phoneNumber || "0000000000",
        branchId: orderData.selectedBranch._id,
        category: orderData.selectedCategory?.name || 'Restaurant', // Add category for invoice numbering
        date: orderData.date || new Date().toLocaleDateString('en-IN'),
        time: orderData.time || new Date().toLocaleTimeString('en-IN', { hour12: true })
      }
      
      console.log('📄 Invoice data:', invoiceData)
      const invoiceResponse = await counterApi.createInvoice(invoiceData)
      console.log('✅ KOT Invoice created:', invoiceResponse.invoice)
      
      // Step 2: Update table status to "reserved" if table is selected
      if (orderData.selectedTable && orderData.selectedTable._id) {
        try {
          console.log('🪑 Updating table status to reserved...')
          const tableId = orderData.selectedTable._id || orderData.selectedTable.id
          await counterApi.request(`/table/${tableId}`, {
            method: 'PUT',
            body: JSON.stringify({
              status: 'reserved'
            })
          })
          console.log('✅ Table status updated to reserved')
        } catch (tableError) {
          console.error('⚠️ Failed to update table status:', tableError)
          // Don't block KOT creation if table update fails
        }
      }
      
      // Step 3: Create KOT order (not completed yet)
      console.log('🍽️ Creating KOT order...')
      const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      
      const kotOrder = {
        userId: counterUser._id,
        customerName: orderData.customerName || "Walk-in Customer",
        phoneNumber: orderData.phoneNumber || "0000000000",
        branchId: orderData.selectedBranch._id,
        branchName: orderData.selectedBranch?.name || 'Unknown Branch', // Add branch name for easier filtering
        categoryId: orderData.selectedCategory?._id || null, // Add category ID
        categoryName: orderData.selectedCategory?.name || 'Restaurant', // Add category name for sales report filtering
        invoiceId: invoiceResponse.invoice.id,
        tableId: orderData.selectedTable?._id || orderData.selectedTable?.id || null,
        tableNumber: orderData.selectedTable?.tableNumber || orderData.selectedTable?.number || null,
        serverName: serverName?.trim() || null, // Optional server/waiter name
        items: cartItems.map(item => ({
          menuItemId: item._id || item.id || "507f1f77bcf86cd799439013",
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          gstRate: item.gstRate || 0,  // CRITICAL: Include GST rate for bill calculation
          // Include remark if it exists
          ...(item.remark ? { remark: item.remark } : {})
        })),
        subtotal: subtotal,
        tax: 0,
        serviceCharge: 0,
        totalAmount: subtotal,
        grandTotal: subtotal,
        paymentMethod: 'pending', // Not paid yet
        orderStatus: 'kot_sent', // Special status for KOT
        paymentStatus: 'pending',
        kotNumber: `KOT-${Date.now()}`,
        kotTime: new Date().toISOString()
      }

      console.log('💾 Saving KOT order:', kotOrder)
      const savedKOT = await counterApi.createOrder(kotOrder)
      console.log('✅ KOT saved successfully:', savedKOT)
      
      setKotSaved(true)
      
      // Store KOT data for later bill generation
      localStorage.setItem('currentKOT', JSON.stringify({
        ...orderData,
        kotOrder: savedKOT,
        kotNumber: kotOrder.kotNumber,
        kotItems: cartItems
      }))
      
      console.log('✅ KOT save process completed successfully!')
      return savedKOT
      
    } catch (error) {
      console.error('❌ Failed to save KOT:', error)
      console.error('❌ Error details:', error.message, error.stack)
      throw error // Re-throw to be caught by handlePrintKOT
    }
  }

  const handlePrintKOT = async () => {
    if (printing) return
    
    setPrinting(true)
    setPrintError(null)
    
    try {
      // Step 1: Save KOT to database FIRST
      console.log('💾 Saving KOT to database...')
      await handleSaveKOT()
      
      // Step 2: Print KOT
      const printerSettings = JSON.parse(localStorage.getItem('thermalPrinterSettings') || '{}')
      
      const kotData = {
        selectedBranch: orderData.selectedBranch,
        kotNumber: `KOT-${Date.now()}`,
        date: orderData.date,
        time: orderData.time,
        tableNumber: orderData.selectedTable?.tableNumber || orderData.selectedTable?.number || 'N/A',
        cartItems: cartItems,
        isKOT: true
      }

      // Try direct thermal printing first
      try {
        // Generate KOT receipt text
        const kotText = generateKOTText(kotData)
        
        // Send directly to thermal printer via backend API
        const backendUrl = import.meta.env.VITE_BACKEND_PRIMARY || 'https://billing.jagalikoota.com/api/v1/hotel'
        const printerIP = printerSettings.ip || '192.168.1.100'
        const port = printerSettings.port || 9100
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout
        
        const response = await fetch(`${backendUrl}/print-thermal/network`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: kotText,
            printerIP,
            port
          }),
          signal: controller.signal
        })

        clearTimeout(timeoutId)
        
        if (response.ok) {
          setPrintError({ type: 'success', message: 'KOT printed to kitchen! Table reserved. Returning to menu...' })
          setKotPrinted(true) // Mark as printed
          
          // Auto-navigate back to menu after successful print
          setTimeout(() => {
            navigate("/counter/menu", {
              state: {
                ...orderData,
                cartItems: [], // Clear cart for new order
                selectedTable: null, // Clear table selection
                kotPrinted: true
              }
            })
          }, 1500) // 1.5 second delay to show success message
        } else {
          throw new Error('Kitchen printer not responding')
        }
        
      } catch (thermalError) {
        console.log('Direct thermal printing failed, trying thermal printer service:', thermalError.message)
        
        // Fallback to thermal printer service
        const options = {
          method: 'network',
          printerIP: printerSettings.ip || '192.168.1.100',
          port: printerSettings.port || 9100
        }

        // Use the thermal printer service as fallback
        const printData = {
          selectedBranch: orderData.selectedBranch,
          invoiceNumber: kotData.kotNumber,
          date: kotData.date,
          time: kotData.time,
          customerName: 'KITCHEN ORDER',
          phoneNumber: '',
          cartItems: cartItems.map(item => ({
            name: `${item.quantity}x ${item.name}`,
            price: 0, // Don't show prices in KOT
            quantity: 1,
            // Include remark if it exists
            ...(item.remark ? { remark: item.remark } : {})
          })),
          total: 0,
          paymentMethod: 'KOT',
          amountReceived: 0,
          change: 0,
          isKOT: true,
          tableNumber: kotData.tableNumber
        }

        await Promise.race([
          thermalPrinter.printBill(printData, options),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Print operation timed out')), 5000)
          )
        ])
        
        setPrintError({ type: 'success', message: 'KOT printed to kitchen! Table reserved. Returning to menu...' })
        setKotPrinted(true) // Mark as printed
        
        // Auto-navigate back to menu after successful print
        setTimeout(() => {
          navigate("/counter/menu", {
            state: {
              ...orderData,
              cartItems: [], // Clear cart for new order
              selectedTable: null, // Clear table selection
              kotPrinted: true
            }
          })
        }, 1500) // 1.5 second delay to show success message
      }
      
      setTimeout(() => setPrintError(null), 3000)
      
    } catch (error) {
      console.error('KOT Print error:', error)
      setPrintError({ 
        type: 'error', 
        message: 'Failed to print KOT. Please check printer connection.' 
      })
      setTimeout(() => setPrintError(null), 5000)
    } finally {
      setPrinting(false)
    }
  }

  const generateKOTText = (kotData) => {
    const width = 42
    const centerText = (text) => {
      const padding = Math.max(0, Math.floor((width - text.length) / 2))
      return ' '.repeat(padding) + text
    }
    
    const formatTwoColumn = (left, right) => {
      const maxLeft = width - right.length - 1
      const truncatedLeft = left.length > maxLeft ? left.substring(0, maxLeft - 3) + '...' : left
      const padding = width - truncatedLeft.length - right.length
      return truncatedLeft + ' '.repeat(Math.max(1, padding)) + right
    }

    let receipt = '\n'
    receipt += centerText('*** KITCHEN ORDER TICKET ***') + '\n'
    receipt += centerText(kotData.selectedBranch.name || 'Restaurant') + '\n'
    receipt += '='.repeat(width) + '\n'
    receipt += formatTwoColumn('KOT#:', kotData.kotNumber || 'KOT-001') + '\n'
    receipt += formatTwoColumn('Table:', kotData.tableNumber || 'N/A') + '\n'
    receipt += formatTwoColumn('Date:', kotData.date || new Date().toLocaleDateString()) + '\n'
    receipt += formatTwoColumn('Time:', kotData.time || new Date().toLocaleTimeString()) + '\n'
    receipt += '='.repeat(width) + '\n'
    receipt += centerText('ITEMS TO PREPARE') + '\n'
    receipt += '-'.repeat(width) + '\n'

    if (kotData.cartItems && kotData.cartItems.length > 0) {
      kotData.cartItems.forEach(item => {
        const itemLine = `${item.quantity || 1}x ${item.name || 'Unknown Item'}`
        receipt += itemLine + '\n'
        
        // Add remark if it exists
        if (item.remark) {
          receipt += `  Note: ${item.remark}\n`
        }
        
        // Add line break for long item names
        if (itemLine.length > width) {
          receipt += '\n'
        }
      })
    } else {
      receipt += centerText('No items') + '\n'
    }

    receipt += '-'.repeat(width) + '\n'
    const totalItems = kotData.cartItems ? kotData.cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0) : 0
    receipt += centerText(`Total Items: ${totalItems}`) + '\n'
    receipt += '='.repeat(width) + '\n'
    receipt += centerText('*** KITCHEN COPY ***') + '\n'
    receipt += '\n\n\n'

    return receipt
  }

  const handlePrintSettings = () => {
    // Open print settings modal/page
    navigate("/counter/print-settings", { 
      state: { returnTo: "/counter/kot-generation", orderData } 
    })
  }

  const handleAddMoreItems = () => {
    // Go back to menu to add more items
    navigate("/counter/menu", { 
      state: {
        ...orderData,
        cartItems: [], // Start with empty cart for additional items
        isKOTOrder: true, // Flag to indicate this is a KOT order
        existingKOT: true
      }
    })
  }

  const handleGenerateFinalBill = () => {
    // Navigate to bill generation with KOT data
    navigate("/counter/bill-generation", {
      state: {
        ...orderData,
        cartItems: cartItems,
        isKOTOrder: true,
        kotSaved: true
      }
    })
  }

  const handleBack = () => {
    navigate("/counter/menu", { 
      state: {
        ...orderData,
        cartItems: cartItems
      }
    })
  }

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  return (
    <div className="counter-container">
      <div className="counter-card">
        <div className="counter-header">
          <h1 className="counter-title">Kitchen Order Ticket (KOT)</h1>
          <p className="counter-subtitle">Send order to kitchen</p>
        </div>

        {/* KOT Details */}
        <div style={{ 
          background: '#fff7ed', 
          padding: '20px', 
          borderRadius: '12px', 
          marginBottom: '24px',
          border: '2px dashed #fb923c'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.5rem', color: '#ea580c' }}>
              🍽️ KITCHEN ORDER TICKET
            </h2>
            <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: '#9a3412' }}>
              {orderData.selectedBranch.name}
            </p>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #fb923c', margin: '16px 0' }} />

          {/* Order Info */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 1fr', 
            gap: '16px',
            marginBottom: '16px'
          }}>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: '#9a3412' }}>
                KOT Number:
              </p>
              <p style={{ margin: '0', fontWeight: '600', color: '#ea580c' }}>
                KOT-{Date.now().toString().slice(-6)}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: '#9a3412' }}>
                Table:
              </p>
              <p style={{ margin: '0', fontWeight: '600', color: '#ea580c' }}>
                🪑 {orderData.selectedTable?.tableNumber || orderData.selectedTable?.number || 'N/A'}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: '#9a3412' }}>
                Time:
              </p>
              <p style={{ margin: '0', fontWeight: '600', color: '#ea580c' }}>
                {orderData.time}
              </p>
            </div>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #fb923c', margin: '16px 0' }} />

          {/* Server Name (Optional) */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '6px', 
              fontSize: '0.875rem', 
              color: '#9a3412',
              fontWeight: '600'
            }}>
              Server/Waiter Name (Optional):
            </label>
            <input
              type="text"
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="Enter server name"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '2px solid #fed7aa',
                borderRadius: '8px',
                fontSize: '0.95rem',
                color: '#9a3412',
                backgroundColor: '#fffbeb',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#fb923c'}
              onBlur={(e) => e.target.style.borderColor = '#fed7aa'}
            />
          </div>

          {/* Items */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#ea580c' }}>
              Items to Prepare
            </h3>
            {cartItems.map((item, index) => (
              <div key={index} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: index < cartItems.length - 1 ? '1px solid #fed7aa' : 'none'
              }}>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0', fontWeight: '600', color: '#9a3412', fontSize: '1rem' }}>
                    {item.quantity}x {item.name}
                  </p>
                  {/* Show remark if it exists */}
                  {item.remark && (
                    <p style={{ 
                      margin: '4px 0 0 0', 
                      fontStyle: 'italic', 
                      color: '#dc2626', 
                      fontSize: '0.875rem',
                      fontWeight: '500'
                    }}>
                      Note: {item.remark}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <hr style={{ border: 'none', borderTop: '2px solid #ea580c', margin: '16px 0' }} />

          <div style={{ 
            textAlign: 'center',
            fontSize: '1.2rem',
            fontWeight: '700',
            color: '#ea580c'
          }}>
            Total Items: {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
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
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          marginTop: '24px'
        }}>
          
          {/* Initial State: Print KOT */}
          {!kotPrinted && (
            <div style={{
              textAlign: 'center',
              padding: '20px',
              background: '#fef3c7',
              border: '2px solid #f59e0b',
              borderRadius: '12px'
            }}>
              <h3 style={{ margin: '0 0 8px 0', color: '#92400e', fontSize: '1.2rem' }}>
                Press Enter to Print KOT
              </h3>
              <p style={{ margin: '0', color: '#78350f', fontSize: '0.875rem' }}>
                Or click the Print KOT button below
              </p>
            </div>
          )}

          {/* After KOT Printed: Show Options */}
          {kotPrinted && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              padding: '20px',
              background: '#f0fdf4',
              border: '2px solid #10b981',
              borderRadius: '12px'
            }}>
              <button
                className="counter-button"
                onClick={handleAddMoreItems}
                style={{
                  background: '#f59e0b',
                  borderColor: '#f59e0b',
                  padding: '16px 24px',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}
              >
                ➕ Add More Items
              </button>
              
              <button
                className="counter-button"
                onClick={handleGenerateFinalBill}
                style={{
                  background: '#10b981',
                  borderColor: '#10b981',
                  padding: '16px 24px',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}
              >
                📄 Generate Final Bill
              </button>
            </div>
          )}

          {/* Bottom Row: Always Available Buttons */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: '1fr 1fr 1fr 1fr', 
            gap: '12px'
          }}>
            <button
              className="counter-button-secondary"
              onClick={handleBack}
            >
              ← Back
            </button>
            
            <button
              className="counter-button-secondary"
              onClick={handlePrintKOT}
              disabled={printing}
              style={{ 
                background: kotPrinted ? '#9ca3af' : '#ea580c',
                borderColor: kotPrinted ? '#9ca3af' : '#ea580c',
                color: 'white',
                opacity: printing ? 0.6 : 1,
                cursor: printing ? 'not-allowed' : 'pointer'
              }}
            >
              {printing ? '🔄 Printing...' : kotPrinted ? '✅ KOT Printed' : '🖨️ Print KOT'}
            </button>

            <button
              className="counter-button-secondary"
              onClick={handlePrintSettings}
              title="Configure printer settings"
            >
              ⚙️ Settings
            </button>

            <button
              className="counter-button-secondary"
              onClick={() => setShowKOTModal(true)}
              title="Press K to view KOT details"
            >
              📋 View KOT (K)
            </button>
          </div>
        </div>

        {/* KOT Modal - Press K to open */}
        {showKOTModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              minWidth: '500px',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '24px'
              }}>
                <h2 style={{ 
                  margin: 0, 
                  fontSize: '1.5rem', 
                  color: '#ea580c',
                  fontWeight: '600'
                }}>
                  🍽️ Kitchen Order Ticket
                </h2>
                <button
                  onClick={() => setShowKOTModal(false)}
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  ✕ Close (K)
                </button>
              </div>

              {/* KOT Details in Modal */}
              <div style={{
                background: '#fff7ed',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #fb923c'
              }}>
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr 1fr', 
                    gap: '16px',
                    marginBottom: '16px'
                  }}>
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: '#9a3412' }}>
                        KOT Number:
                      </p>
                      <p style={{ margin: '0', fontWeight: '600', color: '#ea580c' }}>
                        KOT-{Date.now().toString().slice(-6)}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: '#9a3412' }}>
                        Table:
                      </p>
                      <p style={{ margin: '0', fontWeight: '600', color: '#ea580c' }}>
                        🪑 {orderData.selectedTable?.tableNumber || orderData.selectedTable?.number || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: '#9a3412' }}>
                        Time:
                      </p>
                      <p style={{ margin: '0', fontWeight: '600', color: '#ea580c' }}>
                        {orderData.time}
                      </p>
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #fb923c', margin: '16px 0' }} />

                  <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#ea580c' }}>
                    Items to Prepare
                  </h3>
                  {cartItems.map((item, index) => (
                    <div key={index} style={{ 
                      padding: '8px 0',
                      borderBottom: index < cartItems.length - 1 ? '1px solid #fed7aa' : 'none'
                    }}>
                      <p style={{ margin: '0', fontWeight: '600', color: '#9a3412', fontSize: '1rem' }}>
                        {item.quantity}x {item.name}
                      </p>
                      {/* Show remark if it exists */}
                      {item.remark && (
                        <p style={{ 
                          margin: '4px 0 0 0', 
                          fontStyle: 'italic', 
                          color: '#dc2626', 
                          fontSize: '0.875rem',
                          fontWeight: '500'
                        }}>
                          Note: {item.remark}
                        </p>
                      )}
                    </div>
                  ))}

                  <hr style={{ border: 'none', borderTop: '2px solid #ea580c', margin: '16px 0' }} />

                  <div style={{ 
                    textAlign: 'center',
                    fontSize: '1.2rem',
                    fontWeight: '700',
                    color: '#ea580c'
                  }}>
                    Total Items: {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
                  </div>
                </div>

                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  justifyContent: 'center',
                  marginTop: '20px'
                }}>
                  <button
                    onClick={handlePrintKOT}
                    disabled={printing}
                    style={{
                      background: '#ea580c',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: printing ? 'not-allowed' : 'pointer',
                      opacity: printing ? 0.6 : 1
                    }}
                  >
                    {printing ? '🔄 Printing...' : '🖨️ Print KOT'}
                  </button>
                  
                  <button
                    onClick={() => setShowKOTModal(false)}
                    style={{
                      background: '#6b7280',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default KOTGeneration