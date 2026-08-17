
import { useState, useEffect } from "react"
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom"
import Sidebar from "./components/Sidebar"
// import Dashboard from "./pages/Dashboard"
// import Orders from "./pages/Orders"
// import UserOrders from "./pages/UserOrders"
import Products from "./pages/Products"
import Categories from "./pages/Categories"
import Branches from "./pages/Branches"
import Users from "./pages/Users"
// import Coupons from "./pages/Coupons"
// import Payments from "./pages/Payments"

import HelpSupport from "./pages/HelpSupport"
import AboutUs from "./pages/AboutUs"
import TermsPolicies from "./pages/TermsPolicies"
import Login from "./pages/Login"
import StaffUsers from "./pages/StaffUsers"
import CounterUsers from "./pages/CounterUsers"
import Servers from "./pages/Servers"
import StaffOrders from "./pages/StaffOrders"
// import CounterOrders from "./pages/CounterOrders"
import Tables from "./pages/Tables"
// import StaffInvoices from "./pages/StaffInvoices"
// import CounterBills from "./pages/CounterBills"
// import StaffPayment from "./pages/StaffPayment"
// import CounterPayment from "./pages/CounterPayment"
// import ProductSubmissions from "./pages/ProductSubmissions"
import QRUploads from "./pages/QRUploads"
import PurchaseUsers from "./pages/PurchaseUsers"
// import QrGenerator from "./pages/QrGenerator"
import QRGeneratorV2 from "./pages/QRGeneratorV2"
import PublicMenu from "./pages/PublicMenu"
import PublicRestaurantOrders from "./pages/PublicRestaurantOrders"
import MemberProfile from "./pages/MemberProfile"
import PrivacyPolicy from "./pages/PrivacyPolicy"
import TermsConditions from "./pages/TermsConditions"

// import Subscription from "./pages/Subscription"
// import SubscriptionManagement from "./pages/SubscriptionManagement"
// import MealOfTheDay from "./pages/MealOfTheDay"
// import Rooms from "./pages/Rooms"
// import Housekeeping from "./pages/Housekeeping"
// import RoomBookings from "./pages/RoomBookings"
// import RoomPayments from "./pages/RoomPayments"
import CategoryAccess from "./pages/CategoryAccess"
import CategoryOrders from "./pages/CategoryOrders"
import CategorizedOrders from "./pages/CategorizedOrders"
import KitchenDisplay from "./pages/KitchenDisplay"
// import ReceptionistAccess from "./pages/ReceptionistAccess"
// import ReceptionistDashboard from "./pages/ReceptionistDashboard"
import Reservations from "./pages/Reservations"

// Website Management — only Messages is active
// import WebsiteCarousel from "./pages/WebsiteCarousel"
// import WebsiteCatering from "./pages/WebsiteCatering"
// import WebsiteApp from "./pages/WebsiteApp"
import WebsiteMessages from "./pages/WebsiteMessages"

// Membership Management
import Members from "./pages/Members"
import Events from "./pages/Events"
import EventBookings from "./pages/EventBookings"
import MemberOrders from "./pages/MemberOrders"
import Gallery from "./pages/Gallery"

// Import Counter App
import CounterApp from "./viratcounterweb/CounterApp"

// Import Website (commented out — not in use)
// import Website from "./website/Website"

import "./App.css"

// Protected route component
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem("isAuthenticated") === "true"
  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />
  }
  return children
}

// Component to handle body class based on route
const RouteHandler = () => {
  const location = useLocation()
  useEffect(() => {
    if (location.pathname.startsWith('/admin')) {
      document.body.classList.add('admin-layout')
    } else {
      document.body.classList.remove('admin-layout')
    }
    return () => {
      document.body.classList.remove('admin-layout')
    }
  }, [location.pathname])
  return null
}

function App() {
  const [collapsed, setCollapsed] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const authStatus = localStorage.getItem("isAuthenticated") === "true"
    setIsAuthenticated(authStatus)
    const handleStorageChange = () => {
      const newAuthStatus = localStorage.getItem("isAuthenticated") === "true"
      setIsAuthenticated(newAuthStatus)
    }
    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  return (
    <Router>
      <RouteHandler />
      <Routes>
        {/* Website homepage — commented out, redirect to admin */}
        {/* <Route path="/" element={<Website />} /> */}
        <Route path="/" element={<Navigate to="/admin/login" replace />} />

        {/* Admin Panel Routes */}
        <Route path="/admin" element={<Navigate to="/admin/branches" replace />} />
        <Route path="/admin/login" element={<Login />} />
        <Route path="/admin/*" element={
          <ProtectedRoute>
            <div className="app">
              <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
              <main className={`content ${collapsed ? "content-expanded" : ""}`}>
                <Routes>
                  <Route path="/" element={<Navigate to="/admin/branches" replace />} />
                  {/* <Route path="dashboard" element={<Dashboard />} /> */}
                  <Route path="branches" element={<Branches />} />
                  {/* <Route path="orders" element={<Orders />} /> */}
                  {/* <Route path="user-orders" element={<UserOrders />} /> */}
                  <Route path="categorized-orders" element={<CategorizedOrders />} />
                  <Route path="products" element={<Products />} />
                  <Route path="categories" element={<Categories />} />
                  <Route path="users" element={<Users />} />
                  {/* <Route path="coupons" element={<Coupons />} /> */}
                  {/* <Route path="payments" element={<Payments />} /> */}

                  {/* Website Management — only Messages active */}
                  {/* <Route path="website-carousel" element={<WebsiteCarousel />} /> */}
                  {/* <Route path="website-catering" element={<WebsiteCatering />} /> */}
                  {/* <Route path="website-app" element={<WebsiteApp />} /> */}
                  <Route path="website-messages" element={<WebsiteMessages />} />

                  {/* Membership Management */}
                  <Route path="members" element={<Members />} />
                  <Route path="events" element={<Events />} />
                  <Route path="event-bookings/:eventId" element={<EventBookings />} />
                  <Route path="member-orders" element={<MemberOrders />} />
                  <Route path="gallery" element={<Gallery />} />

                  <Route path="help-support" element={<HelpSupport />} />
                  <Route path="about-us" element={<AboutUs />} />
                  <Route path="terms-policies" element={<TermsPolicies />} />
                  <Route path="staff-users" element={<StaffUsers />} />
                  <Route path="counter-users" element={<CounterUsers />} />
                  <Route path="servers" element={<Servers />} />
                  {/* <Route path="staff-orders" element={<StaffOrders />} />
                  {/* <Route path="counter-orders" element={<CounterOrders />} /> */}
                  <Route path="tables" element={<Tables />} />
                  {/* <Route path="staff-invoices" element={<StaffInvoices />} /> */}
                  {/* <Route path="counter-bills" element={<CounterBills />} /> */}
                  {/* <Route path="staff-payment" element={<StaffPayment />} /> */}
                  {/* <Route path="counter-payment" element={<CounterPayment />} /> */}
                  {/* <Route path="product-submissions" element={<ProductSubmissions />} /> */}
                  <Route path="qr-uploads" element={<QRUploads />} />
                  <Route path="purchase-users" element={<PurchaseUsers />} />
                  {/* <Route path="qr-generator" element={<QrGenerator />} /> */}
                  <Route path="qr-generator-v2" element={<QRGeneratorV2 />} />
                  {/* <Route path="subscription" element={<Subscription />} /> */}
                  {/* <Route path="subscription-management" element={<SubscriptionManagement />} /> */}
                  {/* <Route path="meal-of-the-day" element={<MealOfTheDay />} /> */}
                  {/* <Route path="rooms" element={<Rooms />} /> */}
                  {/* <Route path="housekeeping" element={<Housekeeping />} /> */}
                  {/* <Route path="room-bookings" element={<RoomBookings />} /> */}
                  {/* <Route path="room-payments" element={<RoomPayments />} /> */}
                  <Route path="category-access" element={<CategoryAccess />} />
                  {/* <Route path="receptionist-access" element={<ReceptionistAccess />} /> */}
                  <Route path="reservations" element={<Reservations />} />
                </Routes>
              </main>
            </div>
          </ProtectedRoute>
        } />

        {/* Legacy redirect */}
        <Route path="/login" element={<Navigate to="/admin/login" replace />} />

        {/* Public routes */}
        <Route path="/menu" element={<PublicMenu />} />
        <Route path="/public-menu" element={<PublicMenu />} />
        <Route path="/public/restaurant-orders" element={<PublicRestaurantOrders />} />
        <Route path="/qrorders" element={
          <ProtectedRoute>
            <PublicRestaurantOrders />
          </ProtectedRoute>
        } />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-conditions" element={<TermsConditions />} />
        <Route path="/member/:memberId" element={<MemberProfile />} />
        <Route path="/category-orders" element={<CategoryOrders />} />
        <Route path="/kot" element={<KitchenDisplay />} />
        {/* <Route path="/receptionist-dashboard" element={<ReceptionistDashboard />} /> */}
        <Route path="/counter/*" element={<CounterApp />} />
      </Routes>
    </Router>
  )
}

export default App
