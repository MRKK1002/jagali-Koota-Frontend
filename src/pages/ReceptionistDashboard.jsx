import { useState, useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Search, LogOut, RefreshCw, Bed, User, Phone, Mail, Calendar, X, Check, AlertCircle, Printer } from "lucide-react"
import axios from "axios"
import hotelViratLogo from "../assets/logo4.jpeg"

const API_BASE = import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"

const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
})

// Add CSS animations
const styleSheet = document.createElement("style")
styleSheet.textContent = `
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slideUp {
    from { 
      opacity: 0;
      transform: translateY(30px) scale(0.95);
    }
    to { 
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }
  @keyframes slideDown {
    from { 
      opacity: 0;
      transform: translateY(-10px);
    }
    to { 
      opacity: 1;
      transform: translateY(0);
    }
  }
`
document.head.appendChild(styleSheet)

// Helper function to generate sequential bill numbers
const generateBillNumber = (booking, allBookings = []) => {
  if (!booking || !booking._id) return '-001'
  
  // Get the creation date of the booking
  const bookingDate = new Date(booking.createdAt || booking.checkInDate)
  const bookingYear = bookingDate.getFullYear()
  const bookingMonth = bookingDate.getMonth()
  
  // Filter bookings from the same month and year, and sort by creation date
  const sameMonthBookings = allBookings
    .filter(b => {
      const bDate = new Date(b.createdAt || b.checkInDate)
      return bDate.getFullYear() === bookingYear && bDate.getMonth() === bookingMonth
    })
    .sort((a, b) => {
      const dateA = new Date(a.createdAt || a.checkInDate)
      const dateB = new Date(b.createdAt || b.checkInDate)
      return dateA - dateB
    })
  
  // Find the index of current booking in the sorted list
  const bookingIndex = sameMonthBookings.findIndex(b => b._id === booking._id)
  const sequentialNumber = bookingIndex >= 0 ? bookingIndex + 1 : 1
  
  // Format as -001, -002, etc.
  return `-${String(sequentialNumber).padStart(3, '0')}`
}

const BookingModal = ({ room, allBookings, onClose, onBook }) => {
  const [formData, setFormData] = useState({
    guestName: "",
    guestPhone: "",
    guestEmail: "",
    guestGstNumber: "",
    aadhaarNumber: "",
    aadhaarPic: null, // New: Aadhaar picture upload (optional)
    visaPic: null, // New: Visa picture upload instead of PAN (optional)
    checkInDate: new Date().toISOString().split('T')[0],
    checkOutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    checkInHour: "12",
    checkInMinute: "00",
    checkInPeriod: "PM",
    checkOutHour: "12",
    checkOutMinute: "00",
    checkOutPeriod: "PM",
    customAmount: "", // New: Custom amount if exceeding 24 hours
    gstType: "none", // none, gst (CGST+SGST), igst (out of state)
    discountPercent: "", // discount percentage
    amountPaid: "",
    paymentMethod: "cash", // cash or online
    selectedHourlyDurations: [], // Array of selected durations: ['3hours', '6hours', '9hours', '12hours']
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  
  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false)
  const [calendarFor, setCalendarFor] = useState('checkIn') // 'checkIn' or 'checkOut'
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [monthlyBookings, setMonthlyBookings] = useState({})
  const [calendarLoading, setCalendarLoading] = useState(false)

  // Refresh calendar data when allBookings changes
  useEffect(() => {
    if (showCalendar && room && room._id && allBookings.length > 0) {
      fetchMonthlyBookings(room._id, calendarMonth.getFullYear(), calendarMonth.getMonth())
    }
  }, [allBookings, showCalendar, room, calendarMonth])

  const calculateNights = () => {
    const checkIn = new Date(formData.checkInDate)
    const checkOut = new Date(formData.checkOutDate)
    const diff = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 1
  }

  const nights = calculateNights()
  
  // Calculate if booking exceeds 24 hours based on check-in and check-out times
  const calculateHoursDifference = () => {
    // Convert 12-hour format to 24-hour format
    const checkInHour24 = formData.checkInPeriod === "PM" && formData.checkInHour !== "12" 
      ? parseInt(formData.checkInHour) + 12 
      : formData.checkInPeriod === "AM" && formData.checkInHour === "12"
      ? 0
      : parseInt(formData.checkInHour)
    
    const checkOutHour24 = formData.checkOutPeriod === "PM" && formData.checkOutHour !== "12"
      ? parseInt(formData.checkOutHour) + 12
      : formData.checkOutPeriod === "AM" && formData.checkOutHour === "12"
      ? 0
      : parseInt(formData.checkOutHour)
    
    const checkInTime = `${String(checkInHour24).padStart(2, '0')}:${formData.checkInMinute}`
    const checkOutTime = `${String(checkOutHour24).padStart(2, '0')}:${formData.checkOutMinute}`
    
    const checkInDateTime = new Date(`${formData.checkInDate}T${checkInTime}`)
    const checkOutDateTime = new Date(`${formData.checkOutDate}T${checkOutTime}`)
    const diffInHours = (checkOutDateTime - checkInDateTime) / (1000 * 60 * 60)
    return diffInHours
  }

  const isExceeding24Hours = () => {
    const hours = calculateHoursDifference()
    const nights = calculateNights()
    const isExceeding = hours > (nights * 24)
    console.log('24-hour check:', { hours, nights, threshold: nights * 24, isExceeding })
    return isExceeding
  }
  
  
  const getDurationPrice = () => {
    if (!room.hourlyPricing?.enabled || !formData.selectedHourlyDurations || formData.selectedHourlyDurations.length === 0) {
      return room.price * nights
    }
    
   
    let totalPrice = 0
    formData.selectedHourlyDurations.forEach(duration => {
      switch (duration) {
        case '3hours':
          totalPrice += room.hourlyPricing.threeHours || 0
          break
        case '6hours':
          totalPrice += room.hourlyPricing.sixHours || 0
          break
        case '9hours':
          totalPrice += room.hourlyPricing.nineHours || 0
          break
        case '12hours':
          totalPrice += room.hourlyPricing.twelveHours || 0
          break
      }
    })
    
    return totalPrice
  }
 
  const roomBaseAmount = getDurationPrice()
  
  // Add custom amount on top if exceeding 24 hours
  const customAmountValue = (isExceeding24Hours() && formData.customAmount) 
    ? parseFloat(formData.customAmount) 
    : 0
  
  const baseAmount = roomBaseAmount + customAmountValue
  
  // Discount Calculation
  const discountPercent = parseFloat(formData.discountPercent) || 0
  const discountAmount = (baseAmount * discountPercent) / 100
  const amountAfterDiscount = baseAmount - discountAmount
  
  // GST Calculations (applied after discount)
  const cgst = formData.gstType === 'gst' ? amountAfterDiscount * 0.025 : 0 // 2.5%
  const sgst = formData.gstType === 'gst' ? amountAfterDiscount * 0.025 : 0 // 2.5%
  const igst = formData.gstType === 'igst' ? amountAfterDiscount * 0.05 : 0 // 5%
  const totalGst = cgst + sgst + igst
  const totalPrice = amountAfterDiscount + totalGst

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    setError("")
  }

  // Handle duration checkbox change
  const handleDurationCheckboxChange = (duration) => {
    setFormData(prev => {
      const currentSelections = prev.selectedHourlyDurations || []
      const isSelected = currentSelections.includes(duration)
      
      if (isSelected) {
        // Remove duration
        return {
          ...prev,
          selectedHourlyDurations: currentSelections.filter(d => d !== duration)
        }
      } else {
        // Add duration
        return {
          ...prev,
          selectedHourlyDurations: [...currentSelections, duration]
        }
      }
    })
    setError("")
  }

  const handleFileChange = (e, fieldName) => {
    const file = e.target.files[0]
    if (file) {
      // Validate file type (images only)
      if (!file.type.startsWith('image/')) {
        setError('Please upload an image file')
        return
      }
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size should not exceed 5MB')
        return
      }
      setFormData({ ...formData, [fieldName]: file })
      setError("")
    }
  }

  // Calendar functions - Updated to use existing allBookings data
  const fetchRoomBookings = async (roomId, year, month) => {
    try {
      // Use the already fetched allBookings instead of making a new API call
      const roomBookings = allBookings.filter(booking => {
        const bookingRoomId = booking.roomId?._id || booking.roomId
        return (bookingRoomId === roomId) && booking.status !== 'cancelled'
      })
      
      // Create a map of booked dates for this month
      const bookedDates = {}
      
      roomBookings.forEach(booking => {
        // Extract date strings directly from ISO dates to avoid timezone issues
        const checkInDateStr = booking.checkInDate.split('T')[0] // YYYY-MM-DD
        const checkOutDateStr = booking.checkOutDate.split('T')[0] // YYYY-MM-DD
        
        // Check if same-day booking by comparing date strings
        const isSameDayBooking = checkInDateStr === checkOutDateStr
        
        if (isSameDayBooking) {
          // For same-day bookings, mark the check-in date as booked
          const dateObj = new Date(checkInDateStr + 'T00:00:00')
          const bookingYear = dateObj.getFullYear()
          const bookingMonth = dateObj.getMonth()
          
          if (bookingYear === year && bookingMonth === month) {
            if (!bookedDates[checkInDateStr]) {
              bookedDates[checkInDateStr] = []
            }
            bookedDates[checkInDateStr].push({
              bookingId: booking._id,
              guestName: booking.userName,
              checkIn: booking.checkInDate,
              checkOut: booking.checkOutDate,
              status: booking.status
            })
          }
        } else {
          // For multi-day bookings, mark all dates from check-in to check-out (exclusive of check-out)
          const checkInDate = new Date(checkInDateStr + 'T00:00:00')
          const checkOutDate = new Date(checkOutDateStr + 'T00:00:00')
          const currentDate = new Date(checkInDate)
          
          while (currentDate < checkOutDate) {
            const dateStr = currentDate.toISOString().split('T')[0]
            const bookingYear = currentDate.getFullYear()
            const bookingMonth = currentDate.getMonth()
            
            // Only include dates for the requested month/year
            if (bookingYear === year && bookingMonth === month) {
              if (!bookedDates[dateStr]) {
                bookedDates[dateStr] = []
              }
              bookedDates[dateStr].push({
                bookingId: booking._id,
                guestName: booking.userName,
                checkIn: booking.checkInDate,
                checkOut: booking.checkOutDate,
                status: booking.status
              })
            }
            
            currentDate.setDate(currentDate.getDate() + 1)
          }
        }
      })
      
      return bookedDates
      
    } catch (error) {
      console.error('Error fetching room bookings:', error)
      return {}
    }
  }

  const fetchMonthlyBookings = async (roomId, year, month) => {
    if (!roomId) {
      return
    }
    
    setCalendarLoading(true)
    try {
      const bookedDates = await fetchRoomBookings(roomId, year, month)
      
      // Convert to the format expected by the calendar
      const monthlyBookingsMap = {}
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        const bookingsForDate = bookedDates[dateStr] || []
        
        monthlyBookingsMap[dateStr] = {
          date: dateStr,
          bookings: bookingsForDate,
          hasBookings: bookingsForDate.length > 0,
          isFullyBooked: false // We don't block dates anymore, allow multiple bookings
        }
      }
      
      setMonthlyBookings(monthlyBookingsMap)
    } catch (error) {
      console.error('Error fetching monthly bookings:', error)
    } finally {
      setCalendarLoading(false)
    }
  }

  const openCalendar = (type) => {
    setCalendarFor(type)
    const currentMonth = new Date()
    setCalendarMonth(currentMonth)
    setShowCalendar(true)
    
    // Clear previous data
    setMonthlyBookings({})
    
    if (room && room._id) {
      fetchMonthlyBookings(room._id, currentMonth.getFullYear(), currentMonth.getMonth())
    }
  }

  const changeMonth = (direction) => {
    const newMonth = new Date(calendarMonth)
    newMonth.setMonth(newMonth.getMonth() + direction)
    setCalendarMonth(newMonth)
    
    if (room && room._id) {
      fetchMonthlyBookings(room._id, newMonth.getFullYear(), newMonth.getMonth())
    }
  }

  const selectDate = (day) => {
    const year = calendarMonth.getFullYear()
    const month = String(calendarMonth.getMonth() + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    const dateStr = `${year}-${month}-${dayStr}`
    
    // Allow selection of any non-past date, even if it has existing bookings
    if (calendarFor === 'checkIn') {
      setFormData({ ...formData, checkInDate: dateStr })
    } else {
      setFormData({ ...formData, checkOutDate: dateStr })
    }
    setShowCalendar(false)
  }

  const isPastDate = (day) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const checkDate = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day)
    return checkDate < today
  }

  const hasBookingsOnDate = (day) => {
    const year = calendarMonth.getFullYear()
    const month = String(calendarMonth.getMonth() + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    const dateStr = `${year}-${month}-${dayStr}`
    const bookingData = monthlyBookings[dateStr]
    return bookingData?.hasBookings || false
  }

  const isFullyBooked = (day) => {
    const year = calendarMonth.getFullYear()
    const month = String(calendarMonth.getMonth() + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    const dateStr = `${year}-${month}-${dayStr}`
    const bookingData = monthlyBookings[dateStr]
    return bookingData?.isFullyBooked || false
  }

  const isDateSelectable = (day) => {
    const isPast = isPastDate(day)
    if (isPast) return false
    
    // Check if this date conflicts with existing bookings
    const year = calendarMonth.getFullYear()
    const month = String(calendarMonth.getMonth() + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    const dateStr = `${year}-${month}-${dayStr}`
    const checkDate = new Date(dateStr)
    
    // Get existing bookings for this room (excluding cancelled/checked-out)
    const existingBookings = monthlyBookings[dateStr]?.bookings || []
    const activeBookings = existingBookings.filter(booking => 
      booking.status !== 'cancelled' && booking.status !== 'checked-out'
    )
    
    // If selecting check-in date, ensure no active bookings on this date
    if (calendarFor === 'checkIn') {
      return activeBookings.length === 0
    }
    
    // If selecting check-out date, ensure it's after check-in and no conflicts
    if (calendarFor === 'checkOut' && formData.checkInDate) {
      const checkInDate = new Date(formData.checkInDate)
      if (checkDate <= checkInDate) return false
      
      // Check if any date between check-in and this check-out date has conflicts
      const currentDate = new Date(checkInDate)
      currentDate.setDate(currentDate.getDate() + 1) // Start from day after check-in
      
      while (currentDate < checkDate) {
        const checkDateStr = currentDate.toISOString().split('T')[0]
        const dayBookings = Object.values(monthlyBookings).find(mb => mb.date === checkDateStr)?.bookings || []
        const activeDayBookings = dayBookings.filter(booking => 
          booking.status !== 'cancelled' && booking.status !== 'checked-out'
        )
        
        if (activeDayBookings.length > 0) {
          return false // Conflict found
        }
        
        currentDate.setDate(currentDate.getDate() + 1)
      }
    }
    
    return true
  }

  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDay = new Date(year, month, 1).getDay()
    return { daysInMonth, firstDay }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Validate required fields
      if (!formData.guestName?.trim()) {
        throw new Error("Guest name is required")
      }
      
      if (!formData.guestPhone?.trim()) {
        throw new Error("Guest phone number is required")
      }
      
      if (!formData.checkInDate) {
        throw new Error("Check-in date is required")
      }
      
      if (!formData.checkOutDate) {
        throw new Error("Check-out date is required")
      }
      
      // Validate phone number format (basic validation)
      const phoneRegex = /^[0-9]{10}$/
      if (!phoneRegex.test(formData.guestPhone.replace(/\D/g, ''))) {
        throw new Error("Please enter a valid 10-digit phone number")
      }
      
      // Validate dates
      const checkInDate = new Date(formData.checkInDate)
      const checkOutDate = new Date(formData.checkOutDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (checkInDate < today) {
        throw new Error("Check-in date cannot be in the past")
      }
      
      // For hourly bookings, allow same-day bookings (check-in and check-out on same date)
      // For regular bookings, check-out must be after check-in
      const isHourlyBooking = room.hourlyPricing?.enabled && formData.selectedHourlyDurations?.length > 0
      
      if (isHourlyBooking) {
        // For hourly bookings, allow same day or different days
        // Just ensure check-out is not before check-in date
        if (checkOutDate < checkInDate) {
          throw new Error("Check-out date cannot be before check-in date")
        }
      } else {
        // For regular bookings, check-out must be at least one day after check-in
        if (checkOutDate <= checkInDate) {
          throw new Error("Check-out date must be after check-in date")
        }
      }

      // Validate Aadhaar number if provided
      if (formData.aadhaarNumber && formData.aadhaarNumber.trim()) {
        const aadhaarRegex = /^\d{12}$/
        if (!aadhaarRegex.test(formData.aadhaarNumber.trim())) {
          throw new Error("Aadhaar number must be exactly 12 digits")
        }
      }

      // Upload files first if any
      let aadhaarPicPath = null
      let visaPicPath = null
      
      if (formData.aadhaarPic || formData.visaPic) {
        const uploadFormData = new FormData()
        
        if (formData.aadhaarPic) {
          uploadFormData.append('aadhaarPic', formData.aadhaarPic)
        }
        
        if (formData.visaPic) {
          uploadFormData.append('visaPic', formData.visaPic)
        }
        
        try {
          const uploadResponse = await axios.post(
            `${API_BASE}/room-booking/upload-documents`,
            uploadFormData,
            {
              headers: {
                'Content-Type': 'multipart/form-data'
              }
            }
          )
          
          if (uploadResponse.data.success) {
            aadhaarPicPath = uploadResponse.data.files.aadhaarPic || null
            visaPicPath = uploadResponse.data.files.visaPic || null
          }
        } catch (uploadError) {
          console.error("File upload error:", uploadError)
          throw new Error("Failed to upload documents. Please try again.")
        }
      }

      const paidAmount = parseFloat(formData.amountPaid) || 0
      const paymentMethod = formData.paymentMethod || 'cash'
      
      // Convert 12-hour format to 24-hour format for backend
      const checkInHour24 = formData.checkInPeriod === "PM" && formData.checkInHour !== "12" 
        ? parseInt(formData.checkInHour) + 12 
        : formData.checkInPeriod === "AM" && formData.checkInHour === "12"
        ? 0
        : parseInt(formData.checkInHour)
      
      const checkOutHour24 = formData.checkOutPeriod === "PM" && formData.checkOutHour !== "12"
        ? parseInt(formData.checkOutHour) + 12
        : formData.checkOutPeriod === "AM" && formData.checkOutHour === "12"
        ? 0
        : parseInt(formData.checkOutHour)
      
      const checkInTime = `${String(checkInHour24).padStart(2, '0')}:${formData.checkInMinute}`
      const checkOutTime = `${String(checkOutHour24).padStart(2, '0')}:${formData.checkOutMinute}`
      
      // Create booking data object
      const bookingData = {
        roomId: room._id,
        branchId: room.branchId,
        guestName: formData.guestName,
        guestPhone: formData.guestPhone,
        guestEmail: formData.guestEmail,
        guestGstNumber: formData.guestGstNumber,
        aadhaarNumber: formData.aadhaarNumber ? formData.aadhaarNumber.trim() : '',
        aadhaarPic: aadhaarPicPath, // File path from upload
        visaPic: visaPicPath, // File path from upload
        checkInDate: formData.checkInDate,
        checkOutDate: formData.checkOutDate,
        checkInTime: checkInTime,
        checkOutTime: checkOutTime,
        isExceeding24Hours: isExceeding24Hours(),
        customAmount: isExceeding24Hours() ? parseFloat(formData.customAmount) || 0 : 0,
        nights,
        baseAmount,
        discountPercent: discountPercent || 0,
        discountAmount: discountAmount || 0,
        gstType: formData.gstType,
        cgst,
        sgst,
        igst,
        totalAmount: totalPrice, // Backend expects totalAmount, not totalPrice
        amountPaid: paidAmount,
        cashAmount: paymentMethod === 'cash' ? paidAmount : 0,
        onlineAmount: paymentMethod === 'online' ? paidAmount : 0,
        status: 'checked-in',
        paymentStatus: paidAmount >= totalPrice ? 'paid' : 'pending',
        payments: paidAmount > 0 ? [{ amount: paidAmount, method: paymentMethod, date: new Date() }] : []
      }

      await onBook(bookingData)
      onClose()
    } catch (err) {
      console.error("Booking error:", err)
      
      // Handle different types of errors
      let errorMessage = "Failed to book room"
      
      if (err.response) {
        // Server responded with error status
        const { status, data } = err.response
        
        if (status === 400) {
          if (data.message) {
            errorMessage = data.message
          } else if (data.error) {
            errorMessage = data.error
          } else if (typeof data === 'string') {
            errorMessage = data
          } else {
            errorMessage = "Invalid booking data. Please check all required fields."
          }
        } else if (status === 404) {
          errorMessage = "Room not found. Please refresh and try again."
        } else if (status === 409) {
          errorMessage = "Room is already booked for the selected dates."
        } else if (status >= 500) {
          errorMessage = "Server error. Please try again later."
        }
      } else if (err.request) {
        // Network error
        errorMessage = "Network error. Please check your connection and try again."
      } else {
        // Other error
        errorMessage = err.message || "An unexpected error occurred"
      }
      
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.7)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000,
      backdropFilter: "blur(8px)",
      animation: "fadeIn 0.2s ease-out"
    }} onClick={onClose}>
      <div style={{
        backgroundColor: "white", 
        borderRadius: "16px", 
        width: "90%",
        maxWidth: "580px", 
        maxHeight: "92vh", 
        overflow: "hidden",
        display: "flex", 
        flexDirection: "column",
        boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        animation: "slideUp 0.3s ease-out"
      }} onClick={(e) => e.stopPropagation()}>
        {/* Fixed Header with Gradient */}
        <div style={{
          padding: "18px 22px",
          background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #d946ef 100%)",
          color: "white",
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center",
          position: "relative", 
          zIndex: 10,
          boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "rgba(255,255,255,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(10px)"
            }}>
              <Bed size={22} strokeWidth={2.5} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "700", letterSpacing: "-0.3px" }}>
                Book Room {room.roomNumber}
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "13px", opacity: 0.95, fontWeight: "500" }}>
                {room.roomType} • {room.floor}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ 
            background: "rgba(255,255,255,0.25)", 
            border: "none", 
            cursor: "pointer", 
            fontSize: "24px",
            color: "white",
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.2s",
            backdropFilter: "blur(10px)"
          }}
          onMouseEnter={(e) => e.target.style.background = "rgba(255,255,255,0.35)"}
          onMouseLeave={(e) => e.target.style.background = "rgba(255,255,255,0.25)"}
          >×</button>
        </div>

        {/* Error Message - Fixed at top */}
        {error && (
          <div style={{ 
            padding: "12px 22px", 
            background: "linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)",
            color: "#991b1b", 
            display: "flex", 
            alignItems: "center", 
            gap: "10px", 
            borderBottom: "2px solid #f87171",
            position: "relative", 
            zIndex: 10,
            animation: "slideDown 0.3s ease-out"
          }}>
            <AlertCircle size={18} strokeWidth={2.5} />
            <span style={{ fontSize: "13px", fontWeight: "600", flex: 1 }}>{error}</span>
            <button 
              onClick={() => setError("")}
              style={{ 
                background: "rgba(153, 27, 27, 0.1)", 
                border: "none", 
                cursor: "pointer", 
                color: "#991b1b", 
                fontSize: "20px", 
                padding: "2px 6px",
                fontWeight: "bold",
                borderRadius: "6px",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => e.target.style.background = "rgba(153, 27, 27, 0.2)"}
              onMouseLeave={(e) => e.target.style.background = "rgba(153, 27, 27, 0.1)"}
            >
              ×
            </button>
          </div>
        )}
        
        {/* Scrollable Form Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 22px", backgroundColor: "#fafbfc" }}>
          <form onSubmit={handleSubmit}>
            {/* Room Details Card */}
            <div style={{ 
              marginBottom: "18px", 
              padding: "16px", 
              background: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)", 
              borderRadius: "12px",
              border: "2px solid #6ee7b7",
              boxShadow: "0 2px 4px rgba(16, 185, 129, 0.1)"
            }}>
              <h4 style={{ 
                margin: "0 0 12px", 
                fontSize: "15px", 
                fontWeight: "700", 
                color: "#065f46",
                display: "flex",
                alignItems: "center",
                gap: "6px"
              }}>
                <span style={{ fontSize: "16px" }}>📋</span> Room Details
              </h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ 
                  padding: "10px", 
                  backgroundColor: "rgba(255,255,255,0.7)", 
                  borderRadius: "8px",
                  backdropFilter: "blur(10px)"
                }}>
                  <p style={{ margin: "0 0 3px", fontSize: "11px", color: "#6b7280", fontWeight: "600" }}>Type</p>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#065f46" }}>{room.roomType}</p>
                </div>
                <div style={{ 
                  padding: "10px", 
                  backgroundColor: "rgba(255,255,255,0.7)", 
                  borderRadius: "8px",
                  backdropFilter: "blur(10px)"
                }}>
                  <p style={{ margin: "0 0 3px", fontSize: "11px", color: "#6b7280", fontWeight: "600" }}>Floor</p>
                  <p style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#065f46" }}>{room.floor}</p>
                </div>
                <div style={{ 
                  gridColumn: "1 / -1",
                  padding: "12px", 
                  backgroundColor: "rgba(255,255,255,0.9)", 
                  borderRadius: "8px",
                  backdropFilter: "blur(10px)",
                  border: "2px dashed #6ee7b7"
                }}>
                  <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#6b7280", fontWeight: "600" }}>Standard Price</p>
                  <p style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#059669" }}>
                    ₹{room.price}<span style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>/night</span>
                  </p>
                  <p style={{ margin: "2px 0 0 0", fontSize: "10px", color: "#6b7280" }}>(excluding GST)</p>
                </div>
              </div>
            </div>

          {/* Hourly Duration Selector - Only show if hourly pricing is enabled */}
          {room.hourlyPricing?.enabled === true && (
            <div style={{ 
              marginBottom: "18px", 
              padding: "14px", 
              background: "linear-gradient(135deg, #fef3c7 0%, #fde047 100%)", 
              borderRadius: "12px", 
              border: "2px solid #facc15",
              boxShadow: "0 2px 4px rgba(250, 204, 21, 0.15)"
            }}>
              <h4 style={{ 
                margin: "0 0 6px", 
                fontSize: "14px", 
                fontWeight: "700", 
                color: "#713f12", 
                display: "flex", 
                alignItems: "center", 
                gap: "6px" 
              }}>
                <span style={{ fontSize: "16px" }}>⏱️</span> Select Duration
              </h4>
              <p style={{ margin: "0 0 12px", fontSize: "11px", color: "#854d0e", fontWeight: "500" }}>
                Choose durations. Total = sum of selected.
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                {/* 3 Hours Option */}
                {room.hourlyPricing.threeHours > 0 && (
                  <label style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "12px 10px",
                    backgroundColor: formData.selectedHourlyDurations?.includes('3hours') ? '#713f12' : 'white',
                    color: formData.selectedHourlyDurations?.includes('3hours') ? 'white' : '#713f12',
                    border: `2px solid ${formData.selectedHourlyDurations?.includes('3hours') ? '#713f12' : '#facc15'}`,
                    borderRadius: "10px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: formData.selectedHourlyDurations?.includes('3hours') ? '0 4px 8px rgba(113, 63, 18, 0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
                    transform: formData.selectedHourlyDurations?.includes('3hours') ? 'scale(1.02)' : 'scale(1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!formData.selectedHourlyDurations?.includes('3hours')) {
                      e.currentTarget.style.transform = 'scale(1.02)'
                      e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.1)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!formData.selectedHourlyDurations?.includes('3hours')) {
                      e.currentTarget.style.transform = 'scale(1)'
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'
                    }
                  }}>
                    <input
                      type="checkbox"
                      checked={formData.selectedHourlyDurations?.includes('3hours') || false}
                      onChange={() => handleDurationCheckboxChange('3hours')}
                      style={{ display: "none" }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: "700", marginBottom: "6px" }}>3 Hours</span>
                    <span style={{ fontSize: "18px", fontWeight: "800" }}>₹{room.hourlyPricing.threeHours}</span>
                    {formData.selectedHourlyDurations?.includes('3hours') && (
                      <Check size={16} style={{ marginTop: "6px" }} strokeWidth={3} />
                    )}
                  </label>
                )}
                
                {/* 6 Hours Option */}
                {room.hourlyPricing.sixHours > 0 && (
                  <label style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "12px 10px",
                    backgroundColor: formData.selectedHourlyDurations?.includes('6hours') ? '#713f12' : 'white',
                    color: formData.selectedHourlyDurations?.includes('6hours') ? 'white' : '#713f12',
                    border: `2px solid ${formData.selectedHourlyDurations?.includes('6hours') ? '#713f12' : '#facc15'}`,
                    borderRadius: "10px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: formData.selectedHourlyDurations?.includes('6hours') ? '0 4px 8px rgba(113, 63, 18, 0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
                    transform: formData.selectedHourlyDurations?.includes('6hours') ? 'scale(1.02)' : 'scale(1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!formData.selectedHourlyDurations?.includes('6hours')) {
                      e.currentTarget.style.transform = 'scale(1.02)'
                      e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.1)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!formData.selectedHourlyDurations?.includes('6hours')) {
                      e.currentTarget.style.transform = 'scale(1)'
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'
                    }
                  }}>
                    <input
                      type="checkbox"
                      checked={formData.selectedHourlyDurations?.includes('6hours') || false}
                      onChange={() => handleDurationCheckboxChange('6hours')}
                      style={{ display: "none" }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: "700", marginBottom: "6px" }}>6 Hours</span>
                    <span style={{ fontSize: "18px", fontWeight: "800" }}>₹{room.hourlyPricing.sixHours}</span>
                    {formData.selectedHourlyDurations?.includes('6hours') && (
                      <Check size={16} style={{ marginTop: "6px" }} strokeWidth={3} />
                    )}
                  </label>
                )}
                
                {/* 9 Hours Option */}
                {room.hourlyPricing.nineHours > 0 && (
                  <label style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "12px 10px",
                    backgroundColor: formData.selectedHourlyDurations?.includes('9hours') ? '#713f12' : 'white',
                    color: formData.selectedHourlyDurations?.includes('9hours') ? 'white' : '#713f12',
                    border: `2px solid ${formData.selectedHourlyDurations?.includes('9hours') ? '#713f12' : '#facc15'}`,
                    borderRadius: "10px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: formData.selectedHourlyDurations?.includes('9hours') ? '0 4px 8px rgba(113, 63, 18, 0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
                    transform: formData.selectedHourlyDurations?.includes('9hours') ? 'scale(1.02)' : 'scale(1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!formData.selectedHourlyDurations?.includes('9hours')) {
                      e.currentTarget.style.transform = 'scale(1.02)'
                      e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.1)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!formData.selectedHourlyDurations?.includes('9hours')) {
                      e.currentTarget.style.transform = 'scale(1)'
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'
                    }
                  }}>
                    <input
                      type="checkbox"
                      checked={formData.selectedHourlyDurations?.includes('9hours') || false}
                      onChange={() => handleDurationCheckboxChange('9hours')}
                      style={{ display: "none" }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: "700", marginBottom: "6px" }}>9 Hours</span>
                    <span style={{ fontSize: "18px", fontWeight: "800" }}>₹{room.hourlyPricing.nineHours}</span>
                    {formData.selectedHourlyDurations?.includes('9hours') && (
                      <Check size={16} style={{ marginTop: "6px" }} strokeWidth={3} />
                    )}
                  </label>
                )}
                
                {/* 12 Hours Option */}
                {room.hourlyPricing.twelveHours > 0 && (
                  <label style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "12px 10px",
                    backgroundColor: formData.selectedHourlyDurations?.includes('12hours') ? '#713f12' : 'white',
                    color: formData.selectedHourlyDurations?.includes('12hours') ? 'white' : '#713f12',
                    border: `2px solid ${formData.selectedHourlyDurations?.includes('12hours') ? '#713f12' : '#facc15'}`,
                    borderRadius: "10px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: formData.selectedHourlyDurations?.includes('12hours') ? '0 4px 8px rgba(113, 63, 18, 0.25)' : '0 1px 3px rgba(0,0,0,0.05)',
                    transform: formData.selectedHourlyDurations?.includes('12hours') ? 'scale(1.02)' : 'scale(1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!formData.selectedHourlyDurations?.includes('12hours')) {
                      e.currentTarget.style.transform = 'scale(1.02)'
                      e.currentTarget.style.boxShadow = '0 3px 6px rgba(0,0,0,0.1)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!formData.selectedHourlyDurations?.includes('12hours')) {
                      e.currentTarget.style.transform = 'scale(1)'
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)'
                    }
                  }}>
                    <input
                      type="checkbox"
                      checked={formData.selectedHourlyDurations?.includes('12hours') || false}
                      onChange={() => handleDurationCheckboxChange('12hours')}
                      style={{ display: "none" }}
                    />
                    <span style={{ fontSize: "13px", fontWeight: "700", marginBottom: "6px" }}>12 Hours</span>
                    <span style={{ fontSize: "18px", fontWeight: "800" }}>₹{room.hourlyPricing.twelveHours}</span>
                    {formData.selectedHourlyDurations?.includes('12hours') && (
                      <Check size={16} style={{ marginTop: "6px" }} strokeWidth={3} />
                    )}
                  </label>
                )}
              </div>
              <div style={{ 
                marginTop: "14px", 
                padding: "14px", 
                backgroundColor: "rgba(255,255,255,0.9)", 
                borderRadius: "10px",
                fontSize: "14px",
                fontWeight: "700",
                color: "#713f12",
                textAlign: "center",
                backdropFilter: "blur(10px)"
              }}>
                {formData.selectedHourlyDurations?.length > 0
                  ? `✓ Selected: ${formData.selectedHourlyDurations.length} duration(s) • Total: ₹${getDurationPrice()}`
                  : `💡 No duration selected • Standard price (₹${room.price}/night) will apply`}
              </div>
            </div>
          )}

          {/* Guest Information */}
          <div style={{ 
            marginBottom: "24px",
            padding: "22px",
            backgroundColor: "white",
            borderRadius: "16px",
            border: "2px solid #e5e7eb",
            boxShadow: "0 2px 4px rgba(0,0,0,0.05)"
          }}>
            <h4 style={{ 
              margin: "0 0 18px", 
              fontSize: "17px", 
              fontWeight: "700", 
              color: "#1e293b", 
              paddingBottom: "12px", 
              borderBottom: "2px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}>
              <span style={{ fontSize: "20px" }}>👤</span> Guest Information
            </h4>
            
            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#475569" }}>
                Guest Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="text"
                name="guestName"
                value={formData.guestName}
                onChange={handleChange}
                required
                style={{ 
                  width: "100%", 
                  padding: "13px 16px", 
                  border: "2px solid #e2e8f0", 
                  borderRadius: "10px",
                  fontSize: "15px",
                  fontWeight: "500",
                  transition: "all 0.2s",
                  backgroundColor: "#fafbfc"
                }}
                placeholder="Enter guest full name"
                onFocus={(e) => {
                  e.target.style.borderColor = "#6366f1"
                  e.target.style.backgroundColor = "white"
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e2e8f0"
                  e.target.style.backgroundColor = "#fafbfc"
                }}
              />
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#475569" }}>
                Phone Number <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="tel"
                name="guestPhone"
                value={formData.guestPhone}
                onChange={handleChange}
                required
                style={{ 
                  width: "100%", 
                  padding: "13px 16px", 
                  border: "2px solid #e2e8f0", 
                  borderRadius: "10px",
                  fontSize: "15px",
                  fontWeight: "500",
                  transition: "all 0.2s",
                  backgroundColor: "#fafbfc"
                }}
                placeholder="Enter 10-digit phone number"
                onFocus={(e) => {
                  e.target.style.borderColor = "#6366f1"
                  e.target.style.backgroundColor = "white"
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e2e8f0"
                  e.target.style.backgroundColor = "#fafbfc"
                }}
              />
            </div>

            <div style={{ marginBottom: "0" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "600", fontSize: "14px", color: "#475569" }}>
                Email Address <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: "500" }}>(Optional)</span>
              </label>
              <input
                type="email"
                name="guestEmail"
                value={formData.guestEmail}
                onChange={handleChange}
                style={{ 
                  width: "100%", 
                  padding: "13px 16px", 
                  border: "2px solid #e2e8f0", 
                  borderRadius: "10px",
                  fontSize: "15px",
                  fontWeight: "500",
                  transition: "all 0.2s",
                  backgroundColor: "#fafbfc"
                }}
                placeholder="guest@example.com"
                onFocus={(e) => {
                  e.target.style.borderColor = "#6366f1"
                  e.target.style.backgroundColor = "white"
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e2e8f0"
                  e.target.style.backgroundColor = "#fafbfc"
                }}
              />
            </div>
          </div>

          {/* Identity Documents (Optional) */}
          <div style={{ marginBottom: "20px", padding: "20px", backgroundColor: "#f8fafc", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: "16px", color: "#334155", fontWeight: "600" }}>
              Identity Documents (Optional)
            </h4>
            <p style={{ margin: "0 0 20px", fontSize: "14px", color: "#64748b", lineHeight: "1.5" }}>
              Upload Aadhaar card picture and/or Visa document for guest verification. Both are optional.
            </p>
            
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
              {/* Aadhaar Number */}
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500", color: "#374151" }}>
                  🆔 Aadhaar Number
                </label>
                <input
                  type="text"
                  name="aadhaarNumber"
                  value={formData.aadhaarNumber || ''}
                  onChange={handleChange}
                  style={{ 
                    width: "100%", 
                    padding: "12px", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "8px",
                    fontSize: "14px"
                  }}
                  placeholder="Enter 12-digit Aadhaar number (optional)"
                  maxLength={12}
                  pattern="[0-9]{12}"
                />
                <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                  12-digit number (e.g., 123456789012)
                </div>
              </div>

              {/* Aadhaar Picture Upload */}
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500", color: "#374151" }}>
                  � Aadhaar Picture (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'aadhaarPic')}
                  style={{ 
                    width: "100%", 
                    padding: "12px", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "8px",
                    fontSize: "14px",
                    cursor: "pointer"
                  }}
                />
                {formData.aadhaarPic && (
                  <div style={{ fontSize: "12px", color: "#059669", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Check size={14} /> {formData.aadhaarPic.name}
                  </div>
                )}
                <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                  Upload Aadhaar card image (Max 5MB, JPG/PNG)
                </div>
              </div>

              {/* Visa Picture Upload */}
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontSize: "14px", fontWeight: "500", color: "#374151" }}>
                  🛂 Visa Document (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileChange(e, 'visaPic')}
                  style={{ 
                    width: "100%", 
                    padding: "12px", 
                    border: "1px solid #e5e7eb", 
                    borderRadius: "8px",
                    fontSize: "14px",
                    cursor: "pointer"
                  }}
                />
                {formData.visaPic && (
                  <div style={{ fontSize: "12px", color: "#059669", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Check size={14} /> {formData.visaPic.name}
                  </div>
                )}
                <div style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
                  Upload Visa document image (Max 5MB, JPG/PNG)
                </div>
              </div>
            </div>
          </div>

          {/* Date Selection */}
          <div style={{ marginBottom: "24px" }}>
            <h4 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: "600", color: "#334155", paddingBottom: "8px", borderBottom: "2px solid #e2e8f0" }}>
              📅 Booking Dates
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", fontSize: "14px", color: "#475569" }}>
                  Check-in Date
                </label>
                <button
                  type="button"
                  onClick={() => openCalendar('checkIn')}
                  style={{
                    width: "100%", 
                    padding: "12px 14px", 
                    border: "2px solid #e2e8f0", 
                    borderRadius: "8px", 
                    backgroundColor: "white", 
                    textAlign: "left",
                    cursor: "pointer", 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "10px",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#334155",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.borderColor = "#667eea"
                    e.target.style.backgroundColor = "#f8fafc"
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.borderColor = "#e2e8f0"
                    e.target.style.backgroundColor = "white"
                  }}
                >
                  <Calendar size={18} color="#667eea" />
                  {formData.checkInDate ? new Date(formData.checkInDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select Date'}
                </button>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", fontSize: "14px", color: "#475569" }}>
                  Check-out Date
                </label>
                <button
                  type="button"
                  onClick={() => openCalendar('checkOut')}
                  style={{
                    width: "100%", 
                    padding: "12px 14px", 
                    border: "2px solid #e2e8f0", 
                    borderRadius: "8px", 
                    backgroundColor: "white", 
                    textAlign: "left",
                    cursor: "pointer", 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "10px",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#334155",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.borderColor = "#667eea"
                    e.target.style.backgroundColor = "#f8fafc"
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.borderColor = "#e2e8f0"
                    e.target.style.backgroundColor = "white"
                  }}
                >
                  <Calendar size={18} color="#667eea" />
                  {formData.checkOutDate ? new Date(formData.checkOutDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Select Date'}
                </button>
              </div>
            </div>
          </div>

          {/* GST Options */}
          <div style={{ marginBottom: "24px" }}>
            <h4 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: "600", color: "#334155", paddingBottom: "8px", borderBottom: "2px solid #e2e8f0" }}>
              💰 GST & Pricing
            </h4>
            <label style={{ display: "block", marginBottom: "12px", fontWeight: "500", fontSize: "14px", color: "#475569" }}>
              GST Option
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <label style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "12px", 
                cursor: "pointer", 
                padding: "14px 16px", 
                border: formData.gstType === 'none' ? "3px solid #667eea" : "2px solid #e2e8f0", 
                borderRadius: "10px", 
                backgroundColor: formData.gstType === 'none' ? "#f0f4ff" : "white",
                transition: "all 0.2s",
                boxShadow: formData.gstType === 'none' ? "0 2px 4px rgba(102, 126, 234, 0.2)" : "none"
              }}>
                <input 
                  type="radio" 
                  name="gstType" 
                  value="none" 
                  checked={formData.gstType === 'none'} 
                  onChange={handleChange}
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: "600", fontSize: "15px", color: formData.gstType === 'none' ? "#667eea" : "#334155" }}>Without GST</span>
                  <span style={{ display: "block", fontSize: "13px", color: "#64748b", marginTop: "2px" }}>Basic price only</span>
                </div>
              </label>
              <label style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "12px", 
                cursor: "pointer", 
                padding: "14px 16px", 
                border: formData.gstType === 'gst' ? "3px solid #667eea" : "2px solid #e2e8f0", 
                borderRadius: "10px", 
                backgroundColor: formData.gstType === 'gst' ? "#f0f4ff" : "white",
                transition: "all 0.2s",
                boxShadow: formData.gstType === 'gst' ? "0 2px 4px rgba(102, 126, 234, 0.2)" : "none"
              }}>
                <input 
                  type="radio" 
                  name="gstType" 
                  value="gst" 
                  checked={formData.gstType === 'gst'} 
                  onChange={handleChange}
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: "600", fontSize: "15px", color: formData.gstType === 'gst' ? "#667eea" : "#334155" }}>With GST (Within State)</span>
                  <span style={{ display: "block", fontSize: "13px", color: "#64748b", marginTop: "2px" }}>CGST 2.5% + SGST 2.5% = 5%</span>
                </div>
              </label>
              <label style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "12px", 
                cursor: "pointer", 
                padding: "14px 16px", 
                border: formData.gstType === 'igst' ? "3px solid #667eea" : "2px solid #e2e8f0", 
                borderRadius: "10px", 
                backgroundColor: formData.gstType === 'igst' ? "#f0f4ff" : "white",
                transition: "all 0.2s",
                boxShadow: formData.gstType === 'igst' ? "0 2px 4px rgba(102, 126, 234, 0.2)" : "none"
              }}>
                <input 
                  type="radio" 
                  name="gstType" 
                  value="igst" 
                  checked={formData.gstType === 'igst'} 
                  onChange={handleChange}
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: "600", fontSize: "15px", color: formData.gstType === 'igst' ? "#667eea" : "#334155" }}>With IGST (Out of State)</span>
                  <span style={{ display: "block", fontSize: "13px", color: "#64748b", marginTop: "2px" }}>IGST 5%</span>
                </div>
              </label>
            </div>
          </div>

          {/* Guest GST Number - shown only when GST is selected */}
          {(formData.gstType === 'gst' || formData.gstType === 'igst') && (
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Guest GST Number
              </label>
              <input
                type="text"
                name="guestGstNumber"
                value={formData.guestGstNumber}
                onChange={handleChange}
                style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                placeholder="Enter guest's GST number (e.g., 22AAAAA0000A1Z5)"
                maxLength={15}
              />
              <span style={{ fontSize: "11px", color: "#6b7280" }}>15-digit GST Identification Number</span>
            </div>
          )}

          {/* Discount Percentage */}
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
              Discount (%)
            </label>
            <input
              type="number"
              name="discountPercent"
              value={formData.discountPercent}
              onChange={handleChange}
              style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
              placeholder="Enter discount percentage (0-100)"
              min="0"
              max="100"
              step="0.01"
            />
            {discountPercent > 0 && (
              <span style={{ fontSize: "12px", color: "#059669" }}>
                Discount Amount: ₹{discountAmount.toFixed(2)}
              </span>
            )}
          </div>

          {/* Price Summary */}
          <div style={{ 
            marginBottom: "24px", 
            padding: "20px", 
            background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)", 
            borderRadius: "12px",
            border: "2px solid #cbd5e0"
          }}>
            <h4 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: "600", color: "#334155", display: "flex", alignItems: "center", gap: "8px" }}>
              📊 Price Summary
            </h4>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "14px" }}>
              <span style={{ color: "#64748b" }}>
                {formData.selectedHourlyDurations?.length > 0 
                  ? `Hourly Rate (${formData.selectedHourlyDurations.length} duration${formData.selectedHourlyDurations.length > 1 ? 's' : ''})`
                  : `Room Price (₹${room.price} × ${nights} night${nights > 1 ? 's' : ''})`
                }
              </span>
              <span style={{ fontWeight: "600", color: "#334155" }}>₹{roomBaseAmount.toFixed(2)}</span>
            </div>
            {isExceeding24Hours() && customAmountValue > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "14px", color: "#dc2626" }}>
                <span>Additional Charge (Exceeding 24 hours)</span>
                <span style={{ fontWeight: "600" }}>+ ₹{customAmountValue.toFixed(2)}</span>
              </div>
            )}
            {(isExceeding24Hours() && customAmountValue > 0) && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", paddingTop: "10px", borderTop: "1px solid #cbd5e0", fontSize: "14px" }}>
                <span style={{ fontWeight: "600", color: "#334155" }}>Subtotal</span>
                <span style={{ fontWeight: "600", color: "#334155" }}>₹{baseAmount.toFixed(2)}</span>
              </div>
            )}
            {discountPercent > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "14px", color: "#059669" }}>
                <span>Discount ({discountPercent}%)</span>
                <span style={{ fontWeight: "600" }}>- ₹{discountAmount.toFixed(2)}</span>
              </div>
            )}
            {discountPercent > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "14px" }}>
                <span style={{ fontWeight: "600", color: "#334155" }}>Amount After Discount</span>
                <span style={{ fontWeight: "600", color: "#334155" }}>₹{amountAfterDiscount.toFixed(2)}</span>
              </div>
            )}
            {formData.gstType === 'gst' && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px", color: "#64748b" }}>
                  <span>CGST (2.5%)</span>
                  <span>₹{cgst.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px", color: "#64748b" }}>
                  <span>SGST (2.5%)</span>
                  <span>₹{sgst.toFixed(2)}</span>
                </div>
              </>
            )}
            {formData.gstType === 'igst' && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px", color: "#64748b" }}>
                <span>IGST (5%)</span>
                <span>₹{igst.toFixed(2)}</span>
              </div>
            )}
            <div style={{ 
              display: "flex", 
              justifyContent: "space-between", 
              fontWeight: "700", 
              borderTop: "2px solid #cbd5e0", 
              paddingTop: "12px", 
              marginTop: "12px",
              fontSize: "18px",
              color: "#667eea"
            }}>
              <span>Total Amount</span>
              <span>₹{totalPrice.toFixed(2)}</span>
            </div>
          </div>

          {/* Amount Paid */}
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", marginBottom: "8px", fontWeight: "500", fontSize: "14px", color: "#475569" }}>
              Amount Paid (₹)
            </label>
            <input
              type="number"
              name="amountPaid"
              value={formData.amountPaid}
              onChange={handleChange}
              style={{ 
                width: "100%", 
                padding: "12px 14px", 
                border: "2px solid #e2e8f0", 
                borderRadius: "8px",
                fontSize: "14px",
                transition: "all 0.2s"
              }}
              placeholder={`Enter amount paid (Total: ₹${totalPrice.toFixed(2)})`}
              min="0"
              max={totalPrice}
              onFocus={(e) => e.target.style.borderColor = "#667eea"}
              onBlur={(e) => e.target.style.borderColor = "#e2e8f0"}
            />
            {formData.amountPaid && parseFloat(formData.amountPaid) < totalPrice && (
              <div style={{ 
                marginTop: "8px", 
                padding: "8px 12px", 
                backgroundColor: "#fef3c7", 
                borderRadius: "6px",
                fontSize: "13px", 
                color: "#92400e",
                fontWeight: "500"
              }}>
                ⚠️ Balance Due: ₹{(totalPrice - parseFloat(formData.amountPaid || 0)).toFixed(2)}
              </div>
            )}
            {formData.amountPaid && parseFloat(formData.amountPaid) >= totalPrice && (
              <div style={{ 
                marginTop: "8px", 
                padding: "8px 12px", 
                backgroundColor: "#dcfce7", 
                borderRadius: "6px",
                fontSize: "13px", 
                color: "#166534",
                fontWeight: "500"
              }}>
                ✓ Fully Paid
              </div>
            )}
          </div>

          {/* Payment Method */}
          {formData.amountPaid && parseFloat(formData.amountPaid) > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "10px", fontWeight: "500", fontSize: "14px", color: "#475569" }}>
                Payment Method
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <label style={{ 
                  flex: 1, 
                  display: "flex", 
                  flexDirection: "column",
                  alignItems: "center", 
                  justifyContent: "center", 
                  gap: "6px", 
                  cursor: "pointer", 
                  padding: "12px", 
                  border: formData.paymentMethod === 'cash' ? "2px solid #059669" : "2px solid #e2e8f0", 
                  borderRadius: "8px", 
                  backgroundColor: formData.paymentMethod === 'cash' ? "#f0fdf4" : "white",
                  transition: "all 0.2s",
                  boxShadow: formData.paymentMethod === 'cash' ? "0 2px 4px rgba(5, 150, 105, 0.2)" : "none"
                }}>
                  <input 
                    type="radio" 
                    name="paymentMethod" 
                    value="cash" 
                    checked={formData.paymentMethod === 'cash'} 
                    onChange={handleChange} 
                    style={{ display: "none" }} 
                  />
                  <span style={{ fontSize: "24px" }}>💵</span>
                  <span style={{ fontWeight: "600", fontSize: "13px", color: formData.paymentMethod === 'cash' ? "#059669" : "#475569" }}>Cash</span>
                </label>
                <label style={{ 
                  flex: 1, 
                  display: "flex", 
                  flexDirection: "column",
                  alignItems: "center", 
                  justifyContent: "center", 
                  gap: "6px", 
                  cursor: "pointer", 
                  padding: "12px", 
                  border: formData.paymentMethod === 'online' ? "2px solid #3b82f6" : "2px solid #e2e8f0", 
                  borderRadius: "8px", 
                  backgroundColor: formData.paymentMethod === 'online' ? "#eff6ff" : "white",
                  transition: "all 0.2s",
                  boxShadow: formData.paymentMethod === 'online' ? "0 2px 4px rgba(59, 130, 246, 0.2)" : "none"
                }}>
                  <input 
                    type="radio" 
                    name="paymentMethod" 
                    value="online" 
                    checked={formData.paymentMethod === 'online'} 
                    onChange={handleChange} 
                    style={{ display: "none" }} 
                  />
                  <span style={{ fontSize: "24px" }}>💳</span>
                  <span style={{ fontWeight: "600", fontSize: "13px", color: formData.paymentMethod === 'online' ? "#3b82f6" : "#475569" }}>Online</span>
                </label>
              </div>
            </div>
          )}

            <div style={{ 
              display: "flex", 
              gap: "12px", 
              marginTop: "24px", 
              paddingTop: "20px", 
              borderTop: "2px solid #e2e8f0" 
            }}>
              <button type="button" onClick={onClose} style={{
                flex: 1, 
                padding: "14px", 
                border: "2px solid #cbd5e0", 
                borderRadius: "10px",
                backgroundColor: "white", 
                cursor: "pointer", 
                fontWeight: "600",
                fontSize: "15px",
                color: "#475569",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = "#f8fafc"
                e.target.style.borderColor = "#94a3b8"
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = "white"
                e.target.style.borderColor = "#cbd5e0"
              }}>
                Cancel
              </button>
              <button type="submit" disabled={isLoading} style={{
                flex: 1, 
                padding: "14px", 
                border: "none", 
                borderRadius: "10px",
                background: isLoading ? "#cbd5e0" : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", 
                color: "white", 
                cursor: isLoading ? "not-allowed" : "pointer", 
                fontWeight: "600",
                fontSize: "15px",
                boxShadow: isLoading ? "none" : "0 4px 6px rgba(102, 126, 234, 0.4)",
                transition: "all 0.2s"
              }}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.target.style.transform = "translateY(-2px)"
                  e.target.style.boxShadow = "0 6px 8px rgba(102, 126, 234, 0.5)"
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.target.style.transform = "translateY(0)"
                  e.target.style.boxShadow = "0 4px 6px rgba(102, 126, 234, 0.4)"
                }
              }}>
                {isLoading ? "Booking..." : "✓ Confirm Booking"}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      {/* Calendar Modal */}
      {showCalendar && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.7)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1001
        }} onClick={(e) => e.stopPropagation()}>
          <div style={{
            backgroundColor: "white", borderRadius: "12px", padding: "20px",
            width: "90%", maxWidth: "400px", maxHeight: "80vh", overflow: "auto"
          }} onClick={(e) => e.stopPropagation()}>
            {/* Calendar Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <button onClick={() => changeMonth(-1)} disabled={calendarLoading} style={{
                background: "none", border: "none", cursor: "pointer", fontSize: "24px", padding: "5px"
              }}>‹</button>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>
                {calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h3>
              <button onClick={() => changeMonth(1)} disabled={calendarLoading} style={{
                background: "none", border: "none", cursor: "pointer", fontSize: "24px", padding: "5px"
              }}>›</button>
            </div>

            {/* Calendar Legend */}
            <div style={{ display: "flex", justifyContent: "space-around", marginBottom: "15px", padding: "10px", backgroundColor: "#f8f9fa", borderRadius: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#22c55e" }}></div>
                <span style={{ fontSize: "12px" }}>Available</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#dc2626" }}></div>
                <span style={{ fontSize: "12px" }}>Booked</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#9ca3af" }}></div>
                <span style={{ fontSize: "12px" }}>Past</span>
              </div>
            </div>

            {/* Loading Indicator */}
            {calendarLoading && (
              <div style={{ textAlign: "center", padding: "10px", color: "#6b7280" }}>
                Loading availability...
              </div>
            )}

            {/* Week Days */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "10px" }}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} style={{ textAlign: "center", padding: "8px", fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px", marginBottom: "20px" }}>
              {(() => {
                const { daysInMonth, firstDay } = getDaysInMonth(calendarMonth)
                const days = []
                
                // Empty cells for days before first day of month
                for (let i = 0; i < firstDay; i++) {
                  days.push(<div key={`empty-${i}`} style={{ aspectRatio: "1", padding: "8px" }}></div>)
                }
                
                // Days of the month
                for (let day = 1; day <= daysInMonth; day++) {
                  const isPast = isPastDate(day)
                  const hasBookings = hasBookingsOnDate(day)
                  const isSelectable = !isPast // Allow selection on any non-past date
                  
                  days.push(
                    <button
                      key={day}
                      onClick={() => isSelectable && selectDate(day)}
                      disabled={!isSelectable}
                      style={{
                        aspectRatio: "1",
                        border: isSelectable ? "1px solid #e5e7eb" : "1px solid #fca5a5",
                        borderRadius: "6px",
                        backgroundColor: isPast ? "#f3f4f6" : !isSelectable ? "#fee2e2" : "white",
                        color: isPast ? "#9ca3af" : !isSelectable ? "#dc2626" : "#000",
                        cursor: isSelectable ? "pointer" : "not-allowed",
                        fontSize: "14px",
                        fontWeight: "500",
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.2s ease"
                      }}
                      onMouseOver={(e) => {
                        if (isSelectable) {
                          e.target.style.backgroundColor = "#f0f9ff"
                          e.target.style.borderColor = "#3b82f6"
                        }
                      }}
                      onMouseOut={(e) => {
                        if (isSelectable) {
                          e.target.style.backgroundColor = "white"
                          e.target.style.borderColor = "#e5e7eb"
                        }
                      }}
                    >
                      {day}
                      
                      {/* Show red dot for booked dates */}
                      {hasBookings && !isPast && (
                        <div style={{
                          position: "absolute", 
                          top: "3px", 
                          right: "3px",
                          width: "8px", 
                          height: "8px", 
                          borderRadius: "50%",
                          backgroundColor: "#dc2626",
                          border: "1px solid white",
                          boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
                        }}></div>
                      )}
                      
                      {/* Show green dot for available dates */}
                      {!hasBookings && !isPast && (
                        <div style={{
                          position: "absolute", 
                          top: "3px", 
                          right: "3px",
                          width: "6px", 
                          height: "6px", 
                          borderRadius: "50%",
                          backgroundColor: "#22c55e",
                          opacity: 0.7
                        }}></div>
                      )}
                    </button>
                  )
                }
                
                return days
              })()}
            </div>

            {/* Info Message */}
            <div style={{ textAlign: "center", fontSize: "11px", color: "#6b7280", marginBottom: "15px", padding: "8px", backgroundColor: "#f8f9fa", borderRadius: "4px" }}>
              🟢 Available for booking • 🔴 Already booked (unavailable) • 🔵 Today • Red background = Date conflicts with existing bookings
            </div>

            {/* Close Button */}
            <button onClick={() => setShowCalendar(false)} style={{
              width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px",
              backgroundColor: "white", cursor: "pointer", fontWeight: "500"
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Restaurant Bill Modal for adding bills to checked-in guests
const RestaurantBillModal = ({ booking, onClose, onAddBill, onRemoveBill, allBookings = [] }) => {
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      if (!amount || parseFloat(amount) <= 0) {
        throw new Error("Please enter a valid amount")
      }
      if (!description.trim()) {
        throw new Error("Please enter a description")
      }

      await onAddBill(booking._id, {
        amount: parseFloat(amount),
        description: description.trim()
      })

      setAmount("")
      setDescription("")
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "white", borderRadius: "8px", width: "90%",
        maxWidth: "600px", maxHeight: "90vh", overflow: "auto"
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #e5e7eb",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          backgroundColor: "#f59e0b", color: "white"
        }}>
          <h3 style={{ margin: 0 }}>Restaurant Bills - Room {booking.roomId?.roomNumber}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "24px", color: "white" }}>×</button>
        </div>
        
        <div style={{ padding: "20px" }}>
          {/* Guest Info */}
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f0fdf4", borderRadius: "8px" }}>
            <h4 style={{ margin: "0 0 10px" }}>Guest: {booking.userName}</h4>
            <p style={{ margin: "0", fontSize: "14px", color: "#6b7280" }}>
              Room {booking.roomId?.roomNumber} • {booking.userPhone}
            </p>
          </div>

          {error && (
            <div style={{ padding: "10px", backgroundColor: "#fee2e2", color: "#dc2626", borderRadius: "4px", marginBottom: "15px" }}>
              {error}
            </div>
          )}

          {/* Add New Bill Form */}
          <form onSubmit={handleSubmit} style={{ marginBottom: "30px", padding: "20px", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
            <h4 style={{ margin: "0 0 15px", color: "#374151" }}>Add Restaurant Bill</h4>
            
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Amount (₹)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                placeholder="Enter amount"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                placeholder="e.g., Lunch, Dinner, Room Service"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: "10px 20px", backgroundColor: "#059669", color: "white",
                border: "none", borderRadius: "6px", cursor: isLoading ? "not-allowed" : "pointer",
                fontWeight: "500"
              }}
            >
              {isLoading ? "Adding..." : "Add Bill"}
            </button>
          </form>

          {/* Existing Bills */}
          <div>
            <h4 style={{ margin: "0 0 15px", color: "#374151" }}>
              Restaurant Bills ({booking.restaurantBills?.length || 0})
              {booking.restaurantTotal > 0 && (
                <span style={{ color: "#dc2626", fontWeight: "600", marginLeft: "10px" }}>
                  Total: ₹{booking.restaurantTotal.toFixed(2)}
                </span>
              )}
            </h4>
            
            {booking.restaurantBills && booking.restaurantBills.length > 0 ? (
              <div style={{ maxHeight: "300px", overflowY: "auto" }}>
                {booking.restaurantBills.map((bill, index) => (
                  <div key={bill._id || index} style={{
                    padding: "12px", backgroundColor: "white", borderRadius: "6px",
                    border: "1px solid #e5e7eb", marginBottom: "8px",
                    display: "flex", justifyContent: "space-between", alignItems: "center"
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "500", color: "#374151" }}>{bill.description}</div>
                      <div style={{ fontSize: "12px", color: "#6b7280" }}>
                        {formatDate(bill.date || bill.createdAt)} • Added by {bill.addedBy || 'Receptionist'}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontWeight: "600", color: "#dc2626" }}>₹{bill.amount.toFixed(2)}</span>
                      <button
                        onClick={() => onRemoveBill(booking._id, bill._id)}
                        style={{
                          padding: "4px 8px", backgroundColor: "#fee2e2", color: "#dc2626",
                          border: "1px solid #fecaca", borderRadius: "4px", cursor: "pointer",
                          fontSize: "12px"
                        }}
                        title="Remove bill"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#6b7280", fontStyle: "italic" }}>No restaurant bills added yet.</p>
            )}
          </div>

          {/* Close Button */}
          <div style={{ marginTop: "20px", textAlign: "center" }}>
            <button
              onClick={onClose}
              style={{
                padding: "10px 20px", backgroundColor: "#6b7280", color: "white",
                border: "none", borderRadius: "6px", cursor: "pointer"
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


const CheckoutModal = ({ booking, onClose, onCheckout, onUpdatePayment, allBookings = [] }) => {
  const [additionalPayment, setAdditionalPayment] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const totalAmount = booking.totalPrice || 0
  const restaurantTotal = booking.restaurantTotal || 0
  const grandTotal = totalAmount + restaurantTotal
  const amountPaid = booking.amountPaid || 0
  const cashAmount = booking.cashAmount || 0
  const onlineAmount = booking.onlineAmount || 0
  const balanceDue = grandTotal - amountPaid

  const handleAddPayment = async () => {
    const payment = parseFloat(additionalPayment) || 0
    if (payment <= 0) {
      setError("Please enter a valid amount")
      return
    }
    
    setIsLoading(true)
    setError("")
    try {
      await onUpdatePayment(booking._id, amountPaid + payment, paymentMethod, payment)
      setAdditionalPayment("")
    } catch (err) {
      setError(err.message || "Failed to update payment")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCheckout = async () => {
    setIsLoading(true)
    setError("")
    try {
      await onCheckout(booking._id)
      onClose()
    } catch (err) {
      setError(err.message || "Failed to checkout")
    } finally {
      setIsLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const handlePrintBill = () => {
    const printWindow = window.open('', '_blank')
    const billContent = `
      <!DOCTYPE html>
      <html>
      <head>

        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 15px; }
          .header img { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header p { font-size: 12px; color: #666; }
          .header .gst { font-size: 11px; color: #333; font-weight: bold; margin-top: 5px; }
          .bill-info { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #ccc; }
          .bill-info p { font-size: 13px; margin: 4px 0; }
          .guest-info { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #ccc; }
          .guest-info h3 { font-size: 14px; margin-bottom: 8px; }
          .guest-info p { font-size: 13px; margin: 4px 0; }
          .stay-info { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #ccc; }
          .stay-info h3 { font-size: 14px; margin-bottom: 8px; }
          .stay-info p { font-size: 13px; margin: 4px 0; }
          .charges { margin-bottom: 15px; }
          .charges h3 { font-size: 14px; margin-bottom: 8px; }
          .charge-row { display: flex; justify-content: space-between; font-size: 13px; margin: 5px 0; }
          .charge-row.total { font-weight: bold; font-size: 16px; border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; }
          .footer { text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px dashed #ccc; }
          .footer p { font-size: 12px; color: #666; margin: 3px 0; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${hotelViratLogo}" alt="Hotel Virat Logo" />
          <h1>Hotel Virat siridarshni</h1> 
          <p>149/A, Chord Rd, next to Iskcon Temple, 1st R Block <p>Yeshwanthpur Industrial Suburb, Rajajinagar,</p> Bengaluru, Karnataka 560010</p>
          <p>Your Comfort, Our Priority</p>
          <p>08023477111</p>
          <p class="gst">GSTIN: 29AGZPV1558K2Z6</p>
        </div>
        
        <div class="bill-info">
          <p><strong>Bill No:</strong> ${generateBillNumber(booking, allBookings)}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          <p><strong>Room No:</strong> ${booking.roomId?.roomNumber || 'N/A'}</p>
          <p><strong>Room Type:</strong> ${booking.roomId?.roomType || 'N/A'}</p>
        </div>
        
        <div class="guest-info">
          <h3>Guest Details</h3>
          <p><strong>Name:</strong> ${booking.userName || 'N/A'}</p>
          <p><strong>Phone:</strong> ${booking.userPhone || 'N/A'}</p>
          ${booking.userEmail ? `<p><strong>Email:</strong> ${booking.userEmail}</p>` : ''}
          ${booking.guestGstNumber ? `<p><strong>GSTIN:</strong> ${booking.guestGstNumber}</p>` : ''}
        </div>
        
        <div class="stay-info">
          <h3>Stay Details</h3>
          <p><strong>Check-in:</strong> ${formatDate(booking.checkInDate)} at ${booking.checkInTime || '1:00 PM'}</p>
          <p><strong>Check-out:</strong> ${formatDate(booking.checkOutDate)} at ${booking.checkOutTime || '9:00AM'}</p>
          <p><strong>No. of Nights:</strong> ${booking.nights || 1}</p>
        </div>
        
        <div class="charges">
          <h3>Room Charges</h3>
          <div class="charge-row">
            <span>Room Charges (${booking.nights || 1} night${(booking.nights || 1) > 1 ? 's' : ''})</span>
            <span>₹${(booking.baseAmount || 0).toFixed(2)}</span>
          </div>
          ${booking.gstType === 'gst' ? `
            <div class="charge-row">
              <span>CGST (2.5%)</span>
              <span>₹${(booking.cgst || 0).toFixed(2)}</span>
            </div>
            <div class="charge-row">
              <span>SGST (2.5%)</span>
              <span>₹${(booking.sgst || 0).toFixed(2)}</span>
            </div>
          ` : ''}
          ${booking.gstType === 'igst' ? `
            <div class="charge-row">
              <span>IGST (5%)</span>
              <span>₹${(booking.igst || 0).toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="charge-row total">
            <span>Total Amount</span>
            <span>₹${totalAmount.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you </p>
          <p>We hope to see you again soon.</p>
          <p style="margin-top: 10px; font-size: 10px;">This is a computer generated bill.</p>
        </div>
      </body>
      </html>
    `
    printWindow.document.write(billContent)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "white", borderRadius: "8px", width: "90%",
        maxWidth: "500px", maxHeight: "90vh", overflow: "auto"
      }}>
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #e5e7eb",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          backgroundColor: "#fef2f2"
        }}>
          <h3 style={{ margin: 0 }}>Room {booking.roomId?.roomNumber} - Checkout</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "24px" }}>×</button>
        </div>
        
        <div style={{ padding: "20px" }}>
          {error && (
            <div style={{ padding: "10px", backgroundColor: "#fee2e2", color: "#dc2626", borderRadius: "4px", marginBottom: "15px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertCircle size={16} />{error}
            </div>
          )}

          {/* Guest Details */}
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
            <h4 style={{ margin: "0 0 10px" }}>Guest Details</h4>
            <p style={{ margin: "5px 0", fontSize: "14px" }}><strong>Name:</strong> {booking.userName}</p>
            <p style={{ margin: "5px 0", fontSize: "14px" }}><strong>Phone:</strong> {booking.userPhone}</p>
            {booking.userEmail && <p style={{ margin: "5px 0", fontSize: "14px" }}><strong>Email:</strong> {booking.userEmail}</p>}
            {booking.guestGstNumber && <p style={{ margin: "5px 0", fontSize: "14px" }}><strong>GSTIN:</strong> {booking.guestGstNumber}</p>}
          </div>

          {/* Stay Details */}
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f0fdf4", borderRadius: "8px" }}>
            <h4 style={{ margin: "0 0 10px" }}>Stay Details</h4>
            <p style={{ margin: "5px 0", fontSize: "14px" }}><strong>Check-in:</strong> {formatDate(booking.checkInDate)} at {booking.checkInTime}</p>
            <p style={{ margin: "5px 0", fontSize: "14px" }}><strong>Check-out:</strong> {formatDate(booking.checkOutDate)} at {booking.checkOutTime}</p>
            <p style={{ margin: "5px 0", fontSize: "14px" }}><strong>Nights:</strong> {booking.nights}</p>
            {booking.actualCheckInTime && (
              <p style={{ margin: "8px 0 5px", fontSize: "13px", color: "#059669", fontWeight: "500" }}>
                ✅ <strong>Actual Check-in:</strong> {new Date(booking.actualCheckInTime).toLocaleString()}
              </p>
            )}
            {booking.actualCheckOutTime && (
              <p style={{ margin: "5px 0", fontSize: "13px", color: "#059669", fontWeight: "500" }}>
                ✅ <strong>Actual Check-out:</strong> {new Date(booking.actualCheckOutTime).toLocaleString()}
              </p>
            )}
          </div>

          {/* Payment Summary */}
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#fef3c7", borderRadius: "8px" }}>
            <h4 style={{ margin: "0 0 10px" }}>Payment Summary</h4>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", fontSize: "14px" }}>
              <span>Room Charges:</span>
              <span>₹{totalAmount.toFixed(2)}</span>
            </div>
            {restaurantTotal > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", fontSize: "14px", color: "#dc2626" }}>
                <span>Restaurant Bills:</span>
                <span>₹{restaurantTotal.toFixed(2)}</span>
              </div>
            )}
            {booking.gstType && booking.gstType !== 'none' && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", fontSize: "14px", color: "#6b7280" }}>
                <span>GST ({booking.gstType === 'gst' ? 'CGST+SGST' : 'IGST'}):</span>
                <span>₹{((booking.cgst || 0) + (booking.sgst || 0) + (booking.igst || 0)).toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", fontWeight: "bold", borderTop: "1px solid #e5e7eb", paddingTop: "8px" }}>
              <span>Grand Total:</span>
              <span>₹{grandTotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", fontSize: "14px", color: "#059669" }}>
              <span>Amount Paid:</span>
              <span>₹{amountPaid.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "16px", color: balanceDue > 0 ? "#dc2626" : "#059669" }}>
              <span>{balanceDue > 0 ? "Balance Due:" : "Status:"}</span>
              <span>{balanceDue > 0 ? `₹${balanceDue.toFixed(2)}` : "✓ Fully Paid"}</span>
            </div>
          </div>

          {/* Payment Breakdown */}
          {(cashAmount > 0 || onlineAmount > 0) && (
            <div style={{ marginBottom: "15px", padding: "10px", backgroundColor: "#f0fdf4", borderRadius: "6px", fontSize: "13px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span>💵 Cash Received:</span>
                <span style={{ color: "#059669", fontWeight: "500" }}>₹{cashAmount.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>💳 Online Received:</span>
                <span style={{ color: "#3b82f6", fontWeight: "500" }}>₹{onlineAmount.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Add Payment Section */}
          {balanceDue > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Add Payment (₹)
              </label>
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                <input
                  type="number"
                  value={additionalPayment}
                  onChange={(e) => setAdditionalPayment(e.target.value)}
                  style={{ flex: 1, padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                  placeholder={`Max: ₹${balanceDue.toFixed(2)}`}
                  min="0"
                  max={balanceDue}
                />
                <button
                  onClick={handleAddPayment}
                  disabled={isLoading}
                  style={{
                    padding: "10px 20px", backgroundColor: "#3b82f6", color: "white",
                    border: "none", borderRadius: "6px", cursor: isLoading ? "not-allowed" : "pointer"
                  }}
                >
                  {isLoading ? "..." : "Add"}
                </button>
              </div>
              
              {/* Payment Method Selection */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
                <label style={{ 
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", 
                  cursor: "pointer", padding: "10px", 
                  border: paymentMethod === 'cash' ? "2px solid #059669" : "1px solid #e5e7eb", 
                  borderRadius: "6px", 
                  backgroundColor: paymentMethod === 'cash' ? "#f0fdf4" : "white" 
                }}>
                  <input type="radio" name="checkoutPaymentMethod" value="cash" checked={paymentMethod === 'cash'} onChange={(e) => setPaymentMethod(e.target.value)} style={{ display: "none" }} />
                  <span>💵</span>
                  <span style={{ fontWeight: "500", fontSize: "14px", color: paymentMethod === 'cash' ? "#059669" : "#374151" }}>Cash</span>
                </label>
                <label style={{ 
                  flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", 
                  cursor: "pointer", padding: "10px", 
                  border: paymentMethod === 'online' ? "2px solid #3b82f6" : "1px solid #e5e7eb", 
                  borderRadius: "6px", 
                  backgroundColor: paymentMethod === 'online' ? "#eff6ff" : "white" 
                }}>
                  <input type="radio" name="checkoutPaymentMethod" value="online" checked={paymentMethod === 'online'} onChange={(e) => setPaymentMethod(e.target.value)} style={{ display: "none" }} />
                  <span>💳</span>
                  <span style={{ fontWeight: "500", fontSize: "14px", color: paymentMethod === 'online' ? "#3b82f6" : "#374151" }}>Online</span>
                </label>
              </div>

              <button
                onClick={() => setAdditionalPayment(balanceDue.toString())}
                style={{
                  padding: "6px 12px", backgroundColor: "#f3f4f6",
                  border: "1px solid #e5e7eb", borderRadius: "4px", cursor: "pointer", fontSize: "12px"
                }}
              >
                Pay Full Balance (₹{balanceDue.toFixed(2)})
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, minWidth: "100px", padding: "12px", border: "1px solid #e5e7eb", borderRadius: "6px",
                backgroundColor: "white", cursor: "pointer"
              }}
            >
              Close
            </button>
            {/* Only show Print Bill button if GST is applied */}
            {booking.gstType && booking.gstType !== 'none' && (
              <button
                onClick={handlePrintBill}
                style={{
                  flex: 1, minWidth: "100px", padding: "12px", border: "none", borderRadius: "6px",
                  backgroundColor: "#3b82f6", color: "white", cursor: "pointer", fontWeight: "500",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                }}
              >
                <Printer size={16} /> Print Bill
              </button>
            )}
            <button
              onClick={handleCheckout}
              disabled={isLoading}
              style={{
                flex: 1, minWidth: "100px", padding: "12px", border: "none", borderRadius: "6px",
                backgroundColor: balanceDue > 0 ? "#f59e0b" : "#059669",
                color: "white", cursor: isLoading ? "not-allowed" : "pointer", fontWeight: "500"
              }}
            >
              {isLoading ? "Processing..." : balanceDue > 0 ? `Checkout (₹${balanceDue.toFixed(2)} due)` : "✓ Checkout (Paid)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Bulk Booking Modal for booking multiple rooms under single customer
const BulkBookingModal = ({ rooms, allBookings, onClose, onBulkBook }) => {
  const [selectedRooms, setSelectedRooms] = useState([])
  const [formData, setFormData] = useState({
    guestName: "",
    guestPhone: "",
    guestEmail: "",
    guestGstNumber: "",
    aadhaarNumber: "",
    panNumber: "",
    checkInDate: new Date().toISOString().split('T')[0],
    checkOutDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    checkInTime: "12:00",
    checkOutTime: "11:00",
    gstType: "none",
    discountPercent: "",
    amountPaid: "",
    paymentMethod: "cash",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const calculateNights = () => {
    const checkIn = new Date(formData.checkInDate)
    const checkOut = new Date(formData.checkOutDate)
    const diff = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24))
    return diff > 0 ? diff : 1
  }

  const nights = calculateNights()
  
  // Calculate total for all selected rooms
  const totalRoomPrice = selectedRooms.reduce((sum, room) => sum + (room.price * nights), 0)
  const discountPercent = parseFloat(formData.discountPercent) || 0
  const discountAmount = (totalRoomPrice * discountPercent) / 100
  const amountAfterDiscount = totalRoomPrice - discountAmount
  
  // GST Calculations
  const cgst = formData.gstType === 'gst' ? amountAfterDiscount * 0.025 : 0
  const sgst = formData.gstType === 'gst' ? amountAfterDiscount * 0.025 : 0
  const igst = formData.gstType === 'igst' ? amountAfterDiscount * 0.05 : 0
  const totalGst = cgst + sgst + igst
  const grandTotal = amountAfterDiscount + totalGst

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    setError("")
  }

  const handleRoomToggle = (room) => {
    // Check if room is available for the selected dates
    const isAvailable = checkRoomAvailability(room, formData.checkInDate, formData.checkOutDate)
    
    if (!isAvailable && formData.checkInDate && formData.checkOutDate) {
      // Room is booked - find the conflicting booking and show alert
      const checkIn = new Date(formData.checkInDate)
      checkIn.setHours(0, 0, 0, 0)
      const checkOut = new Date(formData.checkOutDate)
      checkOut.setHours(0, 0, 0, 0)
      
      // If check-in and check-out are the same, add one day to check-out
      if (checkIn.getTime() === checkOut.getTime()) {
        checkOut.setDate(checkOut.getDate() + 1)
      }
      
      const conflictingBookings = allBookings?.filter(booking => {
        const bookingRoomId = booking.roomId?._id || booking.roomId
        if (bookingRoomId !== room._id) return false
        if (booking.status === 'cancelled' || booking.status === 'checked-out') return false
        
        const existingCheckIn = new Date(booking.checkInDate)
        existingCheckIn.setHours(0, 0, 0, 0)
        const existingCheckOut = new Date(booking.checkOutDate)
        existingCheckOut.setHours(0, 0, 0, 0)
        
        // If existing booking has same check-in and check-out, add one day
        if (existingCheckIn.getTime() === existingCheckOut.getTime()) {
          existingCheckOut.setDate(existingCheckOut.getDate() + 1)
        }
        
        return (checkIn < existingCheckOut && checkOut > existingCheckIn)
      }) || []
      
      if (conflictingBookings.length > 0) {
        const booking = conflictingBookings[0]
        const guestName = booking.userName || 'Unknown Guest'
        const checkInDate = new Date(booking.checkInDate).toLocaleDateString()
        const checkOutDate = new Date(booking.checkOutDate).toLocaleDateString()
        
        const confirmed = window.confirm(
          `Room ${room.roomNumber} is already booked by ${guestName} (${checkInDate} - ${checkOutDate}) for the selected dates.\n\nClick OK to view booking details or Cancel to close.`
        )
        
        if (confirmed) {
          // User clicked OK - show booking details (you can implement a booking details modal here)
          alert(`Booking Details:\n\nGuest: ${guestName}\nPhone: ${booking.userPhone || 'N/A'}\nCheck-in: ${checkInDate}\nCheck-out: ${checkOutDate}\nStatus: ${booking.status}\nTotal: ₹${booking.totalPrice || 0}`)
        }
        // If user clicked Cancel, do nothing
        return
      }
    }
    
    // Room is available - proceed with normal toggle
    setSelectedRooms(prev => {
      const isSelected = prev.find(r => r._id === room._id)
      if (isSelected) {
        return prev.filter(r => r._id !== room._id)
      } else {
        return [...prev, room]
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      // Validation
      if (selectedRooms.length === 0) {
        throw new Error("Please select at least one room")
      }
      
      if (!formData.guestName?.trim()) {
        throw new Error("Guest name is required")
      }
      
      if (!formData.guestPhone?.trim()) {
        throw new Error("Guest phone number is required")
      }

      // Validate phone number
      const phoneRegex = /^[0-9]{10}$/
      if (!phoneRegex.test(formData.guestPhone.replace(/\D/g, ''))) {
        throw new Error("Please enter a valid 10-digit phone number")
      }

      // Validate dates
      const checkInDate = new Date(formData.checkInDate)
      const checkOutDate = new Date(formData.checkOutDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      if (checkInDate < today) {
        throw new Error("Check-in date cannot be in the past")
      }
      
      if (checkOutDate < checkInDate) {
        throw new Error("Check-out date cannot be before check-in date")
      }

      // Double-check for room conflicts before submitting
      const conflictingRooms = []
      selectedRooms.forEach(room => {
        const existingBookings = allBookings?.filter(booking => {
          const bookingRoomId = booking.roomId?._id || booking.roomId
          return (bookingRoomId === room._id) && 
                 booking.status !== 'cancelled' && 
                 booking.status !== 'checked-out'
        }) || []
        
        const hasConflict = existingBookings.some(booking => {
          const existingCheckIn = new Date(booking.checkInDate)
          const existingCheckOut = new Date(booking.checkOutDate)
          return (checkInDate < existingCheckOut && checkOutDate > existingCheckIn)
        })
        
        if (hasConflict) {
          const conflictingBookings = existingBookings.filter(booking => {
            const existingCheckIn = new Date(booking.checkInDate)
            const existingCheckOut = new Date(booking.checkOutDate)
            return (checkInDate < existingCheckOut && checkOutDate > existingCheckIn)
          })
          
          conflictingRooms.push({
            room: room,
            conflicts: conflictingBookings
          })
        }
      })
      
      if (conflictingRooms.length > 0) {
        const conflictDetails = conflictingRooms.map(({ room, conflicts }) => {
          const conflictInfo = conflicts.map(booking => 
            `${booking.userName} (${new Date(booking.checkInDate).toLocaleDateString()} - ${new Date(booking.checkOutDate).toLocaleDateString()})`
          ).join(', ')
          return `Room ${room.roomNumber}: ${conflictInfo}`
        }).join('; ')
        
        throw new Error(`The following rooms have booking conflicts: ${conflictDetails}. Please remove these rooms or select different dates.`)
      }

      const paidAmount = parseFloat(formData.amountPaid) || 0
      const paymentMethod = formData.paymentMethod || 'cash'

      // Create bulk booking data
      const bulkBookingData = {
        guestName: formData.guestName,
        guestPhone: formData.guestPhone,
        guestEmail: formData.guestEmail,
        guestGstNumber: formData.guestGstNumber,
        aadhaarNumber: formData.aadhaarNumber ? formData.aadhaarNumber.trim() : '',
        panNumber: formData.panNumber ? formData.panNumber.trim().toUpperCase() : '',
        checkInDate: formData.checkInDate,
        checkOutDate: formData.checkOutDate,
        checkInTime: formData.checkInTime,
        checkOutTime: formData.checkOutTime,
        nights,
        gstType: formData.gstType,
        discountPercent: discountPercent || 0,
        discountAmount: discountAmount || 0,
        cgst,
        sgst,
        igst,
        totalAmount: grandTotal,
        amountPaid: paidAmount,
        cashAmount: paymentMethod === 'cash' ? paidAmount : 0,
        onlineAmount: paymentMethod === 'online' ? paidAmount : 0,
        paymentStatus: paidAmount >= grandTotal ? 'paid' : 'pending',
        selectedRooms: selectedRooms.map(room => ({
          roomId: room._id,
          roomNumber: room.roomNumber,
          roomType: room.roomType,
          price: room.price,
          baseAmount: room.price * nights
        }))
      }

      await onBulkBook(bulkBookingData)
      onClose()
    } catch (err) {
      console.error("Bulk booking error:", err)
      setError(err.message || "Failed to create bulk booking")
    } finally {
      setIsLoading(false)
    }
  }

  // Filter available rooms only
  const checkRoomAvailability = (room, checkInDate, checkOutDate) => {
    if (!checkInDate || !checkOutDate) return true // If dates not set, show all rooms
    
    // Normalize dates to midnight to avoid time comparison issues
    const checkIn = new Date(checkInDate)
    checkIn.setHours(0, 0, 0, 0)
    const checkOut = new Date(checkOutDate)
    checkOut.setHours(0, 0, 0, 0)
    
    // If check-in and check-out are the same, treat it as a single day booking
    // Add one day to check-out for proper overlap detection
    if (checkIn.getTime() === checkOut.getTime()) {
      checkOut.setDate(checkOut.getDate() + 1)
    }
    
    // Get all existing bookings for this room (excluding cancelled and checked-out ones)
    const existingBookings = allBookings?.filter(booking => {
      const bookingRoomId = booking.roomId?._id || booking.roomId
      return (bookingRoomId === room._id) && 
             booking.status !== 'cancelled' && 
             booking.status !== 'checked-out'
    }) || []
    
    // Check for date conflicts
    const hasConflict = existingBookings.some(booking => {
      const existingCheckIn = new Date(booking.checkInDate)
      existingCheckIn.setHours(0, 0, 0, 0)
      const existingCheckOut = new Date(booking.checkOutDate)
      existingCheckOut.setHours(0, 0, 0, 0)
      
      // If existing booking has same check-in and check-out, add one day
      if (existingCheckIn.getTime() === existingCheckOut.getTime()) {
        existingCheckOut.setDate(existingCheckOut.getDate() + 1)
      }
      
      // Check if dates overlap
      // A conflict exists if the new booking overlaps with existing booking
      return (checkIn < existingCheckOut && checkOut > existingCheckIn)
    })
    
    return !hasConflict
  }

  const availableRooms = rooms.filter(room => 
    checkRoomAvailability(room, formData.checkInDate, formData.checkOutDate)
  ).sort((a, b) => {
    // Sort rooms by room number in ascending order (101, 102, 103, etc.)
    const roomA = parseInt(a.roomNumber) || 0
    const roomB = parseInt(b.roomNumber) || 0
    return roomA - roomB
  })

  // Show all rooms but with different styling for available vs booked
  const allRoomsWithStatus = rooms.map(room => ({
    ...room,
    isAvailable: checkRoomAvailability(room, formData.checkInDate, formData.checkOutDate)
  })).sort((a, b) => {
    // Sort rooms by room number in ascending order (101, 102, 103, etc.)
    const roomA = parseInt(a.roomNumber) || 0
    const roomB = parseInt(b.roomNumber) || 0
    return roomA - roomB
  })

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "white", borderRadius: "8px", width: "95%",
        maxWidth: "900px", maxHeight: "90vh", overflow: "hidden",
        display: "flex", flexDirection: "column"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #e5e7eb",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          backgroundColor: "#7c3aed", color: "white"
        }}>
          <h3 style={{ margin: 0 }}>🏨 Bulk Booking - Multiple Rooms</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "24px", color: "white" }}>×</button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{ 
            padding: "12px 20px", backgroundColor: "#fee2e2", color: "#dc2626", 
            display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #fecaca"
          }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: "14px", fontWeight: "500" }}>{error}</span>
          </div>
        )}
        
        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", gap: "20px" }}>
          {/* Left Side - Room Selection */}
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: "0 0 15px", color: "#374151" }}>
              Select Rooms ({selectedRooms.length} selected)
            </h4>
            
            {availableRooms.length === 0 && formData.checkInDate && formData.checkOutDate ? (
              <div style={{
                padding: "20px",
                textAlign: "center",
                border: "1px solid #fbbf24",
                borderRadius: "8px",
                backgroundColor: "#fef3c7",
                color: "#92400e"
              }}>
                <AlertCircle size={24} style={{ marginBottom: "10px" }} />
                <p style={{ margin: 0, fontWeight: "500" }}>No rooms available for selected dates</p>
                <p style={{ margin: "5px 0 0", fontSize: "14px" }}>All rooms are booked. Click on booked rooms to see details.</p>
              </div>
            ) : null}
            
            <div style={{ 
              maxHeight: "400px", 
              overflowY: "auto", 
              border: "1px solid #e5e7eb", 
              borderRadius: "8px",
              padding: "10px"
            }}>
              {allRoomsWithStatus.map(room => {
                const isSelected = selectedRooms.find(r => r._id === room._id)
                const isAvailable = room.isAvailable
                
                return (
                  <div
                    key={room._id}
                    onClick={() => handleRoomToggle(room)}
                    style={{
                      padding: "12px",
                      margin: "8px 0",
                      border: `2px solid ${isSelected ? '#7c3aed' : isAvailable ? '#e5e7eb' : '#fca5a5'}`,
                      borderRadius: "8px",
                      backgroundColor: isSelected ? '#f3f4f6' : isAvailable ? 'white' : '#fef2f2',
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "all 0.2s",
                      opacity: isAvailable ? 1 : 0.7
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "600", color: isAvailable ? "#374151" : "#dc2626" }}>
                        Room {room.roomNumber}
                        {!isAvailable && <span style={{ fontSize: "12px", marginLeft: "8px", color: "#dc2626" }}>● BOOKED</span>}
                      </div>
                      <div style={{ fontSize: "14px", color: "#6b7280" }}>
                        {room.roomType} • Floor {room.floor}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: "600", color: isAvailable ? "#059669" : "#6b7280" }}>
                        ₹{room.price}/night
                      </div>
                      {isSelected && (
                        <div style={{ fontSize: "12px", color: "#7c3aed", fontWeight: "500" }}>
                          ✓ Selected
                        </div>
                      )}
                      {!isAvailable && !isSelected && (
                        <div style={{ fontSize: "12px", color: "#dc2626", fontWeight: "500" }}>
                          Click for details
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right Side - Guest Details Form */}
          <div style={{ flex: 1 }}>
            <form onSubmit={handleSubmit}>
              <h4 style={{ margin: "0 0 15px", color: "#374151" }}>Guest Details</h4>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                  <User size={14} style={{ marginRight: "6px" }} />Guest Name *
                </label>
                <input
                  type="text"
                  name="guestName"
                  value={formData.guestName}
                  onChange={handleChange}
                  required
                  style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                  placeholder="Enter guest name"
                />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                  <Phone size={14} style={{ marginRight: "6px" }} />Phone *
                </label>
                <input
                  type="tel"
                  name="guestPhone"
                  value={formData.guestPhone}
                  onChange={handleChange}
                  required
                  style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                  placeholder="Enter phone number"
                />
              </div>

              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                  <Mail size={14} style={{ marginRight: "6px" }} />Email
                </label>
                <input
                  type="email"
                  name="guestEmail"
                  value={formData.guestEmail}
                  onChange={handleChange}
                  style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                  placeholder="Enter email (optional)"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                    <Calendar size={14} style={{ marginRight: "6px" }} />Check-in Date
                  </label>
                  <input
                    type="date"
                    name="checkInDate"
                    value={formData.checkInDate}
                    onChange={handleChange}
                    required
                    style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Check-out Date</label>
                  <input
                    type="date"
                    name="checkOutDate"
                    value={formData.checkOutDate}
                    onChange={handleChange}
                    required
                    style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                  />
                </div>
              </div>

              {/* GST Options */}
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>GST Option</label>
                <div style={{ display: "flex", gap: "10px" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                    <input type="radio" name="gstType" value="none" checked={formData.gstType === 'none'} onChange={handleChange} />
                    <span style={{ fontSize: "14px" }}>No GST</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                    <input type="radio" name="gstType" value="gst" checked={formData.gstType === 'gst'} onChange={handleChange} />
                    <span style={{ fontSize: "14px" }}>GST (5%)</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                    <input type="radio" name="gstType" value="igst" checked={formData.gstType === 'igst'} onChange={handleChange} />
                    <span style={{ fontSize: "14px" }}>IGST (5%)</span>
                  </label>
                </div>
              </div>

              {/* Discount */}
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                  Discount (%)
                </label>
                <input
                  type="number"
                  name="discountPercent"
                  value={formData.discountPercent}
                  onChange={handleChange}
                  style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                  placeholder="Enter discount percentage"
                  min="0"
                  max="100"
                  step="0.01"
                />
              </div>

              {/* Price Summary */}
              {selectedRooms.length > 0 && (
                <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
                  <h4 style={{ margin: "0 0 10px" }}>Booking Summary</h4>
                  <div style={{ fontSize: "14px", marginBottom: "8px" }}>
                    <strong>{selectedRooms.length} Room(s) × {nights} Night(s)</strong>
                  </div>
                  {selectedRooms.map(room => (
                    <div key={room._id} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "4px" }}>
                      <span>Room {room.roomNumber} ({room.roomType})</span>
                      <span>₹{(room.price * nights).toFixed(2)}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #e5e7eb" }}>
                    <span><strong>Subtotal</strong></span>
                    <span><strong>₹{totalRoomPrice.toFixed(2)}</strong></span>
                  </div>
                  {discountPercent > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#059669" }}>
                      <span>Discount ({discountPercent}%)</span>
                      <span>- ₹{discountAmount.toFixed(2)}</span>
                    </div>
                  )}
                  {totalGst > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", color: "#6b7280" }}>
                      <span>GST</span>
                      <span>₹{totalGst.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "16px", marginTop: "8px", paddingTop: "8px", borderTop: "2px solid #374151" }}>
                    <span>Grand Total</span>
                    <span>₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Amount Paid */}
              <div style={{ marginBottom: "15px" }}>
                <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                  Amount Paid (₹)
                </label>
                <input
                  type="number"
                  name="amountPaid"
                  value={formData.amountPaid}
                  onChange={handleChange}
                  style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                  placeholder={`Enter amount paid (Total: ₹${grandTotal.toFixed(2)})`}
                  min="0"
                  max={grandTotal}
                />
              </div>

              {/* Payment Method */}
              {formData.amountPaid && parseFloat(formData.amountPaid) > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>Payment Method</label>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <label style={{ 
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", 
                      cursor: "pointer", padding: "12px", 
                      border: formData.paymentMethod === 'cash' ? "2px solid #059669" : "1px solid #e5e7eb", 
                      borderRadius: "6px", 
                      backgroundColor: formData.paymentMethod === 'cash' ? "#f0fdf4" : "white" 
                    }}>
                      <input type="radio" name="paymentMethod" value="cash" checked={formData.paymentMethod === 'cash'} onChange={handleChange} style={{ display: "none" }} />
                      <span>💵 Cash</span>
                    </label>
                    <label style={{ 
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", 
                      cursor: "pointer", padding: "12px", 
                      border: formData.paymentMethod === 'online' ? "2px solid #3b82f6" : "1px solid #e5e7eb", 
                      borderRadius: "6px", 
                      backgroundColor: formData.paymentMethod === 'online' ? "#eff6ff" : "white" 
                    }}>
                      <input type="radio" name="paymentMethod" value="online" checked={formData.paymentMethod === 'online'} onChange={handleChange} style={{ display: "none" }} />
                      <span>💳 Online</span>
                    </label>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
                <button type="button" onClick={onClose} style={{
                  flex: 1, padding: "12px", border: "1px solid #e5e7eb", borderRadius: "6px",
                  backgroundColor: "white", cursor: "pointer", fontWeight: "500"
                }}>Cancel</button>
                <button type="submit" disabled={isLoading || selectedRooms.length === 0} style={{
                  flex: 1, padding: "12px", border: "none", borderRadius: "6px",
                  backgroundColor: isLoading || selectedRooms.length === 0 ? "#9ca3af" : "#7c3aed", 
                  color: "white", cursor: isLoading || selectedRooms.length === 0 ? "not-allowed" : "pointer", 
                  fontWeight: "500"
                }}>
                  {isLoading ? "Creating..." : `Book ${selectedRooms.length} Room(s)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

const ReceptionistDashboard = () => {
  const navigate = useNavigate()
  const [receptionistData, setReceptionistData] = useState(null)
  const [rooms, setRooms] = useState([])
  const [bookings, setBookings] = useState([])
  const [allBookings, setAllBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [filterStatus, setFilterStatus] = useState("all")
  const [selectedRoom, setSelectedRoom] = useState(null)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [showCheckoutModal, setShowCheckoutModal] = useState(false)
  const [showRestaurantBillModal, setShowRestaurantBillModal] = useState(false)
  const [showAdvanceBookingModal, setShowAdvanceBookingModal] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showExtendBookingModal, setShowExtendBookingModal] = useState(false)
  const [showCancelExtensionModal, setShowCancelExtensionModal] = useState(false)
  const [showBulkBookingModal, setShowBulkBookingModal] = useState(false)
  const [showBookingDetailsModal, setShowBookingDetailsModal] = useState(false)
  const [showBulkRestaurantModal, setShowBulkRestaurantModal] = useState(false)
  const [activeTab, setActiveTab] = useState("rooms") // "rooms", "history", or "advance"
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentPeriod, setPaymentPeriod] = useState("today") // "today", "week", "month", "all"

  useEffect(() => {
    const userType = localStorage.getItem("userType")
    const staffData = localStorage.getItem("receptionistData")
    
    if (userType !== "receptionist" || !staffData) {
      navigate("/login")
      return
    }
    
    setReceptionistData(JSON.parse(staffData))
  }, [navigate])

  useEffect(() => {
    if (receptionistData) {
      fetchRoomsAndBookings()
    }
  }, [receptionistData])

  const fetchRoomsAndBookings = async () => {
    setLoading(true)
    setError("")

    try {
      // Fetch rooms
      const roomsResponse = await api.get("/room")
      const roomsData = roomsResponse.data.rooms || roomsResponse.data || []
      
      // DEBUG: Log the first room to see its structure
      if (roomsData.length > 0) {
        console.log('🔍 First room data from API:', roomsData[0])
        console.log('🔍 First room hourlyPricing:', roomsData[0].hourlyPricing)
      }
      
      // Fetch active bookings
      const bookingsResponse = await api.get("/room-booking")
      let bookingsData = bookingsResponse.data.bookings || bookingsResponse.data || []
      
      // Sanitize booking data - remove any fields that might contain large binary/file data
      bookingsData = bookingsData.map(booking => {
        const sanitized = { ...booking }
        // Remove any fields that look like file/image data
        Object.keys(sanitized).forEach(key => {
          const value = sanitized[key]
          // Remove fields with base64 data, large objects, or file-like structures
          if (value && typeof value === 'object' && (value.data || value.file || value.image || value.logo)) {
            console.warn(`Removing suspicious field from booking: ${key}`, value)
            delete sanitized[key]
          }
          // Remove fields with very long string values (likely base64)
          if (typeof value === 'string' && value.length > 10000) {
            console.warn(`Removing large string field from booking: ${key}`)
            delete sanitized[key]
          }
        })
        return sanitized
      })
      
      // Only show currently checked-in guests as occupying rooms
      // Confirmed bookings are future bookings and don't block current availability
      const currentlyOccupied = bookingsData.filter(b => 
        b.status === 'checked-in'
      )

      setRooms(roomsData)
      setBookings(currentlyOccupied)
      setAllBookings(bookingsData)
    } catch (err) {
      console.error("Error fetching data:", err)
      setError("Failed to load rooms. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const getRoomStatus = (room) => {
    // Always return available status - rooms can always be booked for future dates
    // Calendar will handle date conflicts during booking process
    return { status: 'available', booking: null }
  }

  const getFutureBookings = (room) => {
    // Get confirmed bookings for this room (future bookings)
    return allBookings.filter(b => 
      (b.roomId === room._id || b.roomId?._id === room._id) && 
      b.status === 'confirmed'
    )
  }

  const handleBookRoom = (room) => {
    // Always allow opening the booking modal
    // Date conflict checks will happen when user submits the booking form
    setSelectedRoom(room)
    setShowBookingModal(true)
  }

  const handleConfirmBooking = async (bookingData) => {
    try {
      // First, check for date conflicts with existing bookings
      const checkInDate = new Date(bookingData.checkInDate)
      const checkOutDate = new Date(bookingData.checkOutDate)
      
      // Get all existing bookings for this room (excluding cancelled ones)
      const existingBookings = allBookings.filter(booking => {
        const bookingRoomId = booking.roomId?._id || booking.roomId
        return (bookingRoomId === bookingData.roomId) && 
               booking.status !== 'cancelled' && 
               booking.status !== 'checked-out'
      })
      
      // Check for date conflicts
      const hasConflict = existingBookings.some(booking => {
        const existingCheckIn = new Date(booking.checkInDate)
        const existingCheckOut = new Date(booking.checkOutDate)
        
        // Check if dates overlap
        // Conflict exists if: new check-in < existing check-out AND new check-out > existing check-in
        return (checkInDate < existingCheckOut && checkOutDate > existingCheckIn)
      })
      
      if (hasConflict) {
        const conflictingBookings = existingBookings.filter(booking => {
          const existingCheckIn = new Date(booking.checkInDate)
          const existingCheckOut = new Date(booking.checkOutDate)
          return (checkInDate < existingCheckOut && checkOutDate > existingCheckIn)
        })
        
        const conflictDetails = conflictingBookings.map(booking => 
          `${booking.userName} (${new Date(booking.checkInDate).toLocaleDateString()} - ${new Date(booking.checkOutDate).toLocaleDateString()})`
        ).join(', ')
        
        throw new Error(`Room is already booked for overlapping dates by: ${conflictDetails}. Please select different dates.`)
      }
      
      // Create a walk-in booking if no conflicts
      await api.post("/room-booking/walk-in", bookingData)
      
      setSuccessMessage("Room booked successfully!")
      setTimeout(() => setSuccessMessage(""), 3000)
      
      // Refresh data
      await fetchRoomsAndBookings()
    } catch (err) {
      throw new Error(err.response?.data?.message || err.message || "Failed to book room")
    }
  }

  const handleUpdatePayment = async (bookingId, newAmountPaid, paymentMethod = 'cash', paymentAmount = 0) => {
    try {
      await api.put(`/room-booking/${bookingId}/payment`, { 
        amountPaid: newAmountPaid,
        paymentMethod,
        paymentAmount
      })
      setSuccessMessage("Payment updated successfully!")
      setTimeout(() => setSuccessMessage(""), 3000)
      await fetchRoomsAndBookings()
      // Update the selected booking
      const updatedBooking = bookings.find(b => b._id === bookingId)
      if (updatedBooking) {
        setSelectedBooking({ ...updatedBooking, amountPaid: newAmountPaid })
      }
    } catch (err) {
      throw new Error(err.response?.data?.message || "Failed to update payment")
    }
  }

  const handleCheckout = async (bookingId) => {
    try {
      await api.put(`/room-booking/${bookingId}/status`, { status: 'checked-out' })
      setSuccessMessage("Guest checked out successfully! Room is now available.")
      setTimeout(() => setSuccessMessage(""), 3000)
      await fetchRoomsAndBookings()
    } catch (err) {
      throw new Error(err.response?.data?.message || "Failed to checkout")
    }
  }

  const handleOpenCheckout = (booking) => {
    setSelectedBooking(booking)
    setShowCheckoutModal(true)
  }

  const handleOpenRestaurantBill = (booking) => {
    setSelectedBooking(booking)
    setShowRestaurantBillModal(true)
  }

  const handleAddRestaurantBill = async (bookingId, billData) => {
    try {
      await api.post(`/room-booking/${bookingId}/restaurant-bill`, billData)
      setSuccessMessage("Restaurant bill added successfully!")
      setTimeout(() => setSuccessMessage(""), 3000)
      await fetchRoomsAndBookings()
      // Update the selected booking
      const updatedBooking = allBookings.find(b => b._id === bookingId)
      if (updatedBooking) {
        setSelectedBooking(updatedBooking)
      }
    } catch (err) {
      throw new Error(err.response?.data?.message || "Failed to add restaurant bill")
    }
  }

  const handleRemoveRestaurantBill = async (bookingId, billId) => {
    try {
      await api.delete(`/room-booking/${bookingId}/restaurant-bill/${billId}`)
      setSuccessMessage("Restaurant bill removed successfully!")
      setTimeout(() => setSuccessMessage(""), 3000)
      await fetchRoomsAndBookings()
      // Update the selected booking
      const updatedBooking = allBookings.find(b => b._id === bookingId)
      if (updatedBooking) {
        setSelectedBooking(updatedBooking)
      }
    } catch (err) {
      throw new Error(err.response?.data?.message || "Failed to remove restaurant bill")
    }
  }

  const handleCreateAdvanceBooking = async (bookingData) => {
    try {
      await api.post("/room-booking/advance", bookingData)
      setSuccessMessage("Advance booking created successfully!")
      setTimeout(() => setSuccessMessage(""), 3000)
      await fetchRoomsAndBookings()
    } catch (err) {
      throw new Error(err.response?.data?.message || "Failed to create advance booking")
    }
  }

  const handleBulkBooking = async (bulkBookingData) => {
    try {
      // Calculate consolidated totals
      const totalBaseAmount = bulkBookingData.selectedRooms.reduce((sum, room) => sum + room.baseAmount, 0)
      const discountPercent = bulkBookingData.discountPercent || 0
      const discountAmount = (totalBaseAmount * discountPercent) / 100
      const amountAfterDiscount = totalBaseAmount - discountAmount
      
      // GST calculations on discounted amount
      const cgst = bulkBookingData.gstType === 'gst' ? amountAfterDiscount * 0.025 : 0
      const sgst = bulkBookingData.gstType === 'gst' ? amountAfterDiscount * 0.025 : 0
      const igst = bulkBookingData.gstType === 'igst' ? amountAfterDiscount * 0.05 : 0
      const totalPrice = amountAfterDiscount + cgst + sgst + igst
      
      // Generate a unique bulk booking ID to link all individual bookings
      const bulkBookingId = `BULK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Create individual bookings for each room
      const individualBookings = bulkBookingData.selectedRooms.map((room, index) => ({
        roomId: room.roomId,
        branchId: rooms.find(r => r._id === room.roomId)?.branchId,
        
        // Mark as bulk booking with shared ID
        bulkBookingId: bulkBookingId,
        isBulkBooking: true,
        bulkBookingIndex: index,
        totalRoomsInBulk: bulkBookingData.selectedRooms.length,
        
        // Store all room details for reference
        bulkRoomDetails: bulkBookingData.selectedRooms.map(r => ({
          roomId: r.roomId,
          roomNumber: r.roomNumber,
          roomType: r.roomType,
          price: r.price,
          baseAmount: r.baseAmount
        })),
        
        // Guest details (same for all rooms in bulk)
        userName: `BULK: ${bulkBookingData.guestName} (${bulkBookingData.selectedRooms.length} rooms)`,
        userPhone: bulkBookingData.guestPhone,
        userEmail: bulkBookingData.guestEmail || "",
        guestGstNumber: bulkBookingData.guestGstNumber || "",
        aadhaarNumber: bulkBookingData.aadhaarNumber || "",
        panNumber: bulkBookingData.panNumber || "",
        
        // Dates and times (same for all rooms)
        checkInDate: bulkBookingData.checkInDate,
        checkOutDate: bulkBookingData.checkOutDate,
        checkInTime: bulkBookingData.checkInTime,
        checkOutTime: bulkBookingData.checkOutTime,
        nights: bulkBookingData.nights,
        
        // Individual room amounts
        baseAmount: room.baseAmount,
        discountPercent: discountPercent,
        discountAmount: (room.baseAmount * discountPercent) / 100,
        gstType: bulkBookingData.gstType,
        cgst: bulkBookingData.gstType === 'gst' ? (room.baseAmount - (room.baseAmount * discountPercent) / 100) * 0.025 : 0,
        sgst: bulkBookingData.gstType === 'gst' ? (room.baseAmount - (room.baseAmount * discountPercent) / 100) * 0.025 : 0,
        igst: bulkBookingData.gstType === 'igst' ? (room.baseAmount - (room.baseAmount * discountPercent) / 100) * 0.05 : 0,
        totalPrice: room.baseAmount - (room.baseAmount * discountPercent) / 100 + 
                   (bulkBookingData.gstType === 'gst' ? (room.baseAmount - (room.baseAmount * discountPercent) / 100) * 0.05 : 0) +
                   (bulkBookingData.gstType === 'igst' ? (room.baseAmount - (room.baseAmount * discountPercent) / 100) * 0.05 : 0),
        
        // Payment details (distributed across rooms, but only first room gets the payment)
        amountPaid: index === 0 ? (bulkBookingData.amountPaid || 0) : 0,
        cashAmount: index === 0 && bulkBookingData.paymentMethod === 'cash' ? (bulkBookingData.amountPaid || 0) : 0,
        onlineAmount: index === 0 && bulkBookingData.paymentMethod === 'online' ? (bulkBookingData.amountPaid || 0) : 0,
        
        // Status (same for all rooms)
        status: 'checked-in',
        paymentStatus: (bulkBookingData.amountPaid || 0) >= totalPrice ? 'paid' : 'pending',
        
        // Payments array (only on first room to avoid duplication)
        payments: index === 0 && (bulkBookingData.amountPaid || 0) > 0 ? [{
          amount: bulkBookingData.amountPaid,
          method: bulkBookingData.paymentMethod || 'cash',
          date: new Date()
        }] : []
      }))

      // Create all individual bookings
      const bookingPromises = individualBookings.map(booking => 
        api.post("/room-booking/walk-in", booking)
      )
      
      await Promise.all(bookingPromises)
      
      setSuccessMessage(`Bulk booking created successfully! ${bulkBookingData.selectedRooms.length} rooms booked for ${bulkBookingData.guestName}`)
      setTimeout(() => setSuccessMessage(""), 5000)
      await fetchRoomsAndBookings()
    } catch (err) {
      console.error("Bulk booking error details:", err.response?.data)
      throw new Error(err.response?.data?.message || err.message || "Failed to create bulk booking")
    }
  }

  const handlePayAdvanceBooking = async (bookingId, amount, method) => {
    try {
      await api.put(`/room-booking/${bookingId}/payment`, { 
        amountPaid: amount,
        paymentMethod: method,
        paymentAmount: amount
      })
      setSuccessMessage("Payment processed successfully!")
      setTimeout(() => setSuccessMessage(""), 3000)
      await fetchRoomsAndBookings()
    } catch (err) {
      throw new Error(err.response?.data?.message || "Failed to process payment")
    }
  }

  const handleCancelAdvanceBooking = async (bookingId) => {
    try {
      await api.put(`/room-booking/${bookingId}/status`, { status: 'cancelled' })
      setSuccessMessage("Booking cancelled successfully!")
      setTimeout(() => setSuccessMessage(""), 3000)
      await fetchRoomsAndBookings()
    } catch (err) {
      throw new Error(err.response?.data?.message || "Failed to cancel booking")
    }
  }

  const handleExtendBooking = async (bookingId, newCheckOutDate, additionalNights, additionalAmount) => {
    try {
      await api.put(`/room-booking/${bookingId}/extend`, { 
        newCheckOutDate,
        additionalNights,
        additionalAmount
      })
      setSuccessMessage("Booking extended successfully!")
      setTimeout(() => setSuccessMessage(""), 3000)
      await fetchRoomsAndBookings()
    } catch (err) {
      throw new Error(err.response?.data?.message || "Failed to extend booking")
    }
  }

  const handleCancelExtension = async (bookingId, daysToCancel) => {
    try {
      const response = await api.put(`/room-booking/${bookingId}/cancel-extension`, {
        daysToCancel: daysToCancel
      })
      setSuccessMessage(`${daysToCancel} day(s) cancelled from extension successfully!`)
      setTimeout(() => setSuccessMessage(""), 5000)
      await fetchRoomsAndBookings()
      return response.data
    } catch (err) {
      throw new Error(err.response?.data?.message || "Failed to cancel extension")
    }
  }

  const printConsolidatedBill = (consolidatedBooking) => {
    const printWindow = window.open('', '_blank')
    const roomsList = consolidatedBooking.roomDetails.map(room => 
      `Room ${room.roomNumber} (${room.originalGuestName})`
    ).join(', ')
    
    const gstSection = consolidatedBooking.gstType && consolidatedBooking.gstType !== 'none' ? `
      <tr><td colspan="2"><hr></td></tr>
      <tr><td><strong>CGST (2.5%):</strong></td><td>₹${(consolidatedBooking.cgst || 0).toFixed(2)}</td></tr>
      <tr><td><strong>SGST (2.5%):</strong></td><td>₹${(consolidatedBooking.sgst || 0).toFixed(2)}</td></tr>
      <tr><td><strong>IGST (5%):</strong></td><td>₹${(consolidatedBooking.igst || 0).toFixed(2)}</td></tr>
    ` : ''
    
    const gstInfo = consolidatedBooking.gstNumber ? `
      <p><strong>GST Number:</strong> ${consolidatedBooking.gstNumber}</p>
    ` : ''
    
    const identityInfo = `
      ${consolidatedBooking.aadhaarNumber ? `<p><strong>Aadhaar:</strong> ${consolidatedBooking.aadhaarNumber}</p>` : ''}
      ${consolidatedBooking.panNumber ? `<p><strong>PAN:</strong> ${consolidatedBooking.panNumber}</p>` : ''}
    `
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Consolidated Bill - ${consolidatedBooking.consolidatedBillNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .bill-details { margin-bottom: 20px; }
          .room-details { margin-bottom: 20px; }
          .payment-summary { margin-top: 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
          .total-row { font-weight: bold; font-size: 16px; }
          .balance-due { color: #dc2626; font-weight: bold; }
          .paid { color: #059669; font-weight: bold; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>HOTEL VIRAT</h1>
          <h2>CONSOLIDATED BILL</h2>
          <p><strong>Bill Number:</strong> ${consolidatedBooking.consolidatedBillNumber}</p>
          <p><strong>Date:</strong> ${new Date(consolidatedBooking.createdAt).toLocaleDateString()}</p>
        </div>
        
        <div class="bill-details">
          <h3>Bill To:</h3>
          <p><strong>Name:</strong> ${consolidatedBooking.userName}</p>
          <p><strong>Phone:</strong> ${consolidatedBooking.userPhone}</p>
          ${consolidatedBooking.userEmail ? `<p><strong>Email:</strong> ${consolidatedBooking.userEmail}</p>` : ''}
          ${gstInfo}
          ${identityInfo}
        </div>
        
        <div class="room-details">
          <h3>Room Details:</h3>
          <p><strong>Total Rooms:</strong> ${consolidatedBooking.totalRooms}</p>
          <p><strong>Rooms:</strong> ${roomsList}</p>
          <p><strong>Check-in:</strong> ${new Date(consolidatedBooking.checkInDate).toLocaleDateString()}</p>
          <p><strong>Check-out:</strong> ${new Date(consolidatedBooking.checkOutDate).toLocaleDateString()}</p>
        </div>
        
        <div class="payment-summary">
          <h3>Payment Summary:</h3>
          <table>
            <tr><td><strong>Base Amount:</strong></td><td>₹${consolidatedBooking.baseAmount.toFixed(2)}</td></tr>
            ${gstSection}
            <tr><td colspan="2"><hr></td></tr>
            <tr class="total-row"><td><strong>Grand Total:</strong></td><td>₹${consolidatedBooking.totalPrice.toFixed(2)}</td></tr>
            <tr><td><strong>Advance Payment Received:</strong></td><td class="paid">₹${consolidatedBooking.amountPaid.toFixed(2)}</td></tr>
            <tr class="total-row ${consolidatedBooking.balanceDue > 0 ? 'balance-due' : 'paid'}">
              <td><strong>${consolidatedBooking.balanceDue > 0 ? 'Balance Payment Due:' : 'Excess Paid:'}</strong></td>
              <td>₹${Math.abs(consolidatedBooking.balanceDue).toFixed(2)}</td>
            </tr>
          </table>
        </div>
        
        <div style="margin-top: 40px; text-align: center;">
          <p>Thank you for choosing Hotel Virat!</p>
          <p style="font-size: 12px;">This is a computer generated bill.</p>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            }
          }
        </script>
      </body>
      </html>
    `)
    
    printWindow.document.close()
  }

  // Bulk Restaurant Handler - Commented Out
  /* const handleBulkRestaurant = async (selectedBookings, restaurantData) => {
    try {
      const restaurantPromises = selectedBookings.map(booking => 
        api.post(`/room-booking/${booking._id}/restaurant-bill`, restaurantData)
      )
      
      await Promise.all(restaurantPromises)
      await fetchRoomsAndBookings() // Refresh bookings
      setSuccessMessage(`Successfully added restaurant bills to ${selectedBookings.length} room(s)!`)
      setTimeout(() => setSuccessMessage(""), 5000)
    } catch (error) {
      console.error("Error in bulk restaurant bill:", error)
      alert("Failed to add restaurant bills to some rooms. Please try again.")
    }
  } */

  const handleLogout = () => {
    localStorage.removeItem("authToken")
    localStorage.removeItem("isAuthenticated")
    localStorage.removeItem("userType")
    localStorage.removeItem("receptionistData")
    navigate("/login")
  }

  const filteredRooms = Array.isArray(rooms) ? rooms.filter(room => {
    const matchesSearch = room.roomNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         room.roomType?.toLowerCase().includes(searchTerm.toLowerCase())
    
    if (filterStatus === "all") return matchesSearch
    
    const { status } = getRoomStatus(room)
    return matchesSearch && status === filterStatus
  }).sort((a, b) => {
    // Sort rooms by room number in ascending order (101, 102, 103, etc.)
    const roomA = parseInt(a.roomNumber) || 0
    const roomB = parseInt(b.roomNumber) || 0
    return roomA - roomB
  }) : []

  // Filter bookings by selected date
  const getBookingsByDate = (date) => {
    return allBookings.filter(booking => {
      const bookingDate = new Date(booking.createdAt).toISOString().split('T')[0]
      return bookingDate === date
    })
  }

  const filteredHistoryBookings = getBookingsByDate(historyDate)

  // Format date for display
  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  // Get quick date options
  const getQuickDates = () => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const dayBefore = new Date(today)
    dayBefore.setDate(dayBefore.getDate() - 2)
    
    return [
      { label: 'Today', date: today.toISOString().split('T')[0] },
      { label: 'Yesterday', date: yesterday.toISOString().split('T')[0] },
      { label: '2 Days Ago', date: dayBefore.toISOString().split('T')[0] },
    ]
  }

  // Print bill for booking history
  const printBookingBill = (booking) => {
    const totalAmount = booking.totalPrice || 0
    const printWindow = window.open('', '_blank')
    const billContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hotel Virat - Bill</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 15px; }
          .header img { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header p { font-size: 12px; color: #666; }
          .header .gst { font-size: 11px; color: #333; font-weight: bold; margin-top: 5px; }
          .bill-info { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #ccc; }
          .bill-info p { font-size: 13px; margin: 4px 0; }
          .guest-info { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #ccc; }
          .guest-info h3 { font-size: 14px; margin-bottom: 8px; }
          .guest-info p { font-size: 13px; margin: 4px 0; }
          .stay-info { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #ccc; }
          .stay-info h3 { font-size: 14px; margin-bottom: 8px; }
          .stay-info p { font-size: 13px; margin: 4px 0; }
          .charges { margin-bottom: 15px; }
          .charges h3 { font-size: 14px; margin-bottom: 8px; }
          .charge-row { display: flex; justify-content: space-between; font-size: 13px; margin: 5px 0; }
          .charge-row.total { font-weight: bold; font-size: 16px; border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; }
          .footer { text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px dashed #ccc; }
          .footer p { font-size: 12px; color: #666; margin: 3px 0; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${hotelViratLogo}" alt="Hotel Virat Logo" />
          <h1>HOTEL VIRAT</h1>
          <p>Your Comfort, Our Priority</p>
          <p class="gst">GSTIN: 29AGZPV1558K2Z6</p>
        </div>
        
        <div class="bill-info">
          <p><strong>Bill No:</strong> ${generateBillNumber(booking, allBookings)}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          <p><strong>Room No:</strong> ${booking.roomId?.roomNumber || 'N/A'}</p>
          <p><strong>Room Type:</strong> ${booking.roomId?.roomType || 'N/A'}</p>
        </div>
        
        <div class="guest-info">
          <h3>Guest Details</h3>
          <p><strong>Name:</strong> ${booking.userName || 'N/A'}</p>
          <p><strong>Phone:</strong> ${booking.userPhone || 'N/A'}</p>
          ${booking.userEmail ? `<p><strong>Email:</strong> ${booking.userEmail}</p>` : ''}
          ${booking.guestGstNumber ? `<p><strong>GSTIN:</strong> ${booking.guestGstNumber}</p>` : ''}
        </div>
        
        <div class="stay-info">
          <h3>Stay Details</h3>
          <p><strong>Check-in:</strong> ${formatDateDisplay(booking.checkInDate)} at ${booking.checkInTime || '12:00'}</p>
          <p><strong>Check-out:</strong> ${formatDateDisplay(booking.checkOutDate)} at ${booking.checkOutTime || '11:00'}</p>
          <p><strong>No. of Nights:</strong> ${booking.nights || 1}</p>
        </div>
        
        <div class="charges">
          <h3>Room Charges</h3>
          <div class="charge-row">
            <span>Room Charges (${booking.nights || 1} night${(booking.nights || 1) > 1 ? 's' : ''})</span>
            <span>₹${(booking.baseAmount || 0).toFixed(2)}</span>
          </div>
          ${booking.gstType === 'gst' ? `
            <div class="charge-row">
              <span>CGST (2.5%)</span>
              <span>₹${(booking.cgst || 0).toFixed(2)}</span>
            </div>
            <div class="charge-row">
              <span>SGST (2.5%)</span>
              <span>₹${(booking.sgst || 0).toFixed(2)}</span>
            </div>
          ` : ''}
          ${booking.gstType === 'igst' ? `
            <div class="charge-row">
              <span>IGST (5%)</span>
              <span>₹${(booking.igst || 0).toFixed(2)}</span>
            </div>
          ` : ''}
          <div class="charge-row total">
            <span>Total Amount</span>
            <span>₹${totalAmount.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you for staying with us!</p>
          <p>We hope to see you again soon.</p>
          <p style="margin-top: 10px; font-size: 10px;">This is a computer generated bill.</p>
        </div>
      </body>
      </html>
    `
    printWindow.document.write(billContent)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  // Print bill without GST for bulk bookings
  const printBulkBillWithoutGST = (booking) => {
    const baseAmount = booking.baseAmount || 0
    const roomDetails = booking.bulkRoomDetails || []
    
    // Generate room details HTML
    const roomDetailsHTML = roomDetails.length > 0 
      ? roomDetails.map(room => `
          <div class="charge-row">
            <span>Room ${room.roomNumber} (${room.roomType})</span>
            <span>₹${(room.baseAmount || 0).toFixed(2)}</span>
          </div>
        `).join('')
      : `
          <div class="charge-row">
            <span>Room Charges (${booking.nights || 1} night${(booking.nights || 1) > 1 ? 's' : ''})</span>
            <span>₹${baseAmount.toFixed(2)}</span>
          </div>
        `
    
    const printWindow = window.open('', '_blank')
    const billContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Hotel Virat - Bill (Without GST)</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 400px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 15px; }
          .header img { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; }
          .header h1 { font-size: 24px; margin-bottom: 5px; }
          .header p { font-size: 12px; color: #666; }
          .bill-info { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #ccc; }
          .bill-info p { font-size: 13px; margin: 4px 0; }
          .guest-info { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #ccc; }
          .guest-info h3 { font-size: 14px; margin-bottom: 8px; }
          .guest-info p { font-size: 13px; margin: 4px 0; }
          .stay-info { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #ccc; }
          .stay-info h3 { font-size: 14px; margin-bottom: 8px; }
          .stay-info p { font-size: 13px; margin: 4px 0; }
          .charges { margin-bottom: 15px; }
          .charges h3 { font-size: 14px; margin-bottom: 8px; }
          .charge-row { display: flex; justify-content: space-between; font-size: 13px; margin: 5px 0; }
          .charge-row.total { font-weight: bold; font-size: 16px; border-top: 2px solid #000; padding-top: 10px; margin-top: 10px; }
          .room-summary { background: #f0f9ff; padding: 10px; border-radius: 6px; margin-bottom: 15px; border-left: 4px solid #0ea5e9; }
          .room-summary p { font-size: 12px; color: #0c4a6e; margin: 2px 0; font-weight: 500; }
          .footer { text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px dashed #ccc; }
          .footer p { font-size: 12px; color: #666; margin: 3px 0; }
          @media print { body { padding: 10px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <img src="${hotelViratLogo}" alt="Hotel Virat Logo" />
          <h1>HOTEL VIRAT</h1>
          <p>Your Comfort, Our Priority</p>
        </div>
        
        <div class="bill-info">
          <p><strong>Bill No:</strong> ${generateBillNumber(booking, allBookings)}</p>
          <p><strong>Date:</strong> ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          <p><strong>Booking Type:</strong> BULK BOOKING</p>
        </div>
        
        ${roomDetails.length > 0 ? `
          <div class="room-summary">
            <p><strong>ROOMS BOOKED:</strong></p>
            <p>${roomDetails.map(room => `Room ${room.roomNumber} (${room.roomType})`).join(', ')}</p>
          </div>
        ` : ''}
        
        <div class="guest-info">
          <h3>Guest Details</h3>
          <p><strong>Name:</strong> ${booking.userName?.replace('BULK: ', '') || 'N/A'}</p>
          <p><strong>Phone:</strong> ${booking.userPhone || 'N/A'}</p>
          ${booking.userEmail ? `<p><strong>Email:</strong> ${booking.userEmail}</p>` : ''}
        </div>
        
        <div class="stay-info">
          <h3>Stay Details</h3>
          <p><strong>Check-in:</strong> ${formatDateDisplay(booking.checkInDate)} at ${booking.checkInTime || '12:00'}</p>
          <p><strong>Check-out:</strong> ${formatDateDisplay(booking.checkOutDate)} at ${booking.checkOutTime || '11:00'}</p>
          <p><strong>No. of Nights:</strong> ${booking.nights || 1}</p>
        </div>
        
        <div class="charges">
          <h3>Room Charges Breakdown</h3>
          ${roomDetailsHTML}
          <div class="charge-row total">
            <span>Total Amount (Without GST)</span>
            <span>₹${baseAmount.toFixed(2)}</span>
          </div>
        </div>
        
        <div class="footer">
          <p>Thank you for staying with us!</p>
          <p>We hope to see you again soon.</p>
          <p style="margin-top: 10px; font-size: 10px;">This is a computer generated bill without GST.</p>
        </div>
      </body>
      </html>
    `
    printWindow.document.write(billContent)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }
  if (!receptionistData) {
    return <div style={{ padding: "40px", textAlign: "center" }}>Loading...</div>
  }

  return (
    <div style={{ 
      position: "fixed", 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      overflowY: "auto", 
      backgroundColor: "#f3f4f6" 
    }}>
      <div style={{ padding: "20px", paddingBottom: "100px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ 
        display: "flex", justifyContent: "space-between", alignItems: "center", 
        marginBottom: "20px", padding: "15px 20px", backgroundColor: "#059669",
        borderRadius: "8px", color: "white"
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "24px" }}>Reception Dashboard</h1>
          <p style={{ margin: "5px 0 0", opacity: 0.9 }}>
            {receptionistData.name} {receptionistData.branchName ? `- ${receptionistData.branchName}` : ''}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={fetchRoomsAndBookings} style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px",
            backgroundColor: "rgba(255,255,255,0.2)", border: "none", borderRadius: "6px",
            color: "white", cursor: "pointer"
          }}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={handleLogout} style={{
            display: "flex", alignItems: "center", gap: "6px", padding: "8px 16px",
            backgroundColor: "#dc2626", border: "none", borderRadius: "6px",
            color: "white", cursor: "pointer"
          }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>
      {successMessage && (
        <div style={{ padding: "12px 16px", backgroundColor: "#dcfce7", color: "#166534", borderRadius: "6px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
          <Check size={18} /><span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div style={{ padding: "12px 16px", backgroundColor: "#fee2e2", color: "#dc2626", borderRadius: "6px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={18} /><span>{error}</span>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "15px", marginBottom: "20px" }}>
        <div style={{ padding: "20px", backgroundColor: "#dcfce7", borderRadius: "8px" }}>
          <h3 style={{ margin: 0, color: "#166534" }}>Available</h3>
          <p style={{ margin: "10px 0 0", fontSize: "32px", fontWeight: "bold", color: "#166534" }}>
            {rooms.filter(r => getRoomStatus(r).status === 'available').length}
          </p>
        </div>
        <div style={{ padding: "20px", backgroundColor: "#fee2e2", borderRadius: "8px" }}>
          <h3 style={{ margin: 0, color: "#dc2626" }}>Unavailable</h3>
          <p style={{ margin: "10px 0 0", fontSize: "32px", fontWeight: "bold", color: "#dc2626" }}>
            {rooms.filter(r => getRoomStatus(r).status === 'unavailable').length}
          </p>
        </div>
        <div style={{ padding: "20px", backgroundColor: "#f3f4f6", borderRadius: "8px" }}>
          <h3 style={{ margin: 0, color: "#374151" }}>Total Rooms</h3>
          <p style={{ margin: "10px 0 0", fontSize: "32px", fontWeight: "bold", color: "#374151" }}>
            {rooms.length}
          </p>
        </div>
      </div>

      {/* Payment Collection Stats */}
      <div style={{ 
        backgroundColor: "white", 
        borderRadius: "8px", 
        padding: "20px", 
        marginBottom: "20px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "20px", color: "#374151" }}>💰 Payment Collections</h2>
          <div style={{ display: "flex", gap: "8px" }}>
            {['today', 'week', 'month', 'all'].map(period => (
              <button
                key={period}
                onClick={() => setPaymentPeriod(period)}
                style={{
                  padding: "8px 16px",
                  border: paymentPeriod === period ? "2px solid #059669" : "1px solid #e5e7eb",
                  borderRadius: "6px",
                  backgroundColor: paymentPeriod === period ? "#dcfce7" : "white",
                  color: paymentPeriod === period ? "#059669" : "#6b7280",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: paymentPeriod === period ? "600" : "400",
                  textTransform: "capitalize"
                }}
              >
                {period === 'all' ? 'All Time' : period === 'week' ? 'This Week' : period === 'month' ? 'This Month' : 'Today'}
              </button>
            ))}
          </div>
        </div>

        {(() => {
          const now = new Date()
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          
          // Get start of week (Monday)
          const startOfWeek = new Date(today)
          const day = startOfWeek.getDay()
          const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1)
          startOfWeek.setDate(diff)
          
          // Get start of month
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
          
          // Filter bookings based on selected period
          const filteredBookings = allBookings.filter(booking => {
            if (!booking.createdAt) return false
            const bookingDate = new Date(booking.createdAt)
            
            switch(paymentPeriod) {
              case 'today':
                return bookingDate >= today
              case 'week':
                return bookingDate >= startOfWeek
              case 'month':
                return bookingDate >= startOfMonth
              case 'all':
              default:
                return true
            }
          })
          
          const cashCollected = filteredBookings.reduce((sum, b) => sum + (b.cashAmount || 0), 0)
          const onlineCollected = filteredBookings.reduce((sum, b) => sum + (b.onlineAmount || 0), 0)
          const totalCollected = filteredBookings.reduce((sum, b) => sum + (b.amountPaid || 0), 0)
          
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "15px" }}>
              <div style={{ padding: "20px", backgroundColor: "#fef3c7", borderRadius: "8px", border: "2px solid #fde68a" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "32px" }}>💵</span>
                  <h3 style={{ margin: 0, color: "#92400e", fontSize: "16px" }}>Cash Collected</h3>
                </div>
                <p style={{ margin: 0, fontSize: "32px", fontWeight: "bold", color: "#92400e" }}>
                  ₹{cashCollected.toFixed(2)}
                </p>
                <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#92400e", opacity: 0.8 }}>
                  {filteredBookings.filter(b => (b.cashAmount || 0) > 0).length} transaction(s)
                </p>
              </div>
              
              <div style={{ padding: "20px", backgroundColor: "#dbeafe", borderRadius: "8px", border: "2px solid #bfdbfe" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "32px" }}>💳</span>
                  <h3 style={{ margin: 0, color: "#1e40af", fontSize: "16px" }}>Online Collected</h3>
                </div>
                <p style={{ margin: 0, fontSize: "32px", fontWeight: "bold", color: "#1e40af" }}>
                  ₹{onlineCollected.toFixed(2)}
                </p>
                <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#1e40af", opacity: 0.8 }}>
                  {filteredBookings.filter(b => (b.onlineAmount || 0) > 0).length} transaction(s)
                </p>
              </div>
              
              <div style={{ padding: "20px", backgroundColor: "#e0e7ff", borderRadius: "8px", border: "2px solid #c7d2fe" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                  <span style={{ fontSize: "32px" }}>💰</span>
                  <h3 style={{ margin: 0, color: "#4338ca", fontSize: "16px" }}>Total Collected</h3>
                </div>
                <p style={{ margin: 0, fontSize: "32px", fontWeight: "bold", color: "#4338ca" }}>
                  ₹{totalCollected.toFixed(2)}
                </p>
                <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#4338ca", opacity: 0.8 }}>
                  {filteredBookings.filter(b => (b.amountPaid || 0) > 0).length} booking(s)
                </p>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Tab Navigation */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "2px solid #e5e7eb", paddingBottom: "10px" }}>
        <button
          onClick={() => setActiveTab("rooms")}
          style={{
            padding: "10px 20px", border: "none", borderRadius: "6px",
            backgroundColor: activeTab === "rooms" ? "#059669" : "#f3f4f6",
            color: activeTab === "rooms" ? "white" : "#374151",
            cursor: "pointer", fontWeight: "500", display: "flex", alignItems: "center", gap: "6px"
          }}
        >
          <Bed size={18} /> Rooms
        </button>
        <button
          onClick={() => setActiveTab("advance")}
          style={{
            padding: "10px 20px", border: "none", borderRadius: "6px",
            backgroundColor: activeTab === "advance" ? "#059669" : "#f3f4f6",
            color: activeTab === "advance" ? "white" : "#374151",
            cursor: "pointer", fontWeight: "500", display: "flex", alignItems: "center", gap: "6px"
          }}
        >
          <Calendar size={18} /> Advance Booking
        </button>
        <button
          onClick={() => setActiveTab("extend")}
          style={{
            padding: "10px 20px", border: "none", borderRadius: "6px",
            backgroundColor: activeTab === "extend" ? "#f59e0b" : "#f3f4f6",
            color: activeTab === "extend" ? "white" : "#374151",
            cursor: "pointer", fontWeight: "500", display: "flex", alignItems: "center", gap: "6px"
          }}
        >
          <RefreshCw size={18} /> Extend Booking
        </button>
        <button
          onClick={() => setActiveTab("history")}
          style={{
            padding: "10px 20px", border: "none", borderRadius: "6px",
            backgroundColor: activeTab === "history" ? "#059669" : "#f3f4f6",
            color: activeTab === "history" ? "white" : "#374151",
            cursor: "pointer", fontWeight: "500", display: "flex", alignItems: "center", gap: "6px"
          }}
        >
          <Calendar size={18} /> Booking History
        </button>
      </div>

      {/* Advance Booking Tab */}
      {activeTab === "advance" && (
        <div>
          {/* Summary */}
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f0f9ff", borderRadius: "8px", borderLeft: "4px solid #0ea5e9" }}>
            <h3 style={{ margin: "0 0 5px", fontSize: "16px" }}>
              Advance Bookings (Future Check-ins)
            </h3>
            <p style={{ margin: 0, color: "#6b7280" }}>
              {(() => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const advanceBookings = allBookings.filter(b => {
                  if (!b.checkInDate) return false
                  const checkInDate = new Date(b.checkInDate)
                  checkInDate.setHours(0, 0, 0, 0)
                  return checkInDate >= today && b.status !== 'cancelled'
                })
                
                return `${advanceBookings.length} advance booking(s) found | Total Revenue: ₹${advanceBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0).toFixed(2)} | Collected: ₹${advanceBookings.reduce((sum, b) => sum + (b.amountPaid || 0), 0).toFixed(2)}`
              })()}
            </p>
          </div>

          {/* Advance Bookings List */}
          {(() => {
            const today = new Date()
            today.setHours(0, 0, 0, 0)
            
            const advanceBookings = allBookings.filter(b => {
              if (!b.checkInDate) {
                return false
              }
              
              // Parse check-in date and set to start of day for comparison
              const checkInDate = new Date(b.checkInDate)
              checkInDate.setHours(0, 0, 0, 0)
              
              const isNotCancelled = b.status !== 'cancelled'
              const isFuture = checkInDate >= today
              
              // Show all future bookings except cancelled ones
              return isFuture && isNotCancelled
            }).sort((a, b) => new Date(a.checkInDate) - new Date(b.checkInDate))

            return advanceBookings.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {advanceBookings.map(booking => {
                  const balanceDue = (booking.totalPrice || 0) - (booking.amountPaid || 0)
                  const daysUntilCheckIn = Math.ceil((new Date(booking.checkInDate) - new Date()) / (1000 * 60 * 60 * 24))
                  
                  return (
                    <div key={booking._id} style={{
                      backgroundColor: "white", 
                      borderRadius: "8px",
                      border: "1px solid #e5e7eb",
                      padding: "16px",
                      display: "flex",
                      gap: "20px",
                      alignItems: "flex-start",
                      justifyContent: "space-between"
                    }}>
                      {/* Left Section - Main Info */}
                      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                        {/* Room & Guest */}
                        <div style={{ marginBottom: "10px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                            <span style={{ 
                              fontSize: "17px", 
                              fontWeight: "600", 
                              color: "#111827" 
                            }}>
                              Room {booking.roomId?.roomNumber || 'N/A'}
                            </span>
                            <span style={{ 
                              fontSize: "12px", 
                              color: "#6b7280",
                              padding: "2px 8px",
                              backgroundColor: "#f3f4f6",
                              borderRadius: "4px"
                            }}>
                              {booking.roomId?.roomType || 'N/A'}
                            </span>
                          </div>
                          <div style={{ fontSize: "14px", color: "#374151", fontWeight: "500" }}>
                            {booking.userName}
                          </div>
                          <div style={{ fontSize: "13px", color: "#6b7280" }}>
                            {booking.userPhone}
                            {booking.userEmail && ` • ${booking.userEmail}`}
                          </div>
                        </div>

                        {/* Dates */}
                        <div style={{ 
                          fontSize: "13px", 
                          color: "#6b7280",
                          lineHeight: "1.5"
                        }}>
                          <div>
                            <strong style={{ color: "#374151" }}>Check-in:</strong> {formatDateDisplay(booking.checkInDate)} at {booking.checkInTime || '12:00'}
                          </div>
                          <div>
                            <strong style={{ color: "#374151" }}>Check-out:</strong> {formatDateDisplay(booking.checkOutDate)} at {booking.checkOutTime || '11:00'}
                          </div>
                          <div style={{ marginTop: "4px", color: "#059669", fontWeight: "500", fontSize: "12px" }}>
                            {booking.nights} night{booking.nights > 1 ? 's' : ''} • {daysUntilCheckIn} day{daysUntilCheckIn !== 1 ? 's' : ''} until check-in
                          </div>
                        </div>

                        {/* Identity Documents */}
                        {(booking.aadhaarNumber || booking.panNumber) && (
                          <div style={{ 
                            fontSize: "11px", 
                            color: "#6b7280", 
                            marginTop: "8px",
                            paddingTop: "8px",
                            borderTop: "1px solid #f3f4f6"
                          }}>
                            {booking.aadhaarNumber && <span>Aadhaar: {booking.aadhaarNumber}</span>}
                            {booking.aadhaarNumber && booking.panNumber && <span> • </span>}
                            {booking.panNumber && <span>PAN: {booking.panNumber}</span>}
                          </div>
                        )}
                      </div>

                      {/* Right Section - Payment & Actions */}
                      <div style={{ 
                        width: "220px",
                        flexShrink: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px"
                      }}>
                        {/* Payment Info */}
                        <div style={{ 
                          padding: "10px 12px",
                          backgroundColor: "#f9fafb",
                          borderRadius: "6px",
                          border: "1px solid #e5e7eb"
                        }}>
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between",
                            fontSize: "12px",
                            marginBottom: "3px"
                          }}>
                            <span style={{ color: "#6b7280" }}>Total</span>
                            <span style={{ fontWeight: "600", color: "#374151" }}>
                              ₹{(booking.totalPrice || 0).toFixed(2)}
                            </span>
                          </div>
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between",
                            fontSize: "12px",
                            marginBottom: "6px"
                          }}>
                            <span style={{ color: "#6b7280" }}>Paid</span>
                            <span style={{ fontWeight: "600", color: "#059669" }}>
                              ₹{(booking.amountPaid || 0).toFixed(2)}
                            </span>
                          </div>
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between",
                            fontSize: "13px",
                            paddingTop: "6px",
                            borderTop: "1px solid #e5e7eb"
                          }}>
                            <span style={{ fontWeight: "600", color: balanceDue > 0 ? "#dc2626" : "#059669" }}>
                              Balance
                            </span>
                            <span style={{ fontWeight: "700", color: balanceDue > 0 ? "#dc2626" : "#059669" }}>
                              ₹{balanceDue.toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {balanceDue > 0 && (
                            <button
                              onClick={() => {
                                setSelectedBooking(booking)
                                setShowPaymentModal(true)
                              }}
                              style={{
                                padding: "8px 14px",
                                backgroundColor: "#059669",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "13px",
                                fontWeight: "500",
                                transition: "background-color 0.2s"
                              }}
                              onMouseOver={(e) => e.target.style.backgroundColor = "#047857"}
                              onMouseOut={(e) => e.target.style.backgroundColor = "#059669"}
                            >
                              Add Payment
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedBooking(booking)
                              setShowExtendBookingModal(true)
                            }}
                            style={{
                              padding: "8px 14px",
                              backgroundColor: "#f59e0b",
                              color: "white",
                              border: "none",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "13px",
                              fontWeight: "500",
                              transition: "background-color 0.2s"
                            }}
                            onMouseOver={(e) => e.target.style.backgroundColor = "#d97706"}
                            onMouseOut={(e) => e.target.style.backgroundColor = "#f59e0b"}
                          >
                            Extend Booking
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm(`Cancel booking for ${booking.userName}?\n\nRoom: ${booking.roomId?.roomNumber}\nCheck-in: ${formatDateDisplay(booking.checkInDate)}`)) {
                                handleCancelAdvanceBooking(booking._id)
                              }
                            }}
                            style={{
                              padding: "8px 14px",
                              backgroundColor: "white",
                              color: "#dc2626",
                              border: "1px solid #dc2626",
                              borderRadius: "6px",
                              cursor: "pointer",
                              fontSize: "13px",
                              fontWeight: "500",
                              transition: "all 0.2s"
                            }}
                            onMouseOver={(e) => {
                              e.target.style.backgroundColor = "#dc2626"
                              e.target.style.color = "white"
                            }}
                            onMouseOut={(e) => {
                              e.target.style.backgroundColor = "white"
                              e.target.style.color = "#dc2626"
                            }}
                          >
                            Cancel Booking
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ padding: "40px", textAlign: "center", color: "#6b7280", backgroundColor: "white", borderRadius: "8px" }}>
                <Calendar size={48} style={{ marginBottom: "10px", opacity: 0.5 }} />
                <p>No advance bookings found</p>
              </div>
            )
          })()}
        </div>
      )}

      {/* Extend Booking Tab */}
      {activeTab === "extend" && (
        <div>
          {/* Summary */}
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#fef3c7", borderRadius: "8px", borderLeft: "4px solid #f59e0b" }}>
            <h3 style={{ margin: "0 0 5px", fontSize: "16px" }}>
              Current Bookings - Extend Stay
            </h3>
            <p style={{ margin: 0, color: "#6b7280" }}>
              {(() => {
                const checkedInBookings = allBookings.filter(b => b.status === 'checked-in')
                return `${checkedInBookings.length} active booking(s) | Total Revenue: ₹${checkedInBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0).toFixed(2)} | Collected: ₹${checkedInBookings.reduce((sum, b) => sum + (b.amountPaid || 0), 0).toFixed(2)}`
              })()}
            </p>
          </div>

          {/* Current Bookings List */}
          {(() => {
            const checkedInBookings = allBookings.filter(b => b.status === 'checked-in')
            
            return checkedInBookings.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
                {checkedInBookings.map(booking => {
                  const totalAmount = booking.totalPrice || 0
                  const amountPaid = booking.amountPaid || 0
                  const balanceDue = totalAmount - amountPaid

                  return (
                    <div key={booking._id} style={{
                      padding: "20px", backgroundColor: "white", borderRadius: "8px",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                      borderLeft: "4px solid #f59e0b"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "15px" }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: "0 0 10px", display: "flex", alignItems: "center", gap: "10px", fontSize: "18px" }}>
                            <Bed size={20} /> Room {booking.roomId?.roomNumber || 'N/A'}
                            <span style={{
                              padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: "600",
                              backgroundColor: "#dcfce7", color: "#166534"
                            }}>
                              CHECKED-IN
                            </span>
                            {/* Extension Indicator */}
                            {booking.extensions && booking.extensions.length > 0 && (
                              <span style={{
                                padding: "4px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "600",
                                backgroundColor: "#fef3c7", color: "#92400e", border: "1px solid #f59e0b"
                              }}>
                                EXTENDED ({booking.extensions.length}x)
                              </span>
                            )}
                          </h4>
                          
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                            <div>
                              <p style={{ margin: "5px 0", fontSize: "14px", color: "#374151" }}>
                                <User size={14} style={{ marginRight: "6px" }} />
                                <strong>Guest:</strong> {booking.guestName || booking.userName || 'N/A'}
                              </p>
                              <p style={{ margin: "5px 0", fontSize: "14px", color: "#374151" }}>
                                <Phone size={14} style={{ marginRight: "6px" }} />
                                <strong>Phone:</strong> {booking.guestPhone || booking.userPhone || 'N/A'}
                              </p>
                              {(booking.guestEmail || booking.userEmail) && (
                                <p style={{ margin: "5px 0", fontSize: "14px", color: "#374151" }}>
                                  <Mail size={14} style={{ marginRight: "6px" }} />
                                  <strong>Email:</strong> {booking.guestEmail || booking.userEmail}
                                </p>
                              )}
                            </div>
                            
                            <div>
                              <p style={{ margin: "5px 0", fontSize: "14px", color: "#374151" }}>
                                <Calendar size={14} style={{ marginRight: "6px" }} />
                                <strong>Check-in:</strong> {formatDateDisplay(booking.checkInDate)}
                              </p>
                              <p style={{ margin: "5px 0", fontSize: "14px", color: "#374151" }}>
                                <Calendar size={14} style={{ marginRight: "6px" }} />
                                <strong>Check-out:</strong> {formatDateDisplay(booking.checkOutDate)}
                              </p>
                              <p style={{ margin: "5px 0", fontSize: "14px", color: "#374151" }}>
                                <strong>Nights:</strong> {booking.nights}
                              </p>
                            </div>
                          </div>

                          {/* Payment Info */}
                          <div style={{ 
                            padding: "12px", 
                            backgroundColor: "#f9fafb", 
                            borderRadius: "6px",
                            marginBottom: "15px"
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                              <span style={{ fontSize: "14px", color: "#6b7280" }}>Total Amount:</span>
                              <span style={{ fontSize: "14px", fontWeight: "600" }}>₹{totalAmount.toFixed(2)}</span>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                              <span style={{ fontSize: "14px", color: "#059669" }}>Amount Paid:</span>
                              <span style={{ fontSize: "14px", fontWeight: "600", color: "#059669" }}>₹{amountPaid.toFixed(2)}</span>
                            </div>
                            {balanceDue > 0 && (
                              <div style={{ 
                                display: "flex", 
                                justifyContent: "space-between", 
                                paddingTop: "8px", 
                                borderTop: "1px solid #e5e7eb" 
                              }}>
                                <span style={{ fontSize: "14px", color: "#dc2626", fontWeight: "600" }}>Balance Due:</span>
                                <span style={{ fontSize: "14px", fontWeight: "700", color: "#dc2626" }}>₹{balanceDue.toFixed(2)}</span>
                              </div>
                            )}
                            {booking.gstType && booking.gstType !== 'none' && (
                              <div style={{ marginTop: "8px", fontSize: "12px", color: "#6b7280" }}>
                                GST Applied: {booking.gstType === 'gst' ? 'CGST + SGST (5%)' : 'IGST (5%)'}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            {balanceDue > 0 && (
                              <button
                                onClick={() => {
                                  setSelectedBooking(booking)
                                  setShowPaymentModal(true)
                                }}
                                style={{
                                  padding: "10px 16px",
                                  backgroundColor: "#059669",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                  fontSize: "14px",
                                  fontWeight: "500",
                                  transition: "background-color 0.2s"
                                }}
                                onMouseOver={(e) => e.target.style.backgroundColor = "#047857"}
                                onMouseOut={(e) => e.target.style.backgroundColor = "#059669"}
                              >
                                Add Payment
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedBooking(booking)
                                setShowExtendBookingModal(true)
                              }}
                              style={{
                                padding: "10px 16px",
                                backgroundColor: "#f59e0b",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: "500",
                                transition: "background-color 0.2s",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px"
                              }}
                              onMouseOver={(e) => e.target.style.backgroundColor = "#d97706"}
                              onMouseOut={(e) => e.target.style.backgroundColor = "#f59e0b"}
                            >
                              <RefreshCw size={16} /> Extend Stay
                            </button>
                            {/* Cancel Extension Button - Only show if booking has extensions */}
                            {(() => {
                              console.log('Booking extensions check:', {
                                bookingId: booking._id,
                                hasExtensions: booking.extensions,
                                extensionsLength: booking.extensions?.length,
                                extensionsData: booking.extensions
                              })
                              return booking.extensions && booking.extensions.length > 0
                            })() && (
                              <button
                                onClick={() => {
                                  setSelectedBooking(booking)
                                  setShowCancelExtensionModal(true)
                                }}
                                style={{
                                  padding: "10px 16px",
                                  backgroundColor: "#dc2626",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                  fontSize: "14px",
                                  fontWeight: "500",
                                  transition: "background-color 0.2s",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px"
                                }}
                                onMouseOver={(e) => e.target.style.backgroundColor = "#b91c1c"}
                                onMouseOut={(e) => e.target.style.backgroundColor = "#dc2626"}
                                title="Cancel specific days from extension"
                              >
                                <X size={16} /> Cancel Extension
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedBooking(booking)
                                setShowRestaurantBillModal(true)
                              }}
                              style={{
                                padding: "10px 16px",
                                backgroundColor: "#8b5cf6",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: "500",
                                transition: "background-color 0.2s"
                              }}
                              onMouseOver={(e) => e.target.style.backgroundColor = "#7c3aed"}
                              onMouseOut={(e) => e.target.style.backgroundColor = "#8b5cf6"}
                            >
                              Restaurant Bill
                            </button>
                            <button
                              onClick={() => handleOpenCheckout(booking)}
                              style={{
                                padding: "10px 16px",
                                backgroundColor: "#3b82f6",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                cursor: "pointer",
                                fontSize: "14px",
                                fontWeight: "500",
                                transition: "background-color 0.2s"
                              }}
                              onMouseOver={(e) => e.target.style.backgroundColor = "#2563eb"}
                              onMouseOut={(e) => e.target.style.backgroundColor = "#3b82f6"}
                            >
                              Checkout
                            </button>
                            {/* Only show Print Bill button if GST is applied */}
                            {booking.gstType && booking.gstType !== 'none' && (
                              <button
                                onClick={() => printBookingBill(booking)}
                                style={{
                                  padding: "10px 16px",
                                  backgroundColor: "white",
                                  color: "#374151",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                  fontSize: "14px",
                                  fontWeight: "500",
                                  transition: "all 0.2s",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px"
                                }}
                                onMouseOver={(e) => {
                                  e.target.style.backgroundColor = "#f3f4f6"
                                }}
                                onMouseOut={(e) => {
                                  e.target.style.backgroundColor = "white"
                                }}
                              >
                                <Printer size={16} /> Print Bill
                              </button>
                            )}
                            {/* Show Print Bill without GST option for bulk bookings */}
                            {booking.userName?.startsWith('BULK:') && (
                              <button
                                onClick={() => printBulkBillWithoutGST(booking)}
                                style={{
                                  padding: "10px 16px",
                                  backgroundColor: "#10b981",
                                  color: "white",
                                  border: "none",
                                  borderRadius: "6px",
                                  cursor: "pointer",
                                  fontSize: "14px",
                                  fontWeight: "500",
                                  transition: "all 0.2s",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px"
                                }}
                                onMouseOver={(e) => {
                                  e.target.style.backgroundColor = "#059669"
                                }}
                                onMouseOut={(e) => {
                                  e.target.style.backgroundColor = "#10b981"
                                }}
                              >
                                <Printer size={16} /> Print Bill (No GST)
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div style={{ padding: "40px", textAlign: "center", color: "#6b7280", backgroundColor: "white", borderRadius: "8px" }}>
                <Bed size={48} style={{ marginBottom: "10px", opacity: 0.5 }} />
                <p>No active bookings found</p>
                <p style={{ fontSize: "14px", marginTop: "5px" }}>All checked-in guests will appear here</p>
              </div>
            )
          })()}
        </div>
      )}

      {/* Booking History Tab */}
      {activeTab === "history" && (
        <div>
          {/* Date Filter */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              {getQuickDates().map(({ label, date }) => (
                <button
                  key={date}
                  onClick={() => setHistoryDate(date)}
                  style={{
                    padding: "8px 16px", border: historyDate === date ? "2px solid #059669" : "1px solid #e5e7eb",
                    borderRadius: "6px", backgroundColor: historyDate === date ? "#dcfce7" : "white",
                    cursor: "pointer", fontSize: "13px", fontWeight: historyDate === date ? "600" : "400"
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "14px", color: "#6b7280" }}>Or select date:</span>
              <input
                type="date"
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
              />
            </div>
          </div>

          {/* Date Summary */}
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f0f9ff", borderRadius: "8px", borderLeft: "4px solid #0ea5e9" }}>
            <h3 style={{ margin: "0 0 5px", fontSize: "16px" }}>
              Bookings for {formatDateDisplay(historyDate)}
            </h3>
            <p style={{ margin: 0, color: "#6b7280" }}>
              {filteredHistoryBookings.length} booking(s) found | 
              Total Revenue: ₹{filteredHistoryBookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0).toFixed(2)} | 
              Collected: ₹{filteredHistoryBookings.reduce((sum, b) => sum + (b.amountPaid || 0), 0).toFixed(2)}
            </p>
          </div>

          {/* Bookings List */}
          {filteredHistoryBookings.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredHistoryBookings.map(booking => (
                <div key={booking._id} style={{
                  padding: "15px", backgroundColor: "white", borderRadius: "8px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  borderLeft: `4px solid ${booking.status === 'checked-out' ? '#22c55e' : booking.status === 'cancelled' ? '#ef4444' : '#f59e0b'}`
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <h4 style={{ margin: "0 0 5px", display: "flex", alignItems: "center", gap: "8px" }}>
                        <Bed size={16} /> Room {booking.roomId?.roomNumber || 'N/A'}
                        <span style={{
                          padding: "2px 8px", borderRadius: "12px", fontSize: "11px", fontWeight: "500",
                          backgroundColor: booking.status === 'checked-out' ? '#dcfce7' : booking.status === 'cancelled' ? '#fee2e2' : '#fef3c7',
                          color: booking.status === 'checked-out' ? '#166534' : booking.status === 'cancelled' ? '#dc2626' : '#92400e'
                        }}>
                          {booking.status?.toUpperCase()}
                        </span>
                      </h4>
                      <p style={{ margin: "3px 0", fontSize: "14px", color: "#374151" }}>
                        <strong>Guest:</strong> {booking.guestName || booking.userName || 'N/A'} | <strong>Phone:</strong> {booking.guestPhone || booking.userPhone || 'N/A'}
                      </p>
                      <p style={{ margin: "3px 0", fontSize: "13px", color: "#6b7280" }}>
                        Check-in: {formatDateDisplay(booking.checkInDate)} → Check-out: {formatDateDisplay(booking.checkOutDate)} ({booking.nights} nights)
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: "0 0 3px", fontSize: "14px" }}>
                        <strong>Total:</strong> ₹{(booking.totalPrice || 0).toFixed(2)}
                      </p>
                      <p style={{ margin: "0 0 3px", fontSize: "13px", color: "#059669" }}>
                        <strong>Paid:</strong> ₹{(booking.amountPaid || 0).toFixed(2)}
                      </p>
                      {(booking.totalPrice - (booking.amountPaid || 0)) > 0 && (
                        <p style={{ margin: "0", fontSize: "13px", color: "#dc2626", fontWeight: "600" }}>
                          Due: ₹{(booking.totalPrice - (booking.amountPaid || 0)).toFixed(2)}
                        </p>
                      )}
                      {booking.gstType && booking.gstType !== 'none' && (
                        <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#6b7280" }}>
                          GST: {booking.gstType === 'gst' ? 'CGST+SGST' : 'IGST'}
                        </p>
                      )}
                      {/* Only show Print Bill button if GST is applied */}
                      {booking.gstType && booking.gstType !== 'none' && (
                        <button
                          onClick={() => printBookingBill(booking)}
                          style={{
                            marginTop: "8px", padding: "6px 12px", backgroundColor: "#3b82f6",
                            color: "white", border: "none", borderRadius: "4px", cursor: "pointer",
                            fontSize: "12px", display: "flex", alignItems: "center", gap: "4px", marginLeft: "auto"
                          }}
                        >
                          <Printer size={14} /> Print Bill
                        </button>
                      )}
                      {/* Show Print Bill without GST option for bulk bookings */}
                      {booking.userName?.startsWith('BULK:') && (
                        <button
                          onClick={() => printBulkBillWithoutGST(booking)}
                          style={{
                            marginTop: "8px", padding: "6px 12px", backgroundColor: "#10b981",
                            color: "white", border: "none", borderRadius: "4px", cursor: "pointer",
                            fontSize: "12px", display: "flex", alignItems: "center", gap: "4px", marginLeft: "auto"
                          }}
                        >
                          <Printer size={14} /> Print Bill (No GST)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: "40px", textAlign: "center", color: "#6b7280", backgroundColor: "white", borderRadius: "8px" }}>
              <Calendar size={48} style={{ marginBottom: "10px", opacity: 0.5 }} />
              <p>No bookings found for {formatDateDisplay(historyDate)}</p>
            </div>
          )}
        </div>
      )}

      {/* Rooms Tab - Filters */}
      {activeTab === "rooms" && (
        <>
      {/* Filters */}
      <div style={{ display: "flex", gap: "15px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: 1, minWidth: "250px" }}>
          <Search size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#9ca3af" }} />
          <input
            type="text"
            placeholder="Search by room number or type..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "10px 10px 10px 40px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ padding: "10px 15px", border: "1px solid #e5e7eb", borderRadius: "6px", minWidth: "150px" }}
        >
          <option value="all">All Rooms</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>
        
        {/* Bulk Booking Button */}
        <button
          onClick={() => setShowBulkBookingModal(true)}
          style={{
            padding: "10px 20px",
            backgroundColor: "#7c3aed",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap"
          }}
        >
          <Bed size={18} />
          Bulk Booking
        </button>
        
        {/* Bulk Restaurant Bill Button - Commented Out */}
        {/* <button
          onClick={() => setShowBulkRestaurantModal(true)}
          style={{
            padding: "10px 20px",
            backgroundColor: "#f59e0b",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: "600",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            whiteSpace: "nowrap"
          }}
        >
          🍽️ Bulk Restaurant Bill
        </button> */}
      </div>

      {/* Rooms Grid */}
      {loading ? (
        <div style={{ padding: "40px", textAlign: "center" }}>Loading rooms...</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
          {filteredRooms.map(room => {
            const { status, booking } = getRoomStatus(room)
            const isAvailable = status === 'available'
            
            // Get current month's bookings for this room
            const currentDate = new Date()
            const currentMonth = currentDate.getMonth()
            const currentYear = currentDate.getFullYear()
            const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
            
            // Get all bookings for this room in current month
            const roomBookings = allBookings.filter(b => {
              const roomId = b.roomId?._id || b.roomId
              if (roomId !== room._id) return false
              
              const checkIn = new Date(b.checkInDate)
              const checkOut = new Date(b.checkOutDate)
              const monthStart = new Date(currentYear, currentMonth, 1)
              const monthEnd = new Date(currentYear, currentMonth + 1, 0)
              
              // Check if booking overlaps with current month
              return checkIn <= monthEnd && checkOut >= monthStart
            })
            
            // Create map of booked dates with guest details for current month
            const bookedDatesMap = {}
            roomBookings.forEach(booking => {
              const checkInDate = booking.checkInDate.split('T')[0] // YYYY-MM-DD format
              const checkOutDate = booking.checkOutDate.split('T')[0] // YYYY-MM-DD format
              
              // Check if same-day booking by comparing date strings
              const isSameDayBooking = checkInDate === checkOutDate
              
              if (isSameDayBooking) {
                // For same-day bookings, mark the check-in date
                const dateObj = new Date(checkInDate + 'T00:00:00')
                if (dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear) {
                  const day = dateObj.getDate()
                  if (!bookedDatesMap[day]) {
                    bookedDatesMap[day] = []
                  }
                  bookedDatesMap[day].push({
                    guestName: booking.userName,
                    phone: booking.userPhone,
                    checkIn: booking.checkInDate,
                    checkOut: booking.checkOutDate,
                    status: booking.status,
                    bookingId: booking._id
                  })
                }
              } else {
                // For multi-day bookings, mark all dates from check-in to check-out (exclusive of check-out)
                const checkIn = new Date(checkInDate + 'T00:00:00')
                const checkOut = new Date(checkOutDate + 'T00:00:00')
                const currentDate = new Date(checkIn)
                
                while (currentDate < checkOut) {
                  if (currentDate.getMonth() === currentMonth && currentDate.getFullYear() === currentYear) {
                    const day = currentDate.getDate()
                    if (!bookedDatesMap[day]) {
                      bookedDatesMap[day] = []
                    }
                    bookedDatesMap[day].push({
                      guestName: booking.userName,
                      phone: booking.userPhone,
                      checkIn: booking.checkInDate,
                      checkOut: booking.checkOutDate,
                      status: booking.status,
                      bookingId: booking._id
                    })
                  }
                  currentDate.setDate(currentDate.getDate() + 1)
                }
              }
            })
            
            return (
              <div key={room._id} style={{
                backgroundColor: "white", borderRadius: "8px", overflow: "hidden",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                border: "2px solid #e5e7eb"
              }}>
                <div style={{
                  padding: "15px", backgroundColor: "#f8fafc",
                  borderBottom: "1px solid #e5e7eb"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                      <Bed size={20} /> Room {room.roomNumber}
                    </h3>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{
                        padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "500",
                        backgroundColor: '#22c55e', color: "white"
                      }}>
                        Available
                      </span>
                    </div>
                  </div>
                </div>
                
                <div style={{ padding: "15px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "15px" }}>
                    {/* Room Details */}
                    <div>
                      <p style={{ margin: "0 0 8px", color: "#6b7280", fontSize: "14px" }}><strong>Type:</strong> {room.roomType}</p>
                      <p style={{ margin: "0 0 8px", color: "#6b7280", fontSize: "14px" }}><strong>Floor:</strong> {room.floor}</p>
                      <p style={{ margin: "0 0 8px", color: "#6b7280", fontSize: "14px" }}><strong>Price:</strong> ₹{room.price}/night</p>
                      <p style={{ margin: "0 0 8px", color: "#6b7280", fontSize: "14px" }}><strong>Capacity:</strong> {room.capacity?.adults || 2} Adults</p>
                    </div>
                    
                    {/* Mini Calendar */}
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                        <Calendar size={16} />
                        <span style={{ fontSize: "14px", fontWeight: "600", color: "#374151" }}>
                          {new Date(currentYear, currentMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                      
                      {/* Calendar Grid */}
                      <div style={{ 
                        display: "grid", 
                        gridTemplateColumns: "repeat(7, 1fr)", 
                        gap: "2px",
                        fontSize: "10px"
                      }}>
                        {/* Day headers */}
                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                          <div key={`day-header-${index}`} style={{ 
                            textAlign: "center", 
                            fontWeight: "600", 
                            color: "#6b7280",
                            padding: "2px"
                          }}>
                            {day}
                          </div>
                        ))}
                        
                        {/* Calendar days */}
                        {(() => {
                          const firstDay = new Date(currentYear, currentMonth, 1).getDay()
                          const days = []
                          
                          // Empty cells for days before month starts
                          for (let i = 0; i < firstDay; i++) {
                            days.push(
                              <div key={`empty-${i}`} style={{ padding: "4px" }}></div>
                            )
                          }
                          
                          // Days of the month
                          for (let day = 1; day <= daysInMonth; day++) {
                            const isToday = day === currentDate.getDate() && 
                                           currentMonth === new Date().getMonth() && 
                                           currentYear === new Date().getFullYear()
                            const bookingsForDay = bookedDatesMap[day] || []
                            const isBooked = bookingsForDay.length > 0
                            
                            // Create tooltip content for booked dates
                            const tooltipContent = bookingsForDay.length > 0 ? 
                              bookingsForDay.map(booking => 
                                `${booking.guestName} (${booking.phone})\n${new Date(booking.checkIn).toLocaleDateString()} - ${new Date(booking.checkOut).toLocaleDateString()}\nStatus: ${booking.status}`
                              ).join('\n\n') : ''
                            
                            days.push(
                              <div 
                                key={day} 
                                title={tooltipContent}
                                style={{ 
                                  textAlign: "center", 
                                  padding: "4px",
                                  borderRadius: "3px",
                                  backgroundColor: isToday ? "#3b82f6" : "transparent",
                                  color: isToday ? "white" : "#374151",
                                  fontWeight: isToday ? "600" : "400",
                                  position: "relative",
                                  minHeight: "20px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  cursor: isBooked ? "pointer" : "default"
                                }}
                                onClick={() => {
                                  if (isBooked) {
                                    const bookingDetails = bookingsForDay.map(booking => 
                                      `Guest: ${booking.guestName}\nPhone: ${booking.phone}\nCheck-in: ${new Date(booking.checkIn).toLocaleDateString()}\nCheck-out: ${new Date(booking.checkOut).toLocaleDateString()}\nStatus: ${booking.status.toUpperCase()}`
                                    ).join('\n\n')
                                    alert(`Bookings for ${day}/${currentMonth + 1}/${currentYear}:\n\n${bookingDetails}`)
                                  }
                                }}
                              >
                                {day}
                                {isBooked && (
                                  <div style={{
                                    position: "absolute",
                                    top: "2px",
                                    right: "2px",
                                    width: "4px",
                                    height: "4px",
                                    borderRadius: "50%",
                                    backgroundColor: "#ef4444"
                                  }}></div>
                                )}
                                {bookingsForDay.length > 1 && (
                                  <div style={{
                                    position: "absolute",
                                    bottom: "1px",
                                    right: "1px",
                                    fontSize: "6px",
                                    fontWeight: "bold",
                                    color: "#ef4444",
                                    backgroundColor: "white",
                                    borderRadius: "50%",
                                    width: "8px",
                                    height: "8px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center"
                                  }}>
                                    {bookingsForDay.length}
                                  </div>
                                )}
                              </div>
                            )
                          }
                          
                          return days
                        })()}
                      </div>
                      
                      {/* Booking legend */}
                      <div style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: "8px", 
                        marginTop: "8px",
                        fontSize: "11px",
                        color: "#6b7280"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <div style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            backgroundColor: "#ef4444"
                          }}></div>
                          <span>Booked (click for details)</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <div style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            backgroundColor: "#3b82f6"
                          }}></div>
                          <span>Today</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Show current guest information only if occupied TODAY */}
                  {!isAvailable && booking && (() => {
                    const today = new Date().toISOString().split('T')[0]
                    const checkInDate = booking.checkInDate.split('T')[0]
                    const checkOutDate = booking.checkOutDate.split('T')[0]
                    const isOccupiedToday = today >= checkInDate && today < checkOutDate
                    
                    return isOccupiedToday && (
                      <div style={{ padding: "10px", backgroundColor: "#fee2e2", borderRadius: "6px", marginBottom: "15px" }}>
                        <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: "600", color: "#dc2626" }}>
                          Current Guest (Today)
                        </p>
                        <div style={{ fontSize: "12px", color: "#dc2626" }}>
                          <div><strong>{booking.userName}</strong></div>
                          <div>📱 {booking.userPhone}</div>
                          <div>📅 {new Date(booking.checkInDate).toLocaleDateString()} - {new Date(booking.checkOutDate).toLocaleDateString()}</div>
                          {booking.actualCheckInTime && (
                            <div>✅ Checked in: {new Date(booking.actualCheckInTime).toLocaleString()}</div>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                  
                  {/* Show booking status information */}
                  {(() => {
                    const today = new Date().toISOString().split('T')[0]
                    
                    // Get today's bookings for this room
                    const todayBookings = allBookings.filter(b => {
                      const roomId = b.roomId?._id || b.roomId
                      if (roomId !== room._id) return false
                      
                      const checkIn = b.checkInDate.split('T')[0]
                      const checkOut = b.checkOutDate.split('T')[0]
                      
                      return today >= checkIn && today < checkOut && b.status !== 'cancelled'
                    })
                    
                    // Get upcoming bookings (future check-in dates)
                    const upcomingBookings = allBookings.filter(b => {
                      const roomId = b.roomId?._id || b.roomId
                      if (roomId !== room._id) return false
                      
                      const checkIn = b.checkInDate.split('T')[0]
                      
                      return checkIn > today && (b.status === 'confirmed' || b.status === 'checked-in')
                    })
                    
                    return (
                      <>
                        {/* Removed current guest and upcoming booking display as requested */}
                        {false && todayBookings.length > 0 && (
                          <div style={{ padding: "8px", backgroundColor: "#fef3c7", borderRadius: "6px", marginBottom: "8px" }}>
                            <p style={{ margin: "0", fontSize: "12px", fontWeight: "600", color: "#92400e" }}>
                              🏠 Current guest: {todayBookings[0].userName}
                            </p>
                            <div style={{ fontSize: "11px", color: "#92400e", marginTop: "4px" }}>
                              <div>📱 {todayBookings[0].userPhone}</div>
                              <div>�  {new Date(todayBookings[0].checkInDate).toLocaleDateString()} - {new Date(todayBookings[0].checkOutDate).toLocaleDateString()}</div>
                            </div>
                          </div>
                        )}
                        {false && upcomingBookings.length > 0 && (
                          <div style={{ padding: "8px", backgroundColor: "#e0f2fe", borderRadius: "6px", marginBottom: "15px" }}>
                            <p style={{ margin: "0", fontSize: "12px", fontWeight: "600", color: "#0369a1" }}>
                              📅 {upcomingBookings.length} upcoming booking{upcomingBookings.length > 1 ? 's' : ''}
                            </p>
                            <div style={{ fontSize: "11px", color: "#0369a1", marginTop: "4px" }}>
                              Next: {upcomingBookings[0].userName} ({new Date(upcomingBookings[0].checkInDate).toLocaleDateString()})
                            </div>
                          </div>
                        )}
                      </>
                    )
                  })()}
                  
                  {/* Show Extend button if room is occupied, otherwise Book Now */}
                  {(() => {
                    const today = new Date().toISOString().split('T')[0]
                    const currentBooking = allBookings.find(b => {
                      const roomId = b.roomId?._id || b.roomId
                      if (roomId !== room._id) return false
                      const checkIn = b.checkInDate.split('T')[0]
                      const checkOut = b.checkOutDate.split('T')[0]
                      return today >= checkIn && today < checkOut && b.status === 'checked-in'
                    })

                    if (currentBooking) {
                      return (
                        <>
                          <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
                            <button
                              onClick={() => {
                                setSelectedBooking(currentBooking)
                                setShowExtendBookingModal(true)
                              }}
                              style={{
                                flex: 1, padding: "10px", backgroundColor: "#f59e0b",
                                color: "white", border: "none", borderRadius: "6px", cursor: "pointer",
                                fontWeight: "500"
                              }}
                            >
                              Extend Stay
                            </button>
                            <button
                              onClick={() => handleOpenCheckout(currentBooking)}
                              style={{
                                flex: 1, padding: "10px", backgroundColor: "#059669",
                                color: "white", border: "none", borderRadius: "6px", cursor: "pointer",
                                fontWeight: "500"
                              }}
                            >
                              Checkout
                            </button>
                          </div>
                          <button
                            onClick={() => handleBookRoom(room)}
                            style={{
                              width: "100%", padding: "10px", backgroundColor: "#059669",
                              color: "white", border: "none", borderRadius: "6px", cursor: "pointer",
                              fontWeight: "500"
                            }}
                          >
                            Book Now
                          </button>
                        </>
                      )
                    }

                    return (
                      <button
                        onClick={() => handleBookRoom(room)}
                        style={{
                          width: "100%", padding: "10px", backgroundColor: "#059669",
                          color: "white", border: "none", borderRadius: "6px", cursor: "pointer",
                          fontWeight: "500"
                        }}
                      >
                        Book Now
                      </button>
                    )
                  })()}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {filteredRooms.length === 0 && !loading && (
        <div style={{ padding: "40px", textAlign: "center", color: "#6b7280" }}>
          No rooms found matching your criteria
        </div>
      )}
        </>
      )}

      {showBookingModal && selectedRoom && (
        <BookingModal
          room={selectedRoom}
          allBookings={allBookings}
          onClose={() => { setShowBookingModal(false); setSelectedRoom(null); }}
          onBook={handleConfirmBooking}
        />
      )}

      {showBulkBookingModal && (
        <BulkBookingModal
          rooms={rooms}
          allBookings={allBookings}
          onClose={() => setShowBulkBookingModal(false)}
          onBulkBook={handleBulkBooking}
        />
      )}

      {showRestaurantBillModal && selectedBooking && (
        <RestaurantBillModal
          booking={selectedBooking}
          onClose={() => { setShowRestaurantBillModal(false); setSelectedBooking(null); }}
          onAddBill={handleAddRestaurantBill}
          onRemoveBill={handleRemoveRestaurantBill}
          allBookings={allBookings}
        />
      )}

      {showCheckoutModal && selectedBooking && (
        <CheckoutModal
          booking={selectedBooking}
          onClose={() => { setShowCheckoutModal(false); setSelectedBooking(null); }}
          onCheckout={handleCheckout}
          onUpdatePayment={handleUpdatePayment}
          allBookings={allBookings}
        />
      )}

      {showAdvanceBookingModal && (
        <AdvanceBookingModal
          onClose={() => setShowAdvanceBookingModal(false)}
          onCreateBooking={handleCreateAdvanceBooking}
          onPayBooking={handlePayAdvanceBooking}
          onCancelBooking={handleCancelAdvanceBooking}
        />
      )}

      {showPaymentModal && selectedBooking && (
        <PaymentModal
          booking={selectedBooking}
          onClose={() => { setShowPaymentModal(false); setSelectedBooking(null); }}
          onAddPayment={handlePayAdvanceBooking}
        />
      )}

      {showExtendBookingModal && selectedBooking && (
        <ExtendBookingModal
          booking={selectedBooking}
          onClose={() => { setShowExtendBookingModal(false); setSelectedBooking(null); }}
          onExtend={handleExtendBooking}
        />
      )}

      {showCancelExtensionModal && selectedBooking && (
        <CancelExtensionModal
          booking={selectedBooking}
          onClose={() => { setShowCancelExtensionModal(false); setSelectedBooking(null); }}
          onCancelExtension={handleCancelExtension}
        />
      )}

      {/* Bulk Restaurant Modal - Commented Out */}
      {/* {showBulkRestaurantModal && (
        <BulkRestaurantModal
          bookings={allBookings}
          onClose={() => setShowBulkRestaurantModal(false)}
          onBulkRestaurant={handleBulkRestaurant}
        />
      )} */}
      </div>
    </div>
  )
}

// Advance Booking Modal for managing future bookings
const AdvanceBookingModal = ({ onClose, onCreateBooking, onPayBooking, onCancelBooking }) => {
  const [activeTab, setActiveTab] = useState("create") // "create", "manage"
  const [futureBookings, setFutureBookings] = useState([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    guestName: "",
    guestPhone: "",
    guestEmail: "",
    checkInDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    checkOutDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0], // Day after tomorrow
    roomType: "",
    advanceAmount: "",
    paymentMethod: "cash"
  })

  useEffect(() => {
    if (activeTab === "manage") {
      fetchFutureBookings()
    }
  }, [activeTab])

  const fetchFutureBookings = async () => {
    setLoading(true)
    try {
      const response = await api.get("/room-booking")
      const allBookings = response.data.bookings || response.data || []
      
      // Filter for future bookings (confirmed status, check-in date is in future)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const future = allBookings.filter(booking => {
        const checkInDate = new Date(booking.checkInDate)
        checkInDate.setHours(0, 0, 0, 0)
        return checkInDate > today && booking.status === 'confirmed'
      })
      
      setFutureBookings(future)
    } catch (error) {
      console.error("Error fetching future bookings:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateBooking = async (e) => {
    e.preventDefault()
    try {
      const bookingData = {
        ...formData,
        status: 'confirmed', // Advance bookings start as confirmed
        amountPaid: parseFloat(formData.advanceAmount) || 0,
        paymentStatus: 'pending'
      }
      
      await onCreateBooking(bookingData)
      
      // Reset form
      setFormData({
        guestName: "",
        guestPhone: "",
        guestEmail: "",
        checkInDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        checkOutDate: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
        roomType: "",
        advanceAmount: "",
        paymentMethod: "cash"
      })
      
      // Switch to manage tab to see the new booking
      setActiveTab("manage")
    } catch (error) {
      console.error("Error creating advance booking:", error)
    }
  }

  const handlePayment = async (booking, amount, method) => {
    try {
      await onPayBooking(booking._id, amount, method)
      fetchFutureBookings() // Refresh the list
    } catch (error) {
      console.error("Error processing payment:", error)
    }
  }

  const handleCancel = async (booking) => {
    if (window.confirm(`Are you sure you want to cancel booking for ${booking.userName}?`)) {
      try {
        await onCancelBooking(booking._id)
        fetchFutureBookings() // Refresh the list
      } catch (error) {
        console.error("Error cancelling booking:", error)
      }
    }
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "white", borderRadius: "8px", width: "90%",
        maxWidth: "800px", maxHeight: "90vh", overflow: "hidden",
        display: "flex", flexDirection: "column"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid #e5e7eb",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          backgroundColor: "#3b82f6", color: "white"
        }}>
          <h3 style={{ margin: 0 }}>Advance Booking Management</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "24px", color: "white" }}>×</button>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: "flex", borderBottom: "1px solid #e5e7eb" }}>
          <button
            onClick={() => setActiveTab("create")}
            style={{
              flex: 1, padding: "12px", border: "none",
              backgroundColor: activeTab === "create" ? "#3b82f6" : "#f3f4f6",
              color: activeTab === "create" ? "white" : "#374151",
              cursor: "pointer", fontWeight: "500"
            }}
          >
            Create New Booking
          </button>
          <button
            onClick={() => setActiveTab("manage")}
            style={{
              flex: 1, padding: "12px", border: "none",
              backgroundColor: activeTab === "manage" ? "#3b82f6" : "#f3f4f6",
              color: activeTab === "manage" ? "white" : "#374151",
              cursor: "pointer", fontWeight: "500"
            }}
          >
            Manage Bookings ({futureBookings.length})
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
          {activeTab === "create" ? (
            <form onSubmit={handleCreateBooking}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "15px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Guest Name *</label>
                  <input
                    type="text"
                    value={formData.guestName}
                    onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
                    required
                    style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                    placeholder="Enter guest name"
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Phone *</label>
                  <input
                    type="tel"
                    value={formData.guestPhone}
                    onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                    required
                    style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                    placeholder="Enter phone number"
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Email</label>
                  <input
                    type="email"
                    value={formData.guestEmail}
                    onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
                    style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                    placeholder="Enter email (optional)"
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Room Type</label>
                  <select
                    value={formData.roomType}
                    onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                    style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                  >
                    <option value="">Any Available</option>
                    <option value="Single">Single</option>
                    <option value="Double">Double</option>
                    <option value="Suite">Suite</option>
                    <option value="Deluxe">Deluxe</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Check-in Date *</label>
                  <input
                    type="date"
                    value={formData.checkInDate}
                    onChange={(e) => setFormData({ ...formData, checkInDate: e.target.value })}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Check-out Date *</label>
                  <input
                    type="date"
                    value={formData.checkOutDate}
                    onChange={(e) => setFormData({ ...formData, checkOutDate: e.target.value })}
                    required
                    min={formData.checkInDate}
                    style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Advance Amount (₹)</label>
                  <input
                    type="number"
                    value={formData.advanceAmount}
                    onChange={(e) => setFormData({ ...formData, advanceAmount: e.target.value })}
                    style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                    placeholder="Enter advance payment"
                    min="0"
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>Payment Method</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                    style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                  >
                    <option value="cash">Cash</option>
                    <option value="online">Online</option>
                  </select>
                </div>
              </div>
              
              <button
                type="submit"
                style={{
                  width: "100%", padding: "12px", backgroundColor: "#059669",
                  color: "white", border: "none", borderRadius: "6px", cursor: "pointer",
                  fontWeight: "500", fontSize: "16px"
                }}
              >
                Create Advance Booking
              </button>
            </form>
          ) : (
            <div>
              <h4 style={{ marginBottom: "15px" }}>Future Bookings</h4>
              {loading ? (
                <div style={{ textAlign: "center", padding: "20px" }}>Loading...</div>
              ) : futureBookings.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
                  No future bookings found
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {futureBookings.map(booking => (
                    <div key={booking._id} style={{
                      padding: "15px", backgroundColor: "#f8fafc", borderRadius: "8px",
                      border: "1px solid #e2e8f0"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div style={{ flex: 1 }}>
                          <h5 style={{ margin: "0 0 8px", color: "#1e293b" }}>{booking.userName}</h5>
                          <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "8px" }}>
                            <div>📱 {booking.userPhone}</div>
                            {booking.userEmail && <div>✉️ {booking.userEmail}</div>}
                            <div>🏠 Room: {booking.roomId?.roomNumber || 'TBD'} ({booking.roomId?.roomType || 'Any'})</div>
                            <div>📅 {new Date(booking.checkInDate).toLocaleDateString()} - {new Date(booking.checkOutDate).toLocaleDateString()}</div>
                            <div>💰 Total: ₹{booking.totalPrice?.toFixed(2) || '0.00'} | Paid: ₹{booking.amountPaid?.toFixed(2) || '0.00'}</div>
                            {booking.totalPrice - booking.amountPaid > 0 && (
                              <div style={{ color: "#dc2626", fontWeight: "500" }}>
                                💳 Due: ₹{(booking.totalPrice - booking.amountPaid).toFixed(2)}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {booking.totalPrice - booking.amountPaid > 0 && (
                            <button
                              onClick={() => {
                                const amount = prompt(`Enter payment amount (Due: ₹${(booking.totalPrice - booking.amountPaid).toFixed(2)}):`)
                                if (amount && parseFloat(amount) > 0) {
                                  const method = confirm("Click OK for Cash, Cancel for Online") ? "cash" : "online"
                                  handlePayment(booking, parseFloat(amount), method)
                                }
                              }}
                              style={{
                                padding: "6px 12px", backgroundColor: "#059669", color: "white",
                                border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px"
                              }}
                            >
                              💳 Pay
                            </button>
                          )}
                          <button
                            onClick={() => handleCancel(booking)}
                            style={{
                              padding: "6px 12px", backgroundColor: "#dc2626", color: "white",
                              border: "none", borderRadius: "4px", cursor: "pointer", fontSize: "12px"
                            }}
                          >
                            ❌ Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Payment Modal for adding payments to advance bookings
const PaymentModal = ({ booking, onClose, onAddPayment }) => {
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("cash")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const totalAmount = booking.totalPrice || 0
  const amountPaid = booking.amountPaid || 0
  const balanceDue = totalAmount - amountPaid

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")

    const amount = parseFloat(paymentAmount)
    
    if (!amount || amount <= 0) {
      setError("Please enter a valid payment amount")
      return
    }

    if (amount > balanceDue) {
      setError(`Payment amount cannot exceed balance due (₹${balanceDue.toFixed(2)})`)
      return
    }

    setIsLoading(true)
    try {
      const newTotalPaid = amountPaid + amount
      await onAddPayment(booking._id, newTotalPaid, paymentMethod)
      onClose()
    } catch (err) {
      setError(err.message || "Failed to add payment")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "white", borderRadius: "8px", width: "90%",
        maxWidth: "500px", padding: "0", overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", backgroundColor: "#059669", color: "white",
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <h3 style={{ margin: 0 }}>Add Payment - Room {booking.roomId?.roomNumber}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "24px", color: "white" }}>×</button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{ 
            padding: "12px 20px", backgroundColor: "#fee2e2", color: "#dc2626", 
            display: "flex", alignItems: "center", gap: "8px"
          }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: "14px" }}>{error}</span>
          </div>
        )}

        {/* Content */}
        <div style={{ padding: "20px" }}>
          {/* Guest Info */}
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f0fdf4", borderRadius: "8px" }}>
            <h4 style={{ margin: "0 0 10px" }}>Guest: {booking.userName}</h4>
            <p style={{ margin: "0", fontSize: "14px", color: "#6b7280" }}>
              Phone: {booking.userPhone}
            </p>
            <p style={{ margin: "5px 0 0", fontSize: "14px", color: "#6b7280" }}>
              Check-in: {new Date(booking.checkInDate).toLocaleDateString()} | 
              Check-out: {new Date(booking.checkOutDate).toLocaleDateString()}
            </p>
          </div>

          {/* Payment Summary */}
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
            <h4 style={{ margin: "0 0 10px" }}>Payment Summary</h4>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
              <span>Total Amount:</span>
              <span style={{ fontWeight: "600" }}>₹{totalAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", color: "#059669" }}>
              <span>Already Paid:</span>
              <span style={{ fontWeight: "600" }}>₹{amountPaid.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "10px", borderTop: "1px solid #e5e7eb" }}>
              <span style={{ fontWeight: "600", color: "#dc2626" }}>Balance Due:</span>
              <span style={{ fontWeight: "700", fontSize: "18px", color: "#dc2626" }}>₹{balanceDue.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "15px" }}>
              <label style={{ display: "block", marginBottom: "5px", fontWeight: "500" }}>
                Payment Amount (₹) *
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                required
                min="0.01"
                max={balanceDue}
                step="0.01"
                style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px" }}
                placeholder={`Enter amount (Max: ₹${balanceDue.toFixed(2)})`}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>Payment Method *</label>
              <div style={{ display: "flex", gap: "10px" }}>
                <label style={{ 
                  flex: 1, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", 
                  padding: "10px", border: paymentMethod === 'cash' ? "2px solid #059669" : "1px solid #e5e7eb", 
                  borderRadius: "6px", backgroundColor: paymentMethod === 'cash' ? "#dcfce7" : "white" 
                }}>
                  <input 
                    type="radio" 
                    name="paymentMethod" 
                    value="cash" 
                    checked={paymentMethod === 'cash'} 
                    onChange={(e) => setPaymentMethod(e.target.value)} 
                  />
                  <span style={{ fontWeight: "500" }}>💵 Cash</span>
                </label>
                <label style={{ 
                  flex: 1, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", 
                  padding: "10px", border: paymentMethod === 'online' ? "2px solid #059669" : "1px solid #e5e7eb", 
                  borderRadius: "6px", backgroundColor: paymentMethod === 'online' ? "#dcfce7" : "white" 
                }}>
                  <input 
                    type="radio" 
                    name="paymentMethod" 
                    value="online" 
                    checked={paymentMethod === 'online'} 
                    onChange={(e) => setPaymentMethod(e.target.value)} 
                  />
                  <span style={{ fontWeight: "500" }}>💳 Online</span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1, padding: "12px", backgroundColor: "#f3f4f6", color: "#374151",
                  border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "500"
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  flex: 1, padding: "12px", backgroundColor: "#059669",
                  color: "white", border: "none", borderRadius: "6px",
                  cursor: isLoading ? "not-allowed" : "pointer", fontWeight: "500"
                }}
              >
                {isLoading ? "Processing..." : "Add Payment"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Extend Booking Modal for extending current stays
const ExtendBookingModal = ({ booking, onClose, onExtend }) => {
  const [additionalNights, setAdditionalNights] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const currentCheckOut = new Date(booking.checkOutDate)
  const newCheckOutDate = new Date(currentCheckOut)
  const nightsValue = typeof additionalNights === 'string' ? (parseInt(additionalNights) || 0) : additionalNights
  newCheckOutDate.setDate(newCheckOutDate.getDate() + nightsValue)

  const pricePerNight = booking.roomId?.price || 0
  const additionalAmount = pricePerNight * nightsValue
  
  // Calculate GST if applicable
  const gstAmount = booking.gstType === 'gst' 
    ? additionalAmount * 0.05 
    : booking.gstType === 'igst' 
    ? additionalAmount * 0.05 
    : 0
  
  const totalAdditionalAmount = additionalAmount + gstAmount

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    const nights = typeof additionalNights === 'string' ? parseInt(additionalNights) : additionalNights
    if (!nights || nights < 1) {
      setError("Please select at least 1 additional night")
      return
    }

    setIsLoading(true)
    try {
      await onExtend(
        booking._id, 
        newCheckOutDate.toISOString().split('T')[0],
        nights,
        totalAdditionalAmount
      )
      onClose()
    } catch (err) {
      setError(err.message || "Failed to extend booking")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000,
      padding: "20px"
    }}>
      <div style={{
        backgroundColor: "white", borderRadius: "8px", width: "90%",
        maxWidth: "500px", maxHeight: "90vh", overflow: "hidden",
        display: "flex", flexDirection: "column"
      }}>
        {/* Header - Fixed */}
        <div style={{
          padding: "16px 20px", backgroundColor: "#f59e0b", color: "white",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexShrink: 0
        }}>
          <h3 style={{ margin: 0 }}>Extend Stay - Room {booking.roomId?.roomNumber}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "24px", color: "white" }}>×</button>
        </div>

        {/* Error Message - Fixed */}
        {error && (
          <div style={{ 
            padding: "12px 20px", backgroundColor: "#fee2e2", color: "#dc2626", 
            display: "flex", alignItems: "center", gap: "8px", flexShrink: 0
          }}>
            <AlertCircle size={16} />
            <span style={{ fontSize: "14px" }}>{error}</span>
          </div>
        )}

        {/* Content - Scrollable */}
        <div style={{ padding: "20px", overflowY: "auto", flex: 1 }}>
          {/* Guest Info */}
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f0fdf4", borderRadius: "8px" }}>
            <h4 style={{ margin: "0 0 10px" }}>Guest: {booking.guestName || booking.userName || 'N/A'}</h4>
            <p style={{ margin: "0", fontSize: "14px", color: "#6b7280" }}>
              Phone: {booking.guestPhone || booking.userPhone || 'N/A'}
            </p>
          </div>

          {/* Current Booking Info */}
          <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#f9fafb", borderRadius: "8px" }}>
            <h4 style={{ margin: "0 0 10px" }}>Current Booking</h4>
            <div style={{ fontSize: "14px", color: "#374151", marginBottom: "5px" }}>
              <strong>Check-in:</strong> {new Date(booking.checkInDate).toLocaleDateString()}
            </div>
            <div style={{ fontSize: "14px", color: "#374151", marginBottom: "5px" }}>
              <strong>Current Check-out:</strong> {currentCheckOut.toLocaleDateString()}
            </div>
            <div style={{ fontSize: "14px", color: "#374151" }}>
              <strong>Current Nights:</strong> {booking.nights}
            </div>
          </div>

          {/* Extension Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", marginBottom: "8px", fontWeight: "500" }}>
                Additional Nights *
              </label>
              <input
                type="number"
                value={additionalNights}
                onChange={(e) => {
                  const value = e.target.value
                  if (value === '' || value === null) {
                    setAdditionalNights('')
                  } else {
                    const numValue = parseInt(value)
                    if (!isNaN(numValue) && numValue >= 0) {
                      setAdditionalNights(numValue)
                    }
                  }
                }}
                onBlur={(e) => {
                  // If field is empty on blur, set to 1
                  if (e.target.value === '' || parseInt(e.target.value) < 1) {
                    setAdditionalNights(1)
                  }
                }}
                required
                min="1"
                max="30"
                style={{ width: "100%", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "6px", fontSize: "14px" }}
              />
            </div>

            {/* New Details */}
            <div style={{ marginBottom: "20px", padding: "15px", backgroundColor: "#fef3c7", borderRadius: "8px" }}>
              <h4 style={{ margin: "0 0 10px", color: "#92400e" }}>Extended Booking Details</h4>
              <div style={{ fontSize: "14px", color: "#92400e", marginBottom: "5px" }}>
                <strong>New Check-out:</strong> {newCheckOutDate.toLocaleDateString()}
              </div>
              <div style={{ fontSize: "14px", color: "#92400e", marginBottom: "5px" }}>
                <strong>Total Nights:</strong> {booking.nights + nightsValue}
              </div>
              <div style={{ fontSize: "14px", color: "#92400e", marginBottom: "10px" }}>
                <strong>Additional Charge:</strong> ₹{pricePerNight} × {nightsValue} night{nightsValue > 1 ? 's' : ''} = ₹{additionalAmount.toFixed(2)}
              </div>
              {gstAmount > 0 && (
                <div style={{ fontSize: "13px", color: "#92400e", marginBottom: "5px" }}>
                  <strong>GST ({booking.gstType === 'gst' ? 'CGST+SGST' : 'IGST'} 5%):</strong> ₹{gstAmount.toFixed(2)}
                </div>
              )}
              <div style={{ fontSize: "16px", fontWeight: "700", color: "#92400e", paddingTop: "10px", borderTop: "1px solid #fde68a" }}>
                <strong>Total Additional Amount:</strong> ₹{totalAdditionalAmount.toFixed(2)}
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1, padding: "12px", backgroundColor: "#f3f4f6", color: "#374151",
                  border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: "500"
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  flex: 1, padding: "12px", backgroundColor: "#f59e0b",
                  color: "white", border: "none", borderRadius: "6px",
                  cursor: isLoading ? "not-allowed" : "pointer", fontWeight: "500"
                }}
              >
                {isLoading ? "Extending..." : "Extend Booking"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

// Cancel Extension Modal for canceling specific days from extension
const CancelExtensionModal = ({ booking, onClose, onCancelExtension }) => {
  const [daysToCancel, setDaysToCancel] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  // Get the most recent extension details
  const lastExtension = booking.extensions && booking.extensions.length > 0 
    ? booking.extensions[booking.extensions.length - 1] 
    : null

  if (!lastExtension) {
    return null
  }

  const maxDaysToCancel = lastExtension.additionalNights
  const amountPerDay = lastExtension.additionalAmount / lastExtension.additionalNights
  const refundAmount = amountPerDay * daysToCancel

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const result = await onCancelExtension(booking._id, daysToCancel)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const currentCheckOut = new Date(booking.checkOutDate)
  const newCheckOut = new Date(currentCheckOut)
  newCheckOut.setDate(currentCheckOut.getDate() - daysToCancel)

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 1000
    }}>
      <div style={{
        backgroundColor: "white", borderRadius: "12px", padding: "0",
        maxWidth: "500px", width: "90%", margin: "16px",
        maxHeight: "90vh", overflowY: "auto"
      }}>
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "20px", borderBottom: "1px solid #e5e7eb",
          backgroundColor: "#fef2f2", borderRadius: "12px 12px 0 0"
        }}>
          <div>
            <h2 style={{ fontSize: "20px", fontWeight: "700", margin: 0, color: "#dc2626" }}>
              Cancel Extension Days
            </h2>
            <p style={{ fontSize: "14px", color: "#6b7280", margin: "4px 0 0" }}>
              Room {booking.roomId?.roomNumber} - {booking.userName}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              color: "#6b7280", backgroundColor: "transparent", border: "none",
              cursor: "pointer", padding: "8px", borderRadius: "8px"
            }}
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: "20px" }}>
            {error && (
              <div style={{
                padding: "12px", backgroundColor: "#fef2f2", color: "#dc2626",
                borderRadius: "8px", marginBottom: "16px", fontSize: "14px"
              }}>
                {error}
              </div>
            )}

            {/* Extension Details */}
            <div style={{
              padding: "16px", backgroundColor: "#fef3c7", borderRadius: "8px",
              marginBottom: "20px", border: "1px solid #f59e0b"
            }}>
              <h3 style={{ margin: "0 0 12px", fontSize: "16px", color: "#92400e" }}>
                Current Extension Details
              </h3>
              <div style={{ fontSize: "14px", color: "#6b7280" }}>
                <p style={{ margin: "4px 0" }}>
                  <strong>Extended Nights:</strong> {lastExtension.additionalNights} night(s)
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>Extension Amount:</strong> ₹{lastExtension.additionalAmount.toFixed(2)}
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>Current Checkout:</strong> {formatDateDisplay(booking.checkOutDate)}
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>Rate per Day:</strong> ₹{amountPerDay.toFixed(2)}
                </p>
              </div>
            </div>

            {/* Days to Cancel Selection */}
            <div style={{ marginBottom: "20px" }}>
              <label style={{
                display: "block", marginBottom: "8px", fontSize: "14px",
                fontWeight: "600", color: "#374151"
              }}>
                Days to Cancel from Extension *
              </label>
              <select
                value={daysToCancel}
                onChange={(e) => setDaysToCancel(parseInt(e.target.value))}
                style={{
                  width: "100%", padding: "12px", border: "1px solid #d1d5db",
                  borderRadius: "8px", fontSize: "14px"
                }}
                required
              >
                {Array.from({ length: maxDaysToCancel }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>
                    {day} day{day > 1 ? 's' : ''} - Refund ₹{(amountPerDay * day).toFixed(2)}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                You can cancel 1 to {maxDaysToCancel} days from the extension
              </p>
            </div>

            {/* Cancellation Summary */}
            <div style={{
              padding: "16px", backgroundColor: "#f0fdf4", borderRadius: "8px",
              marginBottom: "20px", border: "1px solid #10b981"
            }}>
              <h3 style={{ margin: "0 0 12px", fontSize: "16px", color: "#166534" }}>
                Cancellation Summary
              </h3>
              <div style={{ fontSize: "14px", color: "#6b7280" }}>
                <p style={{ margin: "4px 0" }}>
                  <strong>Days to Cancel:</strong> {daysToCancel} night{daysToCancel > 1 ? 's' : ''}
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>Refund Amount:</strong> ₹{refundAmount.toFixed(2)}
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>New Checkout Date:</strong> {formatDateDisplay(newCheckOut)}
                </p>
                <p style={{ margin: "4px 0" }}>
                  <strong>Remaining Extension:</strong> {maxDaysToCancel - daysToCancel} night{(maxDaysToCancel - daysToCancel) !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            display: "flex", justifyContent: "flex-end", gap: "12px",
            padding: "20px", borderTop: "1px solid #e5e7eb",
            backgroundColor: "#f9fafb", borderRadius: "0 0 12px 12px"
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              style={{
                padding: "10px 20px", backgroundColor: "white", color: "#374151",
                border: "1px solid #d1d5db", borderRadius: "8px", cursor: "pointer",
                fontSize: "14px", fontWeight: "500"
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                padding: "10px 20px", backgroundColor: "#dc2626", color: "white",
                border: "none", borderRadius: "8px", cursor: "pointer",
                fontSize: "14px", fontWeight: "500", opacity: isLoading ? 0.6 : 1
              }}
            >
              {isLoading ? "Cancelling..." : `Cancel ${daysToCancel} Day${daysToCancel > 1 ? 's' : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ReceptionistDashboard
