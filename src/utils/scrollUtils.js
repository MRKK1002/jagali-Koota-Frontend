// Scroll utility functions

export const smoothScrollTo = (elementId, offset = 90) => {
  return new Promise((resolve) => {
    const element = document.getElementById(elementId)
    
    if (!element) {
      console.error(`Element with id "${elementId}" not found`)
      resolve(false)
      return
    }

    // Calculate target position
    const targetPosition = element.offsetTop - offset
    
    // Method 1: Using window.scrollTo (most reliable)
    try {
      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      })
      
      console.log(`Scrolling to ${elementId} at position ${targetPosition}`)
      
      // Wait for scroll to complete
      setTimeout(() => {
        resolve(true)
      }, 1000)
      
    } catch (error) {
      console.error('ScrollTo failed, using fallback:', error)
      
      // Method 2: Fallback using scrollIntoView
      try {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
          inline: 'nearest'
        })
        
        // Adjust for header offset after scrollIntoView
        setTimeout(() => {
          const currentPosition = window.pageYOffset
          const adjustedPosition = element.offsetTop - offset
          
          if (Math.abs(currentPosition - adjustedPosition) > 10) {
            window.scrollTo({
              top: adjustedPosition,
              behavior: 'smooth'
            })
          }
        }, 100)
        
        resolve(true)
      } catch (fallbackError) {
        console.error('All scroll methods failed:', fallbackError)
        resolve(false)
      }
    }
  })
}

export const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  })
}

export const isElementInViewport = (elementId) => {
  const element = document.getElementById(elementId)
  if (!element) return false
  
  const rect = element.getBoundingClientRect()
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  )
}

export const getAllSectionIds = () => {
  const sections = document.querySelectorAll('section[id]')
  return Array.from(sections).map(section => ({
    id: section.id,
    element: section,
    offsetTop: section.offsetTop
  }))
}