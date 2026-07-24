import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"

// NEW: Unified bill/invoice numbering system with server-side generation per category
// Bill No = Invoice No (exactly the same number)
const getNextBillNumber = async (branchId, category) => {
  try {
    // console.log('🧾 Getting next unified bill/invoice number from server for category:', category)
    
    if (!branchId) {
      throw new Error('Branch ID is required for bill/invoice number generation')
    }
    
    if (!category) {
      throw new Error('Category is required for bill/invoice number generation')
    }
    
    // Get unified bill/invoice number from server with category
    const response = await counterApi.getNextBillNumber(branchId, category)
    
    if (response && response.success && response.billNumber) {
      // console.log(`🧾 Server generated unified bill/invoice number: ${response.billNumber} for category: ${category}`)
      return response.billNumber
    } else {
      throw new Error('Invalid response from server')
    }
    
  } catch (error) {
    console.error('❌ Failed to get unified bill/invoice number from server:', error)
    // console.log('🔄 Falling back to localStorage method...')
    
    // Fallback to localStorage method with category
    const now = new Date()
    const day = String(now.getDate()).padStart(2, '0')
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const year = String(now.getFullYear()).slice(-2)
    const dateKey = `${day}-${month}-${year}`
    
    const billCounterKey = `unified-bill-counter-${category}-${dateKey}`
    
    let billCounter = parseInt(localStorage.getItem(billCounterKey) || '0')
    billCounter++
    
    localStorage.setItem(billCounterKey, billCounter.toString())
    
    const unifiedNumber = String(billCounter).padStart(3, '0') // Format: 001, 002, 003...
    
    // console.log(`🧾 Fallback generated unified number: ${unifiedNumber} for category: ${category} (counter: ${billCounter})`)
    return unifiedNumber
  }
}
import counterApi from "../services/counterApi"

const CategorySelection = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const branchData = location.state

  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isOffline, setIsOffline] = useState(false)
  
  // Enhanced password protection state
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [passwordInput, setPasswordInput] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [pendingProtectedCategory, setPendingProtectedCategory] = useState(null)
  const [authenticatedCategories, setAuthenticatedCategories] = useState(new Set())

  useEffect(() => {
    if (!branchData || !branchData.selectedBranch) {
      navigate("/counter/branch-selection")
      return
    }
    
    // Check if there's a stored category from previous session
    const storedCategory = localStorage.getItem('selectedCategory')
    const storedCategoryName = localStorage.getItem('selectedCategoryName')
    
    if (storedCategory && storedCategoryName) {
      // console.log('🔄 Found stored category:', storedCategoryName)
      try {
        const categoryData = JSON.parse(storedCategory)
        // console.log('🚀 Auto-navigating to stored category:', storedCategoryName)
        
        // Auto-navigate to the stored category
        navigate("/counter/menu", {
          state: {
            ...branchData,
            selectedCategory: categoryData,
            customerName: "Walk-in Customer",
            phoneNumber: "0000000000",
            invoiceNumber: null,
            date: new Date().toLocaleDateString('en-IN'),
            time: new Date().toLocaleTimeString('en-IN', { 
              hour12: true,
              hour: '2-digit',
              minute: '2-digit'
            }),
            cartItems: []
          }
        })
        return
      } catch (error) {
        console.error('Error parsing stored category:', error)
        // Clear invalid stored data
        localStorage.removeItem('selectedCategory')
        localStorage.removeItem('selectedCategoryName')
      }
    }
    
    loadCategories()
  }, [branchData, navigate])

  const loadCategories = async () => {
    try {
      setLoading(true)
      setError(null)
      setIsOffline(false)

      const categoriesResponse = await counterApi.getCategories(branchData.selectedBranch._id)
      const categoryList = []
      if (categoriesResponse) {
        const cats = categoriesResponse.categories || categoriesResponse
        if (Array.isArray(cats) && cats.length > 0) {
          cats.forEach((cat) => {
            const categoryName = cat.name || cat.categoryName || cat.title
            if (categoryName) {
              categoryList.push({
                _id: cat._id || cat.id,
                name: categoryName,
                description: cat.description || "",
                image: cat.image || null,
                itemCount: cat.itemCount || 0,
                loginPassword: cat.loginPassword || null,
                cancelOrderPassword: cat.cancelOrderPassword || null
              })
            }
          })
        }
      }
      // Cache for offline use
      if (categoryList.length > 0) {
        localStorage.setItem(`cachedCategories_${branchData.selectedBranch._id}`, JSON.stringify(categoryList))
      }
      setCategories(categoryList)
    } catch (error) {
      console.warn("Error loading categories, trying cache:", error)
      // Fall back to cached categories
      try {
        const cached = localStorage.getItem(`cachedCategories_${branchData.selectedBranch._id}`)
        if (cached) {
          const categoryList = JSON.parse(cached)
          if (categoryList.length > 0) {
            setCategories(categoryList)
            setIsOffline(true)
            return
          }
        }
      } catch (_) {}
      setError("Failed to load categories. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleCategorySelect = (category) => {
    const categoryName = category.name.toLowerCase()
    
    // ALWAYS store selected category in localStorage (will persist until user switches category)
    localStorage.setItem('selectedCategory', JSON.stringify(category))
    localStorage.setItem('selectedCategoryName', category.name)
    // console.log('💾 Category stored in localStorage:', category.name)
    
    // Check if this category requires password protection (has loginPassword set)
    const requiresPassword = category.loginPassword && category.loginPassword.trim() !== ''
    
    if (requiresPassword) {
      // Check if already authenticated for this category
      const isAlreadyAuthenticated = authenticatedCategories.has(category._id)
      
      if (isAlreadyAuthenticated) {
        // Already authenticated - proceed directly to menu
        // console.log('✅ Category already authenticated - auto-navigating to menu:', categoryName)
        
        // Navigate directly to menu
        navigate("/counter/menu", {
          state: {
            ...branchData,
            selectedCategory: category,
            // Generate customer data
            customerName: "Walk-in Customer",
            phoneNumber: "0000000000",
            invoiceNumber: null, // Will be generated when order is actually placed
            date: new Date().toLocaleDateString('en-IN'),
            time: new Date().toLocaleTimeString('en-IN', { 
              hour12: true,
              hour: '2-digit',
              minute: '2-digit'
            }),
            cartItems: []
          }
        })
      } else {
        // Show password modal for protected category
        // console.log('🔒 Protected category selected - requesting password:', categoryName)
        setPendingProtectedCategory(category)
        setShowPasswordModal(true)
        setPasswordInput("")
        setPasswordError("")
      }
    } else {
      // For unprotected categories, navigate directly to menu
      // console.log('🚀 Unprotected category selected - auto-navigating to menu:', categoryName)
      
      navigate("/counter/menu", {
        state: {
          ...branchData,
          selectedCategory: category,
          // Generate customer data
          customerName: "Walk-in Customer",
          phoneNumber: "0000000000",
          invoiceNumber: null, // Will be generated when order is actually placed
          date: new Date().toLocaleDateString('en-IN'),
          time: new Date().toLocaleTimeString('en-IN', { 
            hour12: true,
            hour: '2-digit',
            minute: '2-digit'
          }),
          cartItems: []
        }
      })
    }
  }
  
  const handlePasswordSubmit = () => {
    const categoryName = pendingProtectedCategory.name
    const correctPassword = pendingProtectedCategory.loginPassword
    
    if (passwordInput === correctPassword) {
      // Correct password - proceed and remember authentication
      // console.log('✅ Password correct for category:', categoryName)
      
      // Remember this category as authenticated using category ID
      setAuthenticatedCategories(prev => new Set([...prev, pendingProtectedCategory._id]))
      
      // Close modal and clear states
      setShowPasswordModal(false)
      setPasswordInput("")
      setPasswordError("")
      
      // CRITICAL FIX: Automatically navigate to menu after successful authentication
      // console.log('🚀 Auto-navigating to menu after successful authentication')
      
      // Store selected category in localStorage for backup
      localStorage.setItem('selectedCategory', JSON.stringify(pendingProtectedCategory))
      
      // Navigate directly to menu without showing category selection
      navigate("/counter/menu", {
        state: {
          ...branchData,
          selectedCategory: pendingProtectedCategory,
          // Generate customer data
          customerName: "Walk-in Customer",
          phoneNumber: "0000000000",
          invoiceNumber: null, // Will be generated when order is actually placed
          date: new Date().toLocaleDateString('en-IN'),
          time: new Date().toLocaleTimeString('en-IN', { 
            hour12: true,
            hour: '2-digit',
            minute: '2-digit'
          }),
          cartItems: []
        }
      })
      
      setPendingProtectedCategory(null)
    } else {
      // Wrong password - show error
      console.log('❌ Password incorrect for category:', categoryName)
      setPasswordError(`Incorrect password for ${pendingProtectedCategory.name}. Please try again.`)
      setPasswordInput("")
    }
  }
  
  const handlePasswordCancel = () => {
    // Cancel password entry
    setShowPasswordModal(false)
    setPasswordInput("")
    setPasswordError("")
    setPendingProtectedCategory(null)
  }

  const handleContinue = async () => {
    if (!selectedCategory) {
      alert("Please select a category to continue")
      return
    }

    // DON'T generate bill number here - wait until order is actually placed
    // This prevents number wastage when users abandon the process
    // console.log('🧾 Category selected, proceeding to menu without generating bill number yet')

    // Always navigate to menu - table selection will happen on menu screen
    navigate("/counter/menu", {
      state: {
        ...branchData,
        selectedCategory: selectedCategory,
        // Generate customer data
        customerName: "Walk-in Customer",
        phoneNumber: "0000000000",
        invoiceNumber: null, // Will be generated when order is actually placed
        date: new Date().toLocaleDateString('en-IN'),
        time: new Date().toLocaleTimeString('en-IN', { 
          hour12: true,
          hour: '2-digit',
          minute: '2-digit'
        }),
        cartItems: []
      }
    })
  }

  const handleBack = () => {
    navigate("/counter/branch-selection")
  }

  const handleLogout = () => {
    localStorage.removeItem("counterAuthenticated")
    localStorage.removeItem("counterUserId")
    localStorage.removeItem("counterUserData")
    localStorage.removeItem("selectedBranch")
    localStorage.removeItem('counterSelectedCategory')
    // Clear our new category storage (allows switching categories)
    localStorage.removeItem("selectedCategory")
    localStorage.removeItem("selectedCategoryName")
    // console.log('🔄 All category data cleared - user can select different category')
    navigate("/counter/login")
  }

  if (!branchData) {
    return (
      <div className="counter-container">
        <div className="counter-card">
          <div className="counter-error">
            <p>Branch data not found. Please start over.</p>
            <button className="counter-button" onClick={() => navigate("/counter/branch-selection")}>
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="counter-container">
        <div className="counter-card">
          <div className="counter-loading">
            <div className="counter-spinner"></div>
            <p>Loading categories...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="counter-container">
        <div className="counter-card">
          <div className="counter-error">
            <h3>Error</h3>
            <p>{error}</p>
            <button className="counter-button" onClick={loadCategories}>
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="counter-container">
      <div className="counter-card">
        <div className="counter-header">
          <h1 className="counter-title">Select Category</h1>
          <p className="counter-subtitle">
            {branchData.selectedBranch.name} • Choose your dining category
          </p>
          {isOffline && (
            <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: '6px', padding: '8px 12px', marginTop: '8px', fontSize: '0.85rem', color: '#92400e' }}>
              ⚠️ Offline — showing cached categories
            </div>
          )}
          <button 
            className="counter-button-secondary" 
            onClick={handleLogout}
            style={{ 
              position: 'absolute', 
              top: '20px', 
              right: '20px',
              width: 'auto',
              padding: '8px 16px'
            }}
          >
            Logout
          </button>
        </div>

        {categories.length === 0 ? (
          <div className="counter-error">
            <p>No categories available for this branch. Please contact administrator.</p>
          </div>
        ) : (
          <>
            <div className="counter-grid">
              {categories.map((category) => (
                <div
                  key={category._id}
                  className="counter-item"
                  onClick={() => handleCategorySelect(category)}
                  style={{
                    minHeight: '120px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    padding: '24px 16px'
                  }}
                >
                  {/* Category Icon */}
                  <div style={{
                    fontSize: '2.5rem',
                    marginBottom: '12px'
                  }}>
                    {category.name.toLowerCase().includes('restaurant') ? '🍽️' :
                     category.name.toLowerCase().includes('temple') ? '🛕' :
                     category.name.toLowerCase().includes('self service') ? '🥡' :
                     category.name.toLowerCase().includes('breakfast') ? '🥞' :
                     category.name.toLowerCase().includes('lunch') ? '🍛' :
                     category.name.toLowerCase().includes('dinner') ? '🍽️' :
                     category.name.toLowerCase().includes('snack') ? '🍿' :
                     category.name.toLowerCase().includes('beverage') ? '☕' :
                     category.name.toLowerCase().includes('sweet') ? '🍰' :
                     '🍴'}
                  </div>
                  
                  <h3 style={{ 
                    margin: '0 0 8px 0', 
                    color: '#1a202c',
                    fontSize: '1.1rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}>
                    {category.name}
                    {/* Authentication Status Indicator */}
                    {(() => {
                      const requiresPassword = category.loginPassword && category.loginPassword.trim() !== ''
                      
                      if (requiresPassword) {
                        const isAuthenticated = authenticatedCategories.has(category._id)
                        
                        return isAuthenticated ? (
                          <span style={{ 
                            fontSize: '0.8rem', 
                            color: '#10b981',
                            backgroundColor: '#d1fae5',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: '500'
                          }}>
                            ✓ Unlocked
                          </span>
                        ) : (
                          <span style={{ 
                            fontSize: '0.8rem', 
                            color: '#f59e0b',
                            backgroundColor: '#fef3c7',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: '500'
                          }}>
                            🔒 Protected
                          </span>
                        )
                      }
                      return null
                    })()}
                  </h3>
                  
                  {category.description && (
                    <p style={{ 
                      margin: '0 0 8px 0', 
                      color: '#718096', 
                      fontSize: '0.875rem',
                      lineHeight: '1.4'
                    }}>
                      {category.description}
                    </p>
                  )}
                  
                  {category.itemCount > 0 && (
                    <p style={{ 
                      margin: '0', 
                      color: '#4a5568', 
                      fontSize: '0.75rem',
                      fontWeight: '500'
                    }}>
                      {category.itemCount} items available
                    </p>
                  )}

                  {/* Show table requirement indicator */}
                  {(category.name.toLowerCase().includes('restaurant') || 
                    category.name.toLowerCase().includes('temple meal')) && (
                    <p style={{ 
                      margin: '4px 0 0 0', 
                      color: '#f59e0b', 
                      fontSize: '0.7rem',
                      fontWeight: '600'
                    }}>
                      🪑 Table Selection Available
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-start', 
              alignItems: 'center',
              marginTop: '32px'
            }}>
              <button
                className="counter-button-secondary"
                onClick={handleBack}
                style={{ 
                  width: 'auto',
                  padding: '12px 24px'
                }}
              >
                ← Back to Branches
              </button>
            </div>
          </>
        )}
      </div>
      
      {/* Restaurant Password Modal */}
      {showPasswordModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '32px',
            maxWidth: '400px',
            width: '90%',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
          }}>
            <h2 style={{
              margin: '0 0 16px 0',
              fontSize: '1.5rem',
              fontWeight: '600',
              color: '#1f2937',
              textAlign: 'center'
            }}>
              🔒 {pendingProtectedCategory?.name} Access
            </h2>
            
            <p style={{
              margin: '0 0 24px 0',
              color: '#6b7280',
              textAlign: 'center',
              fontSize: '0.9rem'
            }}>
              Please enter the password to access {pendingProtectedCategory?.name} category
            </p>
            
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePasswordSubmit()
                }
              }}
              placeholder={`Enter ${pendingProtectedCategory?.name} password`}
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '2px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '1rem',
                marginBottom: '16px',
                outline: 'none',
                borderColor: passwordError ? '#ef4444' : '#e5e7eb'
              }}
            />
            
            {passwordError && (
              <p style={{
                margin: '0 0 16px 0',
                color: '#ef4444',
                fontSize: '0.8rem',
                textAlign: 'center'
              }}>
                {passwordError}
              </p>
            )}
            
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={handlePasswordCancel}
                style={{
                  padding: '10px 20px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '6px',
                  backgroundColor: 'white',
                  color: '#6b7280',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              
              <button
                onClick={handlePasswordSubmit}
                disabled={!passwordInput.trim()}
                style={{
                  padding: '10px 20px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: passwordInput.trim() ? '#3b82f6' : '#9ca3af',
                  color: 'white',
                  cursor: passwordInput.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '0.9rem',
                  fontWeight: '500'
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CategorySelection