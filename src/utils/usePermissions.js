/**
 * Permission utility for module-wise access control.
 *
 * Usage:
 *   import { hasPermission, isSuperAdmin, getPermissions } from "../utils/usePermissions"
 *
 *   // Check if user can edit menu
 *   if (hasPermission("menu", "edit")) { ... }
 *
 *   // Check if user can view sales reports
 *   if (hasPermission("salesReports", "view")) { ... }
 *
 *   // Super admin always returns true for everything
 *   if (isSuperAdmin()) { ... }
 *
 * Data is stored in localStorage after login:
 *   - adminAccessUser: { id, name, email, isSuperAdmin, permissions }
 *   - adminAccessToken: JWT token
 */

/**
 * Get the current logged-in admin access user data
 */
export const getAdminAccessUser = () => {
  try {
    const raw = localStorage.getItem("adminAccessUser")
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Check if current user is a super admin (full access to everything)
 */
export const isSuperAdmin = () => {
  const user = getAdminAccessUser()
  // If no admin-access user is logged in, treat as super admin (backward compat — 
  // existing admin login has full access)
  if (!user) return true
  return user.isSuperAdmin === true
}

/**
 * Get all permissions for the current user
 */
export const getPermissions = () => {
  const user = getAdminAccessUser()
  if (!user) return null // No restrictions
  if (user.isSuperAdmin) return null // Full access
  return user.permissions || {}
}

/**
 * Check if the current user has a specific permission.
 *
 * @param {string} module - Module key (e.g., "menu", "categories", "salesReports")
 * @param {string} action - Action: "view" | "edit" | "delete"
 * @returns {boolean} true if allowed
 */
export const hasPermission = (module, action) => {
  // If no admin-access user is logged in (legacy admin login), allow everything
  const user = getAdminAccessUser()
  if (!user) return true

  // Super admin always has full access
  if (user.isSuperAdmin) return true

  // Check specific permission
  const permissions = user.permissions
  if (!permissions) return false

  const modulePerm = permissions[module]
  if (!modulePerm) return false

  return modulePerm[action] === true
}

/**
 * Check if user can view a specific module (used for sidebar visibility)
 */
export const canViewModule = (moduleKey) => {
  return hasPermission(moduleKey, "view")
}

/**
 * Store admin access user data after login
 */
export const setAdminAccessUser = (userData, token) => {
  localStorage.setItem("adminAccessUser", JSON.stringify(userData))
  if (token) localStorage.setItem("adminAccessToken", token)
}

/**
 * Clear admin access user data (logout)
 */
export const clearAdminAccessUser = () => {
  localStorage.removeItem("adminAccessUser")
  localStorage.removeItem("adminAccessToken")
}

/**
 * Module key to sidebar path mapping (used for filtering sidebar)
 */
export const MODULE_PATH_MAP = {
  branches: "/admin/branches",
  categories: "/admin/categories",
  menu: "/admin/products",
  tableQrGenerator: "/admin/table-qr",
  tables: "/admin/tables",
  tableReservations: "/admin/table-reservations",
  categorizedOrders: "/admin/categorized-orders",
  salesReports: "/admin/sales-reports",
  qrUploads: "/admin/qr-uploads",
  contactMessages: "/admin/website-messages",
  members: "/admin/members",
  events: "/admin/events",
  gallery: "/admin/gallery",
  staffUsers: "/admin/staff-users",
  counterUsers: "/admin/counter-users",
  servers: "/admin/servers",
  purchaseUsers: "/admin/purchase-users",
  categoryAccess: "/admin/category-access",
  moduleAccess: "/admin/module-access",
}

/**
 * Get the module key for a given sidebar path
 */
export const getModuleKeyForPath = (path) => {
  for (const [key, modulePath] of Object.entries(MODULE_PATH_MAP)) {
    if (path === modulePath) return key
  }
  return null
}
