import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import API_BASE_URL from '../../config/api'
import './CarouselBanner.css'

const CarouselBanner = () => {
  const [bannerImages, setBannerImages] = useState([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchBannerImages()
  }, [])

  useEffect(() => {
    if (bannerImages.length > 1) {
      const interval = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % bannerImages.length)
      }, 5000) // Auto-slide every 5 seconds

      return () => clearInterval(interval)
    }
  }, [bannerImages.length])

  const fetchBannerImages = async () => {
    try {
      console.log('Fetching carousel images from:', `${API_BASE_URL}/api/website/carousel`)
      
      const response = await fetch(`${API_BASE_URL}/api/website/carousel`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Carousel API response:', data)
      
      if (data.success && data.images && data.images.length > 0) {
        // Filter only active images and sort by order
        const activeImages = data.images
          .filter(img => img.isActive)
          .sort((a, b) => (a.order || 0) - (b.order || 0))
        
        console.log('All images from API:', data.images)
        console.log('Active images only:', activeImages)
        console.log('Inactive images:', data.images.filter(img => !img.isActive))
        
        setBannerImages(activeImages)
      } else {
        console.log('No carousel images found, using fallback')
        // Fallback to default content
        setBannerImages([])
      }
    } catch (error) {
      console.error('Error fetching banner images:', error)
      // Set empty array to show placeholder
      setBannerImages([])
    } finally {
      setLoading(false)
    }
  }

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % bannerImages.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + bannerImages.length) % bannerImages.length)
  }

  const goToSlide = (index) => {
    setCurrentSlide(index)
  }

  if (loading) {
    return (
      <section id="home" className="carousel-banner">
        <div className="carousel-loading">
          <div className="loading-spinner"></div>
          <p>Loading banner images...</p>
        </div>
      </section>
    )
  }

  if (bannerImages.length === 0) {
    return (
      <section id="home" className="carousel-banner">
        <div className="carousel-placeholder">
          <div className="placeholder-content">
            <h1>Welcome to Hotel Virat</h1>
            <p>Experience luxury and comfort at its finest</p>
            <div className="placeholder-features">
              <div className="feature">
                <span>🏨</span>
                <h3>Luxury Rooms</h3>
                <p>Comfortable and elegant accommodations</p>
              </div>
              <div className="feature">
                <span>🍽️</span>
                <h3>Fine Dining</h3>
                <p>Delicious cuisine and exceptional service</p>
              </div>
              <div className="feature">
                <span>🎉</span>
                <h3>Event Hosting</h3>
                <p>Perfect venue for your special occasions</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="home" className="carousel-banner">
      <div className="carousel-container">
        <div className="carousel-wrapper">
          {bannerImages.map((image, index) => (
            <div
              key={image._id}
              className={`carousel-slide ${index === currentSlide ? 'active' : ''}`}
            >
              <img
                src={`${API_BASE_URL}${image.imageUrl}`}
                alt={image.title || `Banner ${index + 1}`}
                className="carousel-image"
                style={{
                  objectFit: 'cover',
                  objectPosition: 'center',
                  width: '100%',
                  height: '100%'
                }}
                onError={(e) => {
                  console.error('Image failed to load:', e.target.src)
                  e.target.style.display = 'none'
                }}
              />
              <div className="carousel-overlay">
                <div className="carousel-content">
                  <h1>{image.title || 'Welcome to Hotel Virat'}</h1>
                  <p>{image.description || 'Experience luxury and comfort at its finest'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {bannerImages.length > 1 && (
          <>
            <button className="carousel-nav prev" onClick={prevSlide} aria-label="Previous slide">
              <ChevronLeft size={24} />
            </button>
            <button className="carousel-nav next" onClick={nextSlide} aria-label="Next slide">
              <ChevronRight size={24} />
            </button>

            <div className="carousel-indicators">
              {bannerImages.map((_, index) => (
                <button
                  key={index}
                  className={`indicator ${index === currentSlide ? 'active' : ''}`}
                  onClick={() => goToSlide(index)}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default CarouselBanner