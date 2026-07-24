import { useState, useEffect } from 'react'
import { Menu, X } from 'lucide-react'
import logo from '../../assets/logo4.jpeg'
import './Header.css'

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      setIsScrolled(scrollTop > 50)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (sectionId) => {
    console.log(`🎯 Scrolling to: ${sectionId}`)
    
    // Special handling for home - scroll to top
    if (sectionId === 'home') {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
      console.log(`✅ Scrolling to top (home)`)
      setIsMenuOpen(false)
      return
    }
    
    const element = document.getElementById(sectionId)
    if (element) {
      // Calculate the header height for offset
      const header = document.querySelector('.website-header')
      const headerHeight = header ? header.offsetHeight : 90
      const elementPosition = element.offsetTop - headerHeight
      
      // Use window.scrollTo for reliable scrolling
      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
      })
      
      console.log(`✅ Scrolling to position: ${elementPosition}`)
    } else {
      console.error(`❌ Element not found: ${sectionId}`)
    }
    
    setIsMenuOpen(false) // Close mobile menu after clicking
  }

  // Debug function to test scrolling
  const testScroll = () => {
    console.log('🧪 === Testing scroll functionality ===')
    const sections = ['home', 'room-booking', 'catering-service', 'download-app', 'contact-us']
    
    console.log('📋 Section availability check:')
    sections.forEach(sectionId => {
      const element = document.getElementById(sectionId)
      if (element) {
        console.log(`✅ Section ${sectionId}: Found at ${element.offsetTop}px`)
      } else {
        console.log(`❌ Section ${sectionId}: Not found`)
      }
    })
    
    // Test scroll behavior settings
    console.log('⚙️ Scroll settings:')
    console.log('   📄 Document scroll behavior:', document.documentElement.style.scrollBehavior)
    console.log('   🏠 Body scroll behavior:', document.body.style.scrollBehavior)
    console.log('   🌐 Current scroll position:', window.pageYOffset)
    console.log('   📏 Body overflow:', getComputedStyle(document.body).overflow)
  }

  // Run test on component mount
  useEffect(() => {
    // Wait for components to render
    setTimeout(testScroll, 1000)
  }, [])

  const menuItems = [
    { id: 'home', label: 'Home' },
    { id: 'room-booking', label: 'Room Booking' },
    { id: 'catering-service', label: 'Catering Service' },
    { id: 'download-app', label: 'Order Now' },
    { id: 'contact-us', label: 'Contact Us' }
  ]

  return (
    <header className={`website-header ${isScrolled ? 'scrolled' : ''}`}>
      <div className="header-container">
        <div className="logo-section" onClick={() => scrollToSection('home')} style={{ cursor: 'pointer' }}>
          <img src={logo} alt="Hotel Virat" className="logo-image" />
          <div className="logo-text">
            <h2>Hotel Virat</h2>
            <span className="tagline">Luxury & Comfort</span>
          </div>
        </div>
        
        <nav className={`nav-menu ${isMenuOpen ? 'active' : ''}`}>
          <ul>
            {menuItems.map((item) => (
              <li key={item.id}>
                <button 
                  onClick={() => scrollToSection(item.id)} 
                  className="nav-link"
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="header-actions">
          <button 
            onClick={() => scrollToSection('contact-us')} 
            className="cta-button"
          >
            Book Now
          </button>
          
          <button 
            className="hamburger" 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>
    </header>
  )
}

export default Header