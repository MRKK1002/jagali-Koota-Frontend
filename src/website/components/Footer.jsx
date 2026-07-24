import { Mail, Phone, MapPin, Facebook, Twitter, Instagram, Linkedin } from 'lucide-react'
import './Footer.css'

const Footer = () => {
  const currentYear = new Date().getFullYear()

  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <footer className="website-footer">
      <div className="footer-content">
        <div className="container">
          <div className="footer-grid">
            {/* Company Info */}
            <div className="footer-section">
              <h3>Hotel Virat</h3>
              <p>Experience luxury and comfort at its finest. We provide exceptional hospitality services including comfortable accommodations, delicious catering, and memorable experiences.</p>
              <div className="social-links">
                <a href="#" aria-label="Facebook">
                  <Facebook size={20} />
                </a>
                <a href="#" aria-label="Twitter">
                  <Twitter size={20} />
                </a>
                <a href="#" aria-label="Instagram">
                  <Instagram size={20} />
                </a>
                <a href="#" aria-label="LinkedIn">
                  <Linkedin size={20} />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div className="footer-section">
              <h4>Quick Links</h4>
              <ul>
                <li>
                  <button onClick={() => scrollToSection('home')}>Home</button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('room-booking')}>Room Booking</button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('catering-service')}>Catering Service</button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('download-app')}>Download App</button>
                </li>
                <li>
                  <button onClick={() => scrollToSection('contact-us')}>Contact Us</button>
                </li>
              </ul>
            </div>

            {/* Services */}
            <div className="footer-section">
              <h4>Our Services</h4>
              <ul>
                <li>Room Accommodation</li>
                <li>Catering Services</li>
                <li>Event Management</li>
                <li>Wedding Planning</li>
                <li>Corporate Events</li>
                <li>Food Delivery</li>
              </ul>
            </div>

            {/* Contact Info */}
            <div className="footer-section">
              <h4>Contact Information</h4>
              <div className="contact-item">
                <Phone size={16} />
                <div>
                  <p>+91 9876543210</p>
                  <p>+91 9876543211</p>
                </div>
              </div>
              <div className="contact-item">
                <Mail size={16} />
                <div>
                  <p>info@hotelvirat.com</p>
                  <p>booking@hotelvirat.com</p>
                </div>
              </div>
              <div className="contact-item">
                <MapPin size={16} />
                <div>
                  <p>Hotel Virat Sridarshini</p>
                  <p>Rajaji Nagar, Bangalore</p>
                  <p>Karnataka, India</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <div className="container">
          <div className="footer-bottom-content">
            <p>&copy; {currentYear} Hotel Virat. All rights reserved.</p>
            {/* <div className="footer-links">
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Cookie Policy</a>
            </div> */}
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer