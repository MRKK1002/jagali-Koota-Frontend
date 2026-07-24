import { useEffect } from 'react'
import Header from './components/Header'
import CarouselBanner from './components/CarouselBanner'
import RoomBooking from './components/RoomBooking'
import CateringService from './components/CateringService'
import DownloadApp from './components/DownloadApp'
import ContactUs from './components/ContactUs'
import Footer from './components/Footer'
import './Website.css'

const Website = () => {
  useEffect(() => {
    // Add smooth scrolling behavior to the document
    document.documentElement.style.scrollBehavior = 'smooth'
    document.body.style.scrollBehavior = 'smooth'
    
    // Set page title
    document.title = 'Hotel Virat - Luxury Accommodation & Catering Services'
    
    // Add meta description
    const metaDescription = document.querySelector('meta[name="description"]')
    if (metaDescription) {
      metaDescription.setAttribute('content', 'Experience luxury and comfort at Hotel Virat. We offer premium accommodation, exceptional catering services, and memorable hospitality experiences in Bangalore.')
    } else {
      const meta = document.createElement('meta')
      meta.name = 'description'
      meta.content = 'Experience luxury and comfort at Hotel Virat. We offer premium accommodation, exceptional catering services, and memorable hospitality experiences in Bangalore.'
      document.getElementsByTagName('head')[0].appendChild(meta)
    }

    // Global scroll test function for debugging
    window.testWebsiteScroll = (sectionId = 'catering-service') => {
      console.log(`🧪 === Testing scroll to ${sectionId} ===`)
      const element = document.getElementById(sectionId)
      if (element) {
        console.log('✅ Element found, scrolling...')
        const headerHeight = 90
        const targetPosition = element.offsetTop - headerHeight
        
        console.log(`📊 Scroll details:`, {
          elementOffsetTop: element.offsetTop,
          headerHeight: headerHeight,
          targetPosition: targetPosition,
          currentScrollPosition: window.pageYOffset
        })
        
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        })
        
        setTimeout(() => {
          console.log(`📈 New scroll position: ${window.pageYOffset}`)
          console.log(`🎯 Target was: ${targetPosition}`)
          console.log(`📏 Difference: ${Math.abs(window.pageYOffset - targetPosition)}px`)
        }, 1000)
      } else {
        console.error(`❌ Element ${sectionId} not found`)
      }
    }

    // Keyboard shortcuts for testing (Ctrl+1, Ctrl+2, etc.)
    const handleKeyDown = (e) => {
      if (e.ctrlKey) {
        const sections = ['home', 'room-booking', 'catering-service', 'download-app', 'contact-us']
        const keyNum = parseInt(e.key)
        if (keyNum >= 1 && keyNum <= 5) {
          e.preventDefault()
          const sectionId = sections[keyNum - 1]
          console.log(`⌨️ Keyboard shortcut: Scrolling to ${sectionId}`)
          window.testWebsiteScroll(sectionId)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    // Debug: Log all sections with IDs after a delay to ensure they're rendered
    setTimeout(() => {
      console.log('=== Available sections ===')
      const sections = document.querySelectorAll('section[id]')
      sections.forEach(section => {
        console.log(`- ${section.id}: offsetTop=${section.offsetTop}, height=${section.offsetHeight}`)
      })
      console.log('=== Test scrolling with: window.testWebsiteScroll("section-id") ===')
    }, 2000)

    // Cleanup function
    return () => {
      document.documentElement.style.scrollBehavior = 'auto'
      document.body.style.scrollBehavior = 'auto'
      document.removeEventListener('keydown', handleKeyDown)
      delete window.testWebsiteScroll
    }
  }, [])

  return (
    <div className="website">
      <Header />
      <main className="website-main">
        <CarouselBanner />
        <RoomBooking />
        <CateringService />
        <DownloadApp />
        <ContactUs />
      </main>
      <Footer />
    </div>
  )
}

export default Website