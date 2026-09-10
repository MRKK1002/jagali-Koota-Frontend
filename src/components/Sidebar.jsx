import { useState, useEffect } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import hotelViratLogo from "../assets/logo4.jpeg"
import { canViewModule, getModuleKeyForPath } from "../utils/usePermissions"
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Tags,
  Store,
  Users,
  ChevronLeft,
  ChevronRight,
  LogOut,
  HelpCircle,
  FileText,
  Info,
  Table,
  Receipt,
  KeyRound,
  Calendar,
  MessageSquare,
  QrCode,
  BarChart2,
  Shield,
  Image as ImageIcon,
  Activity,
} from "lucide-react"

const Sidebar = ({ collapsed, setCollapsed }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const [activeItem, setActiveItem] = useState(location.pathname)
  const [userData, setUserData] = useState(null)

useEffect(() => {
    // Set active item based on current pathname
    setActiveItem(location.pathname)
    // Get user data from localStorage
    const storedUserData = localStorage.getItem("userData")
    if (storedUserData) {
      setUserData(JSON.parse(storedUserData))
    }
  }, [location.pathname])
  const menuItems = [
    // { path: "/admin/dashboard", name: "Dashboard", icon: <LayoutDashboard size={20} /> },
     { path: "/admin/branches", name: "Branches", icon: <Store size={20} /> },
    // { path: "/admin/rooms", name: "Rooms", icon: <Bed size={20} /> },
    // { path: "/admin/room-bookings", name: "Room Bookings", icon: <Calendar size={20} /> },
     { path: "/admin/categories", name: "Categories", icon: <Tags size={20} /> },
      { path: "/admin/products", name: "Menu", icon: <Package size={20} /> },
      // { path: "/admin/subscription", name: "Subscriptions", icon: <RefreshCw size={20} /> },
      // { path: "/admin/subscription-management", name: "Subscription Orders", icon: <RefreshCw size={20} /> },
      // { path: "/admin/meal-of-the-day", name: "Meal of the Day", icon: <Award size={20} /> },
      // { path: "/admin/qr-generator", name: "Menu QrGenerator", icon:<Package size={20} />},
      { path: "/admin/qr-generator-v2", name: "Table QR Generator", icon:<QrCode size={20} />},
   { path: "/admin/tables", name: "Tables", icon: <Table size={20} /> },
   { path: "/admin/reservations", name: "Table Reservations", icon: <Calendar size={20} /> },
    
    // { path: "/admin/orders", name: "Online Orders", icon: <ShoppingCart size={20} /> },
    // { path: "/admin/user-orders", name: "User Orders", icon: <ShoppingCart size={20} /> },
    { path: "/admin/categorized-orders", name: "Categorized Orders", icon: <ShoppingCart size={20} /> },
    { path: "/admin/sales-reports", name: "Sales Reports", icon: <BarChart2 size={20} /> },
    // { path: "/admin/staff-orders", name: "Staff Orders", icon: <Receipt size={20} /> },
    // { path: "/admin/payments", name: "Payments", icon: <CreditCard size={20} /> },
    // { path: "/admin/staff-payment", name: "Staff Payments", icon: <CreditCard size={20}/>},
    // { path: "/admin/counter-payment", name: "Counter Payments", icon: <CreditCard size={20}/>},
      //  { path: "/admin/staff-invoices", name: "Staff Invoices", icon: <Receipt size={20} /> },
    //  {path: "/admin/counter-bills", name: "Counter Bills", icon: <Receipt size={20}/>},
  
 { path: "/admin/qr-uploads", name: "QR Uploads", icon: <Receipt size={20} /> },

    // Website Management Section — only Messages is active
    // { path: "/admin/website-carousel", name: "Carousel Images", icon: <Image size={20} /> },
    // { path: "/admin/website-catering", name: "Catering Content", icon: <Utensils size={20} /> },
    // { path: "/admin/website-app", name: "App Download", icon: <Smartphone size={20} /> },
    { path: "/admin/website-messages", name: "Contact Messages", icon: <MessageSquare size={20} /> },

    // Membership Section
    { path: "/admin/members", name: "Members", icon: <Users size={20} /> },
    { path: "/admin/events", name: "Events", icon: <Calendar size={20} /> },
    { path: "/admin/sports", name: "Sports & Activities", icon: <Activity size={20} /> },
    { path: "/admin/affiliated-members", name: "Affiliated Members", icon: <Users size={20} /> },
    { path: "/admin/gallery", name: "Gallery", icon: <ImageIcon size={20} /> },
    // { path: "/admin/member-orders", name: "Member Orders", icon: <ShoppingCart size={20} /> },

    // { path: "/admin/users", name: "Users", icon: <Users size={20} /> },
     { path: "/admin/staff-users", name: "Staff Users", icon: <Users size={20} /> },
     { path: "/admin/counter-users", name: "Counter Users", icon: <Users size={20} /> },
     { path: "/admin/servers", name: "Servers / Waiters", icon: <Users size={20} /> },
     { path: "/admin/purchase-users", name: "Purchase Users", icon: <Users size={20} /> },
     { path: "/admin/category-access", name: "Category Access", icon: <KeyRound size={20} /> },
     { path: "/admin/module-access", name: "Module Access", icon: <Shield size={20} /> },
     // { path: "/admin/receptionist-access", name: "Receptionist Access", icon: <KeyRound size={20} /> },
    // { path: "/admin/coupons", name: "Coupons", icon: <Ticket size={20} /> },
    { path: "/admin/help-support", name: "Help & Support", icon: <HelpCircle size={20} /> },
    { path: "/admin/about-us", name: "About Us", icon: <Info size={20} /> },
    { path: "/admin/terms-policies", name: "Terms & Policies", icon: <FileText size={20} /> },
  ]
  const handleLogout = () => {
    // Clear authentication and user data
    localStorage.removeItem("isAuthenticated")
    localStorage.removeItem("userData")
    localStorage.removeItem("authToken")
    localStorage.removeItem("adminAccessUser")
    localStorage.removeItem("adminAccessToken")
    localStorage.removeItem("userType")
    // Redirect to login
    navigate("/login")
  }
  return (
    <aside className={`sidebar ${collapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-header">
        {!collapsed && (
          <div className="logo">
            <div className="logo-icon">
              <img
                src={hotelViratLogo}
                alt="Jagali Koota"
                style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: '6px' }}
              />
            </div>
            <h2>JAGALI KOOTA</h2>
          </div>
        )}
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
          {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        <ul>
          {menuItems.filter((item) => {
            const moduleKey = getModuleKeyForPath(item.path)
            if (!moduleKey) return true // Non-module pages (Help, About, Terms) always show
            return canViewModule(moduleKey)
          }).map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={`nav-link ${activeItem === item.path ? "active" : ""}`}
                onClick={() => setActiveItem(item.path)}
              >
                <span className="icon">{item.icon}</span>
                {!collapsed && <span className="text">{item.name}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        {!collapsed ? (
          <div className="user-info">
            <div className="avatar">
              <img 
                src={userData?.profileImage || `https://ui-avatars.com/api/?name=${userData?.name || 'Admin'}&background=f0f0f0&color=333`} 
                alt={userData?.name || 'Admin'} 
              />
            </div>
            <div className="user-details">
              <h4>{userData?.name || 'Admin'}</h4>
              <p>{userData?.email || ''}</p>
            </div>
          </div>
        ) : (
          <div className="avatar-small">
            <img 
              src={userData?.profileImage || `https://ui-avatars.com/api/?name=${userData?.name || 'Admin'}&background=f0f0f0&color=333`} 
              alt={userData?.name || 'Admin'} 
            />
          </div>
        )}
        <button className="logout-btn" onClick={handleLogout}>
          <LogOut size={18} />
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  )
}
export default Sidebar