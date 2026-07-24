import { useState } from 'react'
import { Mail, Phone, MapPin, Send, CheckCircle } from 'lucide-react'
import { API_ENDPOINTS, apiCall } from '../../config/api'
import './ContactUs.css'

const ContactUs = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState(null) // 'success', 'error', null

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitStatus(null)

    try {
      await apiCall(API_ENDPOINTS.CONTACT, {
        method: 'POST',
        body: JSON.stringify(formData)
      })

      setSubmitStatus('success')
      setFormData({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: ''
      })
    } catch (error) {
      console.error('Error submitting contact form:', error)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section id="contact-us" className="contact-us">
      <div className="container">
        <div className="section-header">
          <h2>Contact Us</h2>
          <p className="section-subtitle">Get in touch with us for any inquiries or bookings</p>
        </div>

        <div className="contact-content">
          <div className="contact-info">
            <div className="info-card">
              <div className="info-icon">
                <Phone size={24} />
              </div>
              <div className="info-content">
                <h3>Phone</h3>
                <p>+91 9876543210</p>
                <p>+91 9876543211</p>
              </div>
            </div>

            <div className="info-card">
              <div className="info-icon">
                <Mail size={24} />
              </div>
              <div className="info-content">
                <h3>Email</h3>
                <p>info@hotelvirat.com</p>
                <p>booking@hotelvirat.com</p>
              </div>
            </div>

            <div className="info-card"  onClick={() => window.open('https://www.google.com/maps/search/?api=1&query=Hotel+Virat+Sridarshini+149/A+Chord+Rd+next+to+Iskcon+Temple+Rajajinagar+Bengaluru+Karnataka+560010', '_blank')}
  style={{ cursor: 'pointer' }}
  >
              <div className="info-icon">
                <MapPin size={24} />
              </div>
              <div className="info-content">
                <h3>Address</h3>
                <p>Hotel Virat Sridarshini</p>
                <p>Rajaji Nagar, Bangalore</p>
                <p>Karnataka, India</p>
              </div>
            </div>
          </div>

          <div className="contact-form-container">
            <form onSubmit={handleSubmit} className="contact-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">Full Name *</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your full name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="email">Email Address *</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    placeholder="Enter your phone number"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="subject">Subject *</label>
                  <select
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select a subject</option>
                    <option value="room-booking">Room Booking</option>
                    <option value="catering-service">Catering Service</option>
                    <option value="general-inquiry">General Inquiry</option>
                    <option value="feedback">Feedback</option>
                    <option value="complaint">Complaint</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="message">Message *</label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  required
                  rows="5"
                  placeholder="Enter your message here..."
                ></textarea>
              </div>

              {submitStatus === 'success' && (
                <div className="form-message success">
                  <CheckCircle size={20} />
                  <span>Thank you! Your message has been sent successfully. We'll get back to you soon.</span>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="form-message error">
                  <span>Sorry, there was an error sending your message. Please try again or contact us directly.</span>
                </div>
              )}

              <button 
                type="submit" 
                className="submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="loading-spinner"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    Send Message
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ContactUs