import { useState } from "react"
import { useNavigate } from "react-router-dom"

const CategorySelectionFirst = () => {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState(null)

  // Predefined categories (static)
  const categories = [
    {
      id: 'RESTAURANT',
      name: 'Restaurant',
      description: 'Dine-in service with table selection',
      icon: '🍽️',
      loginPath: '/counter/login/restaurant'
    },
    // {
    //   id: 'SELF_SERVICE',
    //   name: 'Self Service',
    //   description: 'Quick counter service',
    //   icon: '🥡',
    //   loginPath: '/counter/login/self-service'
    // },
    // {
    //   id: 'TEMPLE_MEALS',
    //   name: 'Temple Meals',
    //   description: 'Special temple offerings',
    //   icon: '🛕',
    //   loginPath: '/counter/login/temple-meals'
    // }
  ]

  const handleCategorySelect = (category) => {
    setSelectedCategory(category)
  }

  const handleContinue = () => {
    if (!selectedCategory) {
      alert("Please select a category to continue")
      return
    }

    // 🔒 MANDATORY: Store selected category in sessionStorage
    sessionStorage.setItem("orderCategory", selectedCategory.id)
    sessionStorage.setItem("orderCategoryName", selectedCategory.name)
    
    console.log('🎯 Category selected and stored:', selectedCategory.id)
    console.log('🔒 Stored in sessionStorage:', sessionStorage.getItem("orderCategory"))

    // Navigate to category-specific login page
    navigate(selectedCategory.loginPath)
  }

  return (
    <div className="counter-container">
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
          <h1 className="counter-title">Select Order Category</h1>
          <p className="counter-subtitle">Choose your service type to continue</p>
        </div>

        <div className="counter-grid">
          {categories.map((category) => (
            <div
              key={category.id}
              className={`counter-item ${selectedCategory?.id === category.id ? 'selected' : ''}`}
              onClick={() => handleCategorySelect(category)}
              style={{
                minHeight: '140px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                textAlign: 'center',
                padding: '24px 16px',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                border: selectedCategory?.id === category.id ? '3px solid #667eea' : '2px solid #e2e8f0',
                backgroundColor: selectedCategory?.id === category.id ? '#f7fafc' : 'white'
              }}
            >
              {/* Category Icon */}
              <div style={{
                fontSize: '3rem',
                marginBottom: '16px'
              }}>
                {category.icon}
              </div>
              
              <h3 style={{ 
                margin: '0 0 8px 0', 
                color: '#1a202c',
                fontSize: '1.25rem',
                fontWeight: '700'
              }}>
                {category.name}
              </h3>
              
              <p style={{ 
                margin: '0', 
                color: '#718096', 
                fontSize: '0.875rem',
                lineHeight: '1.4'
              }}>
                {category.description}
              </p>

              {selectedCategory?.id === category.id && (
                <div style={{
                  marginTop: '12px',
                  padding: '4px 12px',
                  backgroundColor: '#667eea',
                  color: 'white',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  Selected ✓
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ 
          display: 'flex', 
          justifyContent: 'center',
          marginTop: '32px'
        }}>
          <button
            className="counter-button"
            onClick={handleContinue}
            disabled={!selectedCategory}
            style={{ 
              maxWidth: '300px',
              opacity: selectedCategory ? 1 : 0.6,
              cursor: selectedCategory ? 'pointer' : 'not-allowed',
              padding: '16px 32px',
              fontSize: '1.1rem',
              fontWeight: '600'
            }}
          >
            Continue to Login →
          </button>
        </div>

        {/* Debug info (remove in production) */}
        {selectedCategory && (
          <div style={{
            marginTop: '20px',
            padding: '12px',
            backgroundColor: '#f7fafc',
            borderRadius: '8px',
            fontSize: '0.75rem',
            color: '#4a5568'
          }}>
            <strong>Selected:</strong> {selectedCategory.name} ({selectedCategory.id})
            <br />
            <strong>Next:</strong> {selectedCategory.loginPath}
          </div>
        )}
      </div>
    </div>
  )
}

export default CategorySelectionFirst