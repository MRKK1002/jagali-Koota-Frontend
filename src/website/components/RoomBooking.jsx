
import { useState, useEffect } from 'react'
import API_BASE_URL from '../../config/api'
import './RoomBooking.css'

// Calendar Widget Component
const CalendarWidget = ({ selectedRoom, bookedDates, onDateSelect, selectedCheckIn, selectedCheckOut }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectingCheckOut, setSelectingCheckOut] = useState(false)

  // Fix timezone issues by using local date
  const today = new Date()
  const todayStr = today.getFullYear() + '-' + 
                  String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                  String(today.getDate()).padStart(2, '0')
  
  console.log('Calendar Debug - Today:', {
    todayDate: today,
    todayString: todayStr,
    todayISO: today.toISOString().split('T')[0],
    localDate: today.toLocaleDateString(),
    getDate: today.getDate(),
    getMonth: today.getMonth(),
    getFullYear: today.getFullYear()
  })

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  
  // Get first day of month and number of days
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const startingDayOfWeek = firstDay.getDay()
  
  // Get booked dates for this room
  const roomBookedDates = bookedDates[selectedRoom._id]?.dates || []
  const bookedDatesSet = new Set(roomBookedDates.map(booking => booking.date))
  
  console.log('Calendar Debug - Booked dates for room:', {
    roomId: selectedRoom._id,
    roomNumber: selectedRoom.roomNumber,
    bookedDates: roomBookedDates,
    bookedDatesSet: Array.from(bookedDatesSet)
  })
  
  // Generate calendar days
  const calendarDays = []
  
  // Add empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarDays.push(null)
  }
  
  // Add days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day)
    const dateStr = date.getFullYear() + '-' + 
                   String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                   String(date.getDate()).padStart(2, '0')
    
    const isBooked = bookedDatesSet.has(dateStr)
    const isPast = dateStr < todayStr
    const isSelected = dateStr === selectedCheckIn || dateStr === selectedCheckOut
    const isInRange = selectedCheckIn && selectedCheckOut && 
                     dateStr > selectedCheckIn && dateStr < selectedCheckOut
    const isToday = dateStr === todayStr
    
    console.log(`Calendar Debug - Day ${day}:`, {
      dateStr,
      todayStr,
      isToday,
      isBooked,
      isPast
    })
    
    calendarDays.push({
      day,
      date: dateStr,
      isBooked,
      isPast,
      isSelected,
      isInRange,
      isToday
    })
  }
  
  const handleDateClick = (dayInfo) => {
    if (!dayInfo || dayInfo.isPast) {
      return
    }
    
    if (dayInfo.isBooked) {
      const bookedInfo = roomBookedDates.find(booking => booking.date === dayInfo.date)
      console.log('🚫 Date is booked:', {
        date: dayInfo.date,
        bookedInfo,
        allBookedDates: roomBookedDates
      })
      alert(`❌ This date is already booked!\n\nDate: ${new Date(dayInfo.date).toLocaleDateString()}\nStatus: ${bookedInfo?.status || 'Unknown'}`)
      return
    }
    
    console.log('✅ Date selected:', dayInfo.date, 'Selecting:', selectingCheckOut ? 'Check-out' : 'Check-in')
    onDateSelect(dayInfo.date, selectingCheckOut)
    setSelectingCheckOut(!selectingCheckOut)
  }
  
  const goToPrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1))
  }
  
  const goToNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1))
  }
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  
  return (
    <div className="calendar-widget">
      <div className="calendar-header">
        <button type="button" onClick={goToPrevMonth} className="calendar-nav-btn">‹</button>
        <h3>{monthNames[month]} {year}</h3>
        <button type="button" onClick={goToNextMonth} className="calendar-nav-btn">›</button>
      </div>
      
      <div className="calendar-grid">
        {dayNames.map(day => (
          <div key={day} className="calendar-day-header">{day}</div>
        ))}
        
        {calendarDays.map((dayInfo, index) => (
          <div
            key={index}
            className={`calendar-day ${
              !dayInfo ? 'empty' :
              dayInfo.isPast ? 'past' :
              dayInfo.isBooked ? 'booked' :
              dayInfo.isSelected ? 'selected' :
              dayInfo.isInRange ? 'in-range' :
              dayInfo.isToday ? 'today' :
              'available'
            }`}
            onClick={() => handleDateClick(dayInfo)}
          >
            {dayInfo && (
              <>
                <span className="day-number">{dayInfo.day}</span>
                {dayInfo.isBooked && <span className="booked-dot">●</span>}
                {dayInfo.isToday && <span className="today-indicator">Today</span>}
              </>
            )}
          </div>
        ))}
      </div>
      
      <div className="calendar-instructions">
        {!selectedCheckIn ? (
          <p>📅 Click on an available date to select check-in</p>
        ) : !selectedCheckOut ? (
          <p>📅 Click on another available date to select check-out</p>
        ) : (
          <p>✅ {selectedCheckIn} to {selectedCheckOut} selected</p>
        )}
      </div>
    </div>
  )
}

const RoomBooking = () => {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [existingBookings, setExistingBookings] = useState([])
  const [bookedDates, setBookedDates] = useState({})
  const [bookingData, setBookingData] = useState({
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    checkInDate: '',
    checkOutDate: '',
    adults: 1,
    children: 0,
    specialRequests: ''
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchRooms()
    fetchExistingBookings()
  }, [])

  const fetchRooms = async () => {
    try {
      setLoading(true)
      console.log('Fetching rooms from:', `${API_BASE_URL}/api/v1/hotel/room`)
      
      const response = await fetch(`${API_BASE_URL}/api/v1/hotel/room`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Rooms API response:', data)
      
      // Filter only available rooms and sort by room number
      const availableRooms = data
        .filter(room => room.isAvailable)
        .sort((a, b) => {
          const numA = parseInt(a.roomNumber) || 0
          const numB = parseInt(b.roomNumber) || 0
          return numA - numB
        })
      setRooms(availableRooms)
    } catch (error) {
      console.error('Error fetching rooms:', error)
      setRooms([])
    } finally {
      setLoading(false)
    }
  }

  const fetchExistingBookings = async () => {
    try {
      console.log('Fetching existing bookings...')
      const response = await fetch(`${API_BASE_URL}/api/v1/hotel/room-booking`)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Existing bookings:', data)
      
      if (data.success && data.bookings) {
        setExistingBookings(data.bookings)
        processBookedDates(data.bookings)
      }
    } catch (error) {
      console.error('Error fetching existing bookings:', error)
    }
  }

  const processBookedDates = (bookings) => {
    const bookedDatesMap = {}
    
    console.log('🔍 Processing bookings:', bookings.length, 'bookings')
    
    bookings.forEach(booking => {
      // Only consider active bookings (confirmed, pending, checked-in)
      // EXCLUDE: cancelled, checked-out, completed
      if (['confirmed', 'pending', 'checked-in'].includes(booking.status)) {
        const roomId = booking.roomId?._id || booking.roomId
        const roomNumber = booking.roomId?.roomNumber || 'Unknown'
        
        console.log('📋 Active booking found:', {
          bookingId: booking._id,
          roomNumber,
          checkIn: booking.checkInDate,
          checkOut: booking.checkOutDate,
          status: booking.status
        })
        
        if (!bookedDatesMap[roomId]) {
          bookedDatesMap[roomId] = {
            roomNumber: roomNumber,
            dates: []
          }
        }
        
        // Add all dates between check-in and check-out (EXCLUDING check-out date)
        const checkIn = new Date(booking.checkInDate)
        const checkOut = new Date(booking.checkOutDate)
        
        // Set time to midnight to avoid timezone issues
        checkIn.setHours(0, 0, 0, 0)
        checkOut.setHours(0, 0, 0, 0)
        
        console.log('📅 Processing booking:', {
          roomNumber: roomNumber,
          checkInDate: booking.checkInDate,
          checkOutDate: booking.checkOutDate,
          checkInParsed: checkIn.toISOString().split('T')[0],
          checkOutParsed: checkOut.toISOString().split('T')[0],
          status: booking.status
        })
        
        // Loop through dates from check-in to check-out (EXCLUDING check-out)
        for (let date = new Date(checkIn); date < checkOut; date.setDate(date.getDate() + 1)) {
          // Use consistent date formatting (YYYY-MM-DD)
          const dateStr = date.getFullYear() + '-' + 
                         String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                         String(date.getDate()).padStart(2, '0')
          
          console.log('  ➕ Adding booked date:', dateStr, 'for room:', roomNumber)
          
          bookedDatesMap[roomId].dates.push({
            date: dateStr,
            guestName: booking.guestName,
            status: booking.status,
            bookingId: booking._id
          })
        }
        
        console.log('  ✅ Total booked dates for room', roomNumber, ':', bookedDatesMap[roomId].dates.length)
      }
    })
    
    console.log('Final processed booked dates:', bookedDatesMap)
    setBookedDates(bookedDatesMap)
  }

  const checkDateConflict = (roomId, checkInDate, checkOutDate) => {
    const roomBookings = bookedDates[roomId]
    if (!roomBookings) return null
    
    const checkIn = new Date(checkInDate)
    const checkOut = new Date(checkOutDate)
    
    // Set time to midnight to avoid timezone issues
    checkIn.setHours(0, 0, 0, 0)
    checkOut.setHours(0, 0, 0, 0)
    
    console.log('🔍 Checking date conflict:', {
      roomId,
      checkInDate,
      checkOutDate,
      checkInParsed: checkIn.toISOString().split('T')[0],
      checkOutParsed: checkOut.toISOString().split('T')[0],
      bookedDatesCount: roomBookings.dates.length
    })
    
    // Check each date in the requested range (EXCLUDING check-out date)
    // This matches hotel industry standard: checkout date is available for new check-ins
    for (let date = new Date(checkIn); date < checkOut; date.setDate(date.getDate() + 1)) {
      const dateStr = date.getFullYear() + '-' + 
                     String(date.getMonth() + 1).padStart(2, '0') + '-' + 
                     String(date.getDate()).padStart(2, '0')
      const conflictingBooking = roomBookings.dates.find(booking => booking.date === dateStr)
      
      console.log('  📅 Checking date:', dateStr, '- Conflict:', !!conflictingBooking)
      
      if (conflictingBooking) {
        console.log('  ❌ CONFLICT FOUND on date:', dateStr)
        return {
          conflictDate: dateStr,
          guestName: conflictingBooking.guestName,
          status: conflictingBooking.status,
          roomNumber: roomBookings.roomNumber
        }
      }
    }
    
    console.log('  ✅ No conflicts found!')
    return null
  }

  const handleBookRoom = (room) => {
    setSelectedRoom(room)
    setShowBookingModal(true)
  }

  const handleCloseModal = () => {
    setShowBookingModal(false)
    setSelectedRoom(null)
    setBookingData({
      guestName: '',
      guestEmail: '',
      guestPhone: '',
      checkInDate: '',
      checkOutDate: '',
      adults: 1,
      children: 0,
      specialRequests: ''
    })
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    console.log('📝 Input changed:', { name, value })
    setBookingData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleCalendarDateSelect = (dateStr, isCheckOut) => {
    console.log('📅 Calendar date selected:', {
      dateStr,
      isCheckOut,
      currentCheckIn: bookingData.checkInDate,
      currentCheckOut: bookingData.checkOutDate
    })
    
    if (isCheckOut) {
      // Selecting check-out date
      if (dateStr < bookingData.checkInDate) {
        alert('Check-out date cannot be before check-in date')
        return
      }
      
      console.log('🔍 Checking conflict for range:', bookingData.checkInDate, '→', dateStr)
      
      // Check for conflicts in the date range
      const conflict = checkDateConflict(selectedRoom._id, bookingData.checkInDate, dateStr)
      if (conflict) {
        alert(`❌ Room ${conflict.roomNumber} is already booked!\n\n` +
              `Conflict Date: ${new Date(conflict.conflictDate).toLocaleDateString()}\n` +
              `Status: ${conflict.status}\n\n` +
              `Please select different dates.`)
        return
      }
      
      setBookingData(prev => ({
        ...prev,
        checkOutDate: dateStr
      }))
    } else {
      // Selecting check-in date
      setBookingData(prev => ({
        ...prev,
        checkInDate: dateStr,
        checkOutDate: '' // Clear check-out when check-in changes
      }))
    }
  }

  const handleSubmitBooking = async (e) => {
    e.preventDefault()
    
    console.log('📝 Form submission started:', {
      guestName: bookingData.guestName,
      guestEmail: bookingData.guestEmail,
      checkInDate: bookingData.checkInDate,
      checkOutDate: bookingData.checkOutDate,
      adults: bookingData.adults,
      children: bookingData.children
    })
    
    if (!bookingData.guestName || !bookingData.guestEmail || !bookingData.checkInDate || !bookingData.checkOutDate) {
      alert('Please fill in all required fields')
      return
    }

    console.log('🔍 Final conflict check before submission:', {
      roomId: selectedRoom._id,
      checkInDate: bookingData.checkInDate,
      checkOutDate: bookingData.checkOutDate
    })

    // Final conflict check before submission
    const conflict = checkDateConflict(selectedRoom._id, bookingData.checkInDate, bookingData.checkOutDate)
    if (conflict) {
      alert(`❌ Room ${conflict.roomNumber} is already booked!\n\n` +
            `Conflict Date: ${new Date(conflict.conflictDate).toLocaleDateString()}\n` +
            `Status: ${conflict.status}\n\n` +
            `Please select different dates.`)
      return
    }

    try {
      setSubmitting(true)
      
      const bookingPayload = {
        roomId: selectedRoom._id,
        guestName: bookingData.guestName,
        guestEmail: bookingData.guestEmail,
        guestPhone: bookingData.guestPhone,
        checkInDate: bookingData.checkInDate,
        checkOutDate: bookingData.checkOutDate,
        adults: parseInt(bookingData.adults),
        children: parseInt(bookingData.children),
        specialRequests: bookingData.specialRequests,
        totalAmount: selectedRoom.price,
        status: 'pending'
      }

      console.log('Submitting booking:', bookingPayload)

      const response = await fetch(`${API_BASE_URL}/api/v1/hotel/room-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bookingPayload)
      })

      const data = await response.json()
      
      if (response.ok && data.success) {
        alert('✅ Room booked successfully! We will contact you soon to confirm your reservation.')
        handleCloseModal()
        fetchRooms() // Refresh rooms
        fetchExistingBookings() // Refresh bookings
      } else {
        alert('Error: ' + (data.message || 'Failed to book room'))
      }
    } catch (error) {
      console.error('Error submitting booking:', error)
      alert('Failed to book room. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const formatPrice = (price) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(price)
  }

  if (loading) {
    return (
      <section id="room-booking" className="room-booking">
        <div className="container">
          <div className="section-header">
            <h2>Room Booking</h2>
            <p className="section-subtitle">Book your comfortable stay with us</p>
          </div>
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading available rooms...</p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="room-booking" className="room-booking">
      <div className="container">
        <div className="section-header">
          <h2>Room Booking</h2>
          <p className="section-subtitle">Book your comfortable stay with us</p>
        </div>

        {rooms.length === 0 ? (
          <div className="no-rooms">
            <h3>No Rooms Available</h3>
            <p>Sorry, no rooms are currently available for booking. Please contact us directly.</p>
            <div className="contact-buttons">
              <a href="tel:+919876543210" className="contact-btn">
                📞 Call Now
              </a>
              <button 
                onClick={() => {
                  const element = document.getElementById('contact-us')
                  if (element) {
                    element.scrollIntoView({ behavior: 'smooth' })
                  }
                }}
                className="contact-btn"
              >
                ✉️ Contact Form
              </button>
            </div>
          </div>
        ) : (
          <div className="rooms-grid">
            {rooms.map((room) => (
              <div key={room._id} className="room-card">
                <div className="room-images">
                  {room.images && room.images.length > 0 ? (
                    <img 
                      src={`${API_BASE_URL}/${room.images[0]}`} 
                      alt={`${room.roomType} Room`}
                      onError={(e) => {
                        e.target.src = '/placeholder-room.jpg'
                      }}
                    />
                  ) : (
                    <div className="no-image">
                      <span>🏨</span>
                      <p>No Image</p>
                    </div>
                  )}
                </div>
                
                <div className="room-info">
                  <div className="room-header">
                    <h3>{room.roomType} Room</h3>
                    <div className="room-price">{formatPrice(room.price)}/night</div>
                  </div>
                  
                  <div className="room-details">
                    <p className="room-floor">Floor: {room.floor}</p>
                    {room.roomNumber && <p className="room-number">Room: {room.roomNumber}</p>}
                    <p className="room-capacity">
                      👥 {room.capacity?.adults || 2} Adults, {room.capacity?.children || 0} Children
                    </p>
                  </div>

                  {room.description && (
                    <p className="room-description">{room.description}</p>
                  )}

                  <div className="room-amenities">
                    <h4>Amenities:</h4>
                    <div className="amenities-list">
                      {room.amenities?.tv && <span className="amenity">📺 TV</span>}
                      {room.amenities?.ac && <span className="amenity">❄️ AC</span>}
                      {room.amenities?.wifi && <span className="amenity">📶 WiFi</span>}
                      {room.amenities?.minibar && <span className="amenity">🍷 Minibar</span>}
                      {room.amenities?.roomService && <span className="amenity">🛎️ Room Service</span>}
                      {room.amenities?.balcony && <span className="amenity">🌅 Balcony</span>}
                    </div>
                  </div>

                  <button 
                    className="book-btn"
                    onClick={() => handleBookRoom(room)}
                  >
                    Book This Room
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Booking Modal */}
        {showBookingModal && selectedRoom && (
          <div className="modal-overlay" onClick={handleCloseModal}>
            <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title">
                  <h3>Book {selectedRoom.roomType} Room</h3>
                </div>
                <button className="modal-close" onClick={handleCloseModal} type="button" aria-label="Close modal">
                  <span>&times;</span>
                </button>
              </div>

              <form onSubmit={handleSubmitBooking}>
                <div className="modal-body-container">
                  <div className="modal-body">
                  <div className="room-summary">
                    <h4>Room Details</h4>
                    <p><strong>Type:</strong> {selectedRoom.roomType}</p>
                    <p><strong>Price:</strong> {formatPrice(selectedRoom.price)} per night</p>
                    <p><strong>Capacity:</strong> {selectedRoom.capacity?.adults || 2} Adults, {selectedRoom.capacity?.children || 0} Children</p>
                    {selectedRoom.roomNumber && <p><strong>Room Number:</strong> {selectedRoom.roomNumber}</p>}
                  </div>

                  {/* Visual Calendar */}
                  <div className="visual-calendar">
                    <h4>📅 Select Your Dates</h4>
                    <div className="calendar-legend">
                      <span className="legend-item">
                        <span className="legend-dot available"></span>
                        Available
                      </span>
                      <span className="legend-item">
                        <span className="legend-dot booked"></span>
                        Booked
                      </span>
                      <span className="legend-item">
                        <span className="legend-dot selected"></span>
                        Selected
                      </span>
                    </div>
                    <CalendarWidget 
                      selectedRoom={selectedRoom}
                      bookedDates={bookedDates}
                      onDateSelect={handleCalendarDateSelect}
                      selectedCheckIn={bookingData.checkInDate}
                      selectedCheckOut={bookingData.checkOutDate}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="guestName">Full Name *</label>
                      <input
                        type="text"
                        id="guestName"
                        name="guestName"
                        value={bookingData.guestName}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="guestEmail">Email *</label>
                      <input
                        type="email"
                        id="guestEmail"
                        name="guestEmail"
                        value={bookingData.guestEmail}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="guestPhone">Phone Number</label>
                      <input
                        type="tel"
                        id="guestPhone"
                        name="guestPhone"
                        value={bookingData.guestPhone}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="checkInDate">Check-in Date *</label>
                      <input
                        type="date"
                        id="checkInDate"
                        name="checkInDate"
                        value={bookingData.checkInDate}
                        onChange={handleInputChange}
                        min={new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="checkOutDate">Check-out Date *</label>
                      <input
                        type="date"
                        id="checkOutDate"
                        name="checkOutDate"
                        value={bookingData.checkOutDate}
                        onChange={handleInputChange}
                        min={bookingData.checkInDate || new Date().toISOString().split('T')[0]}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="adults">Adults</label>
                      <select
                        id="adults"
                        name="adults"
                        value={bookingData.adults}
                        onChange={handleInputChange}
                      >
                        <option value="1">1 Adult</option>
                        <option value="2">2 Adults</option>
                        <option value="3">3 Adults</option>
                        <option value="4">4 Adults</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="children">Children</label>
                      <select
                        id="children"
                        name="children"
                        value={bookingData.children}
                        onChange={handleInputChange}
                      >
                        <option value="0">0 Children</option>
                        <option value="1">1 Child</option>
                        <option value="2">2 Children</option>
                        <option value="3">3 Children</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="specialRequests">Special Requests</label>
                    <textarea
                      id="specialRequests"
                      name="specialRequests"
                      value={bookingData.specialRequests}
                      onChange={handleInputChange}
                      rows="3"
                      placeholder="Any special requests or requirements..."
                    />
                  </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={handleCloseModal}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? 'Booking...' : 'Confirm Booking'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default RoomBooking