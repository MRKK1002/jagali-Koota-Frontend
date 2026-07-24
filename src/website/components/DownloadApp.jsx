import React from 'react'
import './DownloadApp.css'
import appScreenshot from '../../assets/copyimage.jpeg'

const DownloadApp = () => {
  const appContent = {
    title: 'Download Hotel Virat App',
    subtitle: 'Book rooms, order food & get exclusive deals on your mobile',
    description: 'Experience seamless hotel booking with our mobile app. Get instant confirmations, exclusive discounts, and 24/7 support right at your fingertips.',
    features: [
      'Quick Room Booking',
      'Food & Room Service', 
      'Exclusive Mobile Offers',
      'Instant Notifications',
      'Secure Payments',
      'Customer Support'
    ],
    downloadLinks: {
      ios: 'https://apps.apple.com/in/app/hotel-virat/id6751843636',
      android: 'https://play.google.com/store/apps/details?id=com.hotelvirat&hl=en_IN'
    },
    isActive: true
  }

  return (
    <section id="download-app" className="download-app">
      <div className="container">
        {/* Simple Header */}
        <div className="section-header">
          <h2>{appContent.title}</h2>
          <p className="section-subtitle">{appContent.subtitle}</p>
        </div>

        {/* Main Content */}
        <div className="app-main">
          {/* Left: Content */}
          <div className="app-content">
            <div className="app-description">
              <p>{appContent.description}</p>
            </div>

            {/* Features List */}
            <div className="app-features">
              <h3>What you can do:</h3>
              <div className="features-list">
                {appContent.features.map((feature, index) => (
                  <div key={index} className="feature-item">
                    <span className="feature-check">✓</span>
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Download Buttons - Very Clear */}
            <div className="download-section">
              <h3>Download Now - Available on Both Platforms</h3>
              <div className="download-buttons">
                {/* iOS Button */}
                <a 
                  href={appContent.downloadLinks.ios} 
                  className="download-btn ios-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="btn-left">
                    <span className="apple-icon">🍎</span>
                  </div>
                  <div className="btn-right">
                    <span className="btn-text">Download on the</span>
                    <span className="btn-store">App Store</span>
                    <span className="btn-device">For iPhone & iPad</span>
                  </div>
                </a>

                {/* Android Button */}
                <a 
                  href={appContent.downloadLinks.android} 
                  className="download-btn android-btn"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <div className="btn-left">
                    <span className="play-icon">▶️</span>
                  </div>
                  <div className="btn-right">
                    <span className="btn-text">Get it on</span>
                    <span className="btn-store">Google Play</span>
                    <span className="btn-device">For Android Devices</span>
                  </div>
                </a>
              </div>

              {/* Additional Info */}
              <div className="download-info">
                <div className="info-item">
                  <span className="info-icon">⭐</span>
                  <span>4.8★ Rating</span>
                </div>
                <div className="info-item">
                  <span className="info-icon">📱</span>
                  <span>50K+ Downloads</span>
                </div>
                <div className="info-item">
                  <span className="info-icon">💰</span>
                  <span>Free Download</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Phone Preview */}
          <div className="app-preview">
            <div className="phone-container">
              <div className="phone-with-image">
               <img 
  src={appScreenshot}
  alt="Hotel Virat App Screenshot" 
  className="app-screenshot"
/>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default DownloadApp