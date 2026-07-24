import { Utensils, Users, Clock, Star, Award, ChefHat, Sparkles } from 'lucide-react'
import './CateringService.css'

const CateringService = () => {
  // Hardcoded content to ensure text shows
  const cateringContent = {
    title: '🍽️ Premium Catering Excellence',
    subtitle: 'Transforming celebrations into culinary masterpieces since 2009',
    description: 'From intimate gatherings to grand celebrations, Hotel Virat delivers exceptional catering experiences that blend authentic flavors with modern presentation. Our award-winning culinary team crafts memorable dining experiences that delight every palate.',
    features: [
      {
        icon: 'chefhat',
        title: 'Master Culinary Team',
        description: '15+ years crafting authentic Indian & international cuisines with precision and passion'
      },
      {
        icon: 'users',
        title: 'Any Scale Event',
        description: 'From intimate 25-guest dinners to spectacular 2500+ celebrations with flawless execution'
      },
      {
        icon: 'clock',
        title: 'Perfect Execution',
        description: 'Flawless timing, elegant presentation, seamless service delivery every single time'
      },
      {
        icon: 'award',
        title: 'Premium Quality',
        description: 'Fresh ingredients, custom menus, personalized attention to every detail'
      }
    ],
    services: [
      {
        name: 'Royal Wedding Feasts',
        description: 'Multi-course traditional spreads with live counters, ceremonial service & personalized menus',
        icon: '👑',
        highlight: 'Most Booked',
      },
      {
        name: 'Corporate Events',
        description: 'Professional catering for conferences, launches, business celebrations & networking events',
        icon: '🏆',
        highlight: 'Business Favorite',
      },
      {
        name: 'Festival Celebrations',
        description: 'Cultural festivals, birthdays, anniversaries with themed presentations & custom decor',
        icon: '🎊',
        highlight: 'Family Choice',
      }
    ],
    specialties: [
      '🔥 Live Cooking Stations (Chaat, Dosa, Pasta)',
      '🍖 Traditional Tandoor & BBQ Counters',
      '🌶️ Regional Specialists (Punjabi, South Indian, Gujarati)',
      '🌍 International Buffets (Continental, Chinese, Italian)',
      '🥗 Special Diets (Jain, Vegan, Keto, Gluten-Free)',
      '🌸 Premium Table Settings & Floral Decor'
    ],
    stats: [
      { number: '750+', label: 'Events Delivered' },
      { number: '15+', label: 'Years Excellence' },
      { number: '65+', label: 'Menu Options' },
      { number: '99%', label: 'Happy Clients' }
    ],
    contactInfo: {
      phone: '+91 9876543210',
      email: 'catering@hotelvirat.com',
      whatsapp: '+91 9876543210'
    },
    isActive: true
  }

  const getIcon = (iconName) => {
    switch (iconName) {
      case 'utensils':
        return <Utensils size={20} />
      case 'users':
        return <Users size={20} />
      case 'clock':
        return <Clock size={20} />
      case 'star':
        return <Star size={20} />
      case 'award':
        return <Award size={20} />
      case 'chefhat':
        return <ChefHat size={20} />
      case 'sparkles':
        return <Sparkles size={20} />
      default:
        return <Utensils size={20} />
    }
  }

  return (
    <section id="catering-service" className="catering-service">
      <div className="container">
        {/* Ultra-Compact Header */}
        <div className="section-header">
          <div className="section-header-inner">
            <div className="header-content">
              <h2>{cateringContent.title}</h2>
              <p className="section-subtitle">{cateringContent.subtitle}</p>
            </div>
            <div className="header-stats">
              {cateringContent.stats?.map((stat, index) => (
                <div key={index} className="stat-item">
                  <div className="stat-number">{stat.number}</div>
                  <div className="stat-label">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ultra-Compact Main Content */}
        <div className="main-content">
          {/* Left: Services & Specialties */}
          <div className="content-left">
            {/* Quick Description */}
            <div className="description-compact">
              <p style={{color: '#000000', fontSize: '0.95rem', fontWeight: '600', margin: '0'}}>
                {cateringContent.description}
              </p>
            </div>

            {/* Compact Services with Pricing */}
            <div className="services-ultra-compact">
              <h3 className="section-title-enhanced">
                <Sparkles size={20} className="title-icon" />
                Our Signature Services
                <div className="title-underline"></div>
              </h3>
              <div className="services-mini-grid">
                {cateringContent.services?.map((service, index) => (
                  <div key={index} className="service-mini-card enhanced">
                    <div className="service-mini-header">
                      <span className="service-icon-large">{service.icon}</span>
                      <div className="service-mini-info">
                        <h4>{service.name}</h4>
                        <span className="service-badge">{service.highlight}</span>
                        {service.price && (
                          <span className="service-price">{service.price}</span>
                        )}
                      </div>
                    </div>
                    <p>{service.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Ultra-Compact Specialties */}
            <div className="specialties-ultra-compact">
              <h3 className="section-title-enhanced">
                <Star size={20} className="title-icon" />
                What Makes Us Special
                <div className="title-underline green"></div>
              </h3>
              <div className="specialties-mini-grid">
                {cateringContent.specialties?.map((specialty, index) => (
                  <div key={index} className="specialty-mini-tag">
                    {specialty}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Features & Contact */}
          <div className="content-right">
            {/* Ultra-Compact Features */}
            <div className="features-ultra-compact">
              <h3 className="section-title-enhanced">
                <Award size={20} className="title-icon" />
                Why Choose Hotel Virat
                <div className="title-underline orange"></div>
              </h3>
              <div className="features-mini-list">
                {cateringContent.features?.map((feature, index) => (
                  <div key={index} className="feature-mini-item enhanced">
                    <div className="feature-mini-icon">
                      {getIcon(feature.icon)}
                    </div>
                    <div className="feature-mini-content">
                      <h4>{feature.title}</h4>
                      <p>{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ultra-Compact Contact & CTA */}
            <div className="contact-cta-combo">
              <div className="contact-ultra-compact enhanced">
                <h3 className="section-title-enhanced">
                  <Utensils size={20} className="title-icon" />
                  Get Instant Quote
                  <div className="title-underline blue"></div>
                </h3>
                <div className="contact-mini-options">
                  <a href={`tel:${cateringContent.contactInfo?.phone}`} className="contact-mini-btn call enhanced">
                    <span className="btn-icon">📞</span>
                    <div className="btn-mini-content">
                      <span className="btn-label">Call Now</span>
                      <span className="btn-value">{cateringContent.contactInfo?.phone}</span>
                    </div>
                  </a>
                  
                  <a href={`https://wa.me/${cateringContent.contactInfo?.whatsapp?.replace(/[^0-9]/g, '')}`} 
                     target="_blank" rel="noopener noreferrer" className="contact-mini-btn whatsapp enhanced">
                    <span className="btn-icon">💬</span>
                    <div className="btn-mini-content">
                      <span className="btn-label">WhatsApp</span>
                      <span className="btn-value">Quick Quote</span>
                    </div>
                  </a>
                </div>
              </div>

              {/* Ultra-Compact CTA */}
              <div className="cta-ultra-compact enhanced">
                <div className="cta-mini-offer">
                  <span className="offer-mini-badge">🎉 February Special</span>
                  <h4>Book Now & Save 20%</h4>
                  <p>Free menu tasting + complimentary decoration</p>
                </div>
                <button 
                  className="cta-mini-btn enhanced"
                  onClick={() => {
                    const element = document.getElementById('contact-us')
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth' })
                    }
                  }}
                >
                  Get Free Consultation
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default CateringService