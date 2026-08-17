import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import thermalPrinter from "../services/thermalPrinter"
import counterApi from "../services/counterApi"
import { offlineQueue } from "../services/offlineQueue"
import { syncManager } from "../services/syncManager"
import { localCache } from "../services/localCache"
import hotelViratLogo from "../../assets/logo4.jpeg"
import { Tag, Printer, Settings, Gift, ArrowLeft, ClipboardList, TableProperties, Calendar, ReceiptText, Pencil, CheckCircle, Loader2 } from "lucide-react"

// Helper function to get stored category from localStorage
const getStoredCategory = () => {
  try {
    const storedCategory = localStorage.getItem('selectedCategory')
    const storedCategoryName = localStorage.getItem('selectedCategoryName')
    
    if (storedCategoryName) {
      return storedCategoryName
    }
    
    if (storedCategory) {
      const categoryData = JSON.parse(storedCategory)
      const categoryName = categoryData?.name || categoryData
      return categoryName
    }
    
    return null
  } catch (error) {
    console.error('❌ Error reading stored category:', error)
    return null
  }
}

// Enhanced helper function to get category from multiple sources
const getCategoryName = (customerData, preSelectedCategory) => {
  // Try multiple sources in order of preference
  const sources = [
    customerData?.selectedCategory?.name,
    preSelectedCategory,
    getStoredCategory(),
    // Check URL or other indicators
    window.location.pathname.includes('temple') ? 'Temple Meals' : null,
    window.location.pathname.includes('self') ? 'Self Service' : null,
    window.location.pathname.includes('restaurant') ? 'Restaurant' : null
  ]
  
  for (const source of sources) {
    if (source && source !== 'All') {
      return source
    }
  }
  
  return 'Self Service' // Default fallback
}
// Local-first: generates instantly from localStorage, works offline.
// Seeded from server on app init so numbers continue from where server left off.

const _todayDateKey = () => {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const year = String(now.getFullYear()).slice(-2)
  return `${day}-${month}-${year}`
}

const _incrementLocalCounter = async (storageKey) => {
  const lockKey = `${storageKey}-lock`
  let attempts = 0
  while (attempts < 10) {
    const lockTs = localStorage.getItem(lockKey)
    const ts = Date.now()
    if (lockTs && (ts - parseInt(lockTs)) < 1000) {
      await new Promise(r => setTimeout(r, 50))
      attempts++
      continue
    }
    localStorage.setItem(lockKey, ts.toString())
    await new Promise(r => setTimeout(r, 10))
    if (localStorage.getItem(lockKey) !== ts.toString()) { attempts++; continue }
    try {
      let counter = parseInt(localStorage.getItem(storageKey) || '0')
      counter++
      localStorage.setItem(storageKey, counter.toString())
      return counter
    } finally {
      localStorage.removeItem(lockKey)
    }
  }
  return null
}

// Seed local counter from server before generating — ensures continuity after session clear
const _seedFromServer = async (branchId, category, key) => {
  if (!branchId || !navigator.onLine) return
  try {
    const res = await counterApi.request(
      `/counter-invoice/last-bill-number/${branchId}?category=${encodeURIComponent(category)}`,
      { _timeout: 4000 }
    )
    if (res?.success && typeof res.lastBillNumber === 'number' && res.lastBillNumber > 0) {
      const localVal = parseInt(localStorage.getItem(key) || '0')
      if (res.lastBillNumber > localVal) {
        localStorage.setItem(key, String(res.lastBillNumber))
        console.log(`[BillGen] Seeded counter for "${category}" from server: ${res.lastBillNumber}`)
      }
    }
  } catch (_) {
    // Offline or error — use local value as-is
  }
}

// LOCAL-FIRST bill numbering — seeds from server on first use so numbers never reset
const getNextBillNumber = async (branchId, category) => {
  if (!category) category = 'default'
  const key = `unified-bill-counter-${category}-${_todayDateKey()}`
  // If local counter is 0 (missing/cleared), fetch server value first
  const localVal = parseInt(localStorage.getItem(key) || '0')
  if (localVal === 0) {
    await _seedFromServer(branchId, category, key)
  }
  const counter = await _incrementLocalCounter(key)
  if (counter === null) return `T${Date.now().toString().slice(-6)}`
  return String(counter).padStart(3, '0')
}

const BillGeneration = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const orderData = location.state

  // CRITICAL DEBUG: Log received data immediately
  // console.log('\n🎯 BILLGENERATION PAGE LOADED')
  // console.log('📦 Received orderData:', {
  //   isComprehensiveBill: orderData?.isComprehensiveBill,
  //   kotNumbers: orderData?.kotNumbers,
  //   cartItemsCount: orderData?.cartItems?.length,
  //   totalAmount: orderData?.totalAmount,
  //   existingOrderIds: orderData?.existingOrderIds
  // })
  
  if (orderData?.cartItems) {
    // console.log('📋 Received Cart Items:')
    // orderData.cartItems.forEach((item, idx) => {
    //   console.log(`  ${idx + 1}. ${item.name} - Qty: ${item.quantity}, Price: ₹${item.price}, Subtotal: ₹${item.quantity * item.price}`)
    // })
    
    const receivedTotal = orderData.cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    // console.log(`💰 Calculated total from received items: ₹${receivedTotal}`)
    // console.log(`💰 Received totalAmount: ₹${orderData.totalAmount}`)
    
    if (Math.abs(receivedTotal - orderData.totalAmount) > 1) {
      console.warn(`⚠️ Amount mismatch in BillGeneration! Difference: ₹${Math.abs(receivedTotal - orderData.totalAmount)}`)
    }
  } else {
    console.error('❌ No cartItems received in orderData!')
  }

  // For KOT orders, ensure bill number is separate from KOT number
  if (orderData?.isKOTOrder && orderData?.kotNumber) {
    // Generate a new bill number (separate from KOT number)
    if (!orderData.billNumber) {
      // Note: This will be handled in the comprehensive bill generation
      // console.log('🔧 Bill number will be generated in comprehensive bill flow')
    }
  }

  const [printing, setPrinting] = useState(false)
  const [printError, setPrintError] = useState(null)
  
  // DEBUG: Check what cartItems we receive
  console.log('🎯 BillGeneration - Received orderData.cartItems:', orderData?.cartItems?.map(item => ({
    name: item.name,
    price: item.price,
    gstRate: item.gstRate || 'MISSING'
  })))
  
  const [cartItems, setCartItems] = useState(orderData?.cartItems || [])

  // Resolve category once at component level — used in bill payloads, bill number generation, and print
  const resolvedCategoryName = (
    orderData?.selectedCategory?.name ||
    localStorage.getItem('selectedCategoryName') ||
    (() => { try { return JSON.parse(localStorage.getItem('selectedCategory') || '{}')?.name } catch(_){} return null })() ||
    'Self Service'
  )
  const resolvedCategoryId = (
    orderData?.selectedCategory?._id ||
    (() => { try { const c = JSON.parse(localStorage.getItem('selectedCategory') || '{}'); return c?._id || c?.id || null } catch(_){} return null })() ||
    null
  )
  
  // State for invoice number - generate if not provided
  const [invoiceNumber, setInvoiceNumber] = useState(orderData?.invoiceNumber || orderData?.billNumber)
  const [invoiceGenerated, setInvoiceGenerated] = useState(false) // Flag to prevent multiple generations
  const [billNumberGenerated, setBillNumberGenerated] = useState(false) // Flag to prevent double generation

  // CRITICAL FIX: Clear bill print lock when page loads
  useEffect(() => {
    const billPrintLock = localStorage.getItem('billPrintLock')
    const lockTimestamp = localStorage.getItem('billPrintLockTime')
    
    if (billPrintLock === 'true') {
      // console.log('🔓 BillGeneration page loaded - clearing bill print lock')
      localStorage.removeItem('billPrintLock')
      localStorage.removeItem('billPrintLockTime')
    }
  }, []) // Run only once when component mounts

  // Generate invoice number if not provided
  useEffect(() => {
    const generateInvoiceIfNeeded = async () => {
      // CRITICAL: Always overwrite category in localStorage when page loads with fresh orderData
      // This ensures category switches are reflected immediately
      if (orderData?.selectedCategory?.name) {
        localStorage.setItem('selectedCategory', JSON.stringify(orderData.selectedCategory))
        localStorage.setItem('selectedCategoryName', orderData.selectedCategory.name)
      }
      
      // CRITICAL FIX: Only use existing invoice number, don't generate new ones here
      // Bill numbers should only be generated when order is actually completed
      if (orderData?.billNumber || orderData?.invoiceNumber) {
        // console.log('🧾 BillGeneration: Using existing invoice number:', orderData.billNumber || orderData.invoiceNumber)
        setInvoiceNumber(orderData.billNumber || orderData.invoiceNumber)
        setInvoiceGenerated(true)
        setBillNumberGenerated(true) // Mark as already generated
      } else {
        // console.log('🧾 BillGeneration: No invoice number provided - will generate when order is completed')
        // Don't generate here - will be generated in handleDone() when order is actually completed
        setInvoiceNumber('PENDING') // Show placeholder
        setInvoiceGenerated(false)
        setBillNumberGenerated(false) // Not generated yet
      }
    }
    
    generateInvoiceIfNeeded()
  }, []) // CRITICAL: Empty dependency array to prevent re-running

  // Discount state
  const [showDiscountPopup, setShowDiscountPopup] = useState(false)
  const [discountType, setDiscountType] = useState("percentage") // "percentage" or "amount"
  const [discountValue, setDiscountValue] = useState("")
  const [discountRemark, setDiscountRemark] = useState("")
  const [appliedDiscount, setAppliedDiscount] = useState(null) // Store applied discount

  // Complimentary state
  const [isComplimentary, setIsComplimentary] = useState(false)
  const [complimentaryReason, setComplimentaryReason] = useState("")
  const [showComplimentaryPopup, setShowComplimentaryPopup] = useState(false)

  // Member Wallet state
  const [memberDetails, setMemberDetails] = useState(null)
  const [loadingMember, setLoadingMember] = useState(false)
  const [walletDeducting, setWalletDeducting] = useState(false)

  // Fetch member details if it's a Member App order
  useEffect(() => {
    const fetchMemberDetails = async () => {
      // Check if this is a Member App order
      // Navigation state uses `existingOrderIds` (array) for comprehensive bills
      // and `existingOrderId` (singular) for single-KOT bills. Use the first
      // available ID to look up the member.
      const orderId =
        orderData?.existingOrderId ||
        (orderData?.existingOrderIds && orderData.existingOrderIds[0]) ||
        null;

      if (orderData?.serverName === 'Member App' && orderId) {
        try {
          setLoadingMember(true)
          const response = await fetch(
            `https://billing.jagalikoota.com/api/v1/hotel/wallet/member-by-order/${orderId}`
          )
          const data = await response.json()
          
          if (data.success) {
            setMemberDetails(data.member)
          } else {
            console.warn('Member not found:', data.message)
          }
        } catch (error) {
          console.error('Error fetching member details:', error)
        } finally {
          setLoadingMember(false)
        }
      }
    }
    
    fetchMemberDetails()
  }, [orderData])

  // Auto-focus discount popup when it opens
  useEffect(() => {
    if (showDiscountPopup) {
      setTimeout(() => {
        const discountInput = document.querySelector('input[type="number"][placeholder*="percentage"]')
        if (discountInput) {
          discountInput.focus()
        }
      }, 100)
    }
  }, [showDiscountPopup])

  // Helper function to update table status to available
  const updateTableStatusToAvailable = async () => {
    if (!orderData.selectedTable) {
      // console.log('⚠️ No selected table to update status for')
      return
    }

    const tableId = orderData.selectedTable._id || orderData.selectedTable.id
    const tableNumber = orderData.selectedTable.tableNumber || orderData.selectedTable.number

    if (!tableId) {
      console.error('❌ Table ID is missing - cannot update status')
      return
    }

    try {
      // console.log(`🪑 Freeing up table after bill print: ${tableNumber} (ID: ${tableId})`)
      
      // Make API call to update table status — short timeout, fire-and-forget style
      const response = await counterApi.request(`/table/${tableId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'available'
        }),
        _timeout: 3000
      })
      

      // Set multiple flags to ensure table refresh
      localStorage.setItem('refreshTablesAfterBill', 'true')
      localStorage.setItem('lastUpdatedTable', tableId)
      localStorage.setItem('lastUpdatedTableStatus', 'available')
      localStorage.setItem('tableStatusUpdateTime', Date.now().toString())
      
      // Force immediate table refresh if possible
      if (window.refreshTables && typeof window.refreshTables === 'function') {
        window.refreshTables()
      }
      
    } catch (error) {
      console.error('❌ Failed to update table status after bill print:', error)
      console.error('❌ Error details:', {
        message: error.message,
        status: error.status,
        response: error.response
      })
      
      // Even if API fails, set the refresh flag
      localStorage.setItem('refreshTablesAfterBill', 'true')
      localStorage.setItem('tableStatusUpdateFailed', 'true')
      localStorage.setItem('failedTableId', tableId)
      
      // Show user notification about the issue
      if (window.showNotification && typeof window.showNotification === 'function') {
        window.showNotification('Table status update failed. Please manually refresh the table list.', 'warning')
      }
    }
  }

  // Add Enter key listener to print bill directly and auto-focus on print
  useEffect(() => {
    const handleKeyPress = async (event) => {
      // Check if Alt+B is pressed to go back to menu
      if (event.altKey && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        handleBack()
        return
      }
      
      // Check if Alt+C is pressed to toggle complimentary
      if (event.altKey && event.key.toLowerCase() === 'c') {
        event.preventDefault()
        if (isComplimentary) {
          // If already complimentary, turn it off
          setIsComplimentary(false)
          setComplimentaryReason("")
        } else {
          // Show complimentary popup to get reason
          setShowComplimentaryPopup(true)
        }
        return
      }
      
      // Check if Enter key is pressed
      if (event.key === 'Enter') {
        // Don't trigger if user is typing in an input field
        const activeElement = document.activeElement
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
          return
        }

        // Don't trigger if discount popup is open
        if (showDiscountPopup || showComplimentaryPopup) {
          // console.log('🚫 Enter key blocked - popup is open')
          return
        }

        // Don't trigger if already printing
        if (printing) {
          return
        }

        // 🔒 LOCK SYSTEM: Check if bill printing is locked (prevents duplicate prints)
        const billPrintLock = localStorage.getItem('billPrintLock')
        const lockTimestamp = localStorage.getItem('billPrintLockTime')
        
        if (billPrintLock === 'true') {
          // Check if lock is stale
          if (lockTimestamp) {
            const lockAge = Date.now() - parseInt(lockTimestamp)
            if (lockAge < 30000) { // Lock is fresh (less than 30 seconds)
              console.log('🔒 Enter key blocked - bill printing is locked (already printing)')
              return
            } else {
              console.log('🔓 Lock is stale, proceeding with print')
              localStorage.removeItem('billPrintLock')
              localStorage.removeItem('billPrintLockTime')
            }
          } else {
            // No timestamp, remove stale lock
            localStorage.removeItem('billPrintLock')
          }
        }

        // console.log('⌨️ Enter key pressed - generating bill number and printing...')

        // CRITICAL FIX: Generate bill number BEFORE printing with proper error handling
        const handleEnterKeyPress = async () => {
          try {
            // 🔒 LOCK SYSTEM: Activate lock to prevent duplicate prints
            // console.log('🔒 Activating bill print lock...')
            localStorage.setItem('billPrintLock', 'true')
            localStorage.setItem('billPrintLockTime', Date.now().toString())
            
            // Generate bill number if not already generated
            let finalInvoiceNumber = invoiceNumber;
            
            if ((!finalInvoiceNumber || finalInvoiceNumber === 'PENDING') && !billNumberGenerated) {
              // console.log('🧾 Enter key: Generating bill number before printing...')
              try {
                finalInvoiceNumber = await getNextBillNumber(
                  orderData.selectedBranch._id, 
                  resolvedCategoryName
                );
                // console.log('🧾 Enter key: Generated bill number:', finalInvoiceNumber)
                setInvoiceNumber(finalInvoiceNumber)
                setBillNumberGenerated(true) // Mark as generated to prevent double generation
                
                // Wait a moment for state to update
                await new Promise(resolve => setTimeout(resolve, 100))
              } catch (billGenError) {
                console.error('❌ Failed to generate bill number:', billGenError)
                // Release lock and show error
                localStorage.removeItem('billPrintLock')
                localStorage.removeItem('billPrintLockTime')
                alert('Failed to generate bill number. Please try again.')
                return
              }
            } else {
              // console.log('🧾 Enter key: Using existing bill number:', finalInvoiceNumber)
            }

            // Validate bill number before proceeding
            if (!finalInvoiceNumber || finalInvoiceNumber === 'PENDING') {
              console.error('❌ Invalid bill number:', finalInvoiceNumber)
              localStorage.removeItem('billPrintLock')
              localStorage.removeItem('billPrintLockTime')
              alert('Invalid bill number. Please try again.')
              return
            }

            // console.log('⌨️ Enter key: Printing with bill number:', finalInvoiceNumber)

            // Print directly to thermal printer with the correct bill number
            await handleDirectPrintWithBillNumber(finalInvoiceNumber)
            
            // Then complete the order with the already generated bill number
            setTimeout(() => {
              handleDone(finalInvoiceNumber) // Pass the bill number to prevent double generation
              // Lock will be released when MenuScreen.jsx loads
            }, 500)
          } catch (error) {
            console.error('❌ Error in Enter key handler:', error)
            // 🔒 LOCK SYSTEM: Release lock on error
            // console.log('🔓 Releasing bill print lock due to error')
            localStorage.removeItem('billPrintLock')
            localStorage.removeItem('billPrintLockTime')
            alert('An error occurred. Please try again.')
          }
        }

        handleEnterKeyPress()
      }
    }

    // Add event listener
    window.addEventListener('keydown', handleKeyPress)

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [printing, cartItems, showDiscountPopup, showComplimentaryPopup, appliedDiscount, isComplimentary]) // Re-run if discount or complimentary state changes

  // All function declarations must come before any return statements
  const handleWalletDeduction = async () => {
    if (!memberDetails) {
      alert('Member details not loaded')
      return false
    }

    // Calculate total the same way as the rest of the component
    const billSubtotal = cartItems.reduce((sum, item) => item.isComplimentary ? sum : sum + (item.price * item.quantity), 0)
    const billGst = cartItems.reduce((sum, item) => {
      if (item.isComplimentary) return sum
      const rate = item.gstRate || 0
      return sum + ((item.price * item.quantity * rate) / 100)
    }, 0)
    const totalAmount = billSubtotal + billGst - getDiscountAmount()

    // Check balance
    if (memberDetails.walletBalance < totalAmount) {
      alert(
        `Insufficient Balance!\n\n` +
        `Required: ₹${totalAmount.toFixed(2)}\n` +
        `Available: ₹${memberDetails.walletBalance.toFixed(2)}\n` +
        `Short by: ₹${(totalAmount - memberDetails.walletBalance).toFixed(2)}`
      )
      return false
    }

    // Confirm deduction
    const confirmed = window.confirm(
      `Deduct from Wallet?\n\n` +
      `Member: ${memberDetails.name}\n` +
      `Phone: ${memberDetails.phone}\n` +
      `Amount: ₹${totalAmount.toFixed(2)}\n` +
      `Balance After: ₹${(memberDetails.walletBalance - totalAmount).toFixed(2)}\n\n` +
      `Click OK to proceed`
    )

    if (!confirmed) return false

    try {
      setWalletDeducting(true)

      const response = await fetch(
        'https://billing.jagalikoota.com/api/v1/hotel/wallet/deduct-for-order',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            orderId: orderData.existingOrderId || (orderData.existingOrderIds && orderData.existingOrderIds[0]),
            memberPhone: memberDetails.phone,
            amount: totalAmount
          })
        }
      )

      const data = await response.json()

      if (data.success) {
        alert(
          `✅ Payment Successful!\n\n` +
          `Amount Deducted: ₹${data.transaction.amount.toFixed(2)}\n` +
          `Previous Balance: ₹${data.transaction.balanceBefore.toFixed(2)}\n` +
          `New Balance: ₹${data.transaction.balanceAfter.toFixed(2)}`
        )

        // Update member details locally
        setMemberDetails(prev => ({
          ...prev,
          walletBalance: data.transaction.balanceAfter
        }))

        return true
      } else {
        alert(`❌ Payment Failed\n\n${data.message}`)
        return false
      }
    } catch (error) {
      console.error('Error deducting from wallet:', error)
      alert(`❌ Error: ${error.message}`)
      return false
    } finally {
      setWalletDeducting(false)
    }
  }

  const handleDone = async (providedBillNumber = null) => {
    // resolvedCategoryName and resolvedCategoryId are defined at component level above
    
    // CRITICAL FIX: Use provided bill number or generate only if needed
    let finalInvoiceNumber = providedBillNumber || invoiceNumber;
    
    // Only generate if we don't have a valid bill number
    if (!providedBillNumber && ((!finalInvoiceNumber || finalInvoiceNumber === 'PENDING') && !billNumberGenerated)) {
      // console.log('🧾 Generating bill number at completion time...')
      try {
        finalInvoiceNumber = await getNextBillNumber(
          orderData.selectedBranch._id, 
          resolvedCategoryName
        );
        // console.log('🧾 Generated bill number at completion:', finalInvoiceNumber)
        setInvoiceNumber(finalInvoiceNumber)
        setBillNumberGenerated(true) // Mark as generated
      } catch (error) {
        console.error('❌ Failed to generate bill number at completion:', error)
        alert('Failed to generate bill number. Please try again.')
        return // Don't proceed without a valid bill number
      }
    }
    
    // Validate we have a valid bill number before proceeding
    if (!finalInvoiceNumber || finalInvoiceNumber === 'PENDING') {
      console.error('❌ Cannot complete order without valid bill number')
      alert('Invalid bill number. Please try again.')
      return
    }
    
    console.log('🎯 Order data:', {
      isComprehensiveBill: orderData.isComprehensiveBill,
      existingOrderIds: orderData.existingOrderIds,
      kotNumbers: orderData.kotNumbers,
      billNumber: orderData.billNumber,
      invoiceNumber: orderData.invoiceNumber,
      finalInvoiceNumber: finalInvoiceNumber
    })
    // console.log('🎯 CRITICAL DEBUG - Full orderData:', orderData)
    // console.log('🎯 CRITICAL DEBUG - selectedCategory:', orderData.selectedCategory)
     // console.log('📝 Updating MULTIPLE KOT orders to completed:', orderData.existingOrderIds)
          // console.log('📝 KOT numbers included:', orderData.kotNumbers)
          
    // Save the order to database when done
    try {
      // Get counter user info from localStorage
      const counterUserData = localStorage.getItem("counterUserData")
      const counterUser = counterUserData ? JSON.parse(counterUserData) : null
      
      if (!counterUser || !counterUser._id) {
        console.warn('⚠️ Counter user not found in localStorage — saving bill locally and navigating')
        // Still save the bill locally so it's not lost
        const subtotal = cartItems.reduce((sum, item) => item.isComplimentary ? sum : sum + (item.price * item.quantity), 0)
        
        // Calculate GST from items
        const gstAmount = cartItems.reduce((sum, item) => {
          if (item.isComplimentary) return sum
          const rate = item.gstRate || 0
          return sum + ((item.price * item.quantity * rate) / 100)
        }, 0)
        
        const total = subtotal + gstAmount - getDiscountAmount()
        const fallbackOrder = {
          userId: null,
          customerName: orderData.customerName || 'Walk-in Customer',
          phoneNumber: orderData.phoneNumber || '0000000000',
          branchId: orderData.selectedBranch._id,
          branchName: orderData.selectedBranch.name,
          categoryId: resolvedCategoryId,
          categoryName: resolvedCategoryName,
          tableId: orderData.selectedTable?._id || orderData.selectedTable?.id || null,
          tableNumber: orderData.selectedTable?.tableNumber || orderData.selectedTable?.number || null,
          serverName: orderData.serverName || null, // Include server name from KOT
          items: cartItems.map(item => ({
            menuItemId: item._id || item.id || '507f1f77bcf86cd799439013',
            name: item.name, quantity: item.quantity, price: item.price,
            gstRate: item.gstRate || 0,  // Include GST rate
            isComplimentary: item.isComplimentary || false  // Per-item complimentary flag
          })),
          subtotal, 
          gstAmount: gstAmount,  // Add GST amount
          tax: 0, serviceCharge: 0,
          totalAmount: total, grandTotal: total,
          discountAmount: getDiscountAmount(),
          isComplimentary, complimentaryReason,
          paymentMethod: 'cash', paymentStatus: 'completed', orderStatus: 'completed', status: 'completed',
          invoiceNumber: finalInvoiceNumber,
        }
        try {
          await localCache.saveBill({
            ...fallbackOrder,
            _id: finalInvoiceNumber, id: finalInvoiceNumber,
            savedAt: new Date().toISOString(), isSynced: false,
          })
        } catch (cacheErr) {
          console.warn('[BillGeneration] localCache.saveBill (fallback) failed:', cacheErr)
        }
        try {
          await offlineQueue.enqueue('bill', { ...fallbackOrder, existingOrderIds: orderData.existingOrderIds || [] })
        } catch (qErr) {
          console.warn('[BillGeneration] offlineQueue.enqueue (fallback) failed:', qErr)
        }
        navigate("/counter/menu", { 
          state: {
            customerName: orderData.customerName,
            phoneNumber: orderData.phoneNumber,
            selectedBranch: orderData.selectedBranch,
            date: new Date().toLocaleDateString(),
            time: new Date().toLocaleTimeString(),
            refreshTables: true
          }
        })
        return
      }
      
      // Check if this is from existing KOT orders (single or multiple)
      if (orderData.existingOrderId || orderData.existingOrderIds) {
        // Handle comprehensive bills with multiple KOTs
        if (orderData.isComprehensiveBill && orderData.existingOrderIds) {
         
          // IMPORTANT: Create a new consolidated order entry for the comprehensive bill
          // This ensures the sales report shows the correct discounted amount
          const subtotal = cartItems.reduce((sum, item) => item.isComplimentary ? sum : sum + (item.price * item.quantity), 0)
          
          // Calculate GST from items (same formula as thermal printer)
          const gstAmount = cartItems.reduce((sum, item) => {
            if (item.isComplimentary) return sum
            const rate = item.gstRate || 0
            return sum + ((item.price * item.quantity * rate) / 100)
          }, 0)
          
          const total = subtotal + gstAmount - getDiscountAmount()
          
          console.log('💰 Comprehensive bill amounts:', {
            subtotal,
            gstAmount,
            discountAmount: getDiscountAmount(),
            finalTotal: total,
            itemsWithGST: cartItems.map(i => ({ name: i.name, gstRate: i.gstRate }))
          })
          
          const consolidatedOrder = {
            userId: counterUser._id,
            customerName: orderData.customerName || "Walk-in Customer",
            phoneNumber: orderData.phoneNumber || "0000000000",
            branchId: orderData.selectedBranch._id,
            branchName: orderData.selectedBranch.name, // Add branch name for easier filtering
            categoryId: resolvedCategoryId, // Add category ID
            categoryName: resolvedCategoryName, // Use enhanced category detection
            // Remove invoiceId field - let backend handle it
            tableId: orderData.selectedTable?._id || orderData.selectedTable?.id || null,
            tableNumber: orderData.selectedTable?.tableNumber || orderData.selectedTable?.number || null,
            serverName: orderData.serverName || null, // Include server name from KOT
            items: cartItems.map(item => ({
              menuItemId: item._id || item.id || "507f1f77bcf86cd799439013",
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              gstRate: item.gstRate || 0,  // Include GST rate in items
              isComplimentary: item.isComplimentary || false  // Per-item complimentary flag
            })),
            subtotal: subtotal,
            discount: appliedDiscount ? {
              type: appliedDiscount.type,
              value: appliedDiscount.value,
              amount: getDiscountAmount(),
              remark: appliedDiscount.remark
            } : null,
            discountAmount: getDiscountAmount(),
            gstAmount: gstAmount,  // Add total GST amount
            tax: 0,
            serviceCharge: 0,
            totalAmount: total, // CRITICAL: This is the final amount after discount + GST
            grandTotal: total,
            isComplimentary,
            complimentaryReason,
            paymentMethod: 'cash',
            paymentStatus: 'completed',
            orderStatus: 'completed',
            status: 'completed',
            invoiceNumber: finalInvoiceNumber,
            // Comprehensive bill metadata
            isComprehensiveBill: true,
            isSplitBill: orderData.isSplitBill || false,
            kotNumbers: orderData.kotNumbers,
            originalKOTIds: orderData.existingOrderIds
          }

          // Offline deduplication check
          const isDup = await offlineQueue.isDuplicate('bill', 'invoiceNumber', finalInvoiceNumber).catch(() => false)

          // ── OFFLINE-FIRST: enqueue bill locally immediately ──
          // Mark all KOTs consolidated in cache right away so KOT list is clean on navigation back
          // For split bills, only mark fully consumed KOTs
          const uniqueOrderIds = [...new Set(orderData.existingOrderIds)]
          await Promise.all(uniqueOrderIds.map(id => localCache.markKOTConsolidated(id).catch(() => {})))
          if (orderData.selectedTable?.tableNumber) {
            // Always clear table KOT cache so refreshed data is fetched
            const _tKey = `table-${orderData.selectedTable.tableNumber}-kots`
            localStorage.removeItem(_tKey)
            localStorage.removeItem(`${_tKey}-expiry`)
          }
          if (!isDup) {
            await offlineQueue.enqueue('bill', {
              ...consolidatedOrder,
              existingOrderIds: orderData.existingOrderIds
            }).catch(() => {})
            for (let i = 0; i < orderData.existingOrderIds.length; i++) {
              const kotId = orderData.existingOrderIds[i]
              // Store kotNumber as fallback so syncManager can resolve offline IDs via server lookup
              const kotNumber = orderData.kotNumbers?.[i] || null
              await offlineQueue.enqueue('kot_status_update', { orderId: kotId, kotNumber, paymentStatus: 'consolidated' }).catch(() => {})
            }
          }

          // ── Handle partially consumed KOTs for split bills ──
          // Update KOTs that have some items billed and some remaining
          if (orderData.isSplitBill && orderData.partiallyConsumedKOTs && orderData.partiallyConsumedKOTs.length > 0) {
            for (const partialKOT of orderData.partiallyConsumedKOTs) {
              try {
                // Update this KOT on the server with only remaining items
                const remainingTotal = partialKOT.remainingItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
                await counterApi.request(`/counter-order/orders/${partialKOT.kotId}`, {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    items: partialKOT.remainingItems,
                    totalAmount: remainingTotal,
                    grandTotal: remainingTotal,
                    subtotal: remainingTotal
                  })
                })
                console.log(`✅ Updated partially consumed KOT ${partialKOT.kotId} with ${partialKOT.remainingItems.length} remaining items`)
              } catch (error) {
                console.error(`❌ Failed to update partially consumed KOT ${partialKOT.kotId}:`, error)
                // Enqueue for offline sync
                await offlineQueue.enqueue('kot_partial_update', {
                  orderId: partialKOT.kotId,
                  items: partialKOT.remainingItems,
                  totalAmount: partialKOT.remainingItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
                }).catch(() => {})
              }
            }
          }

          // ── Save bill to localCache immediately for offline sales report ──
          try {
            await localCache.saveBill({
              ...consolidatedOrder,
              _id: finalInvoiceNumber,
              id: finalInvoiceNumber,
              savedAt: new Date().toISOString(),
              isSynced: false,
            })
          } catch (cacheErr) {
            console.warn('[BillGeneration] localCache.saveBill (comprehensive) failed:', cacheErr)
          }

          // Trigger sync in background — syncManager handles upload sequentially (no race conditions)
          if (syncManager.isOnline()) {
            syncManager.triggerSync().catch(() => {})
          }
          
        } else if (orderData.existingOrderId) {
          // Handle single KOT (existing logic)
          // console.log('📝 Updating existing KOT order to completed:', orderData.existingOrderId)

          const subtotal = cartItems.reduce((sum, item) => item.isComplimentary ? sum : sum + (item.price * item.quantity), 0)
          
          // Calculate GST from items
          const gstAmount = cartItems.reduce((sum, item) => {
            if (item.isComplimentary) return sum
            const rate = item.gstRate || 0
            return sum + ((item.price * item.quantity * rate) / 100)
          }, 0)
          
          const total = subtotal + gstAmount - getDiscountAmount()

          const singleKOTOrder = {
            userId: counterUser._id,
            customerName: orderData.customerName || 'Walk-in Customer',
            phoneNumber: orderData.phoneNumber || '0000000000',
            branchId: orderData.selectedBranch._id,
            branchName: orderData.selectedBranch.name,
            categoryId: resolvedCategoryId,
            categoryName: resolvedCategoryName,
            tableId: orderData.selectedTable?._id || orderData.selectedTable?.id || null,
            tableNumber: orderData.selectedTable?.tableNumber || orderData.selectedTable?.number || null,
            serverName: orderData.serverName || null, // Include server name from KOT
            items: cartItems.map(item => ({
              menuItemId: item._id || item.id || "507f1f77bcf86cd799439013",
              name: item.name, quantity: item.quantity, price: item.price,
              gstRate: item.gstRate || 0,  // Include GST rate
              isComplimentary: item.isComplimentary || false  // Per-item complimentary flag
            })),
            subtotal, 
            gstAmount: gstAmount,  // Add GST amount
            tax: 0, serviceCharge: 0,
            totalAmount: total, grandTotal: total,
            discountAmount: getDiscountAmount(),
            discount: appliedDiscount ? { type: appliedDiscount.type, value: appliedDiscount.value, amount: getDiscountAmount(), remark: appliedDiscount.remark } : null,
            isComplimentary, complimentaryReason,
            paymentMethod: 'cash', paymentStatus: 'completed', orderStatus: 'completed', status: 'completed',
            invoiceNumber: finalInvoiceNumber,
            existingOrderIds: [orderData.existingOrderId],
          }

          // ── Save bill to localCache immediately for offline sales report ──
          try {
            await localCache.saveBill({
              ...singleKOTOrder,
              _id: finalInvoiceNumber, id: finalInvoiceNumber,
              savedAt: new Date().toISOString(), isSynced: false,
            })
          } catch (cacheErr) {
            console.warn('[BillGeneration] localCache.saveBill (single KOT) failed:', cacheErr)
          }

          // ── Enqueue bill for backend upload (was missing — this is why bills weren't uploading) ──
          try {
            const isDupSingle = await offlineQueue.isDuplicate('bill', 'invoiceNumber', finalInvoiceNumber).catch(() => false)
            if (!isDupSingle) {
              await offlineQueue.enqueue('bill', { ...singleKOTOrder, existingOrderIds: [orderData.existingOrderId] })
            }
          } catch (qErr) {
            console.warn('[BillGeneration] offlineQueue.enqueue (single KOT) failed:', qErr)
          }

          // Trigger sync in background
          if (syncManager.isOnline()) {
            syncManager.triggerSync().catch(() => {})
          }

          // Mark KOT consolidated in cache
          await localCache.markKOTConsolidated(orderData.existingOrderId).catch(() => {})

          // Update KOT payment status on server — do NOT set invoiceNumber here.
          // The bill upload (via syncManager) will mark the KOT as 'consolidated' after
          // the bill document is created. Setting invoiceNumber on the KOT before the bill
          // is uploaded causes _isAlreadySyncedBill to find the KOT and skip the bill upload.
          try {
            await counterApi.request(`/counter-order/orders/${orderData.existingOrderId}/payment-status`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ paymentStatus: 'consolidated' })
            })
          } catch (error) {
            console.error('❌ Failed to update KOT order status:', error)
            // Continue anyway
          }
        }
        
        // Free up the table (only if NOT a split bill — remaining items still on table)
        if (orderData.selectedTable && !orderData.isSplitBill) {
          try {
            // console.log(`🪑 Freeing up table: ${orderData.selectedTable.tableNumber || orderData.selectedTable.number}`)
            await counterApi.request(`/table/${orderData.selectedTable._id || orderData.selectedTable.id}`, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                status: 'available'
              })
            })
            // console.log('✅ Table freed successfully')
          } catch (error) {
            console.error('❌ Failed to free table:', error)
          }
        }
      } else {
        // Create new order (original flow for non-KOT orders)
        // SKIP invoice creation since we already have the bill number from frontend
        // console.log('📄 Skipping invoice creation - using existing bill number:', finalInvoiceNumber)
        
        // console.log('📝 Creating order directly...')
        const subtotal = cartItems.reduce((sum, item) => item.isComplimentary ? sum : sum + (item.price * item.quantity), 0)
        
        // Calculate GST from items
        const gstAmount = cartItems.reduce((sum, item) => {
          if (item.isComplimentary) return sum
          const rate = item.gstRate || 0
          return sum + ((item.price * item.quantity * rate) / 100)
        }, 0)
        
        const total = subtotal + gstAmount - getDiscountAmount()
        
        const orderToSave = {
          userId: counterUser._id,
          customerName: orderData.customerName || "Walk-in Customer",
          phoneNumber: orderData.phoneNumber || "0000000000",
          branchId: orderData.selectedBranch._id,
          branchName: orderData.selectedBranch.name, // Add branch name for easier filtering
          categoryId: resolvedCategoryId, // Add category ID
          categoryName: resolvedCategoryName, // Use enhanced category detection
          // Skip invoiceId since we're not creating an invoice
          tableId: orderData.selectedTable?._id || orderData.selectedTable?.id || null,
          tableNumber: orderData.selectedTable?.tableNumber || orderData.selectedTable?.number || null,
          serverName: orderData.serverName || null, // Include server name from KOT
          items: cartItems.map(item => ({
            menuItemId: item._id || item.id || "507f1f77bcf86cd799439013",
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            gstRate: item.gstRate || 0,  // Include GST rate
            isComplimentary: item.isComplimentary || false  // Per-item complimentary flag
          })),
          subtotal: subtotal,
          gstAmount: gstAmount,  // Add GST amount
          discount: appliedDiscount ? {
            type: appliedDiscount.type,
            value: appliedDiscount.value,
            amount: getDiscountAmount(),
            remark: appliedDiscount.remark
          } : null,
          discountAmount: getDiscountAmount(),
          tax: 0,
          serviceCharge: 0,
          totalAmount: total,
          grandTotal: total,
          isComplimentary,
          complimentaryReason,
          paymentMethod: 'cash',
          paymentStatus: 'completed',
          orderStatus: 'completed',
          status: 'completed',
          invoiceNumber: finalInvoiceNumber
        }

        // ── OFFLINE-FIRST: save bill to localCache immediately ──
        try {
          await localCache.saveBill({
            ...orderToSave,
            _id: finalInvoiceNumber,
            id: finalInvoiceNumber,
            savedAt: new Date().toISOString(),
            isSynced: false,
          })
        } catch (cacheErr) {
          console.warn('[BillGeneration] localCache.saveBill failed:', cacheErr)
        }

        // Enqueue for sync — syncManager will upload when online
        try {
          const isDupDirect = await offlineQueue.isDuplicate('bill', 'invoiceNumber', finalInvoiceNumber)
          if (!isDupDirect) {
            await offlineQueue.enqueue('bill', { ...orderToSave, existingOrderIds: [] })
          }
        } catch (qErr) {
          console.warn('[BillGeneration] offlineQueue.enqueue failed:', qErr)
        }

        // Trigger sync in background — syncManager handles upload sequentially (no race conditions)
        if (syncManager.isOnline()) {
          syncManager.triggerSync().catch(() => {})
        }

        // Free up the table if one was selected — fire-and-forget
        if (orderData.selectedTable) {
          counterApi.request(`/table/${orderData.selectedTable._id || orderData.selectedTable.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'available' }),
            _timeout: 3000
          }).catch(() => {})
        }
      }
    } catch (error) {
      console.error('❌ Failed to save order:', error)
      console.error('❌ Error details:', {
        message: error.message,
        stack: error.stack
      })
      
      // Even if order saving fails, try to update KOT status as fallback
      if (orderData.existingOrderIds && orderData.existingOrderIds.length > 0) {
        // console.log('🔄 Attempting emergency fallback KOT status updates due to order save failure...')
        try {
          const fallbackPromises = orderData.existingOrderIds.map(async (kotId) => {
            try {
              // console.log('🔄 Emergency: Updating KOT with discount info and marking as consolidated:', kotId)
              
              // Calculate discount amounts for fallback
              const subtotal = cartItems.reduce((sum, item) => item.isComplimentary ? sum : sum + (item.price * item.quantity), 0)
              const total = subtotal - getDiscountAmount()
              
              const updateResponse = await counterApi.request(`/counter-order/orders/${kotId}`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  paymentStatus: 'consolidated', // NEW: Use 'consolidated' instead of 'completed'
                  status: 'consolidated', // NEW: Use 'consolidated' instead of 'completed'
                  invoiceNumber: finalInvoiceNumber,
                  // CRITICAL: Update the amounts with discount applied
                  totalAmount: total, // Final amount after discount
                  grandTotal: total,
                  subtotal: subtotal,
                  discountAmount: getDiscountAmount(),
                  discount: appliedDiscount ? {
                    type: appliedDiscount.type,
                    value: appliedDiscount.value,
                    amount: getDiscountAmount(),
                    remark: appliedDiscount.remark
                  } : null,
                  isPartOfComprehensiveBill: true // NEW: Flag to indicate this is part of a comprehensive bill
                })
              })
              // console.log('✅ Emergency fallback KOT update with discount and consolidated status successful:', kotId, updateResponse)
              return updateResponse
            } catch (fallbackError) {
              console.error('❌ Emergency fallback KOT update failed:', kotId, fallbackError)
              return null
            }
          })
          
          await Promise.all(fallbackPromises)
          // console.log('🔄 Emergency fallback KOT updates with discount and consolidated status completed')
        } catch (emergencyError) {
          console.error('❌ Emergency fallback also failed:', emergencyError)
        }
      }
      
      // Continue anyway - don't block the user
    }


    
    navigate("/counter/menu", { 
      state: {
        customerName: "Walk-in Customer",
        phoneNumber: "0000000000",
        selectedBranch: orderData.selectedBranch,
        selectedCategory: orderData.selectedCategory,
        selectedTable: null,
        date: new Date().toLocaleDateString('en-IN'),
        time: new Date().toLocaleTimeString('en-IN', { 
          hour12: true,
          hour: '2-digit',
          minute: '2-digit'
        }),
        cartItems: [],
        refreshTables: true, // Flag to refresh tables immediately
        refreshKOTs: true // Flag to refresh KOT list immediately
      }
    })
  }

  const handleCancel = async () => {
    // Cancel the current order and start fresh
    // For KOT orders, don't generate a new invoice number when canceling
    // The KOT number should remain available for the next order

    
    navigate("/counter/menu", { 
      state: {
        customerName: "Walk-in Customer",
        phoneNumber: "0000000000",
        selectedBranch: orderData.selectedBranch,
        selectedCategory: orderData.selectedCategory, // Keep the same category
        date: new Date().toLocaleDateString('en-IN'),
        time: new Date().toLocaleTimeString('en-IN', { 
          hour12: true,
          minute: '2-digit'
        }),
        cartItems: [], // Clear cart
        refreshTables: true, // Flag to refresh tables immediately
        refreshKOTs: true // Flag to refresh KOT list immediately
      }
    })
  }

  const handlePrint = async () => {
    if (printing) return // Prevent multiple simultaneous print attempts
    
    // 🔒 LOCK SYSTEM: Check if bill printing is locked (prevents duplicate prints)
    const billPrintLock = localStorage.getItem('billPrintLock')
    const lockTimestamp = localStorage.getItem('billPrintLockTime')
    
    if (billPrintLock === 'true') {
      // Check if lock is stale
      if (lockTimestamp) {
        const lockAge = Date.now() - parseInt(lockTimestamp)
        if (lockAge < 30000) { // Lock is fresh (less than 30 seconds)
          // console.log('🔒 Print Bill blocked - bill printing is locked (already printing)')
          return
        } else {
          // console.log('🔓 Lock is stale, proceeding with print')
          localStorage.removeItem('billPrintLock')
          localStorage.removeItem('billPrintLockTime')
        }
      } else {
        // No timestamp, remove stale lock
        localStorage.removeItem('billPrintLock')
      }
    }
    
    // 🔒 LOCK SYSTEM: Activate lock to prevent duplicate prints
    // console.log('🔒 Activating bill print lock...')
    localStorage.setItem('billPrintLock', 'true')
    localStorage.setItem('billPrintLockTime', Date.now().toString())
    
    setPrinting(true)
    setPrintError(null)
    
    try {
      // CRITICAL FIX: Generate bill number BEFORE printing if not already generated
      let finalInvoiceNumber = invoiceNumber;
      if ((!finalInvoiceNumber || finalInvoiceNumber === 'PENDING') && !billNumberGenerated) {
        // console.log('🧾 Print Bill: Generating bill number before printing...')
        try {
          finalInvoiceNumber = await getNextBillNumber(
            orderData.selectedBranch._id, 
            resolvedCategoryName
          );
          // console.log('🧾 Print Bill: Generated bill number:', finalInvoiceNumber)
          setInvoiceNumber(finalInvoiceNumber)
          setBillNumberGenerated(true) // Mark as generated to prevent double generation
          
          // Wait a moment for state to update
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          console.error('❌ Failed to generate bill number for printing:', error)
          finalInvoiceNumber = '001' // Fallback
        }
      } else {
        console.log('🧾 Print Bill: Using existing bill number:', finalInvoiceNumber)
      }

      // Get printer settings from localStorage
      const printerSettings = JSON.parse(localStorage.getItem('thermalPrinterSettings') || '{}')
      
      const subtotal = cartItems.reduce((sum, item) => item.isComplimentary ? sum : sum + (item.price * item.quantity), 0)
      const total = subtotal - getDiscountAmount()

      // DEBUG: Check if cart items have gstRate
      console.log('🖨️ BillGeneration handlePrint - Cart items being sent to thermal printer:')
      cartItems.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.name} - gstRate: ${item.gstRate || 'MISSING'}, price: ₹${item.price}, qty: ${item.quantity}`)
      })

      const printData = {
        selectedBranch: orderData.selectedBranch,
        selectedTable: orderData.selectedTable,
        selectedCategory: orderData.selectedCategory,
        invoiceNumber: finalInvoiceNumber, // Use the generated bill number
        billNumber: finalInvoiceNumber, // Use the generated bill number
        date: orderData.date,
        time: orderData.time,
        customerName: orderData.customerName,
        phoneNumber: orderData.phoneNumber,
        cartItems: cartItems,
        subtotal: subtotal, // Add explicit subtotal
        total: total,
        discountAmount: getDiscountAmount(),
        discountRemark: appliedDiscount?.remark || '',
        discount: appliedDiscount,
        paymentMethod: 'Pending',
        amountReceived: 0,
        change: 0,
        // Comprehensive bill information
        isComprehensiveBill: orderData.isComprehensiveBill,
        kotNumbers: orderData.kotNumbers,
        // Complimentary bill information
        isComplimentary: isComplimentary,
        complimentaryReason: complimentaryReason
      }

      // console.log('🖨️ BillGeneration handlePrint - Sending printData to thermal printer:', {
      //   selectedTable: printData.selectedTable,
      //   selectedCategory: printData.selectedCategory,
      //   hasTable: !!(printData.selectedTable?.tableNumber || printData.selectedTable?.number),
      //   categoryName: printData.selectedCategory?.name,
      //   discountAmount: printData.discountAmount,
      //   appliedDiscount: printData.discount,
      //   // CRITICAL DEBUG: Log the invoice numbers being sent
      //   invoiceNumber: printData.invoiceNumber,
      //   billNumber: printData.billNumber,
      //   finalInvoiceNumber: finalInvoiceNumber,
      //   originalInvoiceNumber: invoiceNumber
      // });

      // Use thermal printer service directly
      try {
        const options = {
          method: 'network',
          printerIP: printerSettings.ip || '192.168.1.100',
          port: printerSettings.port || 9100
        }

        const result = await Promise.race([
          thermalPrinter.printBill(printData, options),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Print operation timed out after 5 seconds')), 5000)
          )
        ])
        
        // Show success message with method used
        if (result && result.method) {
          const methodMessages = {
            'popup-window': 'Bill printed using browser (thermal printer not found)',
            'current-window': 'Bill printed using browser (thermal printer not found)', 
            'current-window-fallback': 'Bill printed using browser (thermal printer not found)',
            'network': 'Bill printed to thermal printer successfully!',
            'usb': 'Bill printed to USB thermal printer successfully!'
          };
          const message = methodMessages[result.method] || 'Bill printed successfully!';
          setPrintError({ type: 'success', message });
        } else {
          setPrintError({ type: 'success', message: 'Bill printed successfully!' });
        }
        
        // Update table status to available after successful print
        await updateTableStatusToAvailable();
      } catch (thermalError) {
        // console.log('Thermal printing failed:', thermalError.message)
        setPrintError({ type: 'success', message: 'Bill printed using browser fallback' });
        
        // Update table status to available after print attempt
        await updateTableStatusToAvailable();
      }
      
      // CRITICAL FIX: Complete the order after printing (same as Enter key)
      // console.log('🖨️ Print Bill: Completing order after successful print...');
      
      // Wait a moment for print to complete, then handle order completion
      setTimeout(async () => {
        try {
          await handleDone(finalInvoiceNumber); // Pass the bill number to prevent double generation
        } catch (error) {
          console.error('❌ Error completing order after print:', error);
        }
      }, 1000);
      
      // Clear success message after 3 seconds
      setTimeout(() => setPrintError(null), 3000)
      
    } catch (error) {
      console.error('Print error:', error)
      setPrintError({ 
        type: 'error', 
        message: error.message || 'Failed to print bill. Please try again.' 
      })
      
      // 🔒 LOCK SYSTEM: Release lock on error
      console.log('🔓 Releasing bill print lock due to error')
      localStorage.removeItem('billPrintLock')
      localStorage.removeItem('billPrintLockTime')
      
      // Clear error message after 5 seconds
      setTimeout(() => setPrintError(null), 5000)
    } finally {
      setPrinting(false)
    }
  }

  // Direct print to thermal printer (bypass browser preview) - for Enter key
  const handleDirectPrint = async () => {
    if (printing) return
    
    setPrinting(true)
    
    try {
      // Get printer settings from localStorage
      const printerSettings = JSON.parse(localStorage.getItem('thermalPrinterSettings') || '{}')
      
      const subtotal = cartItems.reduce((sum, item) => item.isComplimentary ? sum : sum + (item.price * item.quantity), 0)
      const discountAmount = getDiscountAmount()
      const total = subtotal - discountAmount

      // console.log('🖨️ Enter Key Print - Discount Debug:', {
      //   subtotal,
      //   discountAmount,
      //   total,
      //   appliedDiscount,
      //   discountState: {
      //     showDiscountPopup,
      //     discountType,
      //     discountValue,
      //     discountRemark
      //   }
      // })

      const printData = {
        selectedBranch: orderData.selectedBranch,
        selectedTable: orderData.selectedTable,
        selectedCategory: orderData.selectedCategory,
        invoiceNumber: invoiceNumber || orderData.billNumber || orderData.invoiceNumber,
        billNumber: invoiceNumber || orderData.billNumber || orderData.invoiceNumber, // Add billNumber field for thermal printer
        date: orderData.date,
        time: orderData.time,
        customerName: orderData.customerName,
        phoneNumber: orderData.phoneNumber,
        cartItems: cartItems,
        subtotal: subtotal, // Add explicit subtotal
        total: total,
        discountAmount: discountAmount,
        discountRemark: appliedDiscount?.remark || '',
        discount: appliedDiscount,
        paymentMethod: 'Pending',
        amountReceived: 0,
        change: 0,
        // Comprehensive bill information
        isComprehensiveBill: orderData.isComprehensiveBill,
        kotNumbers: orderData.kotNumbers,
        // Complimentary bill information
        isComplimentary: isComplimentary,
        complimentaryReason: complimentaryReason
      }

      // console.log('🖨️ BillGeneration handleDirectPrint - Sending printData to thermal printer:', {
      //   selectedTable: printData.selectedTable,
      //   selectedCategory: printData.selectedCategory,
      //   hasTable: !!(printData.selectedTable?.tableNumber || printData.selectedTable?.number),
      //   categoryName: printData.selectedCategory?.name,
      //   discountAmount: printData.discountAmount,
      //   appliedDiscount: printData.discount,
      //   totalAfterDiscount: printData.total,
      //   // CRITICAL DEBUG: Log the invoice numbers being sent
      //   invoiceNumber: printData.invoiceNumber,
      //   billNumber: printData.billNumber,
      //   orderDataBillNumber: orderData.billNumber,
      //   orderDataInvoiceNumber: orderData.invoiceNumber
      // });

      // Use thermal printer service directly
      try {
        const options = {
          method: 'network',
          printerIP: printerSettings.ip || '192.168.1.100',
          port: printerSettings.port || 9100
        }

        await Promise.race([
          thermalPrinter.printBill(printData, options),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Thermal printer service timeout')), 3000)
          )
        ])
        
        // console.log('✅ Enter key: Bill printed via thermal printer service')
        
        // Update table status to available after successful print
        await updateTableStatusToAvailable();
        
      } catch (thermalError) {
        console.log('❌ Enter key: Thermal printing failed:', thermalError.message)
        // Silently fail for Enter key - don't show error to user
      }
      
    } catch (error) {
      console.error('❌ Enter key: All printing methods failed:', error)
      // Silently fail for Enter key - don't show error to user
    } finally {
      setPrinting(false)
    }
  }

  // Direct print to thermal printer with specific bill number - for Enter key
  const handleDirectPrintWithBillNumber = async (billNumber) => {
    if (printing) return
    
    setPrinting(true)
    
    try {
      // Get printer settings from localStorage
      const printerSettings = JSON.parse(localStorage.getItem('thermalPrinterSettings') || '{}')
      
      const subtotal = cartItems.reduce((sum, item) => item.isComplimentary ? sum : sum + (item.price * item.quantity), 0)
      const discountAmount = getDiscountAmount()
      const total = subtotal - discountAmount

      // console.log('🖨️ Enter Key Print with Bill Number - Debug:', {
      //   billNumber,
      //   subtotal,
      //   discountAmount,
      //   total,
      //   appliedDiscount
      // })

      const printData = {
        selectedBranch: orderData.selectedBranch,
        selectedTable: orderData.selectedTable,
        selectedCategory: orderData.selectedCategory,
        invoiceNumber: billNumber, // Use the specific bill number
        billNumber: billNumber, // Use the specific bill number
        date: orderData.date,
        time: orderData.time,
        customerName: orderData.customerName,
        phoneNumber: orderData.phoneNumber,
        cartItems: cartItems,
        subtotal: subtotal, // Add explicit subtotal
        total: total,
        discountAmount: discountAmount,
        discountRemark: appliedDiscount?.remark || '',
        discount: appliedDiscount,
        paymentMethod: 'Pending',
        amountReceived: 0,
        change: 0,
        // Comprehensive bill information
        isComprehensiveBill: orderData.isComprehensiveBill,
        kotNumbers: orderData.kotNumbers,
        // Complimentary bill information
        isComplimentary: isComplimentary,
        complimentaryReason: complimentaryReason
      }

      // console.log('🖨️ BillGeneration handleDirectPrintWithBillNumber - Sending printData to thermal printer:', {
      //   selectedTable: printData.selectedTable,
      //   selectedCategory: printData.selectedCategory,
      //   hasTable: !!(printData.selectedTable?.tableNumber || printData.selectedTable?.number),
      //   categoryName: printData.selectedCategory?.name,
      //   discountAmount: printData.discountAmount,
      //   appliedDiscount: printData.discount,
      //   totalAfterDiscount: printData.total,
      //   // CRITICAL DEBUG: Log the invoice numbers being sent
      //   invoiceNumber: printData.invoiceNumber,
      //   billNumber: printData.billNumber,
      //   finalBillNumber: billNumber
      // });

      // Use thermal printer service directly
      try {
        const options = {
          method: 'network',
          printerIP: printerSettings.ip || '192.168.1.100',
          port: printerSettings.port || 9100
        }

        await Promise.race([
          thermalPrinter.printBill(printData, options),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Thermal printer service timeout')), 3000)
          )
        ])
        
        // console.log('✅ Enter key: Bill printed via thermal printer service with bill number:', billNumber)
        
        // Update table status to available — fire-and-forget, don't block
        updateTableStatusToAvailable().catch(() => {})

      } catch (thermalError) {
        console.log('❌ Enter key: Thermal printing failed:', thermalError.message)
        // Silently fail for Enter key - don't show error to user
        // Still try to update table status
        updateTableStatusToAvailable().catch(() => {})
      }
      
    } catch (error) {
      console.error('❌ Enter key: All printing methods failed:', error)
      // Silently fail for Enter key - don't show error to user
    } finally {
      setPrinting(false)
      // 🔒 LOCK SYSTEM: Release lock — navigation will happen after handleDone
      localStorage.removeItem('billPrintLock')
      localStorage.removeItem('billPrintLockTime')
    }
  }

  const handlePrintSettings = () => {
    // Open print settings modal/page
    navigate("/counter/print-settings", { 
      state: { returnTo: "/counter/bill-generation", orderData } 
    })
  }

  const handleRemoveItem = (indexToRemove) => {
    const updatedItems = cartItems.filter((_, index) => index !== indexToRemove)
    setCartItems(updatedItems)
    
    // If no items left, go back to menu
    if (updatedItems.length === 0) {
      navigate("/counter/menu", { 
        state: {
          customerName: orderData.customerName,
          phoneNumber: orderData.phoneNumber,
          selectedBranch: orderData.selectedBranch,
          invoiceNumber: orderData.invoiceNumber,
          date: orderData.date,
          time: orderData.time,
          cartItems: []
        }
      })
    }
  }

  const handleQuantityChange = (index, newQuantity) => {
    // Parse and validate the quantity
    let quantity = parseInt(newQuantity)
    
    // Handle NaN or invalid numbers
    if (isNaN(quantity) || quantity < 0) {
      quantity = 0
    }
    
    const updatedItems = [...cartItems]
    
    if (quantity === 0) {
      // Remove item if quantity is 0
      updatedItems.splice(index, 1)
    } else {
      // Update quantity
      updatedItems[index] = {
        ...updatedItems[index],
        quantity: quantity
      }
    }
    
    setCartItems(updatedItems)
    
    // If no items left, go back to menu
    if (updatedItems.length === 0) {
      navigate("/counter/menu", { 
        state: {
          customerName: orderData.customerName,
          phoneNumber: orderData.phoneNumber,
          selectedBranch: orderData.selectedBranch,
          invoiceNumber: orderData.invoiceNumber,
          date: orderData.date,
          time: orderData.time,
          cartItems: []
        }
      })
    }
  }

  const handleBack = () => {
    // For Restaurant orders, clear cart items to prevent "Save KOT" prompts
    // For Self Service orders, preserve cart items
    const isRestaurantOrder = orderData.selectedTable && (orderData.selectedTable.tableNumber || orderData.selectedTable.number);
    
    // console.log('🔙 handleBack called:', {
    //   isRestaurantOrder,
    //   selectedTable: orderData.selectedTable,
    //   cartItemsCount: cartItems.length
    // });
    
    navigate("/counter/menu", { 
      state: {
        ...orderData,
        cartItems: isRestaurantOrder ? [] : cartItems, // Clear cart for Restaurant, preserve for Self Service
        // Add refresh flags to ensure clean state
        refreshTables: true,
        refreshKOTs: true
      }
    })
  }

  // Calculate discount amount
  const getDiscountAmount = () => {
    if (!appliedDiscount) return 0
    
    if (appliedDiscount.type === "percentage") {
      return (subtotal * appliedDiscount.value) / 100
    } else {
      return Math.min(appliedDiscount.value, subtotal) // Don't allow discount more than total
    }
  }

  // Calculate final amount after discount
  const getFinalAmount = () => {
    // Total = Subtotal + GST - Discount (subtotal already excludes complimentary items)
    const gstAmount = cartItems.reduce((sum, item) => {
      if (item.isComplimentary) return sum
      const rate = item.gstRate || 0
      return sum + ((item.price * item.quantity * rate) / 100)
    }, 0)
    return subtotal + gstAmount - getDiscountAmount()
  }

  // Handle discount application
  const handleApplyDiscount = () => {
    const value = parseFloat(discountValue)
    if (isNaN(value) || value <= 0) {
      alert("Please enter a valid discount value")
      return
    }

    if (discountType === "percentage" && value > 100) {
      alert("Percentage discount cannot be more than 100%")
      return
    }

    if (discountType === "amount" && value > subtotal) {
      alert("Discount amount cannot be more than total amount")
      return
    }

    if (!discountRemark.trim()) {
      alert("Please enter a remark for the discount")
      return
    }

    setAppliedDiscount({
      type: discountType,
      value: value,
      remark: discountRemark.trim()
    })

    // Close popup and reset values
    setShowDiscountPopup(false)
    setDiscountValue("")
    setDiscountRemark("")
  }

  // Remove applied discount
  const handleRemoveDiscount = () => {
    setAppliedDiscount(null)
  }

  // Toggle complimentary for individual item
  const handleToggleItemComplimentary = (index) => {
    setCartItems(prev => prev.map((item, i) => 
      i === index ? { ...item, isComplimentary: !item.isComplimentary } : item
    ))
  }

  // Calculate subtotal once (exclude complimentary items)
  const subtotal = cartItems.reduce((sum, item) => {
    if (item.isComplimentary) return sum
    return sum + (item.price * item.quantity)
  }, 0)
  
  // Calculate GST from items (exclude complimentary items)
  const gstAmount = cartItems.reduce((sum, item) => {
    if (item.isComplimentary) return sum
    const rate = item.gstRate || 0
    const itemGST = ((item.price * item.quantity * rate) / 100)
    console.log(`💰 BillGen Display - Item: ${item.name}, gstRate: ${rate}, itemGST: ₹${itemGST.toFixed(2)}`)
    return sum + itemGST
  }, 0)
  console.log(`💰 BillGen Display - Total GST Amount: ₹${gstAmount.toFixed(2)}`)
  
  // Calculate complimentary items total (for display)
  const complimentaryTotal = cartItems.reduce((sum, item) => {
    if (!item.isComplimentary) return sum
    return sum + (item.price * item.quantity)
  }, 0)

  // Total = Subtotal + GST - Discount
  const total = subtotal + gstAmount - getDiscountAmount()

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

  return (
    <>
    <div className="counter-container">
      <div className="counter-card">

        {/* ── Clean Bill Header ── */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingBottom: '16px',
          marginBottom: '16px',
          borderBottom: '2px solid #e8ddd8'
        }}>
          <img
            src={hotelViratLogo}
            alt="Jagali Koota"
            style={{ width: '80px', height: '80px', objectFit: 'contain', borderRadius: '10px', marginBottom: '10px' }}
          />
          <h2 style={{ margin: '0 0 2px 0', fontSize: '1.4rem', fontWeight: '800', color: '#69221b', letterSpacing: '-0.3px' }}>
            JAGALI KOOTA
          </h2>
          <p style={{ margin: '0', fontSize: '0.8rem', color: '#a07060', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Restaurant &amp; Bar
          </p>
        </div>

        {/* Bill Details */}
        <div style={{
          background: '#faf8f6',
          padding: '16px',
          borderRadius: '10px',
          border: '1px solid #e8ddd8',
          marginBottom: '16px'
        }}>
          {/* Invoice Info */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: orderData.selectedTable ? '1fr 1fr 1fr' : '1fr 1fr',
            gap: '12px',
            marginBottom: '12px'
          }}>
            <div>
              <p style={{ margin: '0 0 2px 0', fontSize: '0.75rem', color: '#a07060', fontWeight: '600', textTransform: 'uppercase' }}>Invoice No</p>
              <p style={{ margin: '0', fontWeight: '700', color: '#69221b', fontSize: '0.95rem' }}>
                {invoiceNumber || 'Generating...'}
              </p>
            </div>
            <div>
              <p style={{ margin: '0 0 2px 0', fontSize: '0.75rem', color: '#a07060', fontWeight: '600', textTransform: 'uppercase' }}>Date &amp; Time</p>
              <p style={{ margin: '0', fontWeight: '600', color: '#2d1a18', fontSize: '0.85rem' }}>{orderData.date}</p>
              <p style={{ margin: '0', fontWeight: '500', color: '#4a5568', fontSize: '0.8rem' }}>{orderData.time}</p>
            </div>
            {orderData.selectedTable && (
              <div>
                <p style={{ margin: '0 0 2px 0', fontSize: '0.75rem', color: '#a07060', fontWeight: '600', textTransform: 'uppercase' }}>Table</p>
                <p style={{ margin: '0', fontWeight: '700', color: '#2d1a18', fontSize: '0.95rem', display:'flex', alignItems:'center', gap:'5px' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#69221b" strokeWidth="2"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><line x1="12" y1="7" x2="12" y2="17"/></svg>
                  {orderData.selectedTable.tableNumber || orderData.selectedTable.number}
                </p>
              </div>
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e8ddd8', margin: '12px 0' }} />

          <hr style={{ border: 'none', borderTop: '1px solid #e8ddd8', margin: '12px 0' }} />

          {/* Bill Generation Time */}
          <div style={{
            background: '#f0f9ff',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #bfdbfe',
            marginBottom: '16px',
            fontSize: '0.875rem',
            color: '#1e40af'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{display:'flex',alignItems:'center',gap:'6px'}}><ClipboardList size={15}/> Bill Generated:</span>
              <span style={{ fontWeight: '600' }}>
                {new Date().toLocaleDateString('en-IN')} at {new Date().toLocaleTimeString('en-IN', {
                  hour12: true,
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>

          {/* Comprehensive Bill Info - Show KOT numbers when multiple KOTs are combined */}
          {orderData.isComprehensiveBill && orderData.kotNumbers && orderData.kotNumbers.length > 1 && (
            <div style={{ 
              background: '#f0f9ff', 
              padding: '12px', 
              borderRadius: '8px',
              border: '1px solid #0ea5e9',
              marginBottom: '16px'
            }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.875rem', color: '#0369a1', fontWeight: '600' }}>
                📋 Comprehensive Bill - Combined KOTs:
              </p>
              <p style={{ margin: '0', fontSize: '0.875rem', color: '#0369a1' }}>
                {orderData.kotNumbers.join(', ')} ({orderData.kotNumbers.length} KOTs combined)
              </p>
            </div>
          )}

          {/* Customer Info - REMOVED */}

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '16px 0' }} />

          {/* Items */}
          <div style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#1a202c' }}>
              Order Items
            </h3>
            {cartItems.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '20px', 
                color: '#718096',
                fontStyle: 'italic'
              }}>
                No items in cart
              </div>
            ) : (
              cartItems.map((item, index) => (
                <div key={index} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '12px 0',
                  borderBottom: index < cartItems.length - 1 ? '1px solid #e2e8f0' : 'none',
                  background: item.isComplimentary ? '#fefce8' : 'transparent',
                  borderRadius: item.isComplimentary ? '8px' : '0',
                  paddingLeft: item.isComplimentary ? '12px' : '0',
                  paddingRight: item.isComplimentary ? '12px' : '0',
                  transition: 'all 0.2s'
                }}>
                  {/* Complimentary Checkbox */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    marginRight: '12px'
                  }}>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      cursor: 'pointer',
                      title: 'Mark as complimentary'
                    }}>
                      <input
                        type="checkbox"
                        checked={item.isComplimentary || false}
                        onChange={() => handleToggleItemComplimentary(index)}
                        style={{
                          width: '16px',
                          height: '16px',
                          cursor: 'pointer',
                          accentColor: '#f59e0b'
                        }}
                        title="Mark as complimentary (free item)"
                      />
                    </label>
                  </div>

                  <div style={{ flex: 1 }}>
                    <p style={{ 
                      margin: '0 0 4px 0', 
                      fontWeight: '500', 
                      color: item.isComplimentary ? '#92400e' : '#1a202c',
                      textDecoration: item.isComplimentary ? 'line-through' : 'none'
                    }}>
                      {item.name} {item.isComplimentary && <span style={{ fontSize: '0.75rem', background: '#fbbf24', color: '#78350f', padding: '2px 6px', borderRadius: '4px', marginLeft: '6px', textDecoration: 'none', display: 'inline-block' }}>🎁 FREE</span>}
                    </p>
                    <p style={{ margin: '0', fontSize: '0.875rem', color: '#718096' }}>
                      ₹{item.price.toFixed(2)} each
                    </p>
                  </div>
                  
                  {/* Quantity Controls */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    marginRight: '16px'
                  }}>
                    <button
                      onClick={() => handleQuantityChange(index, item.quantity - 1)}
                      style={{
                        background: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: '#374151',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.background = '#e5e7eb'
                        e.target.style.borderColor = '#9ca3af'
                      }}
                      onMouseOut={(e) => {
                        e.target.style.background = '#f3f4f6'
                        e.target.style.borderColor = '#d1d5db'
                      }}
                      title="Decrease quantity"
                    >
                      -
                    </button>
                    
                    <div style={{
                      minWidth: '40px',
                      textAlign: 'center',
                      fontSize: '1rem',
                      fontWeight: '600',
                      color: '#1f2937',
                      padding: '4px 8px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px'
                    }}>
                      {item.quantity}
                    </div>
                    
                    <button
                      onClick={() => handleQuantityChange(index, item.quantity + 1)}
                      style={{
                        background: '#3b82f6',
                        border: '1px solid #3b82f6',
                        borderRadius: '6px',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: 'white',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.background = '#2563eb'
                        e.target.style.borderColor = '#2563eb'
                      }}
                      onMouseOut={(e) => {
                        e.target.style.background = '#3b82f6'
                        e.target.style.borderColor = '#3b82f6'
                      }}
                      title="Increase quantity"
                    >
                      +
                    </button>
                  </div>
                  
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px' 
                  }}>
                    <div style={{ 
                      fontWeight: '600', 
                      color: item.isComplimentary ? '#9ca3af' : '#1a202c',
                      minWidth: '80px',
                      textAlign: 'right',
                      textDecoration: item.isComplimentary ? 'line-through' : 'none'
                    }}>
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </div>
                    <button
                      onClick={() => handleRemoveItem(index)}
                      style={{
                        background: '#dc2626',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        fontWeight: '500',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) => e.target.style.background = '#b91c1c'}
                      onMouseOut={(e) => e.target.style.background = '#dc2626'}
                      title="Remove this item completely"
                    >
                      <span style={{display:'flex',alignItems:'center',gap:'4px'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Remove</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '16px 0' }} />

          {/* Total with Discount - Enhanced */}
          <div style={{ marginBottom: '16px' }}>
            {/* Subtotal */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              fontSize: '1.1rem',
              fontWeight: '500',
              color: '#4a5568',
              marginBottom: '8px'
            }}>
              <span>Subtotal:</span>
              <span>₹{subtotal.toFixed(2)}</span>
            </div>

            {/* Complimentary Items Total */}
            {complimentaryTotal > 0 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                fontSize: '0.9rem',
                color: '#d97706',
                marginBottom: '8px',
                fontStyle: 'italic'
              }}>
                <span>🎁 Complimentary Items ({cartItems.filter(i => i.isComplimentary).length}):</span>
                <span>-₹{complimentaryTotal.toFixed(2)}</span>
              </div>
            )}
            
            {/* GST Amount */}
            {gstAmount > 0 && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                fontSize: '1rem',
                color: '#4a5568',
                marginBottom: '8px'
              }}>
                <span>GST Amount:</span>
                <span>₹{gstAmount.toFixed(2)}</span>
              </div>
            )}
            
            {/* Discount (if applied) */}
            {appliedDiscount && (
              <>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  fontSize: '1rem',
                  color: '#e53e3e',
                  marginBottom: '4px'
                }}>
                  <span>
                    Discount ({appliedDiscount.type === 'percentage' ? `${appliedDiscount.value}%` : `₹${appliedDiscount.value}`}):
                  </span>
                  <span>-₹{getDiscountAmount().toFixed(2)}</span>
                </div>
                <div style={{ 
                  fontSize: '0.875rem',
                  color: '#718096',
                  fontStyle: 'italic',
                  marginBottom: '8px',
                  textAlign: 'right'
                }}>
                  Reason: {appliedDiscount.remark}
                </div>
              </>
            )}
            
            <hr style={{ border: 'none', borderTop: '2px solid #1a202c', margin: '12px 0' }} />
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#1a202c'
            }}>
              <span>Total:</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
          </div>

          {/* Discount Controls */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            marginBottom: '16px',
            justifyContent: 'center'
          }}>
            <button
              onClick={() => setShowDiscountPopup(true)}
              style={{
                background: appliedDiscount ? '#f59e0b' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 20px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.target.style.background = appliedDiscount ? '#d97706' : '#059669'
              }}
              onMouseOut={(e) => {
                e.target.style.background = appliedDiscount ? '#f59e0b' : '#10b981'
              }}
            >
              {appliedDiscount ? <><Pencil size={15} style={{marginRight:'5px'}}/> Edit Discount</> : <><Tag size={15} style={{marginRight:'5px'}}/> Add Discount</>}
            </button>
            
            {appliedDiscount && (
              <button
                onClick={handleRemoveDiscount}
                style={{
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => e.target.style.background = '#b91c1c'}
                onMouseOut={(e) => e.target.style.background = '#dc2626'}
              >
                <span style={{display:'flex',alignItems:'center',gap:'5px'}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Remove Discount</span>
              </button>
            )}
          </div>
        </div>

        {/* Complimentary Controls */}
        <div style={{ 
          background: isComplimentary ? '#fef3c7' : '#f8fafc', 
          padding: '16px', 
          borderRadius: '8px',
          border: `2px solid ${isComplimentary ? '#f59e0b' : '#e2e8f0'}`,
          marginBottom: '16px'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            marginBottom: isComplimentary ? '12px' : '0'
          }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              color: isComplimentary ? '#92400e' : '#374151'
            }}>
              <input
                type="checkbox"
                checked={isComplimentary}
                onChange={(e) => {
                  if (e.target.checked) {
                    setShowComplimentaryPopup(true)
                  } else {
                    setIsComplimentary(false)
                    setComplimentaryReason("")
                  }
                }}
                style={{
                  width: '18px',
                  height: '18px',
                  cursor: 'pointer'
                }}
              />
              🎁 Complimentary Bill
            </label>
            <span style={{ 
              fontSize: '0.875rem', 
              color: '#6b7280',
              fontStyle: 'italic'
            }}>
              (Alt+C)
            </span>
          </div>
          
          {isComplimentary && complimentaryReason && (
            <div style={{ 
              fontSize: '0.875rem',
              color: '#92400e',
              fontStyle: 'italic',
              background: '#fffbeb',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #fbbf24'
            }}>
              <strong>Reason:</strong> {complimentaryReason}
            </div>
          )}
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

        {/* Member Wallet Payment Section */}
        {orderData?.serverName === 'Member App' && (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '16px',
            marginTop: '16px',
            color: 'white',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ fontSize: '28px' }}>💳</div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
                  Member App Order
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', opacity: 0.9 }}>
                  Payment via Member Wallet
                </p>
              </div>
            </div>

            {loadingMember ? (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
                <div style={{ fontSize: '14px', marginTop: '8px' }}>Loading member details...</div>
              </div>
            ) : memberDetails ? (
              <>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '14px' }}>
                    <div>
                      <div style={{ opacity: 0.8, fontSize: '12px', marginBottom: '4px' }}>Member Name</div>
                      <div style={{ fontWeight: '600' }}>{memberDetails.name}</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.8, fontSize: '12px', marginBottom: '4px' }}>Member ID</div>
                      <div style={{ fontWeight: '600' }}>{memberDetails.memberNumber}</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.8, fontSize: '12px', marginBottom: '4px' }}>Phone</div>
                      <div style={{ fontWeight: '600' }}>{memberDetails.phone}</div>
                    </div>
                    <div>
                      <div style={{ opacity: 0.8, fontSize: '12px', marginBottom: '4px' }}>Membership</div>
                      <div style={{ fontWeight: '600', textTransform: 'capitalize' }}>
                        {memberDetails.membershipType || 'Member'}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  padding: '16px',
                  marginBottom: '16px',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '13px', opacity: 0.9, marginBottom: '8px' }}>
                    Current Wallet Balance
                  </div>
                  <div style={{ fontSize: '32px', fontWeight: '700' }}>
                    ₹{(memberDetails.walletBalance || 0).toFixed(2)}
                  </div>
                  {memberDetails.walletBalance < total && (
                    <div style={{
                      marginTop: '8px',
                      fontSize: '13px',
                      background: 'rgba(239, 68, 68, 0.9)',
                      padding: '8px 12px',
                      borderRadius: '6px'
                    }}>
                      ⚠️ Insufficient Balance (Short by ₹{(total - memberDetails.walletBalance).toFixed(2)})
                    </div>
                  )}
                </div>

                <button
                  onClick={handleWalletDeduction}
                  disabled={walletDeducting || memberDetails.walletBalance < total}
                  style={{
                    width: '100%',
                    padding: '14px',
                    fontSize: '16px',
                    fontWeight: '700',
                    background: memberDetails.walletBalance >= total 
                      ? 'rgba(255, 255, 255, 0.95)' 
                      : 'rgba(255, 255, 255, 0.3)',
                    color: memberDetails.walletBalance >= total ? '#667eea' : 'rgba(255, 255, 255, 0.6)',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: memberDetails.walletBalance >= total ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.2s'
                  }}
                >
                  {walletDeducting ? (
                    <>⏳ Processing...</>
                  ) : memberDetails.walletBalance >= total ? (
                    <>💳 Deduct ₹{total.toFixed(2)} from Wallet</>
                  ) : (
                    <>❌ Insufficient Balance</>
                  )}
                </button>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', opacity: 0.9 }}>
                ⚠️ Member details not available
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ 
          display: 'flex',
          flexWrap: 'nowrap',
          gap: '10px',
          marginTop: '20px'
        }}>
          {/* Back */}
          <button
            className="counter-button-secondary"
            onClick={handleBack}
            style={{
              padding: '9px 18px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
              borderRadius: '8px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight:'5px'}}><polyline points="15 18 9 12 15 6"/></svg> Back
          </button>

          {/* Cancel Order */}
          <button
            className="counter-button-secondary"
            onClick={handleCancel}
            style={{
              background: '#dc2626',
              borderColor: '#dc2626',
              color: 'white',
              padding: '9px 18px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
              borderRadius: '8px',
            }}
            title="Cancel this order and start fresh"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{marginRight:'5px'}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> Cancel Order
          </button>

          {/* Print Bill */}
          <button
            className="counter-button"
            onClick={handlePrint}
            disabled={printing}
            style={{
              flex: '1 1 auto',
              padding: '9px 18px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              fontWeight: '700',
              whiteSpace: 'nowrap',
              borderRadius: '8px',
              opacity: printing ? 0.7 : 1,
              cursor: printing ? 'not-allowed' : 'pointer',
            }}
            title="Print bill to thermal printer (Press Enter)"
          >
            {printing
              ? <><Loader2 size={14} style={{marginRight:'5px'}}/> Printing...</>
              : <><Printer size={14} style={{marginRight:'5px'}}/> Print Bill</>}
          </button>

          {/* Settings */}
          <button
            className="counter-button-secondary"
            onClick={handlePrintSettings}
            style={{
              padding: '9px 18px',
              height: '38px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
              fontWeight: '600',
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
              borderRadius: '8px',
            }}
            title="Configure thermal printer settings"
          >
            <Settings size={14} style={{marginRight:'5px'}}/> Settings
          </button>
        </div>
      </div>

      {/* Discount Popup Modal */}
      {showDiscountPopup && (
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
          <div 
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              minWidth: '450px',
              maxWidth: '500px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                // console.log('⌨️ Enter pressed in discount popup - applying discount')
                handleApplyDiscount()
              } else if (e.key === 'Escape') {
                e.preventDefault()
                // console.log('⌨️ Escape pressed in discount popup - closing')
                setShowDiscountPopup(false)
                setDiscountValue("")
                setDiscountRemark("")
              }
            }}
            tabIndex={0}
          >
            <h2 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '1.5rem', 
              color: '#1f2937',
              fontWeight: '600'
            }}>
              <Tag size={20} style={{marginRight:'8px'}}/> Add Discount
            </h2>

            <div style={{
              padding: '16px',
              background: '#f9fafb',
              borderRadius: '8px',
              marginBottom: '24px'
            }}>
              <p style={{ 
                margin: '0 0 8px 0', 
                fontSize: '0.875rem',
                color: '#6b7280'
              }}>
                Current Subtotal: ₹{subtotal.toFixed(2)}
              </p>
              {appliedDiscount && (
                <p style={{ 
                  margin: '0', 
                  fontSize: '0.875rem',
                  color: '#e53e3e'
                }}>
                  Current Discount: {appliedDiscount.type === 'percentage' ? `${appliedDiscount.value}%` : `₹${appliedDiscount.value}`} ({appliedDiscount.remark})
                </p>
              )}
            </div>

            {/* Discount Type Selection */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#374151'
              }}>
                Discount Type:
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setDiscountType('percentage')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: `2px solid ${discountType === 'percentage' ? '#3b82f6' : '#d1d5db'}`,
                    borderRadius: '8px',
                    background: discountType === 'percentage' ? '#eff6ff' : 'white',
                    color: discountType === 'percentage' ? '#2563eb' : '#6b7280',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  📊 Percentage (%)
                </button>
                <button
                  onClick={() => setDiscountType('amount')}
                  style={{
                    flex: 1,
                    padding: '10px',
                    border: `2px solid ${discountType === 'amount' ? '#3b82f6' : '#d1d5db'}`,
                    borderRadius: '8px',
                    background: discountType === 'amount' ? '#eff6ff' : 'white',
                    color: discountType === 'amount' ? '#2563eb' : '#6b7280',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  💰 Amount (₹)
                </button>
              </div>
            </div>

            {/* Discount Value Input */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#374151'
              }}>
                Discount {discountType === 'percentage' ? 'Percentage' : 'Amount'}:
              </label>
              <input
                type="number"
                min="0"
                max={discountType === 'percentage' ? '100' : subtotal}
                step={discountType === 'percentage' ? '1' : '0.01'}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    // Move focus to remark field if value is entered
                    if (discountValue) {
                      const remarkField = document.querySelector('input[placeholder*="Dussehra Sale"]')
                      if (remarkField) {
                        remarkField.focus()
                      }
                    }
                  }
                }}
                placeholder={discountType === 'percentage' ? 'Enter percentage (e.g., 10)' : 'Enter amount (e.g., 50.00)'}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '1.1rem',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px',
                  textAlign: 'center',
                  fontWeight: '600'
                }}
              />
              {discountValue && (
                <p style={{
                  margin: '8px 0 0 0',
                  fontSize: '0.875rem',
                  color: '#059669',
                  textAlign: 'center'
                }}>
                  Discount Amount: ₹{discountType === 'percentage' 
                    ? ((subtotal * parseFloat(discountValue || 0)) / 100).toFixed(2)
                    : parseFloat(discountValue || 0).toFixed(2)
                  }
                </p>
              )}
            </div>

            {/* Discount Remark Input */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '0.875rem',
                fontWeight: '600',
                color: '#374151'
              }}>
                Remark (Required):
              </label>
              <input
                type="text"
                value={discountRemark}
                onChange={(e) => setDiscountRemark(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    // Apply discount if both fields are filled
                    if (discountValue && discountRemark.trim()) {
                      // console.log('⌨️ Enter pressed in remark field - applying discount')
                      handleApplyDiscount()
                    }
                  }
                }}
                placeholder="e.g., Dussehra Sale, Customer Loyalty, etc."
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '1rem',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px'
                }}
              />
            </div>

            <div style={{ 
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={() => {
                  setShowDiscountPopup(false)
                  setDiscountValue("")
                  setDiscountRemark("")
                }}
                style={{
                  flex: 1,
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
                Cancel
              </button>
              
              <button
                onClick={handleApplyDiscount}
                style={{
                  flex: 1,
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Apply Discount
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complimentary Popup */}
      {showComplimentaryPopup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '32px',
            borderRadius: '12px',
            width: '90%',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <h2 style={{ 
              margin: '0 0 24px 0', 
              fontSize: '1.5rem', 
              fontWeight: '700',
              color: '#1a202c',
              textAlign: 'center'
            }}>
              <Gift size={20} style={{marginRight:'8px'}}/> Mark as Complimentary
            </h2>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontSize: '1rem', 
                fontWeight: '600',
                color: '#374151'
              }}>
                Reason for Complimentary:
              </label>
              <input
                type="text"
                value={complimentaryReason}
                onChange={(e) => setComplimentaryReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (complimentaryReason.trim()) {
                      setIsComplimentary(true)
                      setShowComplimentaryPopup(false)
                    }
                  }
                  if (e.key === 'Escape') {
                    setShowComplimentaryPopup(false)
                    setComplimentaryReason("")
                  }
                }}
                placeholder="e.g., Owner's friend, Staff meal, Promotional offer, etc."
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '1rem',
                  border: '2px solid #d1d5db',
                  borderRadius: '8px'
                }}
                autoFocus
              />
              <p style={{ 
                margin: '8px 0 0 0', 
                fontSize: '0.875rem', 
                color: '#6b7280',
                fontStyle: 'italic'
              }}>
                This bill will not appear in sales reports
              </p>
            </div>

            <div style={{ 
              display: 'flex',
              gap: '12px'
            }}>
              <button
                onClick={() => {
                  setShowComplimentaryPopup(false)
                  setComplimentaryReason("")
                }}
                style={{
                  flex: 1,
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
                Cancel
              </button>
              
              <button
                onClick={() => {
                  if (complimentaryReason.trim()) {
                    setIsComplimentary(true)
                    setShowComplimentaryPopup(false)
                  }
                }}
                disabled={!complimentaryReason.trim()}
                style={{
                  flex: 1,
                  background: complimentaryReason.trim() ? '#f59e0b' : '#d1d5db',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontSize: '1rem',
                  fontWeight: '600',
                  cursor: complimentaryReason.trim() ? 'pointer' : 'not-allowed'
                }}
              >
                <span style={{display:'flex',alignItems:'center',gap:'6px'}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg> Mark Complimentary</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

export default BillGeneration
