import { useState, useEffect, useRef, useMemo } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import counterApi from "../services/counterApi"
import thermalPrinter from "../services/thermalPrinter"
import { offlineQueue } from "../services/offlineQueue"
import { syncManager } from "../services/syncManager"
import { localCache } from "../services/localCache"
import { BarChart2, RefreshCw, X, ClipboardList, Gift } from "lucide-react"

/**
 * PERFORMANCE OPTIMIZATIONS:
 * 1. Load ALL menu items once on page load (limit: 1000)
 * 2. Client-side search (instant, no API calls during typing)
 * 3. Reduced debounce from 300ms to 150ms
 * 4. Focus management for better UX
 * 
 * RESULT: Search is now instant (<50ms) instead of 300ms-2s per keystroke
 */

// Admin password for order cancellation
const ADMIN_PASSWORD = "admin@123"

// Helper function to get stored category from localStorage
const getStoredCategory = () => {
  try {
    const storedCategory = localStorage.getItem('selectedCategory')
    const storedCategoryName = localStorage.getItem('selectedCategoryName')

    if (storedCategoryName) {
      return storedCategoryName
    }

    if (storedCategory) {
      const categoryData = JSON.parse(storedCategory)
      const categoryName = categoryData?.name || categoryData
      return categoryName
    }

    return null
  } catch (error) {
    console.error('❌ Error reading stored category:', error)
    return null
  }
}

// Enhanced helper function to get category from multiple sources
const getCategoryName = (customerData, preSelectedCategory) => {
  // Try multiple sources in order of preference
  const sources = [
    customerData?.selectedCategory?.name,
    preSelectedCategory,
    getStoredCategory(),
    // Check URL or other indicators
    window.location.pathname.includes('temple') ? 'Temple Meals' : null,
    window.location.pathname.includes('self') ? 'Self Service' : null,
    window.location.pathname.includes('restaurant') ? 'Restaurant' : null
  ]

  for (const source of sources) {
    if (source && source !== 'All') {
      return source
    }
  }

  return 'Restaurant' // Default fallback for MenuScreen (KOTs are restaurant-only)
}

// Helper function to switch category
const handleSwitchCategory = () => {
  // Clear stored category data
  localStorage.removeItem('selectedCategory')
  localStorage.removeItem('selectedCategoryName')

  // Navigate back to category selection
  window.location.href = '/counter/category-selection'
}

// ─── Counter helpers ──────────────────────────────────────────────────────────
// These generate numbers locally (instant, works offline).
// The local counter is seeded from the server on app init (see CounterApp.jsx)
// so it always continues from where the server left off.
// The actual server counter advances when the KOT/bill syncs via createOrder.

const _todayDateKey = () => {
  const now = new Date()
  const day = String(now.getDate()).padStart(2, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const year = String(now.getFullYear()).slice(-2)
  return `${day}-${month}-${year}`
}

const _incrementLocalCounter = async (storageKey) => {
  const lockKey = `${storageKey}-lock`
  let attempts = 0
  while (attempts < 10) {
    const lockTs = localStorage.getItem(lockKey)
    const ts = Date.now()
    if (lockTs && (ts - parseInt(lockTs)) < 1000) {
      await new Promise(r => setTimeout(r, 50))
      attempts++
      continue
    }
    localStorage.setItem(lockKey, ts.toString())
    await new Promise(r => setTimeout(r, 10))
    if (localStorage.getItem(lockKey) !== ts.toString()) { attempts++; continue }
    try {
      let counter = parseInt(localStorage.getItem(storageKey) || '0')
      counter++
      localStorage.setItem(storageKey, counter.toString())
      return counter
    } finally {
      localStorage.removeItem(lockKey)
    }
  }
  return null // fallback: caller uses timestamp
}

const getNextKOTNumber = async (_branchId) => {
  const key = `kot-counter-${_todayDateKey()}`
  const counter = await _incrementLocalCounter(key)
  if (counter === null) return `KOT-T${Date.now().toString().slice(-6)}`
  return `KOT-${String(counter).padStart(3, '0')}`
}

const getNextBillNumber = async (_branchId, category) => {
  if (!category) category = 'default'
  const key = `unified-bill-counter-${category}-${_todayDateKey()}`
  const counter = await _incrementLocalCounter(key)
  if (counter === null) return `T${Date.now().toString().slice(-6)}`
  return String(counter).padStart(3, '0')
}

// Helper function to get correct image URL - Check local first, then production
const getImageUrl = (imagePath) => {
  if (!imagePath) return null;

  // If already a full URL, return as-is
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  // Try local server first (for newly uploaded images)
  const localBaseUrl = "https://billing.jagalikoota.com";

  // Clean up the path
  let cleanPath = imagePath.toString().trim().replace(/\\/g, "/");

  // Build the URL
  let imageUrl;
  if (cleanPath.startsWith("/")) {
    imageUrl = `${localBaseUrl}${cleanPath}`;
  } else if (cleanPath.startsWith("uploads/")) {
    imageUrl = `${localBaseUrl}/${cleanPath}`;
  } else {
    // Otherwise assume it's just a filename in uploads/menu/
    const filename = cleanPath.split("/").pop();
    imageUrl = `${localBaseUrl}/uploads/menu/${filename}`;
  }

  return imageUrl;
};

// Get production fallback URL (for old images that exist on production)
const getProdImageUrl = (imagePath) => {
  if (!imagePath) return null;

  // If it's already a localhost URL, convert to production
  if (imagePath.startsWith("https://billing.jagalikoota.com")) {
    const prodUrl = imagePath.replace("https://billing.jagalikoota.com", "https://billing.jagalikoota.com");
    return prodUrl;
  }

  // If already a production URL, return as-is
  if (imagePath.startsWith("https://billing.jagalikoota.com")) {
    return imagePath;
  }

  // If already a full URL, return as-is
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }

  // Use production server as fallback
  const prodBaseUrl = "https://billing.jagalikoota.com";

  // Clean up the path
  let cleanPath = imagePath.toString().trim().replace(/\\/g, "/");

  // Build the URL
  let imageUrl;
  if (cleanPath.startsWith("/")) {
    imageUrl = `${prodBaseUrl}${cleanPath}`;
  } else if (cleanPath.startsWith("uploads/")) {
    imageUrl = `${prodBaseUrl}/${cleanPath}`;
  } else {
    // Otherwise assume it's just a filename in uploads/menu/
    const filename = cleanPath.split("/").pop();
    imageUrl = `${prodBaseUrl}/uploads/menu/${filename}`;
  }

  return imageUrl;
};

const MenuScreen = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const customerData = location.state

  const [searchQuery, setSearchQuery] = useState("000")
  // Check if a specific category was pre-selected from category selection page
  // Fall back to localStorage if navigation state is missing (e.g. after page refresh)
  const preSelectedCategory = customerData?.selectedCategory?.name ||
    localStorage.getItem('selectedCategoryName') ||
    (() => { try { return JSON.parse(localStorage.getItem('selectedCategory') || '{}')?.name } catch(_){} return null })() ||
    null
  const [selectedCategory, setSelectedCategory] = useState(preSelectedCategory || "All")

  // Get cancel order password from selected category
  const cancelOrderPassword = customerData?.selectedCategory?.cancelOrderPassword || null

  // Always treat as Restaurant category — table selection, KOT, Alt+K all enabled
  const isRestaurantCategory = true
  const [cartItems, setCartItems] = useState(() => {
    // Only use cartItems if they're explicitly passed and valid
    const initialItems = customerData?.cartItems || []

    // Filter out any invalid or test items
    const validItems = initialItems.filter(item => {
      // Check if item has required properties
      return item &&
        item.name &&
        typeof item.quantity === 'number' &&
        item.quantity > 0 &&
        typeof item.price === 'number' &&
        item.price >= 0
    })

    return validItems
  })
  const [categories, setCategories] = useState(["All"])
  const [menuItems, setMenuItems] = useState([])
  const [allMenuItems, setAllMenuItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [maxQuantityMessage, setMaxQuantityMessage] = useState(null)
  const [savingKOT, setSavingKOT] = useState(false) // CRITICAL FIX: Lock to prevent multiple KOT saves
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [offlineKOTIds, setOfflineKOTIds] = useState(new Set())
  const [inputValues, setInputValues] = useState({}) // Track input field values

  // Table selection state
  const [tables, setTables] = useState([])
  const [selectedTable, setSelectedTable] = useState(customerData?.selectedTable || null)
  const [tablesLoading, setTablesLoading] = useState(false)
  const [expandedTableGroup, setExpandedTableGroup] = useState(null) // e.g. "G" when G group is expanded

  // State for saved KOTs
  const [showKOTList, setShowKOTList] = useState(false)
  const [savedKOTs, setSavedKOTs] = useState([])
  const [kotLoading, setKotLoading] = useState(false)
  const [existingKOTId, setExistingKOTId] = useState(null) // Track if we're updating an existing KOT
  const [showKOTDetailView, setShowKOTDetailView] = useState(false) // NEW: Track if showing detailed view
  const [isNavigatingToBill, setIsNavigatingToBill] = useState(false) // NEW: Prevent multiple navigation calls

  // State for complimentary bills
  const [showComplimentaryList, setShowComplimentaryList] = useState(false)
  const [complimentaryBills, setComplimentaryBills] = useState([])
  const [complimentaryLoading, setComplimentaryLoading] = useState(false)
  const [selectedComplimentaryDate, setSelectedComplimentaryDate] = useState(new Date().toISOString().split('T')[0]) // Today's date

  // State for table shifting
  const [showTableShiftModal, setShowTableShiftModal] = useState(false)
  const [shiftingKOT, setShiftingKOT] = useState(null)
  const [availableTables, setAvailableTables] = useState([])
  const [selectedNewTable, setSelectedNewTable] = useState(null)

  // State for KOT item modification
  const [editingKOT, setEditingKOT] = useState(null)
  const [modifiedItems, setModifiedItems] = useState([])
  const [existingKOTNumber, setExistingKOTNumber] = useState(null) // Track the KOT number
  const [focusedKOTIndex, setFocusedKOTIndex] = useState(0) // Track which KOT card is focused
  const [kotSearchQuery, setKotSearchQuery] = useState('') // Search query for filtering KOTs by table number
  const [hasInitialFocus, setHasInitialFocus] = useState(false) // Track if initial focus has been set to prevent repeated auto-focus
  const [isInitialLoad, setIsInitialLoad] = useState(true) // Track if this is the first load

  // Pagination state for menu items
  const [menuCurrentPage, setMenuCurrentPage] = useState(1)
  const [menuTotalPages, setMenuTotalPages] = useState(1)
  const [menuTotalItems, setMenuTotalItems] = useState(0)
  const [hasMoreItems, setHasMoreItems] = useState(false)

  // 🔓 LOCK SYSTEM: Release bill print lock when MenuScreen loads
  useEffect(() => {
    const billPrintLock = localStorage.getItem('billPrintLock')
    const lockTimestamp = localStorage.getItem('billPrintLockTime')
    
    if (billPrintLock === 'true') {
      // Check if lock is stale (older than 30 seconds)
      if (lockTimestamp) {
        const lockAge = Date.now() - parseInt(lockTimestamp)
        if (lockAge > 30000) {
          // console.log('🔓 Releasing stale bill print lock (age:', lockAge, 'ms)')
          localStorage.removeItem('billPrintLock')
          localStorage.removeItem('billPrintLockTime')
        } else {
          // console.log('🔒 Bill print lock is recent, keeping it (age:', lockAge, 'ms)')
        }
      } else {
        // No timestamp, assume stale
        // console.log('🔓 Releasing bill print lock (no timestamp)')
        localStorage.removeItem('billPrintLock')
      }
    }
    
    // Clean up any stale locks on component mount
    const cleanupStaleLocks = () => {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.endsWith('-lock')) {
          const lockTimestamp = localStorage.getItem(key)
          if (lockTimestamp) {
            const lockAge = Date.now() - parseInt(lockTimestamp)
            if (lockAge > 5000) { // 5 seconds for counter locks
              // console.log(`🔓 Cleaning up stale lock: ${key}`)
              localStorage.removeItem(key)
            }
          }
        }
      })
    }
    
    // CRITICAL FIX: Clean up expired table KOTs from localStorage
    const cleanupExpiredTableKOTs = () => {
      const keys = Object.keys(localStorage)
      const now = Date.now()
      
      keys.forEach(key => {
        // Check for table KOT keys
        if (key.startsWith('table-') && key.endsWith('-kots')) {
          const expiryKey = `${key}-expiry`
          const expiryTime = localStorage.getItem(expiryKey)
          
          if (expiryTime) {
            const expiry = parseInt(expiryTime)
            if (now > expiry) {
              // Expired, remove both keys
              // console.log(`🧹 Removing expired table KOTs: ${key}`)
              localStorage.removeItem(key)
              localStorage.removeItem(expiryKey)
            }
          } else {
            // No expiry set, check if KOTs are old (more than 7 days)
            try {
              const kots = JSON.parse(localStorage.getItem(key) || '[]')
              if (kots.length > 0 && kots[0].savedAt) {
                const savedTime = new Date(kots[0].savedAt).getTime()
                const age = now - savedTime
                const sevenDays = 7 * 24 * 60 * 60 * 1000
                
                if (age > sevenDays) {
                  // console.log(`🧹 Removing old table KOTs (${Math.floor(age / (24 * 60 * 60 * 1000))} days old): ${key}`)
                  localStorage.removeItem(key)
                }
              }
            } catch (error) {
              console.error(`Error parsing table KOTs for ${key}:`, error)
              // If we can't parse it, it's corrupted, remove it
              localStorage.removeItem(key)
            }
          }
        }
      })
    }
    
    cleanupStaleLocks()
    cleanupExpiredTableKOTs()

    // Seed local bill counters from server so bill numbers continue from last bill
    // This runs every time MenuScreen mounts — covers fresh sessions and page refreshes
    const branchRaw = localStorage.getItem('selectedBranch')
    if (branchRaw && navigator.onLine) {
      try {
        const branch = JSON.parse(branchRaw)
        const branchId = branch?._id || branch?.id
        if (branchId) {
          const categories = ['Restaurant', 'Self Service', 'Temple Meals']
          const now = new Date()
          const day = String(now.getDate()).padStart(2, '0')
          const month = String(now.getMonth() + 1).padStart(2, '0')
          const year = String(now.getFullYear()).slice(-2)
          const dateKey = `${day}-${month}-${year}`
          categories.forEach(cat => {
            counterApi.request(
              `/counter-invoice/last-bill-number/${branchId}?category=${encodeURIComponent(cat)}`,
              { _timeout: 5000 }
            ).then(res => {
              if (res?.success && typeof res.lastBillNumber === 'number' && res.lastBillNumber > 0) {
                const key = `unified-bill-counter-${cat}-${dateKey}`
                const localVal = parseInt(localStorage.getItem(key) || '0')
                if (res.lastBillNumber > localVal) {
                  localStorage.setItem(key, String(res.lastBillNumber))
                }
              }
            }).catch(() => {})
          })
        }
      } catch (_) {}
    }
  }, []) // Run only once when component mounts

  // Offline sync: listen for sync completion and track pending count
  useEffect(() => {
    // Store current branch ID in cache so syncManager can refresh after sync
    const branchId = customerData?.selectedBranch?._id
    if (branchId) {
      localCache.setMeta('current_branch_id', branchId).catch(() => {})
    }

    const updatePendingCount = async () => {
      const count = await offlineQueue.countPending()
      setPendingSyncCount(count)
    }
    updatePendingCount()

    // Auto-recovery: on startup, find bills stuck due to false-positive dedup and re-enqueue them
    // Runs silently in background — does not block UI
    if (navigator.onLine && branchId) {
      const recoverStuckBills = async () => {
        try {
          const cachedBills = await localCache._getAll('bills').catch(() => [])
          if (cachedBills.length === 0) return

          const pendingEntries = await offlineQueue.listPending().catch(() => [])
          const pendingInvoiceNums = new Set(
            pendingEntries.filter(e => e.type === 'bill').map(e => e.payload.invoiceNumber).filter(Boolean)
          )

          // Fetch only TODAY's completed bills from server — invoice numbers reset daily,
          // so fetching all-time would cause false positives (yesterday's 001 matches today's 001)
          const now = new Date()
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString()
          const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString()
          const serverRes = await counterApi.getOrders(branchId, {
            limit: 2000,
            includeComplimentary: true,
            startDate: todayStart,
            endDate: todayEnd,
          }).catch(() => null)
          if (!serverRes) return
          const serverOrders = serverRes?.data ?? serverRes?.orders ?? (Array.isArray(serverRes) ? serverRes : [])
          if (!Array.isArray(serverOrders)) return

          const serverCompletedInvoiceNums = new Set(
            serverOrders
              .filter(o => o.paymentStatus === 'completed' || o.orderStatus === 'completed')
              .map(o => o.invoiceNumber)
              .filter(Boolean)
          )

          // Only check bills saved today — older bills with same invoice number are irrelevant
          const todayDateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
          const todayBills = cachedBills.filter(b => {
            if (!b.savedAt) return true // no date info — include to be safe
            const savedDate = new Date(b.savedAt)
            const savedDateStr = `${savedDate.getFullYear()}-${String(savedDate.getMonth()+1).padStart(2,'0')}-${String(savedDate.getDate()).padStart(2,'0')}`
            return savedDateStr === todayDateStr
          })

          let recoveredCount = 0
          for (const bill of todayBills) {
            if (!bill.invoiceNumber) continue
            if (pendingInvoiceNums.has(bill.invoiceNumber)) continue // already queued
            if (serverCompletedInvoiceNums.has(bill.invoiceNumber)) continue // already on server
            // Bill is in localCache but NOT on server as completed — re-enqueue
            const isDup = await offlineQueue.isDuplicate('bill', 'invoiceNumber', bill.invoiceNumber).catch(() => false)
            if (!isDup) {
              await offlineQueue.enqueue('bill', {
                ...bill,
                branchId: bill.branchId || branchId,
                existingOrderIds: bill.existingOrderIds || bill.originalKOTIds || [],
              }).catch(() => {})
              localCache.saveBill({ ...bill, synced: false }).catch(() => {})
              recoveredCount++
              console.log('[MenuScreen] Auto-recovered stuck bill:', bill.invoiceNumber)
            }
          }
          if (recoveredCount > 0) {
            console.log('[MenuScreen] Auto-recovery: re-enqueued', recoveredCount, 'stuck bills — triggering sync')
            syncManager.triggerSync().catch(() => {})
            updatePendingCount()
          }
        } catch (err) {
          console.warn('[MenuScreen] Auto-recovery failed silently:', err?.message)
        }
      }
      // Delay slightly so app finishes loading first
      setTimeout(recoverStuckBills, 3000)
    }

    const handleSyncComplete = () => {
      updatePendingCount()
      // Re-fetch KOT list from backend after sync
      if (branchId) {
        counterApi.request('/counter-order/orders?includeComplimentary=false')
          .then(res => {
            let kots = []
            if (res?.success && Array.isArray(res.orders)) kots = res.orders
            else if (Array.isArray(res?.orders)) kots = res.orders
            else if (Array.isArray(res?.data)) kots = res.data
            else if (Array.isArray(res)) kots = res
            return localCache.saveKOTs(branchId, kots)
          })
          .catch(() => {})
      }
      // Sales report is NOT auto-refreshed on sync — user sees merged local+server data
      // on initial load. Manual refresh (date change or re-open) will show updated data.
    }
    window.addEventListener('offlineSyncComplete', handleSyncComplete)
    return () => window.removeEventListener('offlineSyncComplete', handleSyncComplete)
  }, [])

  // Sales Report state
  const [showSalesReport, setShowSalesReport] = useState(false)
  const [salesData, setSalesData] = useState(null)
  const [salesLoading, setSalesLoading] = useState(false)
  const [selectedSalesDate, setSelectedSalesDate] = useState(() => {
    // Use local date (not UTC) to avoid timezone mismatch — e.g. IST is UTC+5:30
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })
  const [syncingBills, setSyncingBills] = useState(false)

  // Order details modal state
  const [showOrderDetails, setShowOrderDetails] = useState(false)
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null)

  // Cancel order modal state
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [selectedOrderToCancel, setSelectedOrderToCancel] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelledByName, setCancelledByName] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // Pagination state for orders
  const [currentPage, setCurrentPage] = useState(1)
  const [ordersPerPage, setOrdersPerPage] = useState(10) // Show 10 orders per page

  // Complimentary bill modal state
  const [showComplimentaryModal, setShowComplimentaryModal] = useState(false)
  const [selectedOrderForComplimentary, setSelectedOrderForComplimentary] = useState(null)
  const [complimentaryReason, setComplimentaryReason] = useState('')
  const [complimentaryByName, setComplimentaryByName] = useState('')
  const [complimentaryPassword, setComplimentaryPassword] = useState('')
  const [complimentaryError, setComplimentaryError] = useState('')
  const [processingComplimentary, setProcessingComplimentary] = useState(false)

  // Split Bill state
  const [showSplitBillModal, setShowSplitBillModal] = useState(false)
  const [splitBillTableNumber, setSplitBillTableNumber] = useState(null)
  const [splitBillItems, setSplitBillItems] = useState([]) // All items from table KOTs
  const [splitBillSelectedItems, setSplitBillSelectedItems] = useState({}) // { index: true/false }
  const [splitBillKOTData, setSplitBillKOTData] = useState(null) // Store KOT metadata for navigation

  // Split Bill: Open modal to select items for partial billing
  const handleSplitBill = async (tableNumber) => {
    try {
      setKotLoading(true)

      // Fetch all KOTs for this table (same logic as generateComprehensiveBillForTable)
      let kotOrders = []
      const branchId = customerData?.selectedBranch?._id

      // Try cache first
      if (branchId) {
        const cachedKOTs = await localCache.getPendingKOTs(branchId).catch(() => [])
        if (cachedKOTs.length > 0) {
          kotOrders = cachedKOTs
        }
      }

      // If online and cache was empty, try server
      if (kotOrders.length === 0 && navigator.onLine) {
        try {
          const response = await counterApi.request('/counter-order/orders?includeComplimentary=false', { _timeout: 5000 })
          if (response && response.success && Array.isArray(response.orders)) {
            kotOrders = response.orders
          } else if (response && Array.isArray(response.orders)) {
            kotOrders = response.orders
          } else if (response && Array.isArray(response.data)) {
            kotOrders = response.data
          } else if (Array.isArray(response)) {
            kotOrders = response
          }
        } catch (error) {
          console.error('❌ Error fetching orders for split bill:', error)
        }
      }

      // Final fallback to cache
      if (kotOrders.length === 0 && branchId) {
        kotOrders = await localCache.getPendingKOTs(branchId).catch(() => [])
      }

      // Filter KOTs for this table
      const tablePendingKOTs = kotOrders.filter(order =>
        order.paymentStatus === 'pending' &&
        String(order.tableNumber).toLowerCase() === String(tableNumber).toLowerCase()
      )

      if (tablePendingKOTs.length === 0) {
        setKotLoading(false)
        alert('No pending orders found for this table.')
        return
      }

      // Collect all items with KOT reference
      const allItems = []
      const kotNumbers = []
      tablePendingKOTs.forEach((kot) => {
        const kotNum = kot.kotNumber || kot.invoiceNumber || 'Unknown'
        kotNumbers.push(kotNum)
        if (kot.items && Array.isArray(kot.items)) {
          kot.items.forEach((item) => {
            allItems.push({
              name: item.name,
              price: item.price || 0,
              quantity: item.quantity || 1,
              gstRate: item.gstRate || 0,
              _id: item.menuItemId || item._id || item.id,
              kotId: kot.id || kot._id,
              kotNumber: kotNum,
              serverName: kot.serverName || null
            })
          })
        }
      })

      if (allItems.length === 0) {
        setKotLoading(false)
        alert('No items found in the pending orders for this table.')
        return
      }

      // Enrich items with gstRate from menu database (same as comprehensive bill flow)
      try {
        const branchIdForMenu = customerData?.selectedBranch?._id
        if (branchIdForMenu) {
          const menuResp = await counterApi.getMenuItems(branchIdForMenu, null, { limit: 500 })
          const menuList = menuResp?.data || menuResp || []

          // Create lookup maps
          const menuById = {}
          const menuByName = {}
          menuList.forEach(m => {
            if (m._id) menuById[m._id] = m
            const key = (m.name || m.itemName || '').toLowerCase().trim()
            if (key) menuByName[key] = m
          })

          // Enrich each item with gstRate
          for (let i = 0; i < allItems.length; i++) {
            const item = allItems[i]
            if (item.gstRate && item.gstRate > 0) continue // Already has GST

            const rawName = (item.name || '').toLowerCase().trim()
            const cleanName = rawName.replace(/^\d+\s+/, '')

            const matched = menuById[item._id]
              || menuByName[rawName]
              || menuByName[cleanName]
              || menuList.find(m => {
                  const mRaw = (m.name || m.itemName || '').toLowerCase().trim()
                  const mClean = mRaw.replace(/^\d+\s+/, '')
                  return mClean === cleanName || mRaw === rawName || mRaw.endsWith(cleanName) || cleanName.endsWith(mClean)
                })

            if (matched?.gstRate) {
              allItems[i] = { ...item, gstRate: matched.gstRate }
            }
          }
        }
      } catch (e) {
        console.warn('⚠️ Split bill: Failed to enrich with GST rates:', e.message)
      }

      // Store data for the modal
      setSplitBillTableNumber(tableNumber)
      setSplitBillItems(allItems)
      setSplitBillSelectedItems({}) // Reset selection
      setSplitBillKOTData({
        tablePendingKOTs,
        kotNumbers,
        firstKOT: tablePendingKOTs[0]
      })
      setShowSplitBillModal(true)
      setKotLoading(false)
      setShowKOTList(false)
      setShowKOTDetailView(false)

    } catch (error) {
      console.error('❌ Error opening split bill:', error)
      setKotLoading(false)
      alert('Failed to load items for split bill.')
    }
  }

  // Split Bill: Generate bill for selected items only
  const handleSplitBillGenerate = () => {
    const selectedIndexes = Object.keys(splitBillSelectedItems).filter(k => splitBillSelectedItems[k])
    
    if (selectedIndexes.length === 0) {
      alert('Please select at least one item for the bill.')
      return
    }

    const selectedItems = selectedIndexes.map(i => splitBillItems[parseInt(i)])
    const remainingItems = splitBillItems.filter((_, i) => !splitBillSelectedItems[i])
    const totalAmount = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)

    // Determine category
    let finalSelectedCategory = customerData?.selectedCategory
    if (!finalSelectedCategory || !finalSelectedCategory.name) {
      finalSelectedCategory = { name: preSelectedCategory || 'Restaurant', _id: null }
    }

    const { tablePendingKOTs, kotNumbers, firstKOT } = splitBillKOTData

    // Determine which KOTs are fully consumed vs partially consumed
    // A KOT is "fully consumed" if ALL its items are in the selected list
    const kotItemCounts = {} // kotId -> { total: X, selected: Y }
    splitBillItems.forEach((item, i) => {
      const kotId = item.kotId
      if (!kotItemCounts[kotId]) {
        kotItemCounts[kotId] = { total: 0, selected: 0 }
      }
      kotItemCounts[kotId].total++
      if (splitBillSelectedItems[i]) {
        kotItemCounts[kotId].selected++
      }
    })

    // KOTs where ALL items are selected → mark as consolidated
    const fullyConsumedKOTIds = Object.keys(kotItemCounts).filter(
      kotId => kotItemCounts[kotId].selected === kotItemCounts[kotId].total
    )

    // KOTs where only SOME items are selected → need to update with remaining items
    const partiallyConsumedKOTs = Object.keys(kotItemCounts)
      .filter(kotId => kotItemCounts[kotId].selected > 0 && kotItemCounts[kotId].selected < kotItemCounts[kotId].total)
      .map(kotId => {
        // Get remaining items for this KOT
        const kotRemainingItems = remainingItems.filter(item => item.kotId === kotId)
        return {
          kotId,
          remainingItems: kotRemainingItems.map(item => ({
            menuItemId: item._id || '507f1f77bcf86cd799439013',
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            gstRate: item.gstRate || 0
          }))
        }
      })

    // If ALL items are selected, just behave like "Complete Bill" (no split needed)
    const isFullBill = remainingItems.length === 0

    // Navigate to BillGeneration with only selected items
    const navigationState = {
      ...customerData,
      selectedCategory: finalSelectedCategory,
      selectedTable: {
        _id: firstKOT.tableId,
        id: firstKOT.tableId,
        tableNumber: splitBillTableNumber,
        number: splitBillTableNumber,
        status: 'reserved'
      },
      serverName: firstKOT.serverName || null,
      cartItems: selectedItems,
      totalAmount: totalAmount,
      isKOTOrder: true,
      isComprehensiveBill: true,
      isSplitBill: !isFullBill, // Only true if there are remaining items on table
      kotNumbers: [...new Set(selectedItems.map(item => item.kotNumber))],
      kotSaved: true,
      // Only pass fully consumed KOT IDs for consolidation
      existingOrderIds: isFullBill 
        ? [...new Set(tablePendingKOTs.map(kot => kot.id || kot._id))]
        : fullyConsumedKOTIds,
      // Pass partially consumed KOTs info so BillGeneration can update them
      partiallyConsumedKOTs: isFullBill ? [] : partiallyConsumedKOTs,
      customerName: firstKOT.customerName || "Walk-in Customer",
      phoneNumber: firstKOT.phoneNumber || "0000000000",
      date: new Date().toLocaleDateString('en-IN'),
      time: new Date().toLocaleTimeString('en-IN', { hour12: true }),
      // Store remaining items info so we know what stays on the table
      remainingItems: remainingItems
    }

    setShowSplitBillModal(false)
    setIsNavigatingToBill(true)
    sessionStorage.setItem('isNavigatingToBill', 'true')

    navigate("/counter/bill-generation", { state: navigationState })
  }

  // NEW: Function to collect all pending KOTs for a table and generate comprehensive bill
  // FIXED: Updated to use proper unified bill/invoice numbering with loading indicator
  const generateComprehensiveBillForTable = async (tableNumber) => {
    try {
      // console.log("📄 Generating comprehensive bill for table:", tableNumber)

      // CRITICAL FIX: Prevent multiple simultaneous calls
      if (isNavigatingToBill) {
        // console.log('⚠️ Already navigating to bill generation, ignoring duplicate call');
        return;
      }
      setIsNavigatingToBill(true);

      // Show loading indicator
      setKotLoading(true);

      // Close the modal immediately
      setShowKOTList(false);
      setShowKOTDetailView(false);

      // CRITICAL FIX: Check if user is currently editing a KOT for this table
      if (editingKOT && editingKOT.tableNumber === tableNumber) {
        const shouldSave = confirm('You have unsaved changes to a KOT for this table. Do you want to save the changes before generating the bill?')
        if (shouldSave) {
          // Save the changes first
          await saveKOTModifications(false)
          // Add extra delay to ensure database is updated
          await new Promise(resolve => setTimeout(resolve, 1500))
        } else {
          // Cancel the edit and proceed with bill generation
          setEditingKOT(null)
          setModifiedItems([])
        }
      }

      // CRITICAL FIX: Ensure any pending KOT edits are saved before generating bill
      // Only delay if we actually saved KOT modifications above
      // (delay already added in saveKOTModifications path above)

      // CRITICAL FIX: Fetch fresh data from database with retry logic
      let kotOrders = []
      let retryCount = 0
      const maxRetries = 2

      // ── OFFLINE-FIRST: load KOTs from cache when offline or server unavailable ──
      const branchId = customerData?.selectedBranch?._id

      // Try cache first for instant response
      if (branchId) {
        const cachedKOTs = await localCache.getPendingKOTs(branchId).catch(() => [])
        if (cachedKOTs.length > 0) {
          kotOrders = cachedKOTs
          console.log('[MenuScreen] Loaded', kotOrders.length, 'KOTs from cache (fast path)')
        }
      }

      // If online and cache was empty, try server
      if (kotOrders.length === 0 && navigator.onLine) {
        while (retryCount < maxRetries) {
          try {
            const response = await counterApi.request('/counter-order/orders?includeComplimentary=false', { _timeout: 5000 })

            if (response && response.success && Array.isArray(response.orders)) {
              kotOrders = response.orders
            } else if (response && Array.isArray(response.orders)) {
              kotOrders = response.orders
            } else if (response && Array.isArray(response.data)) {
              kotOrders = response.data
            } else if (Array.isArray(response)) {
              kotOrders = response
            }

            if (kotOrders.length > 0) {
              if (branchId) localCache.saveKOTs(branchId, kotOrders).catch(() => {})
              break
            }

            retryCount++
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 300))
            }
          } catch (error) {
            console.error(`❌ Error fetching orders (attempt ${retryCount + 1}):`, error)
            retryCount++
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 300))
            }
          }
        }
      }

      // Final fallback to cache if server failed
      if (kotOrders.length === 0 && branchId) {
        kotOrders = await localCache.getPendingKOTs(branchId).catch(() => [])
        if (kotOrders.length > 0) {
          console.log('[MenuScreen] Server unavailable — loaded', kotOrders.length, 'KOTs from cache')
        }
      } else if (kotOrders.length > 0 && branchId) {
        // Merge offline-only KOTs that server doesn't know about yet
        try {
          const cachedKOTs = await localCache.getPendingKOTs(branchId)
          const offlineOnly = cachedKOTs.filter(k => k.isOffline && !kotOrders.find(o => (o._id || o.id) === (k._id || k.id)))
          if (offlineOnly.length > 0) {
            kotOrders = [...kotOrders, ...offlineOnly]
          }
        } catch (_) {}
      }

      // Find ALL pending KOTs for this table
      const tablePendingKOTs = kotOrders.filter(order => {
        return order.paymentStatus === 'pending' &&
          String(order.tableNumber).toLowerCase() === String(tableNumber).toLowerCase()
      })

      // console.log(`🔍 Found ${tablePendingKOTs.length} pending KOTs for table ${tableNumber}`)

      if (tablePendingKOTs.length === 0) {
        // console.log('⚠️ No pending KOTs found for this table')
        setKotLoading(false);
        alert('No pending orders found for this table.')
        sessionStorage.removeItem('isNavigatingToBill');
        setIsNavigatingToBill(false);
        return
      }

      // Show verification message
      // console.log('🔍 Verifying KOT data...')

      // Combine all items from all KOTs
      const allItems = []
      const kotNumbers = []
      let totalAmount = 0
      let firstKOT = tablePendingKOTs[0] // Use first KOT for customer info

      // console.log('🔍 COMPREHENSIVE BILL DEBUG - Starting KOT aggregation')
      // console.log(`� Total KOTs to process: ${tablePendingKOTs.length}`)

      tablePendingKOTs.forEach((kot, kotIndex) => {
        // console.log(`\n📋 Processing KOT ${kotIndex + 1}/${tablePendingKOTs.length}:`, {
        //   kotNumber: kot.kotNumber,
        //   kotId: kot.id || kot._id,
        //   itemsCount: kot.items?.length || 0,
        //   totalAmount: kot.totalAmount || kot.grandTotal || 0
        // })
        
        kotNumbers.push(kot.kotNumber)
        totalAmount += kot.totalAmount || kot.grandTotal || 0

        // CRITICAL FIX: Validate items array exists and is not empty
        if (!kot.items || !Array.isArray(kot.items)) {
          console.error(`❌ KOT ${kot.kotNumber} has no items array!`, kot)
          return
        }

        if (kot.items.length === 0) {
          console.warn(`⚠️ KOT ${kot.kotNumber} has empty items array`)
          return
        }

        // Add items from this KOT
        kot.items.forEach((item, itemIndex) => {
          // console.log(`  📦 Item ${itemIndex + 1}/${kot.items.length}:`, {
          //   name: item.name,
          //   quantity: item.quantity,
          //   price: item.price,
          //   menuItemId: item.menuItemId || item._id
          // })
          
          // CRITICAL FIX: More robust quantity validation
          const itemQuantity = parseInt(item.quantity)
          
          // Validate quantity is a valid number
          if (isNaN(itemQuantity)) {
            console.error(`  ❌ Invalid quantity for item ${item.name}: ${item.quantity}`)
            return
          }
          
          // Skip items with zero or negative quantity (cancelled items)
          if (itemQuantity <= 0) {
            // console.log(`  ⏭️ Skipping item with zero/negative quantity: ${item.name}`)
            return
          }

          // CRITICAL FIX: Validate item has required fields
          if (!item.name || !item.price) {
            console.error(`  ❌ Item missing required fields:`, item)
            return
          }

          // Check if item already exists in allItems (same name AND same price)
          // Using both name and price for matching to handle items with same name but different prices
          const existingItemIndex = allItems.findIndex(existing => 
            existing.name === item.name && existing.price === parseFloat(item.price)
          )

          if (existingItemIndex >= 0) {
            // Item exists, add quantities
            const previousQty = allItems[existingItemIndex].quantity
            allItems[existingItemIndex].quantity += itemQuantity
            // console.log(`  ➕ Combined item: ${item.name}, Previous: ${previousQty}, Added: ${itemQuantity}, Total: ${allItems[existingItemIndex].quantity}`)
          } else {
            // New item, add to list
            const newItem = {
              _id: item.menuItemId || item._id,
              name: item.name,
              price: parseFloat(item.price) || 0,
              quantity: itemQuantity,
              gstRate: item.gstRate || 0  // CRITICAL: Include gstRate from KOT item
            }
            allItems.push(newItem)
            // console.log(`  ✨ New item added:`, newItem)
          }
        })

        // console.log(`✅ Finished processing KOT ${kot.kotNumber}. Current total items: ${allItems.length}`)
      })

      // console.log('\n📊 AGGREGATION SUMMARY:')
      // console.log(`  Total KOTs processed: ${tablePendingKOTs.length}`)
      // console.log(`  Total unique items: ${allItems.length}`)
      // console.log(`  Total amount: ₹${totalAmount}`)
      // console.log('  Items breakdown:')
      // allItems.forEach((item, idx) => {
      //   console.log(`    ${idx + 1}. ${item.name} - Qty: ${item.quantity}, Price: ₹${item.price}, Total: ₹${item.quantity * item.price}`)
      // })

      // console.log(`📊 Total items before filtering: ${allItems.length}`)
      
      // CRITICAL FIX: Validate each item before filtering
      // console.log('\n🔍 VALIDATION CHECK - Inspecting all items:')
      // allItems.forEach((item, idx) => {
      //   console.log(`  Item ${idx + 1}:`, {
      //     name: item.name,
      //     quantity: item.quantity,
      //     price: item.price,
      //     isValid: item.quantity > 0 && item.name && item.price >= 0
      //   })
      // })
      
      // Filter out any items with zero or negative quantity after combining
      let validItems = allItems.filter(item => {
        const isValid = item.quantity > 0 && item.name && item.price >= 0
        // if (!isValid) {
        //   console.log(`  ❌ Filtering out invalid item:`, {
        //     name: item.name,
        //     quantity: item.quantity,
        //     price: item.price,
        //     reason: !item.name ? 'missing name' : 
        //             item.price < 0 ? 'negative price' : 
        //             'invalid quantity'
        //   })
        // }
        return isValid
      })

      // console.log(`\n✅ Valid items after filtering: ${validItems.length}`)
      
      // CRITICAL FIX: Verify we have items before proceeding
      if (validItems.length === 0) {
        console.error('❌ CRITICAL ERROR: No valid items found after filtering!')
        console.error('❌ Original KOTs data:', tablePendingKOTs.map(kot => ({
          kotNumber: kot.kotNumber,
          items: kot.items
        })))
        setKotLoading(false);
        alert('No items found in the KOT orders. Please check the orders and try again.')
        sessionStorage.removeItem('isNavigatingToBill');
        setIsNavigatingToBill(false);
        return
      }

      // CRITICAL FIX: Verify total matches sum of items
      const calculatedTotal = validItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      // console.log('\n💰 AMOUNT VERIFICATION:')
      // console.log(`  Sum from KOTs: ₹${totalAmount}`)
      // console.log(`  Calculated from items: ₹${calculatedTotal}`)
      if (Math.abs(totalAmount - calculatedTotal) > 1) {
        // console.warn(`⚠️ Amount mismatch detected! Difference: ₹${Math.abs(totalAmount - calculatedTotal)}`)
        // console.warn('⚠️ Using calculated total from items for accuracy')
        totalAmount = calculatedTotal
      }

      // Verification complete - show success message
      console.log('✅ Data verification complete. Proceeding to bill generation...')
      
      // CRITICAL: Enrich items with gstRate from menu database
      console.log('🔍 Enriching items with GST rates from menu...')
      try {
        const menuResp = await counterApi.getMenuItems(
          customerData.selectedBranch._id,
          null,
          { limit: 500 }
        )
        const menuList = menuResp?.data || menuResp || []
        
        // Create lookup maps
        const menuById = {}
        const menuByName = {}
        menuList.forEach(m => {
          if (m._id) menuById[m._id] = m
          const key = (m.name || m.itemName || '').toLowerCase().trim()
          if (key) menuByName[key] = m
        })
        
        // Enrich each item with gstRate
        validItems = validItems.map(item => {
          // Skip if already has gstRate
          if (item.gstRate && item.gstRate > 0) return item
          
          const rawName = (item.name || '').toLowerCase().trim()
          const cleanName = rawName.replace(/^\d+\s+/, '') // Remove number prefix
          
          // Try to find matching menu item
          const matched = menuById[item._id] 
            || menuById[item.menuItemId]
            || menuByName[rawName]
            || menuByName[cleanName]
            || menuList.find(m => {
                const mRaw = (m.name || m.itemName || '').toLowerCase().trim()
                const mClean = mRaw.replace(/^\d+\s+/, '')
                return mClean === cleanName || mRaw === rawName || mRaw.endsWith(cleanName) || cleanName.endsWith(mClean)
              })
          
          const enrichedItem = { ...item, gstRate: matched?.gstRate || 0 }
          console.log(`  ✓ ${item.name}: gstRate = ${enrichedItem.gstRate}`)
          return enrichedItem
        })
        
        console.log('✅ GST enrichment complete')
      } catch (e) {
        console.warn('⚠️ Failed to enrich with GST rates:', e.message)
        // Continue anyway with gstRate = 0
      }
      
      // Add a small delay to show the verification was successful
      await new Promise(resolve => setTimeout(resolve, 300))

      // Don't generate bill number here - BillGeneration page will handle it when order is actually completed
      let billNumber = null // Will be generated in BillGeneration page

      // CRITICAL FIX: Ensure correct category for comprehensive bills
      let finalSelectedCategory = customerData?.selectedCategory

      if (!finalSelectedCategory || !finalSelectedCategory.name) {
        if (preSelectedCategory) {
          finalSelectedCategory = {
            name: preSelectedCategory,
            _id: null
          }
        } else {
          // Auto-detect based on table presence
          finalSelectedCategory = {
            name: 'Restaurant', // Comprehensive bills are typically for restaurant orders with tables
            _id: null
          }
        }
      }

      // Prepare navigation state for BillGeneration page
      const navigationState = {
        ...customerData,
        selectedCategory: finalSelectedCategory,
        selectedTable: {
          _id: firstKOT.tableId,
          id: firstKOT.tableId,
          tableNumber: tableNumber,
          number: tableNumber,
          status: 'reserved'
        },
        serverName: firstKOT.serverName || null, // Transfer server name from KOT to bill
        cartItems: validItems,
        totalAmount: totalAmount,
        isKOTOrder: true,
        isComprehensiveBill: true,
        kotNumbers: kotNumbers,
        kotSaved: true,
        existingOrderIds: [...new Set(tablePendingKOTs.map(kot => kot.id || kot._id))], // CRITICAL FIX: Remove duplicates with Set
        customerName: firstKOT.customerName || "Walk-in Customer",
        phoneNumber: firstKOT.phoneNumber || "0000000000",
        date: new Date().toLocaleDateString('en-IN'),
        time: new Date().toLocaleTimeString('en-IN', { hour12: true })
      };

      // console.log('\n� FINAL NAVIGATION STATE:')
      // console.log('📋 KOT Numbers:', navigationState.kotNumbers)
      // console.log('📦 Cart Items:', navigationState.cartItems.length)
      // console.log('💰 Total Amount:', navigationState.totalAmount)
      // console.log('🔍 Detailed Cart Items:')
      navigationState.cartItems.forEach((item, idx) => {
        console.log(`  ${idx + 1}. ${item.name} - Qty: ${item.quantity}, Price: ₹${item.price}, Subtotal: ₹${item.quantity * item.price}`)
      })
      
      // CRITICAL FIX: Final validation before navigation
      const finalItemCount = navigationState.cartItems.length
      const finalTotalQty = navigationState.cartItems.reduce((sum, item) => sum + item.quantity, 0)
      const finalCalculatedAmount = navigationState.cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
      
      // console.log('\n✅ FINAL VALIDATION:')
      // console.log(`  ✓ Unique items: ${finalItemCount}`)
      // console.log(`  ✓ Total quantity: ${finalTotalQty}`)
      // console.log(`  ✓ Calculated amount: ₹${finalCalculatedAmount}`)
      // console.log(`  ✓ Navigation amount: ₹${navigationState.totalAmount}`)
      
      if (finalItemCount === 0 || finalTotalQty === 0) {
        console.error('❌ CRITICAL: Final validation failed - no items or zero quantity!')
        setKotLoading(false);
        alert('Error: No valid items to generate bill. Please try again.')
        sessionStorage.removeItem('isNavigatingToBill');
        setIsNavigatingToBill(false);
        return
      }

      // Hide loading indicator before navigation
      setKotLoading(false);

      // Use React Router navigate with state (proper way)
      navigate('/counter/bill-generation', { state: navigationState });

      // Clear the navigation flag after navigation
      setTimeout(() => {
        sessionStorage.removeItem('isNavigatingToBill');
        setIsNavigatingToBill(false);
      }, 1000);

    } catch (error) {
      console.error('❌ Error generating comprehensive bill:', error)
      setKotLoading(false);
      alert('Failed to generate comprehensive bill. Please try again.')
      setIsNavigatingToBill(false);
      sessionStorage.removeItem('isNavigatingToBill');
    }
  }

  // Helper function to scroll focused card into view
  const scrollToFocusedCard = (cardIndex) => {
    const cardElement = document.querySelector(`[data-kot-index="${cardIndex}"]`)
    if (cardElement) {
      cardElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      })
    }
  }

  // Quantity popup state
  const [showQuantityPopup, setShowQuantityPopup] = useState(false)
  const [selectedMenuItem, setSelectedMenuItem] = useState(null)
  const [quantityInput, setQuantityInput] = useState("1")
  const [remarkInput, setRemarkInput] = useState("")
  const [serverName, setServerName] = useState("") // Server/Waiter name for KOT
  const [serverList, setServerList] = useState([]) // Dynamic server/waiter list from backend

  // Ref for quantity input in popup
  const quantityInputRef = useRef(null)

  // Table input state
  const [tableInput, setTableInput] = useState("")
  const tableInputRef = useRef(null)
  const searchInputRef = useRef(null)
  const kotSearchInputRef = useRef(null) // Add ref for KOT search input

  useEffect(() => {
    if (!customerData) {
      navigate("/counter/branch-selection")
      return
    }

    // CRITICAL: Ensure category is stored in localStorage when page loads
    if (customerData?.selectedCategory?.name && !localStorage.getItem('selectedCategoryName')) {
      localStorage.setItem('selectedCategory', JSON.stringify(customerData.selectedCategory))
      localStorage.setItem('selectedCategoryName', customerData.selectedCategory.name)
    }

    // Load all menu data once on page load
    // console.log('🚀 Loading all menu items for fast searching...')
    loadMenuData()

    // Always load tables for restaurant category, regardless of selectedTable state
    if (isRestaurantCategory) {
      loadTables()
      loadServerList() // Fetch dynamic server/waiter names

      // REMOVED: Auto-refresh interval to prevent unnecessary API calls
      // Tables will refresh only when needed (after bill print, navigation, etc.)
    }

    // Check if we need to refresh tables after bill printing
    const shouldRefreshTables = localStorage.getItem('refreshTablesAfterBill')
    if (shouldRefreshTables === 'true') {
      localStorage.removeItem('refreshTablesAfterBill') // Clear the flag
      // Delay the refresh slightly to ensure the backend has processed the update
      setTimeout(() => {
        loadTables()
      }, 500)
    }

    // Check if navigation state includes refresh flag
    if (location.state?.refreshTables) {
      setTimeout(() => {
        loadTables()
      }, 200)
    }

    // Check if navigation state includes KOT refresh flag
    if (location.state?.refreshKOTs) {
      // Use a longer delay to ensure all database operations are complete
      setTimeout(() => {
        loadSavedKOTs()
      }, 2000) // Increased delay to 2 seconds to ensure all updates are processed

      // Also set up a secondary refresh after a longer delay as backup
      setTimeout(() => {
        loadSavedKOTs()
      }, 5000) // 5 second backup refresh
    }
  }, [customerData, navigate, preSelectedCategory, location.state]) // Added location.state to dependencies

  // Auto-focus table input when tables are loaded (only once)
  useEffect(() => {
    if (!selectedTable && tables.length > 0 && tableInputRef.current) {
      // Focus on table input when tables are available and no table is selected
      setTimeout(() => {
        tableInputRef.current?.focus()
      }, 100)
    }
  }, [selectedTable, tables.length]) // Use tables.length instead of tables array to prevent re-focus on table updates

  // Auto-focus search input when table is selected (only once when table changes)
  useEffect(() => {
    // Don't auto-focus if user is already typing in the search input
    const isSearchInputFocused = document.activeElement === searchInputRef.current

    if (selectedTable && searchInputRef.current && !isSearchInputFocused) {
      const focusSearchInput = () => {
        // Double-check user isn't typing before focusing
        if (document.activeElement !== searchInputRef.current && searchInputRef.current) {
          searchInputRef.current.focus()
          return true
        }

        return false
      }

      // Only focus once when table is selected
      setTimeout(() => focusSearchInput(), 100)
    }
  }, [selectedTable?.number]) // Only re-run when table number changes, not on every render

  // Auto-focus search input for categories that don't require table selection (only on initial load)
  useEffect(() => {
    // Don't auto-focus if user is already typing in the search input
    const isSearchInputFocused = document.activeElement === searchInputRef.current

    if (preSelectedCategory && !hasInitialFocus && !isSearchInputFocused) {
      // If NOT restaurant category, focus on search input immediately (self-service mode)
      if (!isRestaurantCategory) {
        const focusSearch = () => {
          // Double-check user isn't typing before focusing
          if (document.activeElement !== searchInputRef.current) {
            if (searchInputRef.current) {
              searchInputRef.current.focus()
              setHasInitialFocus(true)
              return true
            }

            const searchInput = document.querySelector('input[placeholder*="Search by name"]')
            if (searchInput) {
              searchInput.focus()
              setHasInitialFocus(true)
              return true
            }
          }

          return false
        }

        // Try a few times to ensure DOM is ready
        setTimeout(() => focusSearch(), 100)
        setTimeout(() => focusSearch(), 300)
      }
    }
  }, [preSelectedCategory, hasInitialFocus]) // Removed allMenuItems.length to prevent re-focus on data load

  // Additional focus attempt after loading completes (only on initial load)
  useEffect(() => {
    // Don't auto-focus if user is already typing in the search input
    const isSearchInputFocused = document.activeElement === searchInputRef.current

    if (!loading && isInitialLoad && preSelectedCategory && !hasInitialFocus && !isSearchInputFocused) {
      // If NOT restaurant category, focus on search input after loading
      if (!isRestaurantCategory && searchInputRef.current) {
        setTimeout(() => {
          // Final check before focusing
          if (document.activeElement !== searchInputRef.current && searchInputRef.current) {
            searchInputRef.current.focus()
            setHasInitialFocus(true)
            setIsInitialLoad(false) // Mark initial load as complete
          }
        }, 200)
      } else if (isRestaurantCategory) {
        // For restaurant category, just mark initial load as complete
        setIsInitialLoad(false)
      }
    }
  }, [loading, preSelectedCategory, hasInitialFocus, isInitialLoad, isRestaurantCategory]) // Only focus on initial load completion

  const loadMenuData = async (options = {}) => {
    const branchId = customerData?.selectedBranch?._id
    try {
      setLoading(true)
      setError(null)

      const pageToLoad = options.page || 1

      // ── CACHE-FIRST: always serve from cache immediately, then refresh in background ──
      if (branchId) {
        const cachedItems = await localCache.getMenuItems(branchId)
        if (cachedItems.length > 0) {
          setAllMenuItems(cachedItems)
          setMenuItems([])
          setLoading(false)
          if (isInitialLoad) setIsInitialLoad(false)
          // If offline, stop here — cache is the source of truth
          if (!navigator.onLine) return
          // If online, continue to refresh cache in background (don't block UI)
        }
      }

      // Get stored category from localStorage
      const storedCategoryName = getStoredCategory()
      // console.log('📦 Stored category from localStorage:', storedCategoryName)
      // console.log('📦 preSelectedCategory:', preSelectedCategory)

      // Build options for API call
      const apiOptions = {
        page: pageToLoad,
        limit: options.limit || 10000, // Load 10000 items per page
        sortBy: options.sortBy || 'name',
        sortOrder: options.sortOrder || 'asc',
        // Don't filter by isActive - show all items like Products page
      }

      // Add search query if provided (BACKEND SEARCH - same as Products page)
      if (options.search && options.search.trim() !== '' && options.search !== '000') {
        apiOptions.search = options.search.trim()
        // console.log('🔍 Backend search query:', apiOptions.search)
      }

      // First, fetch categories to get the category ID
      const categoriesResponse = await counterApi.getCategories(customerData.selectedBranch._id)

      // Process categories (for internal use only, tabs removed)
      const categoryList = ["All"]
      let categoryIdToFilter = null  // Always fetch all items — no category filter

      if (categoriesResponse) {
        const cats = categoriesResponse.categories || categoriesResponse
        if (Array.isArray(cats) && cats.length > 0) {
          cats.forEach((cat) => {
            const categoryName = cat.name || cat.categoryName || cat.title
            if (categoryName && !categoryList.includes(categoryName)) {
              categoryList.push(categoryName)
            }
            // Category ID filtering removed — fetch all items
          })
        }
      }

      // Always fetch all items — no categoryId filter applied

      // Fetch menu items with category filter
      const menuResponse = await counterApi.getMenuItems(
        customerData.selectedBranch._id,
        categoryIdToFilter, // Pass categoryId directly
        apiOptions
      )
      // Process menu items - handle new response format
      let menuArray = []
      let paginationInfo = null

      if (menuResponse) {
        // Handle new paginated response format
        if (menuResponse.success && menuResponse.data) {
          menuArray = menuResponse.data
          paginationInfo = menuResponse.pagination
        } else if (menuResponse.menu || menuResponse.menuItems) {
          // Fallback to old format
          const items = menuResponse.menu || menuResponse.menuItems || menuResponse.data || menuResponse

          if (Array.isArray(items)) {
            menuArray = items
          }
        } else if (Array.isArray(menuResponse)) {
          menuArray = menuResponse
        }

        // Process menu items
        if (Array.isArray(menuArray)) {
          menuArray = menuArray.map((item) => {
            // Handle price
            let itemPrice = 0
            if (item.price !== undefined && item.price !== null) {
              itemPrice = item.price
            } else if (item.prices && typeof item.prices === 'object') {
              const priceValues = Object.values(item.prices)
              if (priceValues.length > 0) {
                itemPrice = priceValues[0]
              }
            }
            itemPrice = Number(itemPrice) || 0

            // Handle image URL - use same logic as Products page
            let imageUrl = getImageUrl(item.image);

            return {
              ...item,
              _id: item._id || item.id,
              name: item.name || item.itemName || item.title,
              price: itemPrice,
              description: item.description || item.desc || "",
              image: imageUrl,
              categoryId: item.categoryId || item.category || null,
              menuItemNumber: item.menuItemNumber || item.number || null,
            }
          })
        }
      }

      // Update pagination state
      if (paginationInfo) {
        setMenuCurrentPage(paginationInfo.currentPage || 1)
        setMenuTotalPages(paginationInfo.totalPages || 1)
        setMenuTotalItems(paginationInfo.totalItems || menuArray.length)
        setHasMoreItems(paginationInfo.hasNextPage || false)
        // console.log('📄 Menu pagination:', paginationInfo)
      } else {
        // No pagination info, all items loaded
        setMenuCurrentPage(1)
        setMenuTotalPages(1)
        setMenuTotalItems(menuArray.length)
        setHasMoreItems(false)
        // console.log('📄 All menu items loaded:', menuArray.length, 'items')
      }

      setCategories(categoryList)

      // Store all items for local searching
      setAllMenuItems(menuArray)
      // Save to local cache for offline use
      if (branchId && menuArray.length > 0) {
        localCache.saveMenuItems(branchId, menuArray).catch(() => {})
      }
      // Never show items directly from API — search always uses client-side filter
      setMenuItems([])

      // Mark initial load as complete after first successful load
      if (isInitialLoad) {
        setIsInitialLoad(false)
      }
    } catch (error) {
      console.error("Error loading menu data:", error)
      // Cache-first already served data at the top — just ensure allMenuItems is populated
      if (branchId) {
        const cachedItems = await localCache.getMenuItems(branchId).catch(() => [])
        if (cachedItems.length > 0) {
          setAllMenuItems(cachedItems)
          setMenuItems([])
          if (isInitialLoad) setIsInitialLoad(false)
          return
        }
      }
      if (error.message?.includes('Rate limit')) {
        setError("Too many requests. Please wait a moment and refresh the page.")
      } else if (!navigator.onLine) {
        // Silently ignore — already served from cache
      } else {
        setError("Failed to load menu data. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }

  // Fetch server/waiter list from backend
  const loadServerList = async () => {
    try {
      const branchId = customerData?.selectedBranch?._id
      if (!branchId) return
      const response = await counterApi.request(`/servers?branchId=${branchId}`)
      if (response && response.success && Array.isArray(response.servers)) {
        setServerList(response.servers)
      }
    } catch (error) {
      console.warn('⚠️ Failed to load server list:', error.message)
      // Fallback: keep empty list, user can still type in the input
    }
  }

  const loadTables = async () => {
    const branchId = customerData?.selectedBranch?._id
    try {
      setTablesLoading(true)

      // ── CACHE-FIRST: serve tables from cache immediately, refresh in background ──
      if (branchId) {
        const cachedTables = await localCache.getTables(branchId)
        if (cachedTables.length > 0) {
          setTables(cachedTables)
          setTablesLoading(false)
          if (!navigator.onLine) return // offline — cache is source of truth
          // online — continue to refresh cache in background
        }
      }

      // Fetch tables for the selected branch from admin panel API (SAME AS Tables.jsx)
      const tablesResponse = await counterApi.request(`/table?branchId=${customerData.selectedBranch._id}`)

      let tableList = []
      if (tablesResponse) {
        // Handle new API response format {success, count, data} or direct array
        let tablesData = []
        if (tablesResponse.success && Array.isArray(tablesResponse.data)) {
          tablesData = tablesResponse.data
        } else if (Array.isArray(tablesResponse.tables)) {
          tablesData = tablesResponse.tables
        } else if (Array.isArray(tablesResponse)) {
          tablesData = tablesResponse
        }

        if (Array.isArray(tablesData)) {
          // Show ALL tables (not just available ones)
          // Users can select any table, and will be prompted if it's not available
          tableList = tablesData
            .map(table => ({
              _id: table._id || table.id,
              number: table.number || table.tableNumber,
              tableNumber: table.number || table.tableNumber,
              capacity: table.capacity || 4,
              status: table.status || 'available',
              categoryId: table.categoryId?._id || table.categoryId || null,
              categoryName: table.categoryId?.name || table.categoryName || 'All Categories',
              branchId: table.branchId?._id || table.branchId,
              branchName: table.branchId?.name || customerData.selectedBranch.name,
              image: table.image || null
            }))
        }
      }

      // Filter tables by category if a specific category is selected
      if (preSelectedCategory && preSelectedCategory !== "All") {
        const categoryName = preSelectedCategory.toLowerCase()

        // For restaurant category, show all tables or category-specific tables
        if (categoryName.includes('restaurant')) {
          // Show tables that either have no category (All Categories) or match the selected category
          tableList = tableList.filter(table => {
            const tableCategoryName = (table.categoryName || '').toLowerCase()
            return tableCategoryName === 'all categories' ||
              tableCategoryName.includes(categoryName) ||
              tableCategoryName === '' ||
              !table.categoryId // Tables without specific category assignment
          })
        }
      }

      setTables(tableList)
      // Save to local cache for offline use
      if (branchId && tableList.length > 0) {
        localCache.saveTables(branchId, tableList).catch(() => {})
      }
    } catch (error) {
      console.error("Error loading tables:", error)
      // Offline fallback — try serving from cache
      if (branchId) {
        const cachedTables = await localCache.getTables(branchId).catch(() => [])
        if (cachedTables.length > 0) {
          setTables(cachedTables)
          setTablesLoading(false)
          return
        }
      }
      setError("Failed to load tables. Please try again.")
      setTables([])
    } finally {
      setTablesLoading(false)
    }
  }

  const handleTableSelect = (table) => {
    // OFFLINE-FIRST: select the table immediately, fire-and-forget status updates
    const updatedTable = { ...table, status: 'reserved' }
    setSelectedTable(updatedTable)
    focusOnSearchInput()

    // Update table status in background (don't block UI)
    const tableStatus = (table.status || '').toLowerCase()
    if (tableStatus !== 'available') {
      // Non-available table: set available then reserved
      handleUpdateTableStatus(table._id, 'available', false)
        .then(() => handleUpdateTableStatus(table._id, 'reserved', false))
        .catch((error) => console.warn('[MenuScreen] Background table status update failed:', error))
    } else {
      // Available table: just mark reserved
      handleUpdateTableStatus(table._id, 'reserved', false)
        .catch((error) => console.warn('[MenuScreen] Background table status update failed:', error))
    }
  }

  // Helper function to focus on search input
  const focusOnSearchInput = () => {
    const focusSearchInput = () => {
      // Try using ref first
      if (searchInputRef.current) {
        searchInputRef.current.focus()
        return true
      }

      // Fallback to querySelector
      const searchInput = document.querySelector('input[placeholder*="Search by name"]')
      if (searchInput) {
        searchInput.focus()
        return true
      }

      return false
    }

    // Try multiple times to ensure focus works
    setTimeout(() => focusSearchInput(), 50)
    setTimeout(() => focusSearchInput(), 200)
    setTimeout(() => focusSearchInput(), 500)
  }

  // Handle table status update
  const handleUpdateTableStatus = async (tableId, newStatus, showAlert = true) => {
    // ── OFFLINE-FIRST: update local state immediately, sync later ──
    setTables(prevTables =>
      prevTables.map(table =>
        table._id === tableId ? { ...table, status: newStatus } : table
      )
    )
    if (selectedTable && selectedTable._id === tableId) {
      setSelectedTable(prev => ({ ...prev, status: newStatus }))
    }
    // Also update the cache
    const branchId = customerData?.selectedBranch?._id
    if (branchId) {
      localCache.getTables(branchId).then(cached => {
        const updated = cached.map(t => t._id === tableId ? { ...t, status: newStatus } : t)
        localCache.saveTables(branchId, updated).catch(() => {})
      }).catch(() => {})
    }

    try {
      await counterApi.request(`/table/${tableId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
        headers: { 'Content-Type': 'application/json' }
      })
      return true
    } catch (error) {
      // Offline or server error — local state already updated above, silently continue
      console.warn('[MenuScreen] Table status update failed (offline/error):', tableId, newStatus)
      return true // Return success so callers don't block
    }
  }

  // Handle table input Enter key
  const handleTableInputEnter = () => {
    const tableNumber = tableInput.trim()
    if (!tableNumber) return


    // Find table by number (search in ALL tables, not just available ones) - CASE INSENSITIVE
    const foundTable = tables.find(table =>
      String(table.number).toLowerCase() === tableNumber.toLowerCase() ||
      String(table.tableNumber).toLowerCase() === tableNumber.toLowerCase()
    )



    if (foundTable) {
      // ALWAYS CREATE NEW KOT - Remove existing KOT check
      // Each KOT should be separate regardless of table

      handleTableSelect(foundTable) // This will check if table is available
      setTableInput("")
    } else {
      console.log(`❌ Table ${tableNumber} not found in this branch. Available tables: ${tables.map(t => t.number || t.tableNumber).join(', ')}`)
    }
  }

  // Debug function to check all KOTs for a specific table
  const debugTableKOTs = async (tableNumber) => {
    try {
      // console.log(`🔍 Debugging KOTs for table ${tableNumber}...`)
      // Exclude complimentary bills from KOT debugging
      const response = await counterApi.request('/counter-order/orders?includeComplimentary=false')

      let kotOrders = []
      if (response && response.success && Array.isArray(response.orders)) {
        kotOrders = response.orders
      } else if (response && Array.isArray(response.orders)) {
        kotOrders = response.orders
      } else if (response && Array.isArray(response.data)) {
        kotOrders = response.data
      } else if (Array.isArray(response)) {
        kotOrders = response
      }

      // Find all KOTs for this table (pending and completed)
      const tableKOTs = kotOrders.filter(order => {
        return String(order.tableNumber).toLowerCase() === String(tableNumber).toLowerCase()
      })

      // console.log(`🔍 Found ${tableKOTs.length} KOTs for table ${tableNumber}:`)
      // tableKOTs.forEach((kot, index) => {
      //   console.log(`🔍 KOT ${index + 1}:`, {
      //     id: kot.id || kot._id,
      //     kotNumber: kot.kotNumber,
      //     paymentStatus: kot.paymentStatus,
      //     items: kot.items,
      //     customerName: kot.customerName,
      //     createdAt: kot.createdAt
      //   })
      // })

      return tableKOTs
    } catch (error) {
      console.error('❌ Error debugging table KOTs:', error)
      return []
    }
  }

  // Add debug function to window for easy access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.debugTableKOTs = debugTableKOTs
      // console.log('🔧 Debug function added: window.debugTableKOTs("B1")')
    }
  }, [])

  // Global function to refresh tables (can be called from other components)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.refreshTables = () => {
        loadTables()
      }

      // Also add debug function for table status
      window.debugTableStatus = (tableNumber) => {
        const table = tables.find(t => t.number === tableNumber || t.tableNumber === tableNumber)
        if (table) {
          // Table found
        } else {
          // Table not found
        }
      }

      // Debug function to show all orders in database
      window.debugAllOrders = async () => {
        try {
          // Exclude complimentary bills from debug operations
          const response = await counterApi.request('/counter-order/orders?includeComplimentary=false')

          let allOrders = []
          if (response && response.success && Array.isArray(response.orders)) {
            allOrders = response.orders
          } else if (response && Array.isArray(response.orders)) {
            allOrders = response.orders
          } else if (response && Array.isArray(response.data)) {
            allOrders = response.data
          } else if (Array.isArray(response)) {
            allOrders = response
          }

          // Show orders with bill numbers 061-068
          const templeBillNumbers = ['061', '062', '063', '064', '065', '066', '067', '068']
          const matchingOrders = allOrders.filter(order =>
            templeBillNumbers.includes(order.invoiceNumber) ||
            templeBillNumbers.includes(order.billNumber)
          )

          // Show all orders from today
          const today = new Date()
          const todayOrders = allOrders.filter(order => {
            const orderDate = new Date(order.createdAt || order.orderTime || order.date)
            return orderDate.toDateString() === today.toDateString()
          })

        } catch (error) {
          console.error('❌ Error fetching orders:', error)
        }
      }
    }
  }, [tables, loadTables])

  // Check if table has existing KOT
  const checkExistingKOTForTable = async (table) => {
    try {
      // Exclude complimentary bills from KOT checking
      const response = await counterApi.request('/counter-order/orders?includeComplimentary=false')

      let kotOrders = []
      if (response && response.success && Array.isArray(response.orders)) {
        kotOrders = response.orders
      } else if (response && Array.isArray(response.orders)) {
        kotOrders = response.orders
      } else if (response && Array.isArray(response.data)) {
        kotOrders = response.data
      } else if (Array.isArray(response)) {
        kotOrders = response
      }

      // Find pending KOT for this table
      const existingKOT = kotOrders.find(order => {
        const isKOT = order.paymentStatus === 'pending' &&
          (String(order.tableNumber).toLowerCase() === String(table.number).toLowerCase() ||
            String(order.tableNumber).toLowerCase() === String(table.tableNumber).toLowerCase())
        return isKOT
      })

      if (existingKOT) {
        return {
          id: existingKOT.id || existingKOT._id,
          kotNumber: existingKOT.kotNumber || existingKOT.orderId || `KOT-${(existingKOT.id || existingKOT._id)?.slice(-6)}`,
          tableNumber: existingKOT.tableNumber,
          items: existingKOT.items || []
        }
      }

      return null
    } catch (error) {
      return null
    }
  }
  // Handle search Enter key - open quantity popup if item found by number
  const handleSearchEnter = async () => {
    // console.log('🔍 handleSearchEnter called - searchQuery:', searchQuery, 'menuItems.length:', menuItems.length, 'loading:', loading)

    // Check if search is "0" or empty - show all items
    if (searchQuery.trim() === "0" || searchQuery.trim() === "" || searchQuery === "000") {
      // If cart has items and search is empty/000, proceed to checkout
      if ((searchQuery === "000" || searchQuery.trim() === "") && cartItems.length > 0) {
        // Check if Restaurant category - trigger Save KOT button click

        if (isRestaurantCategory) {
          // CRITICAL FIX: Check if already saving before triggering
          if (savingKOT) {
            // console.log('🔒 KOT save already in progress, ignoring Enter key')
            return
          }
          
          // Find and click the Save KOT button
          const buttons = document.querySelectorAll('button')
          const saveKOTButton = Array.from(buttons).find(btn => btn.textContent.includes('Save KOT'))
          if (saveKOTButton && !saveKOTButton.disabled) {
            saveKOTButton.click()
          }
        } else {
          // For other categories, go to bill generation
          handleGenerateBill()
        }
        return
      }

      // If search is "0" or empty with no cart items, do nothing
      return
    }

    const query = searchQuery.trim()

    // If currently loading, wait for the search to complete
    if (loading) {
      // console.log('🔍 Search is loading, waiting for results...')
      // Wait up to 2 seconds for the search to complete
      let attempts = 0
      const maxAttempts = 20 // 20 attempts * 100ms = 2 seconds max wait

      while (loading && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100))
        attempts++
      }

      // console.log('🔍 Finished waiting, loading:', loading, 'menuItems.length:', menuItems.length)
    }

    // PRIORITY 1: Check if there are filtered results visible on screen
    // If items are showing, select the first one (most intuitive behavior)
    if (menuItems.length > 0) {
      // console.log('🔍 Found', menuItems.length, 'filtered item(s), opening popup for first item')
      // Show quantity popup for the first visible item
      const firstItem = menuItems[0]
      setSelectedMenuItem(firstItem)
      setQuantityInput("1")
      setRemarkInput("")
      setShowQuantityPopup(true)

      // Clear search query
      setSearchQuery("000")
      return
    }

    // PRIORITY 2: No filtered results, try exact numeric lookup in all items
    // This handles the case where debounce hasn't completed yet
    const isNumericQuery = /^\d+$/.test(query)

    if (isNumericQuery) {
      // console.log('🔍 No filtered results, trying numeric lookup in allMenuItems')
      // Convert query to number for comparison (handles leading zeros)
      const queryNumber = parseInt(query, 10)

      // Find item by menu item number (numeric match) - search in allMenuItems
      const foundItem = allMenuItems.find(item => {
        const itemNumber = parseInt(item.menuItemNumber || item.number || 0, 10)
        return itemNumber === queryNumber
      })

      if (foundItem) {
        // console.log('🔍 Found item by number in allMenuItems:', foundItem.name)
        // Show quantity popup
        setSelectedMenuItem(foundItem)
        setQuantityInput("1")
        setRemarkInput("")
        setShowQuantityPopup(true)

        // Clear search query
        setSearchQuery("000")
        return
      }
    }

    // PRIORITY 3: No results found anywhere
    // console.log('🔍 No items found for query:', query)
    // alert('No items found for your search')
    // Keep focus on search input
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus()
        searchInputRef.current.select()
      }
    }, 100)
  }

  // Handle quantity popup Enter key - add to cart
  const handleQuantityEnter = () => {
    const qty = parseInt(quantityInput)
    if (isNaN(qty) || qty < 1) {
      alert("Please enter a valid quantity")
      return
    }

    // Check if this is restaurant category to include remark

    // Add to cart
    const existingItem = cartItems.find(item => item._id === selectedMenuItem._id)

    if (existingItem) {
      setCartItems(cartItems.map(item =>
        item._id === selectedMenuItem._id
          ? {
            ...item,
            quantity: item.quantity + qty,
            // Only add remark for restaurant category and if remark is provided
            ...(isRestaurantCategory && remarkInput.trim() ? { remark: remarkInput.trim() } : {})
          }
          : item
      ))
    } else {
      const newItem = {
        ...selectedMenuItem,
        quantity: qty,
        // Only add remark for restaurant category and if remark is provided
        ...(isRestaurantCategory && remarkInput.trim() ? { remark: remarkInput.trim() } : {})
      }
      setCartItems([...cartItems, newItem])
    }

    // Close popup and clear search
    setShowQuantityPopup(false)
    setSelectedMenuItem(null)
    setQuantityInput("1")
    setRemarkInput("")
    setSearchQuery("000")

    // Focus back on search input after closing popup
    setTimeout(() => {
      if (searchInputRef.current) {
        searchInputRef.current.focus()
      } else {
        const searchInput = document.querySelector('input[placeholder*="Search by name"]')
        if (searchInput) {
          searchInput.focus()
        }
      }
    }, 100)
  }

  // Cart Management Functions
  const removeFromCart = (itemId) => {
    setCartItems(prevItems => {
      const updatedItems = prevItems.filter(item => item._id !== itemId)

      // If all items are removed, make table available
      if (updatedItems.length === 0 && selectedTable) {
        // console.log('🔄 All items removed, making table available:', selectedTable.number)
        handleUpdateTableStatus(selectedTable._id, 'available', false)
          .then(() => {
            setSelectedTable(null)
            setTableInput("")
            // console.log('✅ Table made available after removing all items')
          })
          .catch((error) => {
            console.error('❌ Failed to update table status:', error)
          })
      }

      return updatedItems
    })
  }

  const updateCartItemQuantity = (itemId, newQuantity) => {
    if (newQuantity < 1) {
      removeFromCart(itemId)
      return
    }

    setCartItems(prevItems =>
      prevItems.map(item =>
        item._id === itemId
          ? { ...item, quantity: newQuantity }
          : item
      )
    )
  }

  // KOT Editing Functions
  const startEditingKOT = (kot) => {
    // console.log('🔍 Starting to edit KOT:', kot)

    if (!kot || kot.paymentStatus !== 'pending') {
      // console.log('❌ Cannot edit: KOT not found or not pending')
      alert('Cannot edit this KOT. Only pending KOTs can be edited.')
      return
    }

    // Set the KOT being edited
    setEditingKOT(kot)
    setExistingKOTNumber(kot.kotNumber)

    // Initialize modified items with current quantities
    const initialModifiedItems = (kot.items || []).map(item => ({
      ...item,
      originalQuantity: item.quantity,
      newQuantity: item.quantity,
      isRemoved: false,
      isChanged: false
    }))

    setModifiedItems(initialModifiedItems)

    // console.log('✅ KOT editing started:', {
    //   kotNumber: kot.kotNumber,
    //   tableNumber: kot.tableNumber,
    //   itemCount: initialModifiedItems.length
    // })
  }

  const saveKOTModifications = async (shouldPrint = false) => {
    if (!editingKOT) {
      // console.log('❌ No KOT being edited')
      return
    }

    try {
      // console.log('💾 Saving KOT modifications:', {
      //   kotNumber: editingKOT.kotNumber,
      //   shouldPrint,
      //   modifiedItems: modifiedItems.length
      // })

    
      const changedItems = modifiedItems.filter(item =>
        item.isRemoved || item.newQuantity !== item.originalQuantity
      )

      if (changedItems.length === 0) {
        // console.log('ℹ️ No changes to save')
        alert('No changes to save.')
        return
      }

      // CRITICAL FIX: More robust item validation and quantity handling
      const updatedItems = modifiedItems
        .filter(item => {
          const isValid = !item.isRemoved && item.newQuantity > 0
          // if (!isValid) {
            // console.log(`  ⏭️ Excluding item: ${item.name}, isRemoved: ${item.isRemoved}, newQuantity: ${item.newQuantity}`)
          // }
          return isValid
        })
        .map(item => {
          const mappedItem = {
            menuItemId: item.menuItemId,
            name: item.name,
            quantity: parseInt(item.newQuantity) || 0,
            price: parseFloat(item.price) || 0
          }
          // console.log(`  ✅ Including item: ${mappedItem.name}, Quantity: ${mappedItem.quantity}, Price: ${mappedItem.price}`)
          return mappedItem
        })

      // console.log(`� Updated items count: ${updatedItems.length}`)

      // Calculate new totals
      const newSubtotal = updatedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)

      const updateData = {
        items: updatedItems,
        subtotal: newSubtotal,
        totalAmount: newSubtotal,
        grandTotal: newSubtotal
      }

      // console.log('� Updating KOT in database:', {
      //   kotId: editingKOT.id,
      //   itemsCount: updateData.items.length,
      //   subtotal: updateData.subtotal,
      //   items: updateData.items.map(i => ({ name: i.name, qty: i.quantity }))
      // })

      // ── OFFLINE-FIRST: update local cache immediately, try server in background ──
      const kotId = editingKOT.id || editingKOT._id
      const kotBranchId = customerData?.selectedBranch?._id
      if (kotBranchId) {
        localCache.putKOT({
          ...editingKOT,
          _id: kotId,
          id: kotId,
          branchId: kotBranchId,
          items: updatedItems,
          subtotal: newSubtotal,
          totalAmount: newSubtotal,
          grandTotal: newSubtotal,
          paymentStatus: 'pending',
        }).catch(() => {})
      }

      // Try server in background — don't await, don't block UI
      if (!String(kotId).startsWith('offline-')) {
        counterApi.request(`/counter-order/orders/${kotId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData)
        }).catch((err) => {
          console.warn('[MenuScreen] KOT edit will sync later:', editingKOT.kotNumber, err.message)
        })
      }

      // console.log('✅ Database update response:', 'offline-first')

      // Print changes to kitchen if requested
      if (shouldPrint) {
        // console.log('🖨️ Printing KOT changes to kitchen')
        try {
          await thermalPrinter.printKOTChanges({
            kotNumber: editingKOT.kotNumber,
            tableNumber: editingKOT.tableNumber,
            items: changedItems
          })
          // console.log('✅ KOT changes printed successfully')
        } catch (printError) {
          console.error('❌ Failed to print KOT changes:', printError)
        }
      }

      // console.log('✅ KOT modifications saved successfully')
      alert(`KOT ${editingKOT.kotNumber} updated successfully!${shouldPrint ? ' Changes sent to kitchen.' : ''}`)

      // Clear editing state
      setEditingKOT(null)
      setModifiedItems([])
      setExistingKOTNumber(null)

      // CRITICAL FIX: Add delay before refreshing to ensure database has committed changes
      await new Promise(resolve => setTimeout(resolve, 500))

      // Refresh KOT list
      loadSavedKOTs()

    } catch (error) {
      console.error('❌ Failed to save KOT modifications:', error)
      alert(`Failed to save changes: ${error.message}`)
    }
  }

  const updateItemQuantity = (itemIndex, newQuantity) => {
    // console.log('🔄 Updating item quantity:', { itemIndex, newQuantity })

    setModifiedItems(prevItems => {
      const updatedItems = [...prevItems]
      const item = updatedItems[itemIndex]

      if (!item) {
        // console.log('❌ Item not found at index:', itemIndex)
        return prevItems
      }

      // Update the quantity
      updatedItems[itemIndex] = {
        ...item,
        newQuantity: Math.max(0, newQuantity),
        isRemoved: newQuantity <= 0,
        isChanged: newQuantity !== item.originalQuantity
      }

      // console.log('✅ Item quantity updated:', {
      //   name: item.name,
      //   originalQuantity: item.originalQuantity,
      //   newQuantity: updatedItems[itemIndex].newQuantity,
      //   isRemoved: updatedItems[itemIndex].isRemoved,
      //   isChanged: updatedItems[itemIndex].isChanged
      // })

      return updatedItems
    })
  }

  const cancelKOTEdit = () => {
    // console.log('❌ Cancelling KOT edit')

    if (editingKOT) {
      const hasChanges = modifiedItems.some(item =>
        item.isRemoved || item.newQuantity !== item.originalQuantity
      )

      if (hasChanges) {
        const confirmCancel = confirm('You have unsaved changes. Are you sure you want to cancel editing?')
        if (!confirmCancel) {
          return
        }
      }

      // console.log('✅ KOT edit cancelled')
    }

    // Clear editing state
    setEditingKOT(null)
    setModifiedItems([])
    setExistingKOTNumber(null)
  }

  const restoreItem = (itemIndex) => {
    // console.log('🔄 Restoring item at index:', itemIndex)

    setModifiedItems(prevItems => {
      const updatedItems = [...prevItems]
      const item = updatedItems[itemIndex]

      if (!item) {
        // console.log('❌ Item not found at index:', itemIndex)
        return prevItems
      }

      // Restore the item to its original quantity
      updatedItems[itemIndex] = {
        ...item,
        newQuantity: item.originalQuantity,
        isRemoved: false,
        isChanged: false
      }

      // console.log('✅ Item restored:', {
      //   name: item.name,
      //   restoredQuantity: item.originalQuantity
      // })

      return updatedItems
    })
  }

  // Load saved KOTs function - v2.0 (fixed today reference error)
  const loadSavedKOTs = async (retryCount = 0, selectedDate = null) => {
    // Only show KOT loading spinner in KOT list mode, not sales report mode
    if (!selectedDate) setKotLoading(true)
    // Declare branchId outside try/catch so catch block can access it for cache fallback
    // Fall back to localStorage if customerData is not in navigation state (e.g. after page refresh)
    let branchId = customerData?.selectedBranch?._id
    if (!branchId) {
      try { branchId = JSON.parse(localStorage.getItem('selectedBranch') || '{}')._id } catch (_) {}
    }
 
    try {
      // ── CACHE-FIRST: serve KOT list from cache immediately (KOT mode only) ──
      if (branchId && !selectedDate) {
        const cachedKOTs = await localCache.getPendingKOTs(branchId)
        if (cachedKOTs.length > 0) {
          const processedKOTs = cachedKOTs.map(order => ({
            id: order.id || order._id,
            kotNumber: order.kotNumber || `KOT-${(order.id || order._id)?.slice(-6)}`,
            tableNumber: order.tableNumber,
            tableId: order.tableId,
            customerName: order.customerName || 'Walk-in Customer',
            items: order.items || [],
            totalAmount: order.totalAmount || order.grandTotal || 0,
            createdAt: order.createdAt || order.kotTime,
            status: order.status,
            paymentStatus: order.paymentStatus,
            isOffline: order.isOffline || false,
          })).filter(kot => (kot.items || []).some(item => (item.quantity || 0) > 0))
          setSavedKOTs(processedKOTs)
          setKotLoading(false)
          if (!navigator.onLine) return // offline — cache is source of truth
          // online — continue to refresh from server in background (don't block UI)
        }
      }

      // ── SALES REPORT: unified local + server merge ──
      // localCache is the source of truth for all bills (online and offline).
      // If online, server data is fetched and merged to pick up any status updates.
      // Result is set once — no pre-render, no separate offline path.
      if (branchId && selectedDate) {
        console.log('[loadSavedKOTs] Sales report path — branchId:', branchId, 'date:', selectedDate, 'category:', preSelectedCategory)
        const filterDateSR = new Date(selectedDate)
        const startSR = new Date(filterDateSR.getFullYear(), filterDateSR.getMonth(), filterDateSR.getDate(), 0, 0, 0, 0)
        const endSR = new Date(filterDateSR.getFullYear(), filterDateSR.getMonth(), filterDateSR.getDate(), 23, 59, 59, 999)

        // NOTE: We do NOT filter by category here — show ALL bills for this branch/date.
        // Bills from this session already have the correct categoryName stored.
        // Filtering by category would hide bills with null/mismatched categoryName.

        // 1. Read ALL local bills — always use all bills from IndexedDB to avoid branchId mismatch
        // (branchId stored in bill may differ in format from the one used to query)
        const allCachedBills = await localCache._getAll('bills').catch(() => [])
        const pendingEntries = await offlineQueue.listPending().catch(() => [])
        const pendingInvoiceNums = new Set(
          pendingEntries.filter(e => e.type === 'bill').map(e => e.payload.invoiceNumber).filter(Boolean)
        )
        console.log('[SalesReport] cachedBills:', allCachedBills.length, 'pendingEntries:', pendingEntries.filter(e=>e.type==='bill').length)
        console.log('[SalesReport] cachedBills invoiceNumbers:', allCachedBills.map(b => b.invoiceNumber).join(', '))
        console.log('[SalesReport] cachedBills branchIds:', [...new Set(allCachedBills.map(b => b.branchId))].join(', '), '| filtering by branchId:', branchId)

        // Include queue entries not yet in localCache
        const queuedBills = pendingEntries
          .filter(e => e.type === 'bill')
          .map(e => ({ ...e.payload, _id: `offline-${e.id}`, id: `offline-${e.id}`, savedAt: e.createdAt }))

        const seenLocal = new Set()
        let allBills = [...allCachedBills, ...queuedBills]
          .filter(b => {
            if (!b.invoiceNumber) return false
            if (seenLocal.has(b.invoiceNumber)) return false
            seenLocal.add(b.invoiceNumber)
            return true
          })
          .filter(b => !b.isComplimentary) // exclude complimentary bills from sales report
          .filter(b => {
            // Date filter: include bills saved on the selected date (local time)
            const ts = b.savedAt || b.createdAt
            if (!ts) return true // no timestamp — include (can't filter)
            const d = new Date(ts)
            return d >= startSR && d <= endSR
          })
          .map(b => ({
            ...b,
            isOfflinePending: pendingInvoiceNums.has(b.invoiceNumber),
          }))
        console.log('[SalesReport] allBills from local (date filtered):', allBills.length, '| date:', selectedDate)

        // 2. If online, fetch ALL server bills for this branch/date (no category filter)
        if (navigator.onLine) {
          try {
            // Fetch without date filter to catch KOTs created on a different day but billed today
            // (e.g. KOT created yesterday evening, billed this morning)
            // We filter by date client-side using savedAt/createdAt
            const serverQueryOptions = { limit: 10000, includeComplimentary: false }
            // No categoryName filter — get all bills so nothing is missed
            const serverRes = await counterApi.getOrders(branchId, serverQueryOptions)
            let serverOrders = []
            if (serverRes?.success && Array.isArray(serverRes.data)) serverOrders = serverRes.data
            else if (serverRes?.success && Array.isArray(serverRes.orders)) serverOrders = serverRes.orders
            else if (Array.isArray(serverRes?.orders)) serverOrders = serverRes.orders
            else if (Array.isArray(serverRes?.data)) serverOrders = serverRes.data
            else if (Array.isArray(serverRes)) serverOrders = serverRes

            // Keep only entries that have an invoiceNumber (bills, not raw KOTs)
            // BUT also include KOT entries that have an invoiceNumber set (single-KOT completed bills)
            serverOrders = serverOrders.filter(o => !!(o.invoiceNumber || o.billNumber))

            // Build a map of server orders by invoiceNumber
            const serverMap = new Map()
            for (const o of serverOrders) {
              const inv = o.invoiceNumber || o.billNumber
              if (inv) serverMap.set(inv, o)
            }

            // Merge: for bills in local, use server version if available (has latest status)
            // Add server bills not in local (e.g. from another device/session)
            const localInvoiceNums = new Set(allBills.map(b => b.invoiceNumber))
            const serverOnlyBills = serverOrders
              .filter(o => {
                const inv = o.invoiceNumber || o.billNumber
                if (!inv || localInvoiceNums.has(inv) || o.isComplimentary) return false
                // Date filter for server-only bills: use createdAt
                const ts = o.createdAt || o.savedAt
                if (!ts) return true
                const d = new Date(ts)
                return d >= startSR && d <= endSR
              })
              .map(o => ({
                ...o,
                invoiceNumber: o.invoiceNumber || o.billNumber,
                savedAt: o.createdAt,
                isOfflinePending: false,
              }))

            // Update local bills with server status (server is authoritative for status)
            allBills = allBills.map(b => {
              const serverVersion = serverMap.get(b.invoiceNumber)
              if (serverVersion) {
                return {
                  ...b,
                  // Keep local data but override status fields from server
                  mongoId: serverVersion.id || serverVersion._id || b.mongoId || null, // real MongoDB _id
                  paymentStatus: serverVersion.paymentStatus || b.paymentStatus,
                  orderStatus: serverVersion.orderStatus || b.orderStatus,
                  status: serverVersion.status || b.status,
                  cancellationReason: serverVersion.cancellationReason,
                  cancelledAt: serverVersion.cancelledAt,
                  cancelledBy: serverVersion.cancelledBy,
                  isComplimentary: serverVersion.isComplimentary || b.isComplimentary, // server is authoritative for complimentary
                  isOfflinePending: false, // server has it, not pending
                }
              }
              return b
            })

            allBills = [...allBills, ...serverOnlyBills]
            console.log('[SalesReport] after server merge — allBills:', allBills.length, '| serverOrders:', serverOrders.length, '| serverOnly:', serverOnlyBills.length)
            console.log('[SalesReport] server invoiceNumbers:', serverOrders.map(o => o.invoiceNumber).join(', '))
            console.log('[SalesReport] local invoiceNumbers:', [...localInvoiceNums].join(', '))
            console.log('[SalesReport] serverOnly invoiceNumbers:', serverOnlyBills.map(o => o.invoiceNumber).join(', '))
          } catch (_) {
            // Server fetch failed — local data is all we have, that's fine
          }
        }

        // Final guard: strip any complimentary bills that slipped through (e.g. from server merge)
        allBills = allBills.filter(b => !b.isComplimentary)

        // 3. Build and set sales report from merged allBills — single setSalesData call
        const activeBills = allBills.filter(b => {
          // A bill is "active" (not cancelled) when paymentStatus is completed/paid
          // Use paymentStatus as primary signal since orderStatus may be 'processing' for old records
          const payStatus = (b.paymentStatus || '').toLowerCase()
          const ordStatus = (b.orderStatus || b.status || '').toLowerCase()
          return ordStatus !== 'cancelled' && payStatus !== 'failed' && payStatus !== 'refunded'
        })
        const cancelledBills = allBills.filter(b => {
          const ordStatus = (b.orderStatus || b.status || '').toLowerCase()
          return ordStatus === 'cancelled'
        })
        const totalRevenueSR = activeBills.reduce((s, b) => s + (b.totalAmount || b.grandTotal || 0), 0)
        const pendingBills = activeBills.filter(b => b.isOfflinePending)

        const _isObjectId = (v) => /^[0-9a-fA-F]{24}$/.test(String(v || ''))
        const mapBill = (bill) => ({
          id: bill.id || bill._id,
          mongoId: (_isObjectId(bill.mongoId) ? bill.mongoId
            : _isObjectId(bill.id) ? bill.id
            : _isObjectId(bill._id) ? bill._id
            : null),
          orderNumber: bill.invoiceNumber,
          invoiceNumber: bill.invoiceNumber,
          time: new Date(bill.savedAt || bill.createdAt || Date.now()).toLocaleTimeString('en-IN', { hour12: true, hour: '2-digit', minute: '2-digit' }),
          customerName: (bill.customerName || 'Walk-in Customer').replace(/\[undefined\]/gi, '').replace(/\[null\]/gi, '').trim(),
          tableNumber: bill.tableNumber || null,
          items: bill.items || [],
          totalAmount: bill.totalAmount || bill.grandTotal || 0,
          discountAmount: bill.discountAmount || 0,
          originalTotalAmount: bill.totalAmount || bill.grandTotal || 0,
          paymentMethod: bill.paymentMethod || 'cash',
          orderStatus: bill.paymentStatus === 'completed' ? 'completed' : (bill.orderStatus || bill.status || 'completed'),
          status: bill.paymentStatus === 'completed' ? 'completed' : (bill.status || 'completed'),
          paymentStatus: bill.paymentStatus || 'completed',
          cancellationReason: bill.cancellationReason,
          cancelledAt: bill.cancelledAt,
          cancelledBy: bill.cancelledBy,
          createdAt: bill.savedAt || bill.createdAt,
          isOfflinePending: bill.isOfflinePending,
          categoryName: bill.categoryName || null,
        })

        setSalesData({
          date: selectedDate,
          category: preSelectedCategory || 'All Categories',
          branch: customerData?.selectedBranch?.name ||
            (() => { try { return JSON.parse(localStorage.getItem('selectedBranch') || '{}').name } catch(_){} return 'Branch' })(),
          summary: {
            totalOrders: activeBills.length,
            totalRevenue: totalRevenueSR,
            totalGST: activeBills.reduce((sum, bill) => {
              if (!bill.items || !Array.isArray(bill.items)) return sum
              return sum + bill.items.reduce((itemSum, item) => {
                const rate = item.gstRate || 0
                return itemSum + (((item.price || 0) * (item.quantity || 0) * rate) / 100)
              }, 0)
            }, 0),
            cancelledOrders: cancelledBills.length,
            cancelledRevenue: cancelledBills.reduce((s, b) => s + (b.totalAmount || b.grandTotal || 0), 0),
            totalItems: activeBills.reduce((s, b) => s + (b.items || []).reduce((is, i) => is + (i.quantity || 1), 0), 0),
            totalDiscount: activeBills.reduce((s, b) => s + (b.discountAmount || 0), 0),
            averageOrderValue: activeBills.length > 0 ? totalRevenueSR / activeBills.length : 0,
            offlinePendingCount: pendingBills.length,
            offlinePendingRevenue: pendingBills.reduce((s, b) => s + (b.totalAmount || b.grandTotal || 0), 0),
          },
          hourlySales: [],
          orders: allBills
            .sort((a, b) => new Date(b.savedAt || b.createdAt || 0) - new Date(a.savedAt || a.createdAt || 0))
            .map(mapBill),
        })
        setSalesLoading(false)
        setKotLoading(false)
        return
      }

      // Date filtering setup for sales report functionality
      // NOTE: Backend now handles date filtering via API, these variables are for display/logging only
      const filterDate = selectedDate ? new Date(selectedDate) : new Date()
      const startOfDay = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate(), 0, 0, 0, 0)
      const endOfDay = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate(), 23, 59, 59, 999)

      // Defensive check to ensure variables are properly defined
      if (!filterDate || !startOfDay || !endOfDay) {
        throw new Error('Date variables not properly initialized')
      }

      // console.log('📅 Target date for filtering:', filterDate.toDateString())
      // console.log('🔍 Date variables check:', { filterDate, startOfDay, endOfDay })
      // console.log('🔍 SALES REPORT DEBUG - Category info:', {
      //   preSelectedCategory: preSelectedCategory,
      //   isTempleCategory: preSelectedCategory && preSelectedCategory.toLowerCase().includes('temple'),
      //   selectedDate: selectedDate,
      //   isKOTLoad: !selectedDate
      // })

      // Get counter user info from localStorage (optional for KOT viewing)
      const counterUserData = localStorage.getItem("counterUserData")
      const counterUser = counterUserData ? JSON.parse(counterUserData) : null

      if (!counterUser || !counterUser._id) {
        console.warn('⚠️ Counter user not found in localStorage, showing all KOTs')
      }

      // Fetch orders from counter-order endpoint using backend filtering
      // Use the new getOrders method with date filtering
      const apiOptions = {
        includeComplimentary: false,
        limit: 10000
      }

      // Add date filter if loading sales report
      if (selectedDate) {
        apiOptions.date = selectedDate
        // console.log('📅 Using backend date filter for sales report:', selectedDate)
      } else {
        // Loading KOTs - filter for pending orders only
        apiOptions.paymentStatus = 'pending'
        // console.log('🎫 Loading KOTs - filtering for pending orders on backend')
      }

      // console.log('🌐 Calling counterApi.getOrders with:', { branchId, apiOptions })
      const response = await counterApi.getOrders(branchId, apiOptions)

      let kotOrders = []
      if (response && response.success && Array.isArray(response.data)) {
        kotOrders = response.data
      } else if (response && response.success && Array.isArray(response.orders)) {
        kotOrders = response.orders
      } else if (response && Array.isArray(response.orders)) {
        kotOrders = response.orders
      } else if (response && Array.isArray(response.data)) {
        kotOrders = response.data
      } else if (Array.isArray(response)) {
        kotOrders = response
      } else {
        kotOrders = []
      }

      // Cache KOTs for offline use (only for KOT list mode, not sales report)
      if (branchId && !selectedDate && kotOrders.length > 0) {
        localCache.saveKOTs(branchId, kotOrders).catch(() => {})
      }

      // Merge in any offline-only KOTs from cache that the server doesn't know about yet
      if (branchId && !selectedDate) {
        try {
          const cachedKOTs = await localCache.getPendingKOTs(branchId)
          const offlineOnly = cachedKOTs.filter(k => k.isOffline && !kotOrders.find(o => (o._id || o.id) === (k._id || k.id)))
          if (offlineOnly.length > 0) {
            kotOrders = [...kotOrders, ...offlineOnly]
          }
        } catch (_) {}
      }

      // console.log('✅ Loaded orders from backend with filtering:', kotOrders.length)

      // CRITICAL DEBUG: Show orders from database (after kotOrders is initialized)
      // console.log('🔍 SALES REPORT DEBUG - Orders loaded:', {
      //   totalOrdersFromAPI: kotOrders.length,
      //   isTempleCategory: preSelectedCategory && preSelectedCategory.toLowerCase().includes('temple')
      // })

      // CRITICAL DEBUG: Show first few orders from database
      // console.log('🔍 FIRST 5 ORDERS FROM DATABASE:', kotOrders.slice(0, 5).map(order => ({
      //   id: order.id || order._id,
      //   invoiceNumber: order.invoiceNumber,
      //   billNumber: order.billNumber,
      //   categoryName: order.categoryName,
      //   customerName: order.customerName,
      //   status: order.status,
      //   paymentStatus: order.paymentStatus,
      //   createdAt: order.createdAt
      // })))

      // Group KOTs by table and combine items
      const kotsByTable = {}

      // console.log('🔍 KOT Loading Debug - Total orders from API:', kotOrders.length)
      // console.log('🔍 KOT Loading Debug - First 3 orders:', kotOrders.slice(0, 3).map(order => ({
      //   id: order.id || order._id,
      //   kotNumber: order.kotNumber,
      //   tableNumber: order.tableNumber,
      //   paymentStatus: order.paymentStatus,
      //   status: order.status,
      //   categoryName: order.categoryName
      // })))

      // Filter for KOT orders (pending orders with tables)
      // Backend already filters for pending orders, just need to check for table
      const kotOrdersFiltered = kotOrders.filter(order => {
        // Backend already filtered for paymentStatus='pending', just verify table exists
        const hasTable = order.tableNumber && order.tableId
        return hasTable
      })

      // console.log('✅ KOT orders after table filter:', kotOrdersFiltered.length)

      // CRITICAL FIX: Set the filtered KOTs for the Alt+K modal
      // Only set KOTs when not loading sales report (selectedDate is null)
      if (!selectedDate) {
        // Process KOTs for display in the modal
        const processedKOTs = kotOrdersFiltered
          .map(order => ({
            id: order.id || order._id,
            kotNumber: order.kotNumber || `KOT-${(order.id || order._id)?.slice(-6)}`,
            tableNumber: order.tableNumber,
            tableId: order.tableId, // CRITICAL FIX: Include tableId for table shift functionality
            customerName: order.customerName || 'Walk-in Customer',
            items: order.items || [],
            totalAmount: order.totalAmount || order.grandTotal || 0,
            createdAt: order.createdAt || order.kotTime,
            status: order.status,
            paymentStatus: order.paymentStatus
          }))
          // CRITICAL FIX: Filter out KOTs where all items have zero quantity
          .filter(kot => {
            if (!kot.items || kot.items.length === 0) {
              // console.log('🔍 Filtering out KOT with no items:', kot.kotNumber)
              return false
            }

            // Check if at least one item has quantity > 0
            const hasValidItems = kot.items.some(item => item.quantity && item.quantity > 0)

            // if (!hasValidItems) {
            //   console.log('🔍 Filtering out KOT with all zero-quantity items:', kot.kotNumber)
            // }

            return hasValidItems
          })

        // console.log('🔍 Setting processed KOTs for modal (after filtering zero-quantity KOTs):', processedKOTs.length)
        setSavedKOTs(processedKOTs)
      } else {
        // console.log('🔍 Skipping KOT modal update - loading sales report for date:', selectedDate)
      }

      // CRITICAL DEBUG: Show ALL orders from database for Temple Meals debugging
      // if (preSelectedCategory && preSelectedCategory.toLowerCase().includes('temple')) {
      //   console.log('🔍 CRITICAL DEBUG - ALL ORDERS FROM DATABASE:')
      //   kotOrders.forEach((order, index) => {
      //     console.log(`Database Order ${index + 1}:`, JSON.stringify({
      //       id: order.id || order._id,
      //       invoiceNumber: order.invoiceNumber,
      //       billNumber: order.billNumber,
      //       categoryName: order.categoryName,
      //       categoryId: order.categoryId,
      //       customerName: order.customerName,
      //       status: order.status,
      //       paymentStatus: order.paymentStatus,
      //       tableNumber: order.tableNumber,
      //       tableId: order.tableId,
      //       branchId: order.branchId,
      //       createdAt: order.createdAt,
      //       items: (order.items || []).map(item => ({
      //         name: item.name,
      //         quantity: item.quantity,
      //         price: item.price
      //       }))
      //     }))
      //   })
       
      // }

      const filteredOrders = kotOrders.filter(order => {
        // Category filtering logic starts here
        const isKOT = order.paymentStatus === 'pending' &&
          order.tableNumber &&
          order.tableId

        // Filter by category if specific category is selected
        let isSameCategory = true
        if (preSelectedCategory && preSelectedCategory !== "All") {
          const categoryName = preSelectedCategory.toLowerCase()

          // CRITICAL FIX: Simplified and more reliable category detection
          if (order.categoryName) {
            // PRIMARY METHOD: Use saved category name (most reliable)
            const orderCategoryName = order.categoryName.toLowerCase()
            // console.log('📊 Using saved category for filtering:', {
            //   orderCategoryName,
            //   selectedCategory: categoryName,
            //   orderId: order.id || order._id,
            //   invoiceNumber: order.invoiceNumber || order.billNumber
            // })

            if (categoryName.includes('temple') || categoryName.includes('meal')) {
              // Temple Meals: Exact matching with safety checks
              isSameCategory = (
                orderCategoryName.includes('temple') ||
                orderCategoryName === 'temple meals' ||
                orderCategoryName === 'temple meal'
              ) &&
                // Exclude Self Service orders
                !orderCategoryName.includes('self service') &&
                !orderCategoryName.includes('darshini')

              // console.log('🛕 Temple Meals Filter:', {
              //   orderId: order.id || order._id,
              //   orderCategoryName,
              //   selectedCategory: categoryName,
              //   isTempleMatch: orderCategoryName.includes('temple'),
              //   excludesSelfService: !orderCategoryName.includes('self service'),
              //   finalDecision: isSameCategory ? 'INCLUDE' : 'EXCLUDE'
              // })

            } else if (categoryName.includes('restaurant')) {
              // Restaurant: Exact matching
              isSameCategory = orderCategoryName.includes('restaurant')

            } else if (categoryName.includes('darshini') || categoryName.includes('self service') || categoryName.includes('self-service')) {
              // Self Service: Exact matching with safety checks
              isSameCategory = (
                orderCategoryName === 'self service' ||
                orderCategoryName === 'self-service' ||
                orderCategoryName === 'darshini' ||
                orderCategoryName.includes('self service') ||
                orderCategoryName.includes('self-service') ||
                orderCategoryName.includes('darshini')
              ) &&
                // CRITICAL FIX: Exclude Temple Meals orders
                !orderCategoryName.includes('temple') &&
                // CRITICAL FIX: Exclude Restaurant orders
                !orderCategoryName.includes('restaurant')

              // console.log('🏪 Self Service Filter (Database Category):', {
              //   orderId: order.id || order._id,
              //   orderCategoryName,
              //   selectedCategory: categoryName,
              //   isSelfServiceMatch: orderCategoryName.includes('self service') || orderCategoryName.includes('self-service') || orderCategoryName.includes('darshini'),
              //   excludesTemple: !orderCategoryName.includes('temple'),
              //   excludesRestaurant: !orderCategoryName.includes('restaurant'),
              //   finalDecision: isSameCategory ? 'INCLUDE' : 'EXCLUDE'
              // })
            }

          } else {
            // FALLBACK METHOD: Use order characteristics (less reliable but necessary for old orders)
            // CRITICAL: Only use fallback for orders that truly have no category information
            // console.log('⚠️ No saved category - using fallback detection for order:', order.id || order._id)

            const orderId = (order.orderId || order.kotNumber || order.id || order._id || '').toLowerCase()
            const customerName = (order.customerName || '').toLowerCase()
            const hasTable = !!(order.tableNumber || order.tableId)

            if (categoryName.includes('temple') || categoryName.includes('meal')) {
              // CRITICAL FIX: Temple Meals fallback - ITEM-DRIVEN and RESTRICTIVE
              // ONLY include orders that explicitly contain Temple Meals items
              const hasActualTempleMealsItems = (order.items || []).some(item => {
                const itemName = (item.name || '').toLowerCase()

                // CRITICAL: Exclude Kashaya and HOT Badam Milk from Temple Meals
                if (itemName.includes('kashaya') ||
                  itemName.includes('hot badam milk') ||
                  itemName.includes('badam milk')) {
                  return false
                }

                return itemName.includes('holige') ||
                  itemName.includes('temple meal') ||
                  itemName.includes('temple meals') ||
                  itemName.includes('prasad') ||
                  itemName.includes('pooja') ||
                  // Enhanced matching for numbered items
                  /\d+\s*temple\s*meal/i.test(item.name || '') ||
                  /temple\s*meal/i.test(item.name || '')
              })

              // CRITICAL: Also exclude orders that ONLY contain Kashaya or HOT Badam Milk
              const hasOnlyExcludedItems = (order.items || []).every(item => {
                const itemName = (item.name || '').toLowerCase()
                return itemName.includes('kashaya') ||
                  itemName.includes('hot badam milk') ||
                  itemName.includes('badam milk')
              })

              // Check for explicit Temple Meals patterns (NOT bill numbers)
              const hasTempleMealsPatterns = (
                orderId.includes('temple') ||
                orderId.includes('-tm-') ||
                customerName.includes('temple')
              )

              // STRICT EXCLUSIONS: Exclude restaurant orders AND self-service indicators
              const isRestaurantOrder = hasTable || !!(order.tableNumber || order.tableId)

              // For Temple Meals: If order has temple meals items, include it regardless of customer name
              // Only exclude if it's clearly a different service type without temple items
              const isSelfServiceOrder = !hasActualTempleMealsItems && (
                orderId.includes('counter') ||
                orderId.includes('darshini') ||
                orderId.includes('self service')
              )

              // RESTRICTIVE LOGIC: ONLY include if has Temple Meals items OR explicit temple patterns 
              // AND not restaurant/self-service AND not only excluded items
              isSameCategory = (hasActualTempleMealsItems || hasTempleMealsPatterns) &&
                !isRestaurantOrder &&
                !isSelfServiceOrder &&
                !hasOnlyExcludedItems

              // console.log('🛕 Temple Meals Fallback (ITEM-DRIVEN):', {
              //   orderId: order.id || order._id,
              //   invoiceNumber: order.invoiceNumber || order.billNumber,
              //   customerName: order.customerName,
              //   hasActualTempleMealsItems: hasActualTempleMealsItems,
              //   hasTempleMealsPatterns: hasTempleMealsPatterns,
              //   hasOnlyExcludedItems: hasOnlyExcludedItems,
              //   isRestaurantOrder: isRestaurantOrder,
              //   isSelfServiceOrder: isSelfServiceOrder,
              //   items: (order.items || []).map(item => ({
              //     name: item.name,
              //     lowerName: (item.name || '').toLowerCase(),
              //     includesTempleMeals: (item.name || '').toLowerCase().includes('temple meals'),
              //     includesTempleMeal: (item.name || '').toLowerCase().includes('temple meal'),
              //     includesHolige: (item.name || '').toLowerCase().includes('holige'),
              //     isKashaya: (item.name || '').toLowerCase().includes('kashaya'),
              //     isBadamMilk: (item.name || '').toLowerCase().includes('badam milk'),
              //     regexMatch: /\d+\s*temple\s*meal/i.test(item.name || '')
              //   })),
              //   finalDecision: isSameCategory ? 'INCLUDE' : 'EXCLUDE'
              // })

            } else if (categoryName.includes('restaurant')) {
              // Restaurant fallback: Must have table and not be temple meals
              const hasTempleIndicators = (
                orderId.includes('temple') ||
                customerName.includes('temple') ||
                (order.items || []).some(item => {
                  const itemName = (item.name || '').toLowerCase()
                  // CRITICAL: Don't exclude Kashaya or HOT Badam Milk from Restaurant
                  if (itemName.includes('kashaya') ||
                    itemName.includes('hot badam milk') ||
                    itemName.includes('badam milk')) {
                    return false // These items are allowed in Restaurant
                  }
                  return itemName.includes('temple meal') ||
                    itemName.includes('temple meals') ||
                    itemName.includes('prasad') ||
                    itemName.includes('pooja') ||
                    itemName.includes('holige')
                })
              )

              isSameCategory = hasTable && !hasTempleIndicators

            } else if (categoryName.includes('darshini') || categoryName.includes('self service') || categoryName.includes('self-service')) {
              // CRITICAL FIX: Self Service fallback - MUCH MORE RESTRICTIVE
              // Only include orders that are clearly NOT from other categories

              const hasActualTempleMealsItems = (order.items || []).some(item => {
                const itemName = (item.name || '').toLowerCase()
                // CRITICAL: Don't exclude Kashaya or HOT Badam Milk from Self Service
                if (itemName.includes('kashaya') ||
                  itemName.includes('hot badam milk') ||
                  itemName.includes('badam milk')) {
                  return false // These items are allowed in Self Service
                }
                return itemName.includes('temple meal') ||
                  itemName.includes('temple meals') ||
                  itemName.includes('prasad') ||
                  itemName.includes('pooja') ||
                  itemName.includes('holige')
              })

              // Check for restaurant indicators (has table)
              const isRestaurantOrder = hasTable || !!(order.tableNumber || order.tableId)

              // CRITICAL FIX: Only include if it's clearly a self-service order
              // AND not a restaurant order AND not a temple meals order
              isSameCategory = !hasActualTempleMealsItems && !isRestaurantOrder

              // console.log('🏪 Self Service Fallback (RESTRICTIVE):', {
              //   orderId: order.id || order._id,
              //   invoiceNumber: order.invoiceNumber || order.billNumber,
              //   customerName: order.customerName,
              //   hasTable,
              //   hasActualTempleMealsItems,
              //   isRestaurantOrder,
              //   hasTableNumber: !!order.tableNumber,
              //   hasTableId: !!order.tableId,
              //   itemCount: (order.items || []).length,
              //   items: (order.items || []).map(item => item.name),
              //   finalDecision: isSameCategory ? 'INCLUDE' : 'EXCLUDE'
              // });
            }
          }
        }

        // CRITICAL FIX: Improved completion status check
        let isCompleted = true
        if (preSelectedCategory && preSelectedCategory !== "All") {

          if (isRestaurantCategory) {
            // Restaurant orders: ONLY include completed, paid, billed, or cancelled orders
            // EXCLUDE pending KOT orders from sales report
            isCompleted = (order.status === 'completed' ||
              order.paymentStatus === 'completed' ||
              order.status === 'paid' ||
              order.paymentStatus === 'paid' ||
              order.status === 'billed' ||
              order.paymentStatus === 'billed' ||
              order.orderStatus === 'completed' ||
              order.orderStatus === 'paid' ||
              order.orderStatus === 'billed' ||
              order.status === 'cancelled' ||
              order.paymentStatus === 'cancelled' ||
              order.orderStatus === 'cancelled') &&
              // EXCLUDE consolidated orders (they are part of comprehensive bills)
              order.status !== 'consolidated' &&
              order.paymentStatus !== 'consolidated'

            // console.log('🍽️ Restaurant Completion Check:', {
            //   orderId: order.id || order._id,
            //   kotNumber: order.kotNumber,
            //   invoiceNumber: order.invoiceNumber || order.billNumber,
            //   status: order.status,
            //   paymentStatus: order.paymentStatus,
            //   orderStatus: order.orderStatus,
            //   isCompleted,
            //   reason: isCompleted ? 'INCLUDED (completed/paid/billed/cancelled)' : 'EXCLUDED (pending KOT)'
            // })

          } else {
            // All other categories (Self Service, Temple Meals, etc.): 
            // ONLY include completed orders, EXCLUDE pending/processing KOT data
            isCompleted = (order.status === 'completed' ||
              order.paymentStatus === 'completed' ||
              order.status === 'paid' ||
              order.paymentStatus === 'paid' ||
              order.status === 'billed' ||
              order.paymentStatus === 'billed' ||
              order.orderStatus === 'completed' ||
              order.orderStatus === 'paid' ||
              order.orderStatus === 'billed' ||
              order.status === 'cancelled' ||
              order.paymentStatus === 'cancelled' ||
              order.orderStatus === 'cancelled') &&
              // EXCLUDE pending/processing orders
              order.status !== 'pending' &&
              order.paymentStatus !== 'pending' &&
              order.status !== 'processing' &&
              order.paymentStatus !== 'processing'

            // console.log('🏪 Self Service/Other Category Completion Check:', {
            //   orderId: order.id || order._id,
            //   categoryName: preSelectedCategory,
            //   invoiceNumber: order.invoiceNumber || order.billNumber,
            //   status: order.status,
            //   paymentStatus: order.paymentStatus,
            //   orderStatus: order.orderStatus,
            //   itemCount: (order.items || []).length,
            //   isCompleted,
            //   reason: isCompleted ? 'INCLUDED (completed order)' : 'EXCLUDED (pending/processing KOT data)'
            // })

          }
        } else {
          // If "All" categories selected, include ALL orders except cancelled/failed
          isCompleted = order.status !== 'cancelled' &&
            order.paymentStatus !== 'cancelled' &&
            order.status !== 'failed' &&
            order.paymentStatus !== 'failed'
        }

        // Variables for debugging (declared here for console.log)
        const orderDate = new Date(order.createdAt || order.orderTime || order.date)
        const isInDateRange = orderDate >= startOfDay && orderDate <= endOfDay
        const orderBranchId = order.branchId?._id || order.branchId || order.branch?.id || order.branch?._id || order.branch
        const isSameBranch = orderBranchId === customerData.selectedBranch._id

        return isInDateRange && isSameBranch && isSameCategory && isCompleted
      })

      // CRITICAL DEBUG: Check if invoice 004 made it through filtering
      const invoice004AfterFilter = filteredOrders.find(o => o.invoiceNumber === '004' || o.billNumber === '004');
      // console.log('🔍 INVOICE 004 - After initial filtering:', invoice004AfterFilter ? 'FOUND ✅' : 'NOT FOUND ❌');
      // if (invoice004AfterFilter) {
      //   console.log('🔍 INVOICE 004 details:', {
      //     id: invoice004AfterFilter._id || invoice004AfterFilter.id,
      //     invoiceNumber: invoice004AfterFilter.invoiceNumber,
      //     totalAmount: invoice004AfterFilter.totalAmount
      //   });
      // }

      // console.log('📊 Filtered orders count:', filteredOrders.length)

      // CRITICAL DEBUG: Show exactly which orders made it through all filters
      // if (preSelectedCategory && preSelectedCategory.toLowerCase().includes('temple')) {
      //   console.log('🎯 FINAL FILTERED ORDERS FOR TEMPLE MEALS:')
      //   filteredOrders.forEach((order, index) => {
      //     console.log(`Final Order ${index + 1}:`, JSON.stringify({
      //       id: order.id || order._id,
      //       invoiceNumber: order.invoiceNumber,
      //       categoryName: order.categoryName,
      //       customerName: order.customerName,
      //       status: order.status,
      //       paymentStatus: order.paymentStatus,
      //       totalAmount: order.totalAmount,
      //       createdAt: order.createdAt
      //     }))
      //   })
      // }

      // CRITICAL DEBUG: Detailed analysis of Self Service filtering
      if (preSelectedCategory && preSelectedCategory.toLowerCase().includes('self service')) {
        // console.log('🏪 SELF SERVICE FILTERING ANALYSIS:')
        // console.log('  Total orders before filtering:', kotOrders.length)
        // console.log('  Orders after filtering:', filteredOrders.length)

        // Check each order to see why it was included/excluded
        // kotOrders.forEach((order, index) => {
        //   const orderDate = new Date(order.createdAt || order.orderTime || order.date)
        //   const isInDateRange = orderDate >= startOfDay && orderDate <= endOfDay
        //   const orderBranchId = order.branchId?._id || order.branchId || order.branch?.id || order.branch?._id || order.branch
        //   const isSameBranch = orderBranchId === customerData.selectedBranch._id

        //   let categoryMatch = 'NO MATCH'
        //   if (order.categoryName) {
        //     const orderCategoryName = order.categoryName.toLowerCase()
        //     if (orderCategoryName.includes('self service') || orderCategoryName.includes('darshini')) {
        //       categoryMatch = 'SAVED CATEGORY MATCH'
        //     }
        //   } else if (!order.tableNumber && !order.tableId) {
        //     categoryMatch = 'FALLBACK MATCH (no table)'
        //   }

        //   // const isIncluded = filteredOrders.some(fo => (fo.id || fo._id) === (order.id || order._id))

        //   // console.log(`    Order ${index + 1} (${order.invoiceNumber || order.billNumber}):`)
        //   // console.log(`      - Category: ${order.categoryName || 'NOT SET'}`)
        //   // console.log(`      - Date match: ${isInDateRange}`)
        //   // console.log(`      - Branch match: ${isSameBranch}`)
        //   // console.log(`      - Category match: ${categoryMatch}`)
        //   // console.log(`      - Table: ${order.tableNumber || 'None'}`)
        //   // console.log(`      - Status: ${order.status}/${order.paymentStatus}`)
        //   // console.log(`      - INCLUDED: ${isIncluded}`)
        // })

        // console.log('🏪 Self Service orders found:', filteredOrders.map(order => ({
        //   id: order.id || order._id,
        //   bill: order.invoiceNumber || order.billNumber,
        //   category: order.categoryName,
        //   customer: order.customerName,
        //   amount: order.totalAmount
        // })))
      }

      // console.log('📊 TEMPLE MEALS DEBUG - Filtering summary:', {
      //   totalOrders: kotOrders.length,
      //   selectedCategory: preSelectedCategory,
      //   filteredCount: filteredOrders.length,
      //   templeMealsOrders: filteredOrders.filter(order => {
      //     // More inclusive Temple Meals detection for debug
      //     const orderCategoryName = (order.categoryName || '').toLowerCase()
      //     const orderId = (order.orderId || order.kotNumber || order.id || order._id || '').toLowerCase()
      //     const customerName = (order.customerName || '').toLowerCase()
      //     const hasTempleIndicators = orderCategoryName.includes('temple') ||
      //       orderId.includes('temple') ||
      //       customerName.includes('temple') ||
      //       (order.invoiceNumber && /^0(1[1-9]|20)$/.test(order.invoiceNumber)) ||
      //       /\[0(1[1-9]|20)\]/.test(order.customerName || '')
      //     return hasTempleIndicators
      //   }).length,
      //   ordersWithCategoryName: filteredOrders.filter(order => order.categoryName).length,
      //   ordersWithoutCategoryName: filteredOrders.filter(order => !order.categoryName).length
      // })
      // CRITICAL DEBUG: Show Temple Meals orders specifically
      if (preSelectedCategory && preSelectedCategory.toLowerCase().includes('temple')) {
        // console.log('� TEMPLE MEALS ORDERS FOUND:')
        // filteredOrders.forEach((order, index) => {
        //   console.log(`  Temple Order ${index + 1}:`, {
        //     id: order.id || order._id,
        //     invoiceNumber: order.invoiceNumber || order.billNumber,
        //     categoryName: order.categoryName,
        //     customerName: order.customerName,
        //     totalAmount: order.totalAmount,
        //     status: order.status,
        //     paymentStatus: order.paymentStatus,
        //     items: (order.items || []).map(item => item.name)
        //   })
        // })
        // console.log(`🛕 Total Temple Meals orders in sales report: ${filteredOrders.length}`)

        // ADDITIONAL DEBUG: Show all orders that were processed for Temple Meals
        // console.log('🔍 ALL ORDERS PROCESSED FOR TEMPLE MEALS (first 10):')
        // kotOrders.slice(0, 10).forEach((order, index) => {
        //   console.log(`  All Order ${index + 1}:`, {
        //     id: order.id || order._id,
        //     invoiceNumber: order.invoiceNumber || order.billNumber,
        //     categoryName: order.categoryName,
        //     customerName: order.customerName,
        //     status: order.status,
        //     paymentStatus: order.paymentStatus,
        //     hasTempleInvoice: order.invoiceNumber && (/^0(1[1-9]|20)$/.test(order.invoiceNumber) || /^0(6[1-9]|70)$/.test(order.invoiceNumber)),
        //     hasTempleCustomer: /\[0(1[1-9]|20)\]/.test(order.customerName || '') || /\[0(6[1-9]|70)\]/.test(order.customerName || ''),
        //     noTable: !order.tableNumber && !order.tableId,
        //     items: (order.items || []).map(item => item.name)
        //   })
        // })
      }

      // console.log('📊 Sample filtered orders with category info:', filteredOrders.slice(0, 3).map(order => ({
      //   id: order.id || order._id,
      //   invoiceNumber: order.invoiceNumber,
      //   categoryName: order.categoryName,
      //   categoryId: order.categoryId,
      //   branchName: order.branchName,
      //   customerName: order.customerName,
      //   totalAmount: order.totalAmount,
      //   status: order.status,
      //   paymentStatus: order.paymentStatus,
      //   createdAt: order.createdAt
      // })))
      // console.log('📊 Filtered orders:', filteredOrders)

      // NO DEDUPLICATION - Show all orders including duplicates from comprehensive bills
      // This matches the behavior of Categorized Orders page
      let finalOrders = filteredOrders

      // Debug: Show detailed filtering results
      // console.log('📊 Filtering Debug - showing first 5 orders:')
      kotOrders.slice(0, 5).forEach((order, index) => {
        const orderDate = new Date(order.createdAt || order.orderTime || order.date)
        const isInDateRange = orderDate >= startOfDay && orderDate <= endOfDay

        const orderBranchId = order.branchId?._id || order.branchId || order.branch?.id || order.branch?._id || order.branch
        const selectedBranchId = customerData.selectedBranch._id
        const isSameBranch = orderBranchId === selectedBranchId

        // Check completion status
        let isCompleted = true
        if (preSelectedCategory && preSelectedCategory !== "All") {
          const categoryName = preSelectedCategory.toLowerCase()

          if (categoryName.includes('restaurant')) {
            isCompleted = (order.status === 'completed' ||
              order.paymentStatus === 'completed' ||
              order.status === 'paid' ||
              order.paymentStatus === 'paid' ||
              order.status === 'billed' ||
              order.paymentStatus === 'billed' ||
              order.orderStatus === 'completed' ||
              order.orderStatus === 'paid' ||
              order.orderStatus === 'billed') &&
              // EXCLUDE consolidated orders (they are part of comprehensive bills)
              order.status !== 'consolidated' &&
              order.paymentStatus !== 'consolidated'
          } else {
            isCompleted = true
          }
        }

        // Check category filtering
        let isSameCategory = true
        if (preSelectedCategory && preSelectedCategory !== "All") {
          const categoryName = preSelectedCategory.toLowerCase()

          const orderId = (order.orderId || order.kotNumber || order.id || order._id || '').toLowerCase()
          const customerName = (order.customerName || '').toLowerCase()
          const branchName = (order.branchName || order.branchId?.name || order.branch?.name || '').toLowerCase()
          const itemNames = (order.items || []).map(item => (item.name || '').toLowerCase()).join(' ')

          if (categoryName.includes('temple') || categoryName.includes('meal')) {
            // Temple Meals: Use exact category matching when available
            if (order.categoryName) {
              const orderCategoryName = order.categoryName.toLowerCase()
              isSameCategory = (
                orderCategoryName.includes('temple') ||
                orderCategoryName === 'temple meals' ||
                orderCategoryName === 'temple meal'
              ) &&
                // Exclude Self Service orders
                !orderCategoryName.includes('self service') &&
                !orderCategoryName.includes('darshini')
            } else {
              // ITEM-DRIVEN FALLBACK: ONLY include orders with actual Temple Meals items
              const hasActualTempleMealsItems = (order.items || []).some(item => {
                const itemName = (item.name || '').toLowerCase()

                // CRITICAL: Exclude Kashaya and HOT Badam Milk from Temple Meals
                if (itemName.includes('kashaya') ||
                  itemName.includes('hot badam milk') ||
                  itemName.includes('badam milk')) {
                  return false
                }

                return itemName.includes('holige') ||
                  itemName.includes('temple meal') ||
                  itemName.includes('temple meals') ||
                  itemName.includes('prasad') ||
                  itemName.includes('pooja') ||
                  // Enhanced matching for numbered items
                  /\d+\s*temple\s*meal/i.test(item.name || '') ||
                  /temple\s*meal/i.test(item.name || '')
              })

              // CRITICAL: Also exclude orders that ONLY contain Kashaya or HOT Badam Milk
              const hasOnlyExcludedItems = (order.items || []).every(item => {
                const itemName = (item.name || '').toLowerCase()
                return itemName.includes('kashaya') ||
                  itemName.includes('hot badam milk') ||
                  itemName.includes('badam milk')
              })

              // Check for explicit Temple Meals patterns (NOT bill numbers)
              const hasTempleMealsPatterns = (
                orderId.includes('temple') ||
                orderId.includes('-tm-') ||
                customerName.includes('temple')
              )

              // STRICT EXCLUSIONS: Exclude restaurant orders AND self-service indicators
              const isRestaurant = !!(order.tableNumber && order.tableId)

              // For Temple Meals: If order has temple meals items, include it regardless of customer name
              // Only exclude if it's clearly a different service type without temple items
              const isSelfService = !hasActualTempleMealsItems && (
                orderId.includes('counter') ||
                orderId.includes('darshini') ||
                orderId.includes('self service')
              )

              // RESTRICTIVE: ONLY include if has Temple Meals items OR explicit temple patterns 
              // AND not restaurant/self-service AND not only excluded items
              isSameCategory = (hasActualTempleMealsItems || hasTempleMealsPatterns) &&
                !isRestaurant &&
                !isSelfService &&
                !hasOnlyExcludedItems

              // console.log('🛕 Temple Meals Item-Driven Filter:', {
              //   orderId: order.id || order._id,
              //   invoiceNumber: order.invoiceNumber || order.billNumber,
              //   customerName: order.customerName,
              //   hasActualTempleMealsItems: hasActualTempleMealsItems,
              //   hasTempleMealsPatterns: hasTempleMealsPatterns,
              //   hasOnlyExcludedItems: hasOnlyExcludedItems,
              //   isRestaurant: isRestaurant,
              //   isSelfService: isSelfService,
              //   items: (order.items || []).map(item => ({
              //     name: item.name,
              //     lowerName: (item.name || '').toLowerCase(),
              //     includesTempleMeals: (item.name || '').toLowerCase().includes('temple meals'),
              //     includesTempleMeal: (item.name || '').toLowerCase().includes('temple meal'),
              //     includesHolige: (item.name || '').toLowerCase().includes('holige'),
              //     isKashaya: (item.name || '').toLowerCase().includes('kashaya'),
              //     isBadamMilk: (item.name || '').toLowerCase().includes('badam milk'),
              //     regexMatch: /\d+\s*temple\s*meal/i.test(item.name || '')
              //   })),
              //   willInclude: isSameCategory
              // })
            }
          } else if (categoryName.includes('restaurant')) {
            // CRITICAL FIX: Only exclude actual Temple Meals items, NOT Kashaya/Badam Milk
            const isTemple = orderId.includes('temple') ||
              orderId.includes('-tm-') ||
              customerName.includes('temple') ||
              branchName.includes('temple') ||
              // CRITICAL: Only exclude if order contains actual temple meals (not kashaya/badam milk)
              (order.items || []).some(item => {
                const itemName = (item.name || '').toLowerCase()
                // CRITICAL: Don't exclude Kashaya or HOT Badam Milk from Restaurant
                if (itemName.includes('kashaya') ||
                  itemName.includes('hot badam milk') ||
                  itemName.includes('badam milk')) {
                  return false // These items are allowed in Restaurant
                }
                return itemName.includes('temple meal') ||
                  itemName.includes('temple meals') ||
                  itemName.includes('prasad') ||
                  itemName.includes('pooja') ||
                  itemName.includes('holige')
              })
            isSameCategory = !isTemple && order.tableNumber && order.tableId
          } else if (categoryName.includes('darshini') || categoryName.includes('self service') || categoryName.includes('self-service')) {
            // CRITICAL FIX: Only exclude actual Temple Meals items, NOT Kashaya/Badam Milk
            const isTemple = orderId.includes('temple') ||
              orderId.includes('-tm-') ||
              customerName.includes('temple') ||
              branchName.includes('temple') ||
              // CRITICAL: Only exclude if order contains actual temple meals (not kashaya/badam milk)
              (order.items || []).some(item => {
                const itemName = (item.name || '').toLowerCase()
                // CRITICAL: Don't exclude Kashaya or HOT Badam Milk from Self Service
                if (itemName.includes('kashaya') ||
                  itemName.includes('hot badam milk') ||
                  itemName.includes('badam milk')) {
                  return false // These items are allowed in Self Service
                }
                return itemName.includes('temple meal') ||
                  itemName.includes('temple meals') ||
                  itemName.includes('prasad') ||
                  itemName.includes('pooja') ||
                  itemName.includes('holige')
              })

            // Check for restaurant indicators
            const isRestaurant = (order.tableNumber && order.tableId) || // Has table assignment
              (order.tableNumber || order.tableId) || // Has either table number or ID
              orderId.includes('-res-') || // Restaurant order ID pattern
              orderId.includes('table') || // Order ID mentions table
              customerName.includes('table') // Table-based customer

            // INCLUSIVE: Include walk-in customers and counter orders (typical self-service patterns)
            const isSelfServicePattern = (
              customerName.includes('walk-in') ||
              customerName.includes('[undefined]') ||
              customerName.includes('[pending]') ||
              orderId.includes('counter') ||
              orderId.includes('darshini') ||
              orderId.includes('self service')
            )

            // Include if it's a self-service pattern OR (not temple AND not restaurant AND no table)
            isSameCategory = isSelfServicePattern || (!isTemple && !isRestaurant && !order.tableNumber && !order.tableId)
          }
        }

        // console.log(`📊 Order ${index + 1}:`, {
        //   id: order.id || order._id,
        //   orderDate: orderDate.toISOString(),
        //   dateForComparison: orderDate.toDateString(),
        //   selectedDate: filterDate.toDateString(),
        //   isInDateRange,
        //   orderBranchId,
        //   selectedBranchId,
        //   isSameBranch,
        //   status: order.status,
        //   paymentStatus: order.paymentStatus,
        //   orderStatus: order.orderStatus,
        //   isCompleted,
        //   categoryName: preSelectedCategory,
        //   isSameCategory,
        //   tableNumber: order.tableNumber,
        //   tableId: order.tableId,
        //   shouldInclude: isInDateRange && isSameBranch && isCompleted && isSameCategory,
        //   items: (order.items || []).map(item => item.name)
        // })
      })

      // Calculate sales statistics using deduplicated orders
      // INCLUDE PENDING, PROCESSING, AND CONSOLIDATED ORDERS
      // ONLY EXCLUDE CANCELLED ORDERS
      const activeOrders = finalOrders.filter(order => {
        const paymentStatus = (order.paymentStatus || '').toLowerCase()
        const orderStatus = (order.orderStatus || order.status || '').toLowerCase()

        // Only exclude cancelled orders
        if (orderStatus === 'cancelled') {
          // console.log('🚫 SALES REPORT: Excluding cancelled order:', order.invoiceNumber || order.id, { paymentStatus, orderStatus, amount: order.totalAmount || order.grandTotal })
          return false
        }

        // Include all other orders (pending, processing, consolidated, completed)
        // console.log('✅ SALES REPORT: Including order:', order.invoiceNumber || order.id, {
        //   paymentStatus,
        //   orderStatus,
        //   amount: order.totalAmount || order.grandTotal
        // })
        return true
      })

      // console.log('📊 SALES REPORT FILTERING SUMMARY:', {
      //   totalFinalOrders: finalOrders.length,
      //   activeOrders: activeOrders.length,
      //   excludedOrders: finalOrders.length - activeOrders.length,
      //   totalRevenue: activeOrders.reduce((sum, order) => sum + (order.totalAmount || order.grandTotal || 0), 0)
      // })

      const cancelledOrders = finalOrders.filter(order =>
        order.orderStatus === 'cancelled' || order.status === 'cancelled'
      )

      // Use activeOrders for statistics (excludes cancelled orders)
      const totalOrders = activeOrders.length
      const totalRevenue = activeOrders.reduce((sum, order) => {
        return sum + (order.totalAmount || order.grandTotal || 0)
      }, 0)

      const cancelledRevenue = cancelledOrders.reduce((sum, order) => {
        return sum + (order.totalAmount || order.grandTotal || 0)
      }, 0)

      const totalItems = activeOrders.reduce((sum, order) => {
        return sum + (order.items || []).reduce((itemSum, item) => itemSum + (item.quantity || 1), 0)
      }, 0)

      // Calculate discount statistics (for active orders only)
      const totalDiscount = activeOrders.reduce((sum, order) => {
        return sum + (order.discountAmount || 0)
      }, 0)

      // Offline-pending stats (bills not yet synced to server — still in offlineQueue)
      const offlinePendingOrders = activeOrders.filter(o => o.isOfflinePending === true)
      const offlinePendingCount = offlinePendingOrders.length
      const offlinePendingRevenue = offlinePendingOrders.reduce((sum, o) => sum + (o.totalAmount || o.grandTotal || 0), 0)

      // Group by hour for hourly sales (for active orders only)
      const hourlySales = {}
      activeOrders.forEach(order => {
        const hour = new Date(order.createdAt || order.orderTime).getHours()
        const hourKey = `${hour}:00`
        if (!hourlySales[hourKey]) {
          hourlySales[hourKey] = { orders: 0, revenue: 0 }
        }
        hourlySales[hourKey].orders += 1
        hourlySales[hourKey].revenue += (order.totalAmount || order.grandTotal || 0)
      })

      const salesReport = {
        date: filterDate.toISOString().split('T')[0], // Selected date in YYYY-MM-DD format
        category: preSelectedCategory || 'All Categories',
        branch: customerData?.selectedBranch?.name ||
          (() => { try { return JSON.parse(localStorage.getItem('selectedBranch') || '{}').name } catch(_){} return 'Branch' })(),
        summary: {
          totalOrders,
          totalRevenue,
          totalGST: activeOrders.reduce((sum, order) => {
            if (!order.items || !Array.isArray(order.items)) return sum
            return sum + order.items.reduce((itemSum, item) => {
              const rate = item.gstRate || 0
              return itemSum + (((item.price || 0) * (item.quantity || 0) * rate) / 100)
            }, 0)
          }, 0),
          cancelledOrders: cancelledOrders.length,
          cancelledRevenue,
          totalItems,
          totalDiscount,
          averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
          offlinePendingCount,
          offlinePendingRevenue,
        },
        hourlySales: Object.entries(hourlySales)
          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
          .map(([hour, data]) => ({ hour, ...data })),
        orders: finalOrders
          // Sort orders by creation time (newest first) for sales report display
          .sort((a, b) => {
            const aTime = new Date(a.createdAt || a.orderTime || 0)
            const bTime = new Date(b.createdAt || b.orderTime || 0)
            return bTime - aTime // Newest first
          })
          .map(order => {
            // Debug: Log order fields to see what's available
            // console.log('🔍 Order fields available:', {
            //   id: order.id || order._id,
            //   invoiceNumber: order.invoiceNumber,
            //   billNumber: order.billNumber,
            //   kotNumber: order.kotNumber,
            //   orderId: order.orderId,
            //   orderNumber: order.orderNumber,
            //   paymentStatus: order.paymentStatus,
            //   status: order.status,
            //   customerName: order.customerName,
            //   tableNumber: order.tableNumber,
            //   totalAmount: order.totalAmount,
            //   allFields: Object.keys(order)
            // })

            // CRITICAL: Check if this is a Self Service order without proper invoice number
            const isLikelySelfService = !order.tableNumber && order.paymentStatus === 'completed'
            if (isLikelySelfService) {
              // console.log('🏪 Self Service order detected:', {
              //   id: order.id || order._id,
              //   invoiceNumber: order.invoiceNumber,
              //   billNumber: order.billNumber,
              //   hasInvoiceNumber: !!(order.invoiceNumber),
              //   hasBillNumber: !!(order.billNumber),
              //   willUseFallback: !order.invoiceNumber && !order.billNumber
              // })
            }

            // For restaurant orders, prioritize invoiceNumber (bill number) over kotNumber
            let orderNumber

            // Check direct fields first
            if (order.invoiceNumber && !order.invoiceNumber.includes('ObjectId') && order.invoiceNumber.length <= 20) {
              orderNumber = order.invoiceNumber
              // console.log('✅ Using invoiceNumber:', orderNumber)
            } else if (order.billNumber && !order.billNumber.includes('ObjectId') && order.billNumber.length <= 20) {
              orderNumber = order.billNumber
              // console.log('✅ Using billNumber:', orderNumber)
            }
            // WORKAROUND: Extract bill number from customerName field
            else if (order.customerName && order.customerName.includes('[BILL-') && order.customerName.includes(']')) {
              const match = order.customerName.match(/\[(BILL-\d+)\]/)
              if (match) {
                orderNumber = match[1]
                // console.log('✅ WORKAROUND SUCCESS: Extracted bill number from customerName:', orderNumber, 'from:', order.customerName)
              } else {
                // console.log('❌ WORKAROUND FAILED: Could not extract bill number from:', order.customerName)
              }
            }
            else if (order.kotNumber) {
              orderNumber = order.kotNumber
              // console.log('✅ Using kotNumber:', orderNumber)
            } else {
              // Fallback to other identifiers
              orderNumber = order.orderId || order.orderNumber || order.id || order._id
              // console.log('⚠️ Using fallback:', orderNumber, 'Available fields:', {
              //   invoiceNumber: order.invoiceNumber,
              //   billNumber: order.billNumber,
              //   kotNumber: order.kotNumber,
              //   orderId: order.orderId,
              //   orderNumber: order.orderNumber,
              //   id: order.id,
              //   _id: order._id,
              //   customerName: order.customerName
              // })
            }

            if (!orderNumber || orderNumber.includes('ObjectId') || orderNumber.length > 20) {
              // For Self Service orders, try to use a simple sequential approach
              if (isLikelySelfService) {
                // For Self Service, generate a simple BILL number based on order ID
                const orderId = order.id || order._id || Date.now()
                const orderSuffix = orderId.toString().slice(-6) // Use last 6 characters
                orderNumber = `BILL-${orderSuffix.slice(-3)}` // Use last 3 characters for bill
                // console.log('🏪 Generated BILL number for Self Service:', orderNumber)
              } else {
                // For other orders, use ORDER format
                const orderId = order.id || order._id || Date.now()
                const orderSuffix = orderId.toString().slice(-6) // Use last 6 characters
                orderNumber = `ORDER-${orderSuffix}`
                // console.log('🔧 Generated ORDER number for restaurant:', orderNumber)
              }
            }

            // Convert KOT numbers to BILL format for completed orders
            if (orderNumber && orderNumber.startsWith('KOT-') && order.paymentStatus === 'completed') {
              const kotSuffix = orderNumber.replace('KOT-', '')
              orderNumber = `BILL-${kotSuffix}`
              // console.log('🔄 Converted KOT to BILL format:', orderNumber)
            }

            // Final check: For Self Service completed orders, ensure we show BILL format
            if (isLikelySelfService && orderNumber && orderNumber.startsWith('ORDER-')) {
              // Convert ORDER-xxx to BILL-xxx for Self Service
              const orderSuffix = orderNumber.replace('ORDER-', '')
              orderNumber = `BILL-${orderSuffix}`
              // console.log('🏪 Final conversion: ORDER to BILL for Self Service:', orderNumber)
            }

            return {
              id: order.id || order._id,
              orderNumber: orderNumber,
              invoiceNumber: order.invoiceNumber || order.billNumber || null, // Keep original for reference
              time: new Date(order.createdAt || order.orderTime).toLocaleTimeString('en-IN', {
                hour12: true,
                hour: '2-digit',
                minute: '2-digit'
              }),
              customerName: (() => {
                const rawCustomerName = order.customerName || 'Walk-in Customer'
                // Remove any [undefined], [null], or empty brackets from customer name
                return rawCustomerName
                  .replace(/\[undefined\]/gi, '')
                  .replace(/\[null\]/gi, '')
                  .replace(/\[\]/g, '')
                  .trim()
              })(),
              tableNumber: order.tableNumber || null,
              items: order.items || [],
              // Debug: Log the order amounts to see what's in the database
              originalTotalAmount: order.totalAmount || order.grandTotal || 0,
              discountAmount: order.discountAmount || 0,
              // CORRECT: totalAmount is already the final amount after discount
              totalAmount: (() => {
                const dbTotalAmount = order.totalAmount || order.grandTotal || 0
                const dbDiscountAmount = order.discountAmount || 0
                const dbSubtotal = order.subtotal || 0

                // console.log('💰 Order amount debug for', orderNumber, ':', {
                //   orderId: order.id || order._id,
                //   dbTotalAmount,
                //   dbDiscountAmount,
                //   dbSubtotal,
                //   orderFields: {
                //     totalAmount: order.totalAmount,
                //     grandTotal: order.grandTotal,
                //     discountAmount: order.discountAmount,
                //     subtotal: order.subtotal
                //   },
                //   // Special debug for BILL-005
                //   isBill005: orderNumber === 'BILL-005',
                //   rawOrderData: orderNumber === 'BILL-005' ? order : 'not BILL-005'
                // })

                // CORRECT LOGIC: 
                // BillGeneration.jsx saves totalAmount as (subtotal - discountAmount)
                // So totalAmount already contains the final amount after discount
                const finalAmount = dbTotalAmount

                // console.log('💰 Using totalAmount directly (already discounted):', finalAmount)
                return finalAmount
              })(),
              paymentMethod: order.paymentMethod || 'cash',
              // CRITICAL FIX: Include cancellation fields from backend
              orderStatus: order.orderStatus,
              status: order.status,
              paymentStatus: order.paymentStatus,
              cancellationReason: order.cancellationReason,
              cancelledAt: order.cancelledAt,
              cancelledBy: order.cancelledBy,
              categoryName: order.categoryName || null,
            }
          })
      }

      // console.log('📊 Sales report loaded:', salesReport)
      // console.log('📊 Sample order with amounts:', salesReport.orders[0])
      // console.log('📊 All order amounts:', salesReport.orders.map(o => ({
      //   orderNumber: o.orderNumber,
      //   totalAmount: o.totalAmount,
      //   discountAmount: o.discountAmount,
      //   originalTotalAmount: o.originalTotalAmount
      // })))

      // Special debug for discount orders
      const ordersWithDiscount = salesReport.orders.filter(o => o.discountAmount > 0)
      // console.log('💰 Orders with discounts:', ordersWithDiscount.length, ordersWithDiscount)

      // Only set sales data in sales report mode (selectedDate is set)
      // In KOT mode this code path is not reached (we return early above)
      if (selectedDate) setSalesData(salesReport)

    } catch (error) {
      console.error('❌ Error loading sales report:', error)

      // ── OFFLINE / ERROR FALLBACK ──
      if (branchId && !selectedDate) {
        // KOT list mode — load pending KOTs from cache
        try {
          const cachedKOTs = await localCache.getPendingKOTs(branchId)
          if (cachedKOTs.length > 0) {
            const processedKOTs = cachedKOTs.map(order => ({
              id: order.id || order._id,
              kotNumber: order.kotNumber || `KOT-${(order.id || order._id)?.slice(-6)}`,
              tableNumber: order.tableNumber,
              tableId: order.tableId,
              customerName: order.customerName || 'Walk-in Customer',
              items: order.items || [],
              totalAmount: order.totalAmount || order.grandTotal || 0,
              createdAt: order.createdAt || order.kotTime,
              status: order.status,
              paymentStatus: order.paymentStatus,
              isOffline: order.isOffline || false,
            })).filter(kot => (kot.items || []).some(item => (item.quantity || 0) > 0))
            setSavedKOTs(processedKOTs)
            setKotLoading(false)
            setSalesLoading(false)
            return
          }
        } catch (_) {}
      }

      if (branchId && selectedDate) {
        // Sales report error — salesData was already set from local cache above
        // Nothing to do here, local data is already displayed
      }

      if (!selectedDate) {
        setSavedKOTs([])
      } else {
        setSalesData(null)
      }
    } finally {
      // CRITICAL FIX: Reset both loading states
      setKotLoading(false)
      setSalesLoading(false)
    }
  }

  // Sales Report function - wrapper around loadSavedKOTs since it handles sales data
  const loadSalesReport = async (selectedDate = null) => {
    try {
      setCurrentPage(1) // Reset pagination to first page when loading new data

      // Only show loading spinner if we have no existing data to display
      if (!salesData) {
        setSalesLoading(true)
      }

      // Trigger sync only once per sales report session open (not on every date change)
      if (navigator.onLine && !hasSyncedOnOpenRef.current) {
        hasSyncedOnOpenRef.current = true
        syncManager.triggerSync().catch(() => {})
      }

      // Use loadSavedKOTs since it processes and creates sales report data
      await loadSavedKOTs(0, selectedDate)

    } catch (error) {
      console.error('❌ Error loading sales report:', error)
      setSalesData(null)
    } finally {
      setSalesLoading(false)
    }
  }

  // Force-upload all pending offline bills then reload the sales report
  const handleSyncBills = async () => {
    if (syncingBills) return
    setSyncingBills(true)
    try {
      // Step 1: Re-enqueue any localCache bills that are not synced and not already in queue
      try {
        const branchId = customerData?.selectedBranch?._id
        const cachedBills = await localCache._getAll('bills').catch(() => [])
        // Include failed_permanent entries so we know what's already queued
        const pendingEntries = await offlineQueue.listPending(true).catch(() => [])
        const pendingInvoiceNums = new Set(pendingEntries.filter(e => e.type === 'bill').map(e => e.payload.invoiceNumber).filter(Boolean))

        // Fetch server bills to verify which ones actually exist as completed bills
        let serverCompletedInvoiceNums = new Set()
        try {
          const serverRes = await counterApi.getOrders(branchId, { limit: 10000, includeComplimentary: true })
          const serverOrders = serverRes?.data ?? serverRes?.orders ?? (Array.isArray(serverRes) ? serverRes : [])
          if (Array.isArray(serverOrders)) {
            serverOrders
              .filter(o => (o.paymentStatus === 'completed' || o.orderStatus === 'completed') && !o.kotNumber)
              .forEach(o => { if (o.invoiceNumber) serverCompletedInvoiceNums.add(o.invoiceNumber) })
          }
        } catch (_) {}

        // Re-enqueue bills that: (a) not synced, OR (b) marked synced but not actually on server
        const billsToReEnqueue = cachedBills.filter(b => {
          if (!b.invoiceNumber) return false
          if (pendingInvoiceNums.has(b.invoiceNumber)) return false // already queued
          if (!b.synced) return true // not synced at all
          if (serverCompletedInvoiceNums.size > 0 && !serverCompletedInvoiceNums.has(b.invoiceNumber)) return true
          return false
        })

        for (const bill of billsToReEnqueue) {
          const isDup = await offlineQueue.isDuplicate('bill', 'invoiceNumber', bill.invoiceNumber).catch(() => false)
          if (!isDup) {
            await offlineQueue.enqueue('bill', {
              ...bill,
              branchId: bill.branchId || branchId,
              existingOrderIds: bill.existingOrderIds || bill.originalKOTIds || [],
            }).catch(() => {})
            localCache.saveBill({ ...bill, synced: false }).catch(() => {})
            console.log('[handleSyncBills] Re-enqueued bill:', bill.invoiceNumber)
          }
        }
      } catch (reEnqueueErr) {
        console.warn('[handleSyncBills] Re-enqueue step failed:', reEnqueueErr)
      }

      await syncManager.triggerSync()

      // Check for sync errors and alert user
      const syncErrors = window.__syncErrors || []
      const billErrors = syncErrors.filter(e => e.type === 'bill')
      if (billErrors.length > 0) {
        const errorDetails = billErrors.map(e => `Bill ${e.label}: ${e.error}`).join('\n')
        alert(`⚠️ ${billErrors.length} bill(s) failed to sync:\n\n${errorDetails}\n\nCheck browser console for details.`)
      }

      const count = await offlineQueue.countPending().catch(() => 0)
      setPendingSyncCount(count)
      hasSyncedOnOpenRef.current = true
      await loadSavedKOTs(0, selectedSalesDate)
    } catch (err) {
      console.error('[handleSyncBills] error:', err)
      alert(`Sync failed: ${err.message}`)
    } finally {
      setSyncingBills(false)
    }
  }

  // Load complimentary bills — merges local cache + server (same pattern as sales report)
  const loadComplimentaryBills = async (selectedDate = null) => {
    setComplimentaryLoading(true)
    try {
      const targetDate = selectedDate || selectedComplimentaryDate

      let branchId = customerData?.selectedBranch?._id
      if (!branchId) {
        try { branchId = JSON.parse(localStorage.getItem("selectedBranch") || '{}')._id } catch (_) {}
      }
      if (!branchId) throw new Error('No branch selected')

      const filterDate = new Date(targetDate)
      const startOfDay = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate(), 0, 0, 0, 0)
      const endOfDay   = new Date(filterDate.getFullYear(), filterDate.getMonth(), filterDate.getDate(), 23, 59, 59, 999)

      const activeCategoryName = preSelectedCategory || null

      // 1. Local cache — bills marked isComplimentary
      const cachedBills = await localCache.getBills(branchId).catch(() => [])
      const localComplimentary = cachedBills.filter(b => {
        if (!b.isComplimentary) return false
        const d = new Date(b.savedAt || b.createdAt || 0)
        if (d < startOfDay || d > endOfDay) return false
        if (activeCategoryName) {
          const bc = (b.categoryName || '').toLowerCase().trim()
          const fc = activeCategoryName.toLowerCase().trim()
          if (bc !== fc && !bc.includes(fc) && !fc.includes(bc)) return false
        }
        return true
      })

      // Build map by invoiceNumber for dedup
      const seen = new Map()
      for (const b of localComplimentary) {
        if (b.invoiceNumber) seen.set(b.invoiceNumber, b)
      }

      // 2. If online, fetch server complimentary bills and merge
      if (navigator.onLine) {
        try {
          const serverRes = await counterApi.getOrders(branchId, {
            date: targetDate,
            includeComplimentary: true,
            limit: 10000,
            ...(activeCategoryName ? { categoryName: activeCategoryName } : {}),
          })
          let serverOrders = []
          if (serverRes?.success && Array.isArray(serverRes.data)) serverOrders = serverRes.data
          else if (Array.isArray(serverRes?.orders)) serverOrders = serverRes.orders
          else if (Array.isArray(serverRes?.data)) serverOrders = serverRes.data
          else if (Array.isArray(serverRes)) serverOrders = serverRes

          for (const o of serverOrders) {
            if (!o.isComplimentary) continue
            const inv = o.invoiceNumber || o.billNumber
            if (!inv) continue
            // Server version is authoritative — override local if exists
            seen.set(inv, {
              ...(seen.get(inv) || {}),
              ...o,
              invoiceNumber: inv,
              savedAt: o.createdAt,
            })
          }
        } catch (_) {
          // Server fetch failed — local data is all we have
        }
      }

      const formattedBills = [...seen.values()].map(order => ({
        billId: order.id || order._id,
        orderId: order.id || order._id,
        customerName: (order.customerName || 'Walk-in Customer').replace(/\[undefined\]/gi, '').replace(/\[null\]/gi, '').trim(),
        amount: order.grandTotal || order.totalAmount || 0,
        reason: order.complimentaryReason || 'No reason provided',
        time: new Date(order.savedAt || order.createdAt || Date.now()).toLocaleTimeString('en-IN', {
          hour: '2-digit', minute: '2-digit', hour12: true
        }),
        invoiceNumber: order.invoiceNumber || order.billNumber || 'N/A',
        items: order.items || [],
        complimentaryBy: order.complimentaryBy || 'N/A',
        categoryName: order.categoryName || 'N/A',
        paymentMethod: order.paymentMethod || 'Cash',
        createdAt: order.savedAt || order.createdAt,
      })).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))

      setComplimentaryBills(formattedBills)
    } catch (error) {
      console.error('❌ Error loading complimentary bills:', error)
      setComplimentaryBills([])
    } finally {
      setComplimentaryLoading(false)
    }
  }

  // Table shift function
  const handleTableShift = async (kot) => {
    try {
      // console.log('🔄 Starting table shift for KOT:', kot.kotNumber, 'from table:', kot.tableNumber)

      // Set the KOT being shifted
      setShiftingKOT(kot)

      // Get available tables (exclude current table)
      const currentTableNumber = kot.tableNumber
      const availableTablesList = tables.filter(table =>
        table.status === 'available' && table.number !== currentTableNumber
      )

      setAvailableTables(availableTablesList)
      setSelectedNewTable(null)
      setShowTableShiftModal(true)

    } catch (error) {
      console.error('❌ Error preparing table shift:', error)
      alert('Failed to prepare table shift. Please try again.')
    }
  }

  // Execute table shift
  const executeTableShift = async () => {
    if (!shiftingKOT || !selectedNewTable) {
      alert('Please select a table to shift to.')
      return
    }

    try {
      // Check if this is a full table shift (all KOTs) or single KOT shift
      const isTableShift = shiftingKOT.isTableShift && shiftingKOT.allTableKOTs;
      const kotsToShift = isTableShift ? shiftingKOT.allTableKOTs : [shiftingKOT];

      // console.log('🔄 Executing table shift:', {
      //   isTableShift: isTableShift,
      //   kotCount: kotsToShift.length,
      //   fromTable: shiftingKOT.tableNumber,
      //   toTable: selectedNewTable.number,
      //   kotNumbers: kotsToShift.map(kot => kot.kotNumber)
      // })

      // Update all KOTs with new table information
      const updateData = {
        tableId: selectedNewTable._id || selectedNewTable.id,
        tableNumber: selectedNewTable.number
      }

      // Shift all KOTs to the new table
      for (const kot of kotsToShift) {
        await counterApi.request(`/counter-order/orders/${kot.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData)
        })
        // console.log(`✅ Shifted KOT ${kot.kotNumber} to Table ${selectedNewTable.number}`)
      }

      // Find the old table ID from the tables array using table number
      const oldTable = tables.find(table => table.number === shiftingKOT.tableNumber)
      const oldTableId = oldTable?._id || oldTable?.id

      // console.log('🔄 Table IDs:', {
      //   oldTableNumber: shiftingKOT.tableNumber,
      //   oldTableId: oldTableId,
      //   newTableNumber: selectedNewTable.number,
      //   newTableId: selectedNewTable._id || selectedNewTable.id
      // })

      // Update the old table status to available (only if we found the table ID)
      if (oldTableId) {
        await counterApi.request(`/table/${oldTableId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'available'
          })
        })
        // console.log('✅ Old table status updated to available')
      } else {
        console.warn('⚠️ Could not find old table ID, skipping old table status update')
      }

      // Update the new table status to occupied
      await counterApi.request(`/table/${selectedNewTable._id || selectedNewTable.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'occupied'
        })
      })
      // console.log('✅ New table status updated to occupied')

      // console.log('✅ Table shift completed successfully')

      // Close modal and refresh data
      setShowTableShiftModal(false)
      setShiftingKOT(null)
      setSelectedNewTable(null)

      // Refresh KOTs and tables
      await loadSavedKOTs()
      await loadTables()

      // Show appropriate success message
      if (isTableShift) {
        alert(`✅ Successfully shifted entire Table ${shiftingKOT.tableNumber} (${kotsToShift.length} KOTs) to Table ${selectedNewTable.number}`)
      } else {
        alert(`✅ Successfully shifted KOT ${shiftingKOT.kotNumber} from Table ${shiftingKOT.tableNumber} to Table ${selectedNewTable.number}`)
      }

    } catch (error) {
      console.error('❌ Error executing table shift:', error)
      alert('Failed to shift table. Please try again.')
    }
  }

  // CRITICAL: Restore focus to search input after loading completes
  // This prevents the input from losing focus during API calls/re-renders
  useEffect(() => {
    // When loading completes and search query is not empty, restore focus
    if (!loading && searchQuery !== "000" && searchQuery !== "" && searchInputRef.current) {
      // Check if focus was lost (active element is not the search input)
      if (document.activeElement !== searchInputRef.current) {
        // console.log('🔍 Loading completed, restoring focus to search input')
        searchInputRef.current.focus()
      }
    }
  }, [loading, searchQuery]) // Run when loading state changes

  // Auto-focus quantity input when popup opens
  useEffect(() => {
    if (showQuantityPopup && quantityInputRef.current) {
      // Use setTimeout to ensure the popup is fully rendered
      setTimeout(() => {
        if (quantityInputRef.current) {
          quantityInputRef.current.focus()
          quantityInputRef.current.select() // Select all text for easy replacement
          // console.log('🔢 Auto-focused quantity input')
        }
      }, 100)
    }
  }, [showQuantityPopup])

  // Search effect — always client-side from cached allMenuItems (instant, no API call)
  useEffect(() => {
    if (searchQuery && searchQuery.trim() !== "" && searchQuery !== "000") {
      filterMenuItems()
    } else {
      setMenuItems([])
    }
  }, [searchQuery, allMenuItems]) // re-run when allMenuItems updates from background refresh

  // Auto-focus on KOT search bar when modal opens
  useEffect(() => {
    if (showKOTList) {
      // Focus on search bar when KOT modal opens
      const focusSearchBar = () => {
        // Try ref first (most reliable)
        if (kotSearchInputRef.current) {
          kotSearchInputRef.current.focus()
          kotSearchInputRef.current.select() // Also select any existing text
          // console.log('🔍 ✅ Auto-focused on KOT search bar via ref')
          return true
        }

        // Fallback to selectors
        const searchInput = document.querySelector('#kot-search-input') ||
          document.querySelector('input[placeholder*="Search by table number"]') ||
          document.querySelector('input[placeholder*="Search by table"]') ||
          document.querySelector('.kot-search-input')

        if (searchInput) {
          searchInput.focus()
          searchInput.select() // Also select any existing text
          // console.log('🔍 ✅ Auto-focused on KOT search bar via selector')
          return true
        } else {
          // console.log('🔍 ❌ Search input not found, retrying...')
          return false
        }
      }

      // Try multiple times with different delays and requestAnimationFrame to ensure search input gets focus
      requestAnimationFrame(() => focusSearchBar())
      setTimeout(() => focusSearchBar(), 10)
      setTimeout(() => focusSearchBar(), 50)
      setTimeout(() => focusSearchBar(), 100)
      setTimeout(() => focusSearchBar(), 200)
    }
  }, [showKOTList])

  // Additional auto-focus effect specifically for KOT search input ref
  useEffect(() => {
    if (showKOTList && kotSearchInputRef.current) {
      // Use requestAnimationFrame to ensure DOM is fully updated
      requestAnimationFrame(() => {
        if (kotSearchInputRef.current) {
          kotSearchInputRef.current.focus()
          kotSearchInputRef.current.select()
          // console.log('🔍 ✅ KOT search /input focused via ref effect with requestAnimationFrame')
        }
      })
    }
  }, [showKOTList]) // Removed kotSearchInputRef.current from dependencies

  // Add keyboard event listener for Alt+K
  useEffect(() => {
    const handleKeyPress = (event) => {
      // console.log('🔍 Global key pressed:', event.key, 'showKOTList:', showKOTList, 'savedKOTs.length:', savedKOTs.length)

      // CRITICAL: Don't handle Enter key if search input is focused
      const activeElement = document.activeElement
      if (event.key === 'Enter') {
        // Check if the active element is the search input (by ref or by tag/class)
        const isSearchInput = activeElement && (
          activeElement === searchInputRef.current ||
          (activeElement.tagName === 'INPUT' && activeElement.placeholder && activeElement.placeholder.includes('Search'))
        )

        // console.log('🔍 Enter key check:', {
        //   activeElement: activeElement?.tagName,
        //   placeholder: activeElement?.placeholder,
        //   isSearchInputRef: activeElement === searchInputRef.current,
        //   isSearchInput: isSearchInput
        // })

        if (isSearchInput) {
          // console.log('🔍 Enter key pressed in search input, letting input handler deal with it')
          return // Let the input's onKeyDown handler deal with it
        }
      }

      // Handle Alt+K or Ctrl+K for saved KOTs (works even when typing in input fields)
      // CRITICAL: Only enable for Restaurant category
      if ((event.altKey && event.key.toLowerCase() === 'k') || (event.ctrlKey && event.key.toLowerCase() === 'k')) {
        // Check if current category is Restaurant
        if (!isRestaurantCategory) {
          // console.log('🔍 Alt+K/Ctrl+K disabled: Not a Restaurant category')
          return // Disable Alt+K for non-restaurant categories
        }

        // Alt+K or Ctrl+K should work everywhere, even in input fields
        event.preventDefault()

        if (showKOTList) {
          // If KOT list is open, close it
          // console.log('🔍 Alt+K/Ctrl+K pressed: Closing KOT list...')
          setShowKOTList(false)
          setFocusedKOTIndex(0) // Reset focus

          // Focus on main search bar after closing KOT list with enhanced reliability
          const focusMainSearchBar = () => {
            if (searchInputRef.current) {
              searchInputRef.current.focus()
              searchInputRef.current.select() // Also select the text for better UX
              // console.log('🔍 ✅ Alt+K: Focused on main search bar after closing KOT list via ref')
              return true
            } else {
              const searchInput = document.querySelector('input[placeholder*="Search by name"]')
              if (searchInput) {
                searchInput.focus()
                searchInput.select()
                // console.log('🔍 ✅ Alt+K: Focused on main search bar via selector after closing KOT list')
                return true
              }
            }
            return false
          }

          // Try multiple times to ensure focus works reliably
          setTimeout(() => focusMainSearchBar(), 50)
          setTimeout(() => focusMainSearchBar(), 150)
          setTimeout(() => focusMainSearchBar(), 300)
        } else {
          // If KOT list is closed, open it
          // console.log('🔍 Alt+K/Ctrl+K pressed: Loading saved KOTs...')
          loadSavedKOTs()
          setShowKOTList(true)
          setFocusedKOTIndex(0) // Start with first card focused
          setKotSearchQuery('') // Clear search when opening

          // Auto-focus on search bar after modal opens - enhanced with multiple attempts
          const focusSearchBarAfterOpen = () => {
            // Try ref first (most reliable)
            if (kotSearchInputRef.current) {
              kotSearchInputRef.current.focus()
              kotSearchInputRef.current.select()
              // console.log('🔍 ✅ Alt+K: Auto-focused on KOT search bar via ref')
              return true
            }

            // Fallback to selectors
            const searchInput = document.querySelector('#kot-search-input') ||
              document.querySelector('input[placeholder*="Search by table number"]') ||
              document.querySelector('input[placeholder*="Search by table"]') ||
              document.querySelector('.kot-search-input')

            if (searchInput) {
              searchInput.focus()
              searchInput.select()
              // console.log('🔍 ✅ Alt+K: Auto-focused on KOT search bar via selector')
              return true
            } else {
              // console.log('🔍 ❌ Alt+K: Search input not found, retrying...')
              return false
            }
          }
          // Try multiple times with requestAnimationFrame and delays to ensure modal is rendered and search input gets focus
          requestAnimationFrame(() => focusSearchBarAfterOpen())
          setTimeout(() => focusSearchBarAfterOpen(), 10)
          setTimeout(() => focusSearchBarAfterOpen(), 50)
          setTimeout(() => focusSearchBarAfterOpen(), 100)
          setTimeout(() => focusSearchBarAfterOpen(), 200)
        }
        return
      }

      // Handle Alt+C for complimentary bills (works even when typing in input fields)
      // CRITICAL: Only enable for Restaurant category
      if (event.altKey && event.key.toLowerCase() === 'c') {
        // Check if current category is Restaurant
        if (!isRestaurantCategory) {
          // console.log('🎁 Alt+C disabled: Not a Restaurant category')
          return // Disable Alt+C for non-restaurant categories
        }

        // Alt+C should work everywhere, even in input fields
        event.preventDefault()

        if (showComplimentaryList) {
          // If complimentary list is open, close it
          // console.log('🎁 Alt+C pressed: Closing complimentary list...')
          setShowComplimentaryList(false)
        } else {
          // If complimentary list is closed, open it
          // console.log('🎁 Alt+C pressed: Loading complimentary bills...')
          loadComplimentaryBills(selectedComplimentaryDate)
          setShowComplimentaryList(true)
        }
        return
      }

      // Let the modal handle navigation keys when it's open
      // Only handle navigation here if modal is not focused
      if (showKOTList && savedKOTs.length > 0) {
        const activeElement = document.activeElement
        const isModalFocused = activeElement && activeElement.getAttribute('tabindex') === '0'

        if (!isModalFocused) {
          // console.log('🔍 Modal not focused, handling navigation globally...')

          // Don't trigger if user is typing in an input field
          if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            // console.log('🔍 Ignoring key press - user is typing in input field')
            return
          }

          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            // Focus the modal so it can handle the navigation
            const modal = document.querySelector('[tabindex="0"]')
            if (modal) {
              modal.focus()
              // console.log('🔍 Focused modal for navigation')
            }
          }
        }
      }
    }

    // console.log('🔍 Adding global keyboard event listener, showKOTList:', showKOTList)
    // Add event listener
    window.addEventListener('keydown', handleKeyPress)

    // Cleanup
    return () => {
      // console.log('🔍 Removing global keyboard event listener')
      window.removeEventListener('keydown', handleKeyPress)
    }
  }, [showKOTList, showComplimentaryList, savedKOTs, focusedKOTIndex, customerData, navigate]) // Added complimentary dependencies

  // Add window focus event listener to refresh tables when returning to the page
  useEffect(() => {
    const handleWindowFocus = () => {
      // Check if we need to refresh tables when window gains focus
      const shouldRefreshTables = localStorage.getItem('refreshTablesAfterBill')
      if (shouldRefreshTables === 'true') {
        // console.log('🔄 Window focused: Refreshing tables after bill print...')
        localStorage.removeItem('refreshTablesAfterBill') // Clear the flag
        loadTables()
      }
    }

    // Add event listener
    window.addEventListener('focus', handleWindowFocus)

    // Cleanup
    return () => {
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, []) // Empty dependency array - only set up once

  // Load sales report once when modal opens for restaurant category
  const hasLoadedSalesRef = useRef(false)
  const hasSyncedOnOpenRef = useRef(false)

  useEffect(() => {
    // Reset flags when modal closes
    if (!showSalesReport) {
      hasLoadedSalesRef.current = false
      hasSyncedOnOpenRef.current = false
    }
  }, [showSalesReport])

  // Auto-focus modal when KOT list opens - DISABLED to prevent competing with search input focus
  useEffect(() => {
    if (showKOTList) {
    
      // Small delay to ensure modal is rendered, then scroll to first card
      setTimeout(() => {
        // Scroll to the first card but don't focus the modal
        if (savedKOTs.length > 0) {
          scrollToFocusedCard(0)
        }
      }, 100)
    }
  }, [showKOTList, savedKOTs.length])

  const filterMenuItems = async () => {
    // Special case: "0", "000", or empty means show NO items (clear the list)
    if (searchQuery.trim() === "0" || searchQuery.trim() === "" || searchQuery === "000") {
      // Clear the menu items list - show nothing
      setMenuItems([])
      return
    }

    // CLIENT-SIDE SEARCH (INSTANT - NO API CALLS)
    const query = searchQuery.trim().toLowerCase()

    // console.log('🔍 Searching in allMenuItems:', allMenuItems.length, 'items for query:', query)

    // Search in allMenuItems (already loaded)
    let filtered = allMenuItems.filter(item => {
      const itemName = (item.name || item.itemName || '').toLowerCase()

      // Extract numbers from item name (e.g., "007 Paneer Tikka" -> "007")
      const numberMatch = itemName.match(/^(\d+)/)
      const itemNumber = numberMatch ? numberMatch[1] : ''

      // Also check menuItemNumber field if it exists
      const menuItemNum = String(item.menuItemNumber || item.number || '')

      // Search by extracted number from name
      if (itemNumber && itemNumber.includes(query)) {

        return true
      }

      // Search by menuItemNumber field
      if (menuItemNum && menuItemNum.includes(query)) {
      
        return true
      }

      // Search by full name (partial match)
      if (itemName.includes(query)) {

        return true
      }

      return false
    })

    // No category filter — show items from all categories
    setMenuItems(filtered)
  }

  // Format search input with leading zeros
  const formatSearchInput = (input) => {
    // Check if input contains only digits
    const isNumericOnly = /^\d+$/.test(input)

    if (input === "") {
      // If input is completely empty, return empty (user cleared it)
      return ""
    } else if (isNumericOnly) {
      // Remove leading zeros first, then format properly
      const cleanedInput = input.replace(/^0+/, "") || "0"

      // If 3 digits or more, return as is
      if (cleanedInput.length >= 3) {
        return cleanedInput
      }

      // Pad with leading zeros to make it 3 digits
      return cleanedInput.padStart(3, "0")
    } else {
      // If input contains letters or other characters, return as-is (for text search)
      return input
    }
  }

  const handleSearchChange = (text) => {
    // If current value is "000" and user types something, replace 000 entirely with new input
    if (searchQuery === "000") {
      // Strip any leading zeros that were already in the field — start fresh
      const fresh = text.replace(/^0+/, '') 
      setSearchQuery(fresh === '' ? '' : fresh)
      return
    }
    const formattedText = formatSearchInput(text)
    setSearchQuery(formattedText)
  }

  const handleKeyDown = (e) => {
  
    if (e.key === 'Enter') {
      e.preventDefault() // Prevent form submission or other default behavior
      e.stopPropagation() // Prevent event from bubbling up

      // Store that we're handling Enter key
      const isHandlingEnter = true

      handleSearchEnter()

      // Restore focus after a short delay to ensure it's not lost during state updates
      setTimeout(() => {
        if (searchInputRef.current && document.activeElement !== searchInputRef.current) {
          searchInputRef.current.focus()
        }
      }, 50)
    } else if (e.key === 'Backspace') {
      // If current value is "000" and user presses backspace, clear it completely
      if (searchQuery === "000") {
        e.preventDefault()
        setSearchQuery("")
      }
    }
  }

  // Handle focus - set to "000" if empty when user focuses
  const handleFocus = () => {
    if (searchQuery === "") {
      setSearchQuery("000")
    }
  }

  const handleAddToCart = (item) => {
    // Show quantity popup for all categories when clicking menu item
    setSelectedMenuItem(item)
    setQuantityInput("1")
    setRemarkInput("")
    setShowQuantityPopup(true)
  }

  const handleQuantityInputChange = (itemId, value) => {
    // Update the input field value immediately (for display)
    setInputValues(prev => ({
      ...prev,
      [itemId]: value
    }))
  }
  const handleQuantityInputBlur = (itemId, value) => {
    handleQuantityChange(itemId, value)
    // Clear the input value from state (will show cart quantity)
    setInputValues(prev => {
      const newValues = { ...prev }
      delete newValues[itemId]
      return newValues
    })
  }

  const handleQuantityChange = (itemId, newQuantity) => {
    // Parse and validate the quantity
    let quantity = parseInt(newQuantity)

    // Handle NaN or invalid numbers
    if (isNaN(quantity) || quantity < 0) {
      quantity = 0
    }

    // Limit quantity between 0 and 10
    const validQuantity = Math.max(0, Math.min(10, quantity))

    setCartItems((prevItems) => {
      const existingItemIndex = prevItems.findIndex((item) => item._id === itemId)

      if (validQuantity === 0) {
        // Remove item if quantity is 0
        if (existingItemIndex >= 0) {
          const updatedItems = [...prevItems]
          updatedItems.splice(existingItemIndex, 1)
          return updatedItems
        }
        return prevItems
      } else {
        // Update or add item with new quantity
        if (existingItemIndex >= 0) {
          const updatedItems = [...prevItems]
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: validQuantity,
          }
          return updatedItems
        } else {
          // Find the item from menuItems to add to cart
          const menuItem = allMenuItems.find(item => item._id === itemId)
          if (menuItem) {
            return [...prevItems, { ...menuItem, quantity: validQuantity }]
          }
          return prevItems
        }
      }
    })

    // Show warning if user tried to enter more than 10
    if (quantity > 10) {
      const item = allMenuItems.find(item => item._id === itemId)
      setMaxQuantityMessage(`Maximum quantity (10) reached for ${item?.name || 'this item'}`)
      setTimeout(() => setMaxQuantityMessage(null), 3000)
    }
  }

  const getItemQuantity = (itemId) => {
    const item = cartItems.find((item) => item._id === itemId)
    return item ? item.quantity : 0
  }

  const getTotalAmount = () => {
    return cartItems.reduce((sum, item) => sum + (item.price || 0) * item.quantity, 0)
  }

  // Sort menu items to show cart items first
  const sortedMenuItems = useMemo(() => {
    // When no search is active, show ALL items from allMenuItems
    const source = (menuItems && menuItems.length > 0) ? menuItems : allMenuItems
    if (!source || source.length === 0) return []

    // Get IDs of items in cart
    const cartItemIds = new Set(cartItems.map(item => item._id))

    // Separate items into cart items and non-cart items
    const itemsInCart = []
    const itemsNotInCart = []

    source.forEach(item => {
      if (cartItemIds.has(item._id)) {
        itemsInCart.push(item)
      } else {
        itemsNotInCart.push(item)
      }
    })

    // Return cart items first, then other items
    return [...itemsInCart, ...itemsNotInCart]
  }, [menuItems, allMenuItems, cartItems])

  const handleGenerateBill = async () => {
    try {
     

      if (cartItems.length === 0) {
        alert("Please add items to the cart first")
        return
      }

      // CRITICAL FIX: DON'T generate bill number here - let BillGeneration page handle it
      // This prevents bill number increment when user navigates back with Alt+B
   
      // Don't generate bill number here - BillGeneration page will handle it when order is actually completed
      let newInvoiceNumber = null // Will be generated in BillGeneration page
   

      // CRITICAL FIX: Ensure Self Service orders have correct category information
      let finalSelectedCategory = customerData?.selectedCategory

      // If no category is set, or if it's a Self Service context, ensure proper category
      if (!finalSelectedCategory || !finalSelectedCategory.name) {
        if (preSelectedCategory) {
          // Use the pre-selected category from navigation
          finalSelectedCategory = {
            name: preSelectedCategory,
            _id: null // We don't have the ID, but name is sufficient for sales reports
          }
         
        } else if (!selectedTable || (!selectedTable.tableNumber && !selectedTable.number)) {
          // No table selected = Self Service
          finalSelectedCategory = {
            name: 'Self Service',
            _id: null
          }
         
        } else {
          // Has table = Restaurant
          finalSelectedCategory = {
            name: 'Restaurant',
            _id: null
          }
        
        }
      }

   

      navigate("/counter/bill-generation", {
        state: {
          ...customerData,
          selectedCategory: finalSelectedCategory, // Use the corrected category
          selectedTable, // Include the current selectedTable state
          cartItems,
          totalAmount: getTotalAmount(),
          // CRITICAL FIX: Don't pass bill number - let BillGeneration page generate it
          // invoiceNumber: newInvoiceNumber,
          // billNumber: newInvoiceNumber
        }
      })

    } catch (error) {
      console.error('❌ Error in handleGenerateBill:', error)
      alert(`Error generating bill: ${error.message}\nPlease try again.`)
    }
  }

  const handleBack = () => {
    navigate("/counter/category-selection", { state: customerData })
  }

  // Handle cancel order submit
  const handleCancelOrderSubmit = async () => {
    // Validation
    if (!cancelReason.trim()) {
      setCancelError('Please enter a cancellation reason')
      return
    }
    if (!cancelledByName.trim()) {
      setCancelError('Please enter your name')
      return
    }
    if (!adminPassword.trim()) {
      setCancelError('Please enter cancel order password')
      return
    }

    // Check password - use category's cancelOrderPassword if set, otherwise use default ADMIN_PASSWORD
    const correctPassword = cancelOrderPassword || ADMIN_PASSWORD
    if (adminPassword !== correctPassword) {
      setCancelError('Invalid cancel order password')
      return
    }

    setCancelling(true)
    setCancelError('')

    try {
      const order = selectedOrderToCancel
      const fullReason = `${cancelReason.trim()} (Cancelled by: ${cancelledByName.trim()})`

      if (order.mongoId) {
        // Bill is on the server — cancel via API using real MongoDB _id
        await counterApi.cancelOrder(order.mongoId, fullReason, cancelledByName.trim())
        // Also update localCache so offline sales report reflects the cancellation
        try {
          const cachedBills = await localCache.getBills(customerData.selectedBranch._id)
          const cached = cachedBills.find(b => b.invoiceNumber === order.invoiceNumber)
          if (cached) {
            await localCache.saveBill({
              ...cached,
              orderStatus: 'cancelled',
              status: 'cancelled',
              cancellationReason: fullReason,
              cancelledBy: cancelledByName.trim(),
              cancelledAt: new Date().toISOString(),
            })
          }
        } catch (_) {}
      } else {
        // Offline-only bill — cancel locally in localCache only
        try {
          const cachedBills = await localCache.getBills(customerData.selectedBranch._id)
          const cached = cachedBills.find(b => b.invoiceNumber === order.invoiceNumber)
          if (cached) {
            await localCache.saveBill({
              ...cached,
              orderStatus: 'cancelled',
              status: 'cancelled',
              cancellationReason: fullReason,
              cancelledBy: cancelledByName.trim(),
              cancelledAt: new Date().toISOString(),
            })
          } else {
            setCancelError('Bill not found locally. Please sync first.')
            setCancelling(false)
            return
          }
        } catch (localErr) {
          setCancelError('Failed to cancel bill locally: ' + localErr.message)
          setCancelling(false)
          return
        }
      }

  

      // Close modal
      setShowCancelModal(false)
      setSelectedOrderToCancel(null)
      setCancelReason('')
      setCancelledByName('')
      setAdminPassword('')

      // Reload sales report to show updated status
      await loadSalesReport(selectedSalesDate)

      alert('Order cancelled successfully')
    } catch (error) {
      console.error('❌ Error cancelling order:', error)
      setCancelError(error.message || 'Failed to cancel order')
    } finally {
      setCancelling(false)
    }
  }

  // Handle close cancel modal
  const handleCloseCancelModal = () => {
    if (cancelling) return
    setShowCancelModal(false)
    setSelectedOrderToCancel(null)
    setCancelReason('')
    setCancelledByName('')
    setAdminPassword('')
    setCancelError('')
  }

  // Handle complimentary bill submit
  const handleComplimentaryBillSubmit = async () => {
    // Validation
    if (!complimentaryReason.trim()) {
      setComplimentaryError('Please enter a reason for complimentary bill')
      return
    }
    if (!complimentaryByName.trim()) {
      setComplimentaryError('Please enter your name')
      return
    }
    if (!complimentaryPassword.trim()) {
      setComplimentaryError('Please enter cancel order password')
      return
    }

    // Check password - use category's cancelOrderPassword if set, otherwise use default ADMIN_PASSWORD
    const correctPassword = cancelOrderPassword || ADMIN_PASSWORD
    if (complimentaryPassword !== correctPassword) {
      setComplimentaryError('Invalid password')
      return
    }

    setProcessingComplimentary(true)
    setComplimentaryError('')

    try {
      const order = selectedOrderForComplimentary
      let mongoId = order.mongoId

      // If bill hasn't synced yet, try to sync it now (if online)
      if (!mongoId && navigator.onLine) {
        setComplimentaryError('Syncing bill to server, please wait...')
        try {
          await syncManager.triggerSync()
          // Re-read from localCache to get the mongoId assigned after sync
          const branchId = customerData?.selectedBranch?._id
          if (branchId) {
            const freshBills = await localCache.getBills(branchId)
            const fresh = freshBills.find(b => b.invoiceNumber === order.invoiceNumber)
            mongoId = fresh?.mongoId || null
          }
        } catch (_) {}
        setComplimentaryError('')
      }

      // If still no mongoId (offline or sync failed), mark complimentary locally only
      if (!mongoId) {
        const branchId = customerData?.selectedBranch?._id
        if (!branchId) {
          setComplimentaryError('Cannot process: no branch found.')
          setProcessingComplimentary(false)
          return
        }
        const cachedBills = await localCache.getBills(branchId)
        const cached = cachedBills.find(b => b.invoiceNumber === order.invoiceNumber)
        if (!cached) {
          setComplimentaryError('Bill not found locally. Please sync first.')
          setProcessingComplimentary(false)
          return
        }
        await localCache.saveBill({
          ...cached,
          isComplimentary: true,
          complimentaryReason: `${complimentaryReason.trim()} (By: ${complimentaryByName.trim()})`,
          complimentaryBy: complimentaryByName.trim(),
          complimentaryAt: new Date().toISOString(),
        })
        setShowComplimentaryModal(false)
        setSelectedOrderForComplimentary(null)
        setComplimentaryReason('')
        setComplimentaryByName('')
        setComplimentaryPassword('')
        await loadSalesReport(selectedSalesDate)
        await loadComplimentaryBills(selectedComplimentaryDate)
        alert('Complimentary bill saved locally. It will sync to server when connection is restored.')
        return
      }

      // Update order to mark as complimentary
      await counterApi.request(`/counter-order/orders/${mongoId}`, {
        method: 'PUT',
        body: JSON.stringify({
          isComplimentary: true,
          complimentaryReason: `${complimentaryReason.trim()} (By: ${complimentaryByName.trim()})`,
          complimentaryBy: complimentaryByName.trim(),
          complimentaryAt: new Date().toISOString(),
          paymentStatus: 'completed',
          orderStatus: 'completed'
        })
      })

      // Update localCache so the bill is excluded from sales report immediately
      try {
        const branchId = customerData?.selectedBranch?._id
        if (branchId) {
          const cachedBills = await localCache.getBills(branchId)
          const cached = cachedBills.find(b => b.invoiceNumber === order.invoiceNumber)
          if (cached) {
            await localCache.saveBill({
              ...cached,
              isComplimentary: true,
              complimentaryReason: `${complimentaryReason.trim()} (By: ${complimentaryByName.trim()})`,
              complimentaryBy: complimentaryByName.trim(),
              complimentaryAt: new Date().toISOString(),
            })
          }
        }
      } catch (_) {}

  

      // Close modal
      setShowComplimentaryModal(false)
      setSelectedOrderForComplimentary(null)
      setComplimentaryReason('')
      setComplimentaryByName('')
      setComplimentaryPassword('')

      // Reload sales report to show updated status
      await loadSalesReport(selectedSalesDate)
      await loadComplimentaryBills(selectedComplimentaryDate)

      alert('Complimentary bill generated successfully')
    } catch (error) {
      console.error('❌ Error generating complimentary bill:', error)
      setComplimentaryError(error.message || 'Failed to generate complimentary bill')
    } finally {
      setProcessingComplimentary(false)
    }
  }

  // Handle close complimentary modal
  const handleCloseComplimentaryModal = () => {
    if (processingComplimentary) return
    setShowComplimentaryModal(false)
    setSelectedOrderForComplimentary(null)
    setComplimentaryReason('')
    setComplimentaryByName('')
    setComplimentaryPassword('')
    setComplimentaryError('')
  }

  if (!customerData) {
    return (
      <div className="counter-container">
        <div className="counter-card">
          <div className="counter-error">
            <p>Customer data not found. Please start over.</p>
            <button className="counter-button" onClick={() => navigate("/counter/branch-selection")}>
              Go Back
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Show initial loading screen only on first load
  if (loading && isInitialLoad) {
    return (
      <div className="counter-container">
        <div className="counter-card">
          <div className="counter-loading">
            <div className="counter-spinner"></div>
            <p>Loading menu...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="counter-container">
        <div className="counter-card">
          <div className="counter-error">
            <h3>Error</h3>
            <p>{error}</p>
            <button className="counter-button" onClick={loadMenuData}>
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="counter-container">
      {/* Loading Overlay for Data Verification */}
      {kotLoading && isNavigatingToBill && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '32px 48px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            minWidth: '320px'
          }}>
            {/* Spinner */}
            <div style={{
              width: '60px',
              height: '60px',
              border: '4px solid #e5e7eb',
              borderTop: '4px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }} />
            
            {/* Message */}
            <div style={{
              textAlign: 'center'
            }}>
              <h3 style={{
                margin: '0 0 8px 0',
                fontSize: '1.25rem',
                color: '#1a202c',
                fontWeight: '600'
              }}>
                Verifying KOT Data
              </h3>
              <p style={{
                margin: 0,
                fontSize: '0.875rem',
                color: '#718096'
              }}>
                Please wait while we verify all items...
              </p>
            </div>
          </div>
        </div>
      )}

      <div
        className="counter-card"
        style={{
          paddingBottom: '20px'
        }}
      >
        {/* Header */}
        <div className="counter-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 className="counter-title" style={{ fontSize: '1.5rem', margin: 0 }}>
              {customerData.customerName}'s Order
            </h1>
            <p className="counter-subtitle" style={{ margin: '4px 0 0 0' }}>
              {customerData.selectedBranch.name} • {customerData.invoiceNumber} • {customerData.date} • {customerData.time}
            </p>
          </div>

          {/* Header Buttons */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {pendingSyncCount > 0 && (
              <span style={{ 
                background: '#f59e0b', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '12px', 
                fontSize: '12px',
                fontWeight: '600'
              }}>
                ⚠️ {pendingSyncCount} pending sync
              </span>
            )}
            {/* KOT List Button */}
            <button
              onClick={() => {
                setShowKOTList(true)
                loadSavedKOTs()
              }}
              style={{
                background: '#fff5f4',
                color: '#69221b',
                border: '1.5px solid #69221b',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#69221b'; e.currentTarget.style.color = '#fff' }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#fff5f4'; e.currentTarget.style.color = '#69221b' }}
              title="View saved KOTs (Alt+K)"
            >
              <ClipboardList size={16} strokeWidth={2} /> KOTs
              <span style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: '400' }}>Alt+K</span>
            </button>

            {/* Complimentary Button */}
            <button
              onClick={() => {
                setShowComplimentaryList(true)
                loadComplimentaryBills(selectedComplimentaryDate)
              }}
              style={{
                background: '#fff5f4',
                color: '#69221b',
                border: '1.5px solid #69221b',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#69221b'; e.currentTarget.style.color = '#fff' }}
              onMouseOut={(e) => { e.currentTarget.style.background = '#fff5f4'; e.currentTarget.style.color = '#69221b' }}
              title="View complimentary bills (Alt+C)"
            >
              <Gift size={16} strokeWidth={2} /> Complimentary
              <span style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: '400' }}>Alt+C</span>
            </button>

            {/* Sales Report Button */}
            <button
              onClick={() => {
                setShowSalesReport(true)
                loadSalesReport(selectedSalesDate)
              }}
              style={{
                background: '#69221b',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#8b2e26'}
              onMouseOut={(e) => e.currentTarget.style.background = '#69221b'}
              title="View today's sales report and history"
            >
              <BarChart2 size={16} strokeWidth={2} /> Sales Report
            </button>
          </div>
        </div>

        {/* Max Quantity Message */}
        {maxQuantityMessage && (
          <div style={{
            marginBottom: '16px',
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            fontSize: '0.875rem',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>⚠️</span>
            {maxQuantityMessage}
          </div>
        )}

        {/* Two Column Layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 400px',
          gap: '20px',
          alignItems: 'start'
        }}>
          {/* LEFT COLUMN - Search, Table Selection, Menu Items */}
          <div>
            {/* Search */}
            <div style={{ marginBottom: '20px', position: 'relative' }}>
              <input
                key="menu-search-input" // Prevent React from recreating this element
                ref={searchInputRef}
                type="text"
                className="counter-input"
                placeholder="🔍 Search item number (e.g., 100) or name, then press Enter..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={handleFocus}
                onBlur={(e) => {
    
                  // CRITICAL FIX: If input loses focus during typing (not clicking elsewhere),
                  // restore focus immediately to prevent Enter key from being lost
                  if (!e.relatedTarget && searchQuery !== "000" && searchQuery !== "") {
                   
                    setTimeout(() => {
                      if (searchInputRef.current) {
                        searchInputRef.current.focus()
                      }
                    }, 0)
                  }
                }}
                style={{
                  paddingRight: loading && !isInitialLoad ? '40px' : '16px'
                }}
              />
              {/* Inline loading indicator for search */}
              {loading && !isInitialLoad && (
                <div style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#3b82f6',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}>
                  <div className="counter-spinner" style={{
                    width: '16px',
                    height: '16px',
                    borderWidth: '2px'
                  }}></div>
                </div>
              )}
            </div>
            {isRestaurantCategory && (
              <div style={{
                marginBottom: '16px',
                borderRadius: '10px',
                border: `2px solid ${selectedTable ? '#69221b' : '#e8ddd8'}`,
                overflow: 'hidden',
                background: selectedTable ? '#fff5f4' : '#faf8f6',
              }}>
                {/* Header row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: selectedTable ? '#69221b' : '#f0ebe6',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.1rem' }}>🪑</span>
                    <span style={{
                      fontWeight: '700',
                      fontSize: '0.9rem',
                      color: selectedTable ? '#fff' : '#69221b',
                      letterSpacing: '0.3px'
                    }}>
                      {selectedTable
                        ? `Table ${selectedTable.tableNumber || selectedTable.number} Selected`
                        : 'Select Table'}
                    </span>
                  </div>

                  {selectedTable && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <select
                        value={selectedTable.status}
                        onChange={(e) => handleUpdateTableStatus(selectedTable._id, e.target.value)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1.5px solid rgba(255,255,255,0.5)',
                          backgroundColor: 'rgba(255,255,255,0.15)',
                          color: '#fff',
                          fontWeight: '600',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          outline: 'none',
                        }}
                      >
                        <option value="available" style={{ color: '#1a1a1a' }}>Available</option>
                        <option value="reserved" style={{ color: '#1a1a1a' }}>Reserved</option>
                      </select>
                      <button
                        onClick={() => { setSelectedTable(null); setTableInput('') }}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '6px',
                          border: '1.5px solid rgba(255,255,255,0.6)',
                          backgroundColor: 'rgba(255,255,255,0.18)',
                          color: '#fff',
                          fontWeight: '700',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                      >
                        Change
                      </button>
                    </div>
                  )}
                </div>

                {/* Input area */}
                {!selectedTable && (
                  <div style={{ padding: '12px 14px' }}>
                    {tablesLoading ? (
                      <div style={{ textAlign: 'center', padding: '8px', color: '#a07060', fontSize: '0.85rem' }}>
                        Loading tables...
                      </div>
                    ) : tables.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '8px', color: '#dc2626', fontSize: '0.85rem' }}>
                        No tables available
                      </div>
                    ) : (
                      <>
                        <input
                          ref={tableInputRef}
                          type="text"
                          value={tableInput}
                          onChange={(e) => setTableInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              handleTableInputEnter()
                            }
                          }}
                          placeholder="Enter table number..."
                          autoFocus
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            fontSize: '0.95rem',
                            border: '2px solid #e8ddd8',
                            borderRadius: '8px',
                            fontWeight: '600',
                            color: '#2d1a18',
                            backgroundColor: '#fff',
                            outline: 'none',
                            boxSizing: 'border-box',
                            transition: 'border-color 0.2s',
                          }}
                          onFocus={(e) => e.target.style.borderColor = '#69221b'}
                          onBlur={(e) => e.target.style.borderColor = '#e8ddd8'}
                        />

                        {/* Table grid */}
                        <div style={{ marginTop: '10px' }}>
                          <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: '#a07060', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                            Or click to select
                          </p>
                          {(() => {
                            // Group tables by prefix letter
                            const numericTables = []
                            const groupedTables = {}

                            tables.forEach(table => {
                              const num = table.number || table.tableNumber || ''
                              const match = String(num).match(/^([A-Za-z]+)(\d+.*)$/)
                              if (match) {
                                const prefix = match[1].toUpperCase()
                                if (!groupedTables[prefix]) groupedTables[prefix] = []
                                groupedTables[prefix].push(table)
                              } else {
                                numericTables.push(table)
                              }
                            })

                            const groupPrefixes = Object.keys(groupedTables).sort()

                            return (
                              <>
                                {/* Row 1: Numeric tables */}
                                {numericTables.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                                    {numericTables.map(table => {
                                      const isAvailable = table.status === 'available' || table.status === 'Available'
                                      return (
                                        <button
                                          key={table._id}
                                          onClick={() => handleTableSelect(table)}
                                          style={{
                                            background: isAvailable ? '#fff' : '#fee2e2',
                                            border: `2px solid ${isAvailable ? '#69221b' : '#ef4444'}`,
                                            borderRadius: '8px',
                                            padding: '7px 12px',
                                            minWidth: '52px',
                                            fontSize: '0.85rem',
                                            fontWeight: '700',
                                            cursor: isAvailable ? 'pointer' : 'not-allowed',
                                            color: isAvailable ? '#69221b' : '#991b1b',
                                            transition: 'all 0.15s',
                                            opacity: isAvailable ? 1 : 0.6,
                                          }}
                                          onMouseOver={(e) => { if (isAvailable) e.currentTarget.style.background = '#fff5f4' }}
                                          onMouseOut={(e) => { if (isAvailable) e.currentTarget.style.background = '#fff' }}
                                        >
                                          {table.number}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}

                                {/* Row 2: Group prefix buttons (G, T, VIP, etc.) */}
                                {groupPrefixes.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: expandedTableGroup ? '10px' : '0' }}>
                                    {groupPrefixes.map(prefix => (
                                      <button
                                        key={`group-${prefix}`}
                                        onClick={() => setExpandedTableGroup(expandedTableGroup === prefix ? null : prefix)}
                                        style={{
                                          background: expandedTableGroup === prefix ? '#f59e0b' : '#fffbeb',
                                          border: `2px solid #f59e0b`,
                                          borderRadius: '8px',
                                          padding: '7px 14px',
                                          minWidth: '52px',
                                          fontSize: '0.85rem',
                                          fontWeight: '700',
                                          cursor: 'pointer',
                                          color: expandedTableGroup === prefix ? 'white' : '#92400e',
                                          transition: 'all 0.15s',
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.background = expandedTableGroup === prefix ? '#d97706' : '#fef3c7'}
                                        onMouseOut={(e) => e.currentTarget.style.background = expandedTableGroup === prefix ? '#f59e0b' : '#fffbeb'}
                                      >
                                        {prefix}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* Row 3: Expanded group tables (G1, G2, G3...) */}
                                {expandedTableGroup && groupedTables[expandedTableGroup] && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {groupedTables[expandedTableGroup].map(table => {
                                      const isAvailable = table.status === 'available' || table.status === 'Available'
                                      return (
                                        <button
                                          key={table._id}
                                          onClick={() => handleTableSelect(table)}
                                          style={{
                                            background: isAvailable ? '#fef3c7' : '#fee2e2',
                                            border: `2px solid ${isAvailable ? '#f59e0b' : '#ef4444'}`,
                                            borderRadius: '8px',
                                            padding: '7px 12px',
                                            minWidth: '52px',
                                            fontSize: '0.85rem',
                                            fontWeight: '700',
                                            cursor: isAvailable ? 'pointer' : 'not-allowed',
                                            color: isAvailable ? '#92400e' : '#991b1b',
                                            transition: 'all 0.15s',
                                            opacity: isAvailable ? 1 : 0.6,
                                          }}
                                          onMouseOver={(e) => { if (isAvailable) e.currentTarget.style.background = '#fde68a' }}
                                          onMouseOut={(e) => { if (isAvailable) e.currentTarget.style.background = '#fef3c7' }}
                                        >
                                          {table.number}
                                        </button>
                                      )
                                    })}
                                  </div>
                                )}
                              </>
                            )
                          })()}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Categories tabs removed - fetch all items */}

            {/* Menu Items */}
            {sortedMenuItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#a07060' }}>
                {loading ? 'Loading menu items...' : 'No menu items found'}
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '12px',
                margin: '16px 0',
                paddingRight: '8px',
                paddingBottom: menuTotalPages > 1 ? '80px' : '0',
                width: '100%'
              }}>
                {sortedMenuItems.map((item) => {
                  const quantity = getItemQuantity(item._id)
                  return (
                    <div
                      key={item._id}
                      id={`counter-item-${item._id}`}
                      style={{
                        background: 'white',
                        border: '2px solid #e2e8f0',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        transition: 'all 0.3s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%'
                      }}
                    >
                      {/* Product Image */}
                      <div style={{ width: '100%', height: '140px', background: '#f3f4f6', flexShrink: 0, position: 'relative' }}>
                        <img
                          src={item.image || `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='140'%3E%3Crect fill='%23f3f4f6' width='300' height='140'/%3E%3Ctext fill='%239ca3af' font-family='sans-serif' font-size='13' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3ENo Image%3C/text%3E%3C/svg%3E`}
                          alt={item.name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#f9f9f9' }}
                          onError={(e) => {
                            const prodUrl = getProdImageUrl(item.image)
                            if (prodUrl && e.target.src !== prodUrl) {
                              e.target.src = prodUrl
                            } else {
                              e.target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='140'%3E%3Crect fill='%23f3f4f6' width='300' height='140'/%3E%3Ctext fill='%239ca3af' font-family='sans-serif' font-size='13' x='50%25' y='50%25' text-anchor='middle' dominant-baseline='middle'%3ENo Image%3C/text%3E%3C/svg%3E`
                              e.target.onerror = null
                            }
                          }}
                        />
                      </div>

                      {/* Card Content */}
                      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <h3 style={{ margin: 0, fontSize: '0.9rem', lineHeight: '1.2', fontWeight: '600', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.menuItemNumber && (
                            <span style={{ color: '#f59e0b', marginRight: '6px' }}>{item.menuItemNumber}</span>
                          )}
                          {item.name}
                        </h3>
                        {item.description && (
                          <p style={{ margin: 0, color: '#718096', fontSize: '0.72rem', lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.description}
                          </p>
                        )}
                        <p style={{ margin: 0, color: '#69221b', fontSize: '0.95rem', fontWeight: '700' }}>
                          ₹{item.price.toFixed(2)}
                        </p>

                        {/* Add / Quantity controls */}
                        <div style={{ marginTop: '4px' }}>
                          {quantity > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                              <button
                                className="counter-button-secondary"
                                onClick={() => handleQuantityChange(item._id, quantity - 1)}
                                style={{ width: '28px', height: '28px', padding: '0', fontSize: '1rem', minHeight: 'auto', border: '1px solid #69221b', borderRadius: '6px' }}
                              >-</button>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <input
                                  type="number"
                                  min="0"
                                  max="10"
                                  value={inputValues[item._id] !== undefined ? inputValues[item._id] : quantity}
                                  onChange={(e) => handleQuantityInputChange(item._id, e.target.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
                                  style={{ width: '40px', height: '28px', textAlign: 'center', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '0.85rem', fontWeight: '600', padding: '0 4px', outline: 'none' }}
                                  onFocus={(e) => { e.target.select(); e.target.style.borderColor = '#69221b' }}
                                  onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; handleQuantityInputBlur(item._id, e.target.value) }}
                                />
                                {quantity >= 10 && (
                                  <span style={{ fontSize: '0.6rem', color: '#e53e3e', fontWeight: '500', marginTop: '1px' }}>MAX</span>
                                )}
                              </div>
                              <button
                                className="counter-button"
                                onClick={() => handleQuantityChange(item._id, quantity + 1)}
                                disabled={quantity >= 10}
                                style={{ width: '28px', height: '28px', padding: '0', fontSize: '1rem', minHeight: 'auto', borderRadius: '6px', opacity: quantity >= 10 ? 0.5 : 1, cursor: quantity >= 10 ? 'not-allowed' : 'pointer' }}
                                title={quantity >= 10 ? 'Maximum quantity reached (10)' : 'Add one more'}
                              >+</button>
                            </div>
                          ) : (
                            <button
                              className="counter-button"
                              onClick={() => handleAddToCart(item)}
                              style={{ width: '100%', padding: '7px 12px', fontSize: '0.8rem', minHeight: 'auto', borderRadius: '6px' }}
                            >
                              ADD
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pagination Controls - Sticky at bottom */}
            {menuTotalPages > 1 && sortedMenuItems.length > 0 && (
              <div style={{
                position: 'sticky',
                bottom: '0',
                backgroundColor: 'white',
                borderTop: '2px solid #e5e7eb',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                boxShadow: '0 -4px 12px rgba(0, 0, 0, 0.1)',
                zIndex: 100,
                marginTop: '16px'
              }}>
                {/* Previous Button */}
                <button
                  onClick={() => {
                    if (menuCurrentPage > 1) {
                      loadMenuData({
                        page: menuCurrentPage - 1,
                        limit: 100,
                        search: searchQuery !== "000" && searchQuery.trim() ? searchQuery.trim() : undefined
                      })
                    }
                  }}
                  disabled={menuCurrentPage === 1 || loading}
                  style={{
                    background: menuCurrentPage === 1 ? '#e5e7eb' : '#3b82f6',
                    color: menuCurrentPage === 1 ? '#9ca3af' : 'white',
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: menuCurrentPage === 1 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    if (menuCurrentPage > 1) e.target.style.background = '#2563eb'
                  }}
                  onMouseOut={(e) => {
                    if (menuCurrentPage > 1) e.target.style.background = '#3b82f6'
                  }}
                >
                  ← Prev
                </button>

                {/* Page Numbers */}
                {(() => {
                  const pages = []
                  const showPages = 5 // Number of page buttons to show

                  // Always show first page
                  if (menuCurrentPage > 3) {
                    pages.push(
                      <button
                        key={1}
                        onClick={() => loadMenuData({
                          page: 1,
                          limit: 100,
                          search: searchQuery !== "000" && searchQuery.trim() ? searchQuery.trim() : undefined
                        })}
                        disabled={loading}
                        style={{
                          background: 'white',
                          color: '#3b82f6',
                          padding: '8px 12px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          borderRadius: '6px',
                          border: '1px solid #3b82f6',
                          cursor: 'pointer',
                          minWidth: '40px',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.background = '#eff6ff'
                        }}
                        onMouseOut={(e) => {
                          e.target.style.background = 'white'
                        }}
                      >
                        1
                      </button>
                    )

                    if (menuCurrentPage > 4) {
                      pages.push(
                        <span key="dots1" style={{ color: '#6b7280', padding: '0 4px' }}>...</span>
                      )
                    }
                  }

                  // Show pages around current page
                  const startPage = Math.max(1, menuCurrentPage - 2)
                  const endPage = Math.min(menuTotalPages, menuCurrentPage + 2)

                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        onClick={() => {
                          if (i !== menuCurrentPage) {
                            loadMenuData({
                              page: i,
                              limit: 100,
                              search: searchQuery !== "000" && searchQuery.trim() ? searchQuery.trim() : undefined
                            })
                          }
                        }}
                        disabled={loading}
                        style={{
                          background: i === menuCurrentPage ? '#3b82f6' : 'white',
                          color: i === menuCurrentPage ? 'white' : '#3b82f6',
                          padding: '8px 12px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          borderRadius: '6px',
                          border: `1px solid ${i === menuCurrentPage ? '#3b82f6' : '#d1d5db'}`,
                          cursor: i === menuCurrentPage ? 'default' : 'pointer',
                          minWidth: '40px',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          if (i !== menuCurrentPage) {
                            e.target.style.background = '#eff6ff'
                          }
                        }}
                        onMouseOut={(e) => {
                          if (i !== menuCurrentPage) {
                            e.target.style.background = 'white'
                          }
                        }}
                      >
                        {i}
                      </button>
                    )
                  }

                  // Always show last page
                  if (menuCurrentPage < menuTotalPages - 2) {
                    if (menuCurrentPage < menuTotalPages - 3) {
                      pages.push(
                        <span key="dots2" style={{ color: '#6b7280', padding: '0 4px' }}>...</span>
                      )
                    }

                    pages.push(
                      <button
                        key={menuTotalPages}
                        onClick={() => loadMenuData({
                          page: menuTotalPages,
                          limit: 100,
                          search: searchQuery !== "000" && searchQuery.trim() ? searchQuery.trim() : undefined
                        })}
                        disabled={loading}
                        style={{
                          background: 'white',
                          color: '#3b82f6',
                          padding: '8px 12px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          borderRadius: '6px',
                          border: '1px solid #3b82f6',
                          cursor: 'pointer',
                          minWidth: '40px',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.target.style.background = '#eff6ff'
                        }}
                        onMouseOut={(e) => {
                          e.target.style.background = 'white'
                        }}
                      >
                        {menuTotalPages}
                      </button>
                    )
                  }

                  return pages
                })()}

                {/* Next Button */}
                <button
                  onClick={() => {
                    if (menuCurrentPage < menuTotalPages) {
                      loadMenuData({
                        page: menuCurrentPage + 1,
                        limit: 100,
                        search: searchQuery !== "000" && searchQuery.trim() ? searchQuery.trim() : undefined
                      })
                    }
                  }}
                  disabled={menuCurrentPage === menuTotalPages || loading}
                  style={{
                    background: menuCurrentPage === menuTotalPages ? '#e5e7eb' : '#3b82f6',
                    color: menuCurrentPage === menuTotalPages ? '#9ca3af' : 'white',
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    borderRadius: '6px',
                    border: 'none',
                    cursor: menuCurrentPage === menuTotalPages ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    if (menuCurrentPage < menuTotalPages) e.target.style.background = '#2563eb'
                  }}
                  onMouseOut={(e) => {
                    if (menuCurrentPage < menuTotalPages) e.target.style.background = '#3b82f6'
                  }}
                >
                  Next →
                </button>
              </div>
            )}

            {/* Pagination Info */}
            {sortedMenuItems.length > 0 && menuTotalItems > 0 && (
              <div style={{
                textAlign: 'center',
                color: '#6b7280',
                fontSize: '0.875rem',
                margin: '12px 0',
                padding: '0 16px'
              }}>
                Showing {sortedMenuItems.length} of {menuTotalItems} items
                {menuTotalPages > 1 && ` • Page ${menuCurrentPage} of ${menuTotalPages}`}
              </div>
            )}
          </div>
          {/* END LEFT COLUMN */}

          {/* RIGHT COLUMN - Cart (Sticky) */}
          <div style={{
            position: 'sticky',
            top: '20px',
            alignSelf: 'start'
          }}>
            {/* Server Name Field (for Restaurant category only) */}
            {isRestaurantCategory && cartItems.length > 0 && (
              <div style={{
                background: '#fffbeb',
                border: '2px solid #fbbf24',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '12px'
              }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#92400e',
                  marginBottom: '6px'
                }}>
                  👤 Server/Waiter Name:
                </label>
                <select
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '2px solid #fcd34d',
                    borderRadius: '6px',
                    fontSize: '0.875rem',
                    outline: 'none',
                    transition: 'border-color 0.2s',
                    backgroundColor: '#ffffff',
                    cursor: 'pointer'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#f59e0b'}
                  onBlur={(e) => e.target.style.borderColor = '#fcd34d'}
                >
                  <option value="">Select Server (Optional)</option>
                  {serverList.length > 0 ? (
                    serverList.map(server => (
                      <option key={server._id} value={server.name}>{server.name}</option>
                    ))
                  ) : (
                    <option value="" disabled>No servers added — add in Admin</option>
                  )}
                </select>
              </div>
            )}
            
            {/* Cart Items Display */}
            {cartItems.length > 0 ? (
              <div style={{
                background: '#ffffff',
                border: '2px solid #10b981',
                borderRadius: '8px',
                padding: '16px',
                boxShadow: '0 2px 8px 0 rgba(16, 185, 129, 0.2)'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '12px',
                  paddingBottom: '8px',
                  borderBottom: '2px solid #10b981'
                }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: '600',
                    color: '#1f2937',
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    🛒 Cart Items ({cartItems.reduce((total, item) => total + item.quantity, 0)})
                  </h3>
                  <div style={{
                    fontSize: '1.125rem',
                    fontWeight: '700',
                    color: '#059669'
                  }}>
                    ₹{getTotalAmount().toFixed(2)}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '60vh', overflowY: 'auto' }}>
                  {cartItems.map((item, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: '#f0fdf4',
                      padding: '12px',
                      borderRadius: '6px',
                      border: '1px solid #bbf7d0'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          color: '#1f2937',
                          marginBottom: '2px'
                        }}>
                          {item.name}
                        </div>
                        <div style={{
                          fontSize: '0.75rem',
                          color: '#6b7280'
                        }}>
                          ₹{item.price} each
                          {item.remark && (
                            <span style={{
                              marginLeft: '6px',
                              fontStyle: 'italic',
                              color: '#3b82f6'
                            }}>
                              • {item.remark}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-end',
                        gap: '4px'
                      }}>
                        {/* Quantity Controls */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          background: '#ffffff',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1'
                        }}>
                          <button
                            onClick={() => updateCartItemQuantity(item._id, item.quantity - 1)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: '4px 8px',
                              fontSize: '1rem',
                              fontWeight: '600',
                              color: item.quantity > 1 ? '#ef4444' : '#9ca3af',
                              cursor: item.quantity > 1 ? 'pointer' : 'not-allowed',
                              borderRadius: '4px 0 0 4px'
                            }}
                            disabled={item.quantity <= 1}
                          >
                            −
                          </button>
                          <div style={{
                            padding: '4px 12px',
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#1f2937',
                            minWidth: '32px',
                            textAlign: 'center',
                            background: 'white',
                            borderLeft: '1px solid #cbd5e1',
                            borderRight: '1px solid #cbd5e1'
                          }}>
                            {item.quantity}
                          </div>
                          <button
                            onClick={() => updateCartItemQuantity(item._id, item.quantity + 1)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: '4px 8px',
                              fontSize: '1rem',
                              fontWeight: '600',
                              color: '#10b981',
                              cursor: 'pointer',
                              borderRadius: '0 4px 4px 0'
                            }}
                          >
                            +
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {/* Item Total */}
                          <div style={{
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#1f2937'
                          }}>
                            ₹{(item.price * item.quantity).toFixed(2)}
                          </div>

                          {/* Remove Button */}
                          <button
                            onClick={() => removeFromCart(item._id)}
                            style={{
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              color: '#dc2626',
                              padding: '4px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseOver={(e) => {
                              e.target.style.background = '#fee2e2'
                              e.target.style.borderColor = '#fca5a5'
                            }}
                            onMouseOut={(e) => {
                              e.target.style.background = '#fef2f2'
                              e.target.style.borderColor = '#fecaca'
                            }}
                            title={`Remove ${item.name} from cart`}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{
                background: '#f9fafb',
                border: '2px dashed #d1d5db',
                borderRadius: '8px',
                padding: '32px 16px',
                textAlign: 'center',
                color: '#6b7280'
              }}>
                <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🛒</div>
                <div style={{ fontSize: '0.875rem', fontWeight: '500' }}>Cart is empty</div>
                <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Add items to get started</div>
              </div>
            )}
          </div>
          {/* END RIGHT COLUMN */}
        </div>
        {/* END TWO COLUMN LAYOUT */}

        {/* Cart Summary - After pagination */}
        {cartItems.length > 0 && (
          <div
            className="counter-cart-summary"
            style={{
              backgroundColor: '#1f2937',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderRadius: '8px',
              margin: '20px 0',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}
          >
            <div style={{ color: 'white' }}>
              <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>
                {cartItems.reduce((total, item) => total + item.quantity, 0)} Items
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '700' }}>
                ₹{getTotalAmount().toFixed(2)}
              </div>
            </div>

            {/* Show different button based on category */}
            {isRestaurantCategory ? (
              // For Restaurant ONLY: Save KOT button
              <button
                className="counter-button"
                disabled={savingKOT} // CRITICAL FIX: Disable button while saving
                onClick={async () => {

                  // CRITICAL FIX: Check if already saving
                  if (savingKOT) {
                  
                    return
                  }

                  if (!selectedTable) {
                    // console.log('⚠️ Pl/ease select a table first!')
                    alert('Please select a table first!')
                    return
                  }

                  if (!cartItems || cartItems.length === 0) {
                  
                    alert('Please add items to cart first!')
                    return
                  }

                  // CRITICAL FIX: Set lock before starting save
                  setSavingKOT(true)
           

                  try {
                    const counterUserData = localStorage.getItem("counterUserData")
                    const counterUser = counterUserData ? JSON.parse(counterUserData) : null


                    if (!counterUser || !counterUser._id) {
                      alert('User session expired. Please login again.')
                      setSavingKOT(false) // Release lock on error
                      return
                    }

                 
                    // Create NEW KOT for this table
                    const subtotal = getTotalAmount()
             
                    const kotNumber = await getNextKOTNumber(customerData.selectedBranch._id)
                   

                    const kotOrder = {
                      userId: counterUser._id,
                      customerName: customerData.customerName || "Walk-in Customer",
                      phoneNumber: customerData.phoneNumber || "0000000000",
                      branchId: customerData.selectedBranch._id,
                      tableId: selectedTable._id || selectedTable.id,
                      tableNumber: selectedTable.tableNumber || selectedTable.number,
                      serverName: serverName?.trim() || null, // Server/Waiter name (optional)
                      items: cartItems.map(item => ({
                        menuItemId: item._id || item.id,
                        name: item.name,
                        quantity: item.quantity,
                        price: item.price,
                        gstRate: item.gstRate || 0, // Include GST rate
                        // Include remark if it exists (only for restaurant category)
                        ...(item.remark ? { remark: item.remark } : {})
                      })),
                      subtotal: subtotal,
                      tax: 0,
                      serviceCharge: 0,
                      totalAmount: subtotal,
                      grandTotal: subtotal,
                      paymentMethod: 'cash',
                      paymentStatus: 'pending',
                      orderStatus: 'processing',
                      kotNumber: kotNumber, // KOT-001, KOT-002, etc.
                      invoiceNumber: null, // Will be generated when bill is completed
                      kotTime: new Date().toISOString(),
                      categoryName: getCategoryName(customerData, preSelectedCategory),
                      categoryId: customerData?.selectedCategory?._id ||
                        (() => { try { const c = JSON.parse(localStorage.getItem('selectedCategory') || '{}'); return c?._id || c?.id || null } catch(_){} return null })() ||
                        null,
                      branchName: customerData?.selectedBranch?.name || 'Unknown Branch'
                    }

                

                   

                    let savedKOT
                    // ── LOCAL-FIRST: save to IndexedDB immediately, then try server in background ──
                    const offlineEntry = await offlineQueue.enqueue('kot', kotOrder)
                    savedKOT = { ...kotOrder, id: `offline-${offlineEntry.id}`, _id: `offline-${offlineEntry.id}`, isOffline: true }
                    setOfflineKOTIds(prev => new Set([...prev, savedKOT.id]))
                    setPendingSyncCount(prev => prev + 1)

                    // Save to local cache immediately so KOT list works offline
                    const kotForCache = {
                      ...kotOrder,
                      _id: savedKOT._id,
                      id: savedKOT.id,
                      isOffline: true,
                      paymentStatus: 'pending',
                    }
                    await localCache.putKOT(kotForCache).catch(() => {})

                    // DEBUG: Log the kotOrder being sent to server
                    console.log('🔍 [DEBUG] Sending KOT to server with serverName:', kotOrder.serverName)
                    console.log('🔍 [DEBUG] Full kotOrder:', JSON.stringify(kotOrder, null, 2))

                    // Try server in background — don't await, don't block UI
                    counterApi.createOrder(kotOrder).then(async (serverKOT) => {
                      const realId = serverKOT?.order?._id || serverKOT?.order?.id || serverKOT?._id || serverKOT?.id
                      if (realId) {
                        // Update cache with real server ID
                        const offlineKey = `offline-${offlineEntry.id}`
                        await localCache.putKOT({ ...kotForCache, _id: realId, id: realId, isOffline: false }).catch(() => {})
                        await localCache.removeKOT(offlineKey).catch(() => {})
                        // Mark queue entry as synced
                        await offlineQueue.markSynced(offlineEntry.id).catch(() => {})
                        setOfflineKOTIds(prev => { const s = new Set(prev); s.delete(offlineKey); return s })
                        setPendingSyncCount(prev => Math.max(0, prev - 1))
                        // Persist the offline→real ID mapping for bill generation
                        const map = await localCache.getOfflineIdMap().catch(() => ({}))
                        map[offlineKey] = realId
                        localCache.setOfflineIdMap(map).catch(() => {})
                      }
                    }).catch(() => {
                      // Server unavailable — already saved locally, syncManager will retry on reconnect
                      console.warn('[MenuScreen] KOT queued for sync:', kotOrder.kotNumber)
                    })

                    // ✅ CRITICAL FIX: Save to localStorage immediately for instant access
                    const tableKOTKey = `table-${kotOrder.tableNumber}-kots`
                    const existingTableKOTs = JSON.parse(localStorage.getItem(tableKOTKey) || '[]')
                    existingTableKOTs.push({
                      ...savedKOT,
                      id: savedKOT.id || savedKOT._id,
                      kotNumber: kotOrder.kotNumber,
                      tableNumber: kotOrder.tableNumber,
                      items: kotOrder.items,
                      totalAmount: kotOrder.totalAmount,
                      grandTotal: kotOrder.grandTotal,
                      paymentStatus: 'pending',
                      customerName: kotOrder.customerName,
                      phoneNumber: kotOrder.phoneNumber,
                      savedAt: new Date().toISOString()
                    })
                    localStorage.setItem(tableKOTKey, JSON.stringify(existingTableKOTs))
                 
                    
                    // Set expiry time for cleanup (24 hours from now)
                    const expiryKey = `${tableKOTKey}-expiry`
                    const expiryTime = Date.now() + (24 * 60 * 60 * 1000) // 24 hours
                    localStorage.setItem(expiryKey, expiryTime.toString())



                    try {
                      await thermalPrinter.printKOT({
                        kotNumber: kotNumber,
                        tableNumber: selectedTable.number || selectedTable.tableNumber,
                        items: cartItems
                      })
                  
                    } catch (printError) {
                      console.error('❌ Failed to print KOT:', printError)
                    }


                    // Show success message with KOT info (no bill number yet)
                    // alert(`✅ New KOT created!\n\nTable: ${selectedTable.number}\nKOT: ${kotNumber}\nItems: ${cartItems.length}\n\nEach KOT gets a unique number!`)

                    // CRITICAL FIX: Reset table selection and auto-focus for next table entry
                    setCartItems([])
                    setSelectedTable(null)
                    setTableInput("")
                    setExistingKOTId(null)
                    setExistingKOTNumber(null)

                    // CRITICAL FIX: Release lock after successful save
                    setSavingKOT(false)
                  

                    // Auto-focus on table input for next order entry
                    setTimeout(() => {
                      if (tableInputRef.current) {
                        tableInputRef.current.focus()
                        // console.log('🎯 Auto-focused on table input after creating new KOT')
                      }
                    }, 100)

                  } catch (error) {
                   
                    alert(`Failed to save KOT: ${error.message}\nPlease try again.`)
                    
                    // CRITICAL FIX: Release lock on error
                    setSavingKOT(false)
                  
                  }
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  width: 'auto',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  opacity: savingKOT ? 0.6 : 1,
                  cursor: savingKOT ? 'not-allowed' : 'pointer'
                }}
              >
                {savingKOT ? '⏳ Saving KOT...' : '💾 Save KOT →'}
              </button>
            ) : (
              // For Self Service and Temple Meals: Generate Bill button
              <button
                className="counter-button"
                onClick={handleGenerateBill}
                style={{
                  background: 'rgba(34, 197, 94, 0.9)',
                  border: '1px solid rgba(34, 197, 94, 1)',
                  color: 'white',
                  width: 'auto',
                  padding: '12px 24px',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '1rem'
                }}
              >
                🧾 Generate Bill →
              </button>
            )}
          </div>
        )}

        {/* Back Button */}
        {/* 
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            className="counter-button-secondary"
            onClick={handleBack}
            style={{ width: 'auto', padding: '8px 16px' }}
          >
            ← Back to Category Selection
          </button>
        </div>
        */}

        {showKOTList && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '14px',
              padding: '24px',
              minWidth: '700px',
              maxWidth: '900px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(105,34,27,0.18)',
              outline: 'none',
              border: '1px solid #e8ddd8'
            }}
              tabIndex={0}
              data-kot-modal="true"
              onKeyDown={async (e) => {
             

                // Get filtered KOTs for navigation
                const getFilteredKOTs = () => {
                  if (!kotSearchQuery.trim()) return savedKOTs;

                  const searchTerm = kotSearchQuery.toLowerCase().trim();
                  return savedKOTs.filter(kot => {
                    const tableNumber = String(kot.tableNumber || '').toLowerCase();
                    return tableNumber.includes(searchTerm);
                  });
                };

                const filteredKOTs = getFilteredKOTs();

                // Handle arrow keys directly on the modal
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                
                  setFocusedKOTIndex(prev => {
                    const newIndex = prev < filteredKOTs.length - 1 ? prev + 1 : 0
                   
                    setTimeout(() => scrollToFocusedCard(newIndex), 50)
                    return newIndex
                  })
                }

                if (e.key === 'ArrowUp') {
                  e.preventDefault()
                
                  setFocusedKOTIndex(prev => {
                    const newIndex = prev > 0 ? prev - 1 : filteredKOTs.length - 1
                
                    setTimeout(() => scrollToFocusedCard(newIndex), 50)
                    return newIndex
                  })
                }

                if (e.key === 'Enter') {
                  e.preventDefault()

                  // Check if the search input is focused - if so, let the search input handle Enter
                  const activeElement = document.activeElement;
                  const isSearchInputFocused = activeElement && (
                    activeElement.id === 'kot-search-input' ||
                    activeElement === kotSearchInputRef.current
                  );

                  if (isSearchInputFocused) {
                  
                    return; // Let the search input handle the Enter key
                  }

               

                  // FIXED: Group KOTs by table and get the focused table
                  const kotsByTable = {};
                  filteredKOTs.forEach(kot => {
                    const tableKey = kot.tableNumber;
                    if (!kotsByTable[tableKey]) {
                      kotsByTable[tableKey] = [];
                    }
                    kotsByTable[tableKey].push(kot);
                  });

                  // Sort tables by table number
                  const sortedTables = Object.keys(kotsByTable).sort((a, b) => {
                    const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
                    const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
                    return numA - numB;
                  });

                  // Get the focused table using the table index
                  const focusedTableNumber = sortedTables[focusedKOTIndex];
                

                  if (!focusedTableNumber) {
                
                    return;
                  }

                  // NEW: Two-step process
                  // First Enter: Show detailed view
                  // Second Enter: Generate bill
                  if (!showKOTDetailView) {
                    // console.log('🔍 First Enter: Showing detailed view');
                    setShowKOTDetailView(true);
                    return;
                  }

                  // Second Enter: Generate bill (already in detailed view)
              
                  await generateComprehensiveBillForTable(focusedTableNumber)
                }

                if (e.key === 'Escape') {
                  e.preventDefault()
                 
                  setShowKOTList(false)
                  setFocusedKOTIndex(0)
                  setShowKOTDetailView(false) // Reset detail view
                }

                // Add 'E' key for editing the focused KOT
                if (e.key.toLowerCase() === 'e') {
                  e.preventDefault()
                  const filteredKOTs = savedKOTs.filter(kot => {
                    if (!kotSearchQuery.trim()) return true;
                    const searchTerm = kotSearchQuery.toLowerCase().trim();
                    const tableNumber = String(kot.tableNumber || '').toLowerCase();
                    return tableNumber.includes(searchTerm);
                  });

                  const focusedKOT = filteredKOTs[focusedKOTIndex];
                  if (focusedKOT && focusedKOT.paymentStatus === 'pending') {
                   
                    startEditingKOT(focusedKOT)
                  } else {
                    console.log('🔍 Cannot edit: KOT not found or not pending')
                  }
                }

                // Add 'P' key for Save and Print KOT when editing
                if (e.key.toLowerCase() === 'p' && editingKOT) {
                  e.preventDefault()
       
                  saveKOTModifications(true)
                }
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                paddingBottom: '14px',
                borderBottom: '2px solid #e8ddd8'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    background: '#fff5f4', border: '1.5px solid #69221b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <ClipboardList size={18} color="#69221b" strokeWidth={2} />
                  </div>
                  <div>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#69221b', fontWeight: '700' }}>
                      Saved KOTs &nbsp;
                      <span style={{ fontSize: '0.85rem', color: '#a07060', fontWeight: '500' }}>
                        {focusedKOTIndex + 1}/{(() => {
                          if (!kotSearchQuery.trim()) return savedKOTs.length;
                          return savedKOTs.filter(kot => {
                            const searchTerm = kotSearchQuery.toLowerCase().trim();
                            return String(kot.tableNumber || '').toLowerCase().includes(searchTerm);
                          }).length;
                        })()}
                        {kotSearchQuery.trim() && ` · "${kotSearchQuery}"`}
                      </span>
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => { setShowKOTList(false); setShowKOTDetailView(false) }}
                  style={{
                    background: '#fff5f4',
                    color: '#69221b',
                    border: '1.5px solid #e8ddd8',
                    borderRadius: '8px',
                    width: '32px', height: '32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = '#69221b'; e.currentTarget.style.color = '#fff' }}
                  onMouseOut={(e) => { e.currentTarget.style.background = '#fff5f4'; e.currentTarget.style.color = '#69221b' }}
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              {/* Keyboard Navigation Instructions */}


              {/* Search Bar for Table Number */}
              <div style={{
                marginBottom: '20px'
              }}>
                <input
                  id="kot-search-input"
                  ref={kotSearchInputRef}
                  type="text"
                  placeholder="Search by table number (e.g., 5, 10)..."
                  value={kotSearchQuery}
                  autoFocus={true}
                  onChange={(e) => {
                    setKotSearchQuery(e.target.value)
                    setFocusedKOTIndex(0) // Reset to first result when search changes
                    setShowKOTDetailView(false) // Reset detail view when search changes
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation() // Prevent event from bubbling to other handlers

                      // Check if already navigating
                      if (sessionStorage.getItem('isNavigatingToBill') === 'true') {
                       
                        return;
                      }

                     

                      // Get filtered KOTs
                      const filteredKOTs = savedKOTs.filter(kot => {
                        if (!kotSearchQuery.trim()) return true;
                        const searchTerm = kotSearchQuery.toLowerCase().trim();
                        const tableNumber = String(kot.tableNumber || '').toLowerCase();
                        return tableNumber.includes(searchTerm);
                      });

                      // If no results, show alert and return
                      if (filteredKOTs.length === 0) {
                        alert(`No KOTs found for table "${kotSearchQuery}". Please check the table number and try again.`)
                        return
                      }

                      // NEW: Two-step process
                      // First Enter: Show detailed view
                      // Second Enter: Generate bill
                      if (!showKOTDetailView) {

                        setShowKOTDetailView(true);
                        // Keep focus on search input so user can press Enter again
                        setTimeout(() => {
                          if (kotSearchInputRef.current) {
                            kotSearchInputRef.current.focus();
                          }
                        }, 100);
                        return;
                      }

                      // Second Enter: Generate bill
                      // Set navigation flag immediately
                      sessionStorage.setItem('isNavigatingToBill', 'true');

                      // Blur the search input to prevent further Enter events
                      if (kotSearchInputRef.current) {
                        kotSearchInputRef.current.blur();
                      }

                      // If there's exactly one filtered result, generate bill for it
                      if (filteredKOTs.length === 1) {
                        const kotToPrint = filteredKOTs[0];
                        

                        if (kotToPrint.paymentStatus === 'pending') {
                       
                          try {
                            await generateComprehensiveBillForTable(kotToPrint.tableNumber)
                         
                          } catch (error) {
                            console.error('🔍 ❌ Error generating bill:', error)
                            alert('Failed to generate bill. Please try again.')
                            sessionStorage.removeItem('isNavigatingToBill'); // Reset on error
                          }
                        } else {
                          // console.log('🔍 ❌ KOT already completed:', kotToPrint.kotNumber, 'Status:', kotToPrint.paymentStatus)
                          alert(`KOT ${kotToPrint.kotNumber} for table ${kotToPrint.tableNumber} is already ${kotToPrint.paymentStatus}. Cannot generate bill.`)
                          sessionStorage.removeItem('isNavigatingToBill'); // Reset flag
                        }
                        return
                      }

                      // If multiple KOTs but all for the same table, generate bill for that table
                      if (filteredKOTs.length > 1) {
                        const uniqueTables = [...new Set(filteredKOTs.map(kot => kot.tableNumber))];

                        if (uniqueTables.length === 1) {
                          const tableNumber = uniqueTables[0];
                          const pendingKOTs = filteredKOTs.filter(kot => kot.paymentStatus === 'pending');

                          if (pendingKOTs.length > 0) {
                           
                            try {
                              await generateComprehensiveBillForTable(tableNumber)
                            
                            } catch (error) {
                              console.error('🔍 ❌ Error generating bill:', error)
                              alert('Failed to generate bill. Please try again.')
                              sessionStorage.removeItem('isNavigatingToBill'); // Reset on error
                            }
                            return
                          } else {
                            alert(`All KOTs for table ${tableNumber} are already completed. Cannot generate bill.`)
                            sessionStorage.removeItem('isNavigatingToBill'); // Reset flag
                            return
                          }
                        } else {
                          alert(`Found KOTs for multiple tables: ${uniqueTables.join(', ')}. Please be more specific with the table number.`)
                          sessionStorage.removeItem('isNavigatingToBill'); // Reset flag
                          return
                        }
                      }

                      // If we reach here, reset the flag
                      sessionStorage.removeItem('isNavigatingToBill');
                    } else if (e.key === 'Escape') {
                      e.preventDefault()
                      // Clear search or close modal
                      if (kotSearchQuery.trim()) {
                        setKotSearchQuery('')
                        setShowKOTDetailView(false) // Reset detail view

                      } else {
                        setShowKOTList(false)
                        setFocusedKOTIndex(0)
                        setShowKOTDetailView(false) // Reset detail view
                      
                      }
                    } else if (e.key === 'ArrowDown') {
                      e.preventDefault()
                      // Move focus to modal for arrow navigation
                      const modalContainer = document.querySelector('[data-kot-modal="true"]')
                      if (modalContainer) {
                        modalContainer.focus()
                     
                      }
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    fontSize: '1rem',
                    border: '2px solid #d1d5db',
                    borderRadius: '8px',
                    outline: 'none',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
              </div>

              {kotLoading ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: '#6b7280'
                }}>
                  <div style={{
                    fontSize: '2rem',
                    marginBottom: '16px'
                  }}>
                    🔄
                  </div>
                  Loading saved KOTs...
                </div>
              ) : savedKOTs.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '40px',
                  color: '#6b7280'
                }}>
                  <div style={{
                    fontSize: '3rem',
                    marginBottom: '16px'
                  }}>
                    📋
                  </div>
                  <h3 style={{ margin: '0 0 8px 0', color: '#374151' }}>
                    No Saved KOTs Found
                  </h3>
                  <p style={{ margin: '0', fontSize: '0.875rem' }}>
                    KOTs will appear here after they are sent to the kitchen
                  </p>
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gap: '16px',
                  maxHeight: '500px',
                  overflowY: 'auto'
                }}>
                  {(() => {
                    // Filter KOTs based on search query (table number)
                    const filteredKOTs = savedKOTs.filter(kot => {
                      if (!kotSearchQuery.trim()) return true; // Show all if no search query

                      const searchTerm = kotSearchQuery.toLowerCase().trim();
                      const tableNumber = String(kot.tableNumber || '').toLowerCase();

                      // Match table number (exact or partial match)
                      return tableNumber.includes(searchTerm);
                    });

                    if (filteredKOTs.length === 0 && kotSearchQuery.trim()) {
                      return (
                        <div style={{
                          textAlign: 'center',
                          padding: '40px',
                          color: '#6b7280'
                        }}>
                          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🔍</div>
                          <p>No KOTs found for table "{kotSearchQuery}"</p>
                          <p style={{ fontSize: '0.875rem', marginTop: '8px' }}>
                            Try searching with a different table number
                          </p>
                        </div>
                      );
                    }

                    // Group KOTs by table number for better display
                    const kotsByTable = {};
                    filteredKOTs.forEach(kot => {
                      const tableKey = kot.tableNumber;
                      if (!kotsByTable[tableKey]) {
                        kotsByTable[tableKey] = [];
                      }
                      kotsByTable[tableKey].push(kot);
                    });

                    // Sort tables by table number
                    const sortedTables = Object.keys(kotsByTable).sort((a, b) => {
                      const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
                      const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
                      return numA - numB;
                    });

                    if (sortedTables.length === 0) {
                      return (
                        <div style={{
                          textAlign: 'center',
                          padding: '40px',
                          color: '#9ca3af'
                        }}>
                          <div style={{ fontSize: '2rem', marginBottom: '16px' }}>🔍</div>
                          <p>No KOTs found for table "{kotSearchQuery}"</p>
                          <p style={{ fontSize: '0.875rem', marginTop: '8px' }}>
                            Try searching with a different table number
                          </p>
                        </div>
                      );
                    }

                    return sortedTables.map((tableNumber, tableIndex) => {
                      const tableKOTs = kotsByTable[tableNumber];
                      const totalTableAmount = tableKOTs.reduce((sum, kot) => sum + (kot.totalAmount || 0), 0);
                      const totalTableItems = tableKOTs.reduce((sum, kot) => sum + (kot.items?.length || 0), 0);
                      const isTableFocused = tableIndex === Math.floor(focusedKOTIndex / 1);

                      // NEW: Check if this table should show detailed view
                      const showDetailedView = showKOTDetailView && isTableFocused;

                      return (
                        <div
                          key={tableNumber}
                          data-kot-index={tableIndex}
                          style={{
                            background: isTableFocused ? '#fff5f4' : '#faf8f6',
                            border: isTableFocused ? '2px solid #69221b' : '1.5px solid #e8ddd8',
                            borderRadius: '12px',
                            padding: '16px',
                            marginBottom: '12px',
                            transition: 'all 0.2s ease',
                            boxShadow: isTableFocused ? '0 4px 12px rgba(105,34,27,0.15)' : 'none',
                            cursor: 'pointer'
                          }}
                          onClick={() => {
                            setFocusedKOTIndex(tableIndex);
                            if (!showDetailedView) {
                              setShowKOTDetailView(true);
                            }
                          }}
                        >

                          {/* SIMPLIFIED VIEW - Show only table number and total */}
                          {!showDetailedView ? (
                            <div style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '12px',
                              background: '#fed7aa',
                              borderRadius: '8px'
                            }}>
                              <div>
                                <h3 style={{ margin: '0', color: '#9a3412', fontSize: '1.25rem' }}>
                                  🪑 Table {tableNumber}
                                </h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.875rem', color: '#7c2d12' }}>
                                  {tableKOTs.length} KOT{tableKOTs.length > 1 ? 's' : ''} • {totalTableItems} items
                                </p>
                              </div>
                              <div style={{
                                fontSize: '1.5rem',
                                fontWeight: '700',
                                color: '#9a3412'
                              }}>
                                ₹{totalTableAmount.toFixed(2)}
                              </div>
                            </div>
                          ) : (
                            /* DETAILED VIEW - Show full KOT details */
                            <>
                              {/* Table Header */}
                              <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '12px',
                                padding: '10px 12px',
                                background: '#69221b',
                                borderRadius: '8px'
                              }}>
                                <div>
                                  <h3 style={{ margin: '0', color: '#fff', fontSize: '1rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/><line x1="12" y1="7" x2="12" y2="17"/></svg>
                                    Table {tableNumber}
                                  </h3>
                                  <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'rgba(255,255,255,0.75)' }}>
                                    {tableKOTs.length} KOT{tableKOTs.length > 1 ? 's' : ''} • {totalTableItems} items • ₹{totalTableAmount.toFixed(2)}
                                  </p>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    onClick={() => {
                                      // Add new items to this table (creates new KOT)
                                      const firstKOT = tableKOTs[0];
                                      setSelectedTable({
                                        _id: firstKOT.tableId,
                                        id: firstKOT.tableId,
                                        tableNumber: firstKOT.tableNumber,
                                        number: firstKOT.tableNumber,
                                        status: 'reserved'
                                      });
                                      setCartItems([]);
                                      setExistingKOTId(null);
                                      setExistingKOTNumber(null);
                                      setShowKOTList(false);

                                    }}
                                    style={{
                                      background: 'rgba(255,255,255,0.15)',
                                      color: 'white',
                                      border: '1.5px solid rgba(255,255,255,0.4)',
                                      borderRadius: '6px',
                                      padding: '6px 12px',
                                      fontSize: '0.8rem',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      display: 'flex', alignItems: 'center', gap: '4px'
                                    }}
                                  >
                                    ➕ Add Items
                                  </button>
                                  <button
                                    onClick={async () => {
                                     
                                      await generateComprehensiveBillForTable(tableNumber);
                                    }}
                                    style={{
                                      background: 'white',
                                      color: '#69221b',
                                      border: '1.5px solid rgba(255,255,255,0.9)',
                                      borderRadius: '6px',
                                      padding: '6px 12px',
                                      fontSize: '0.8rem',
                                      fontWeight: '700',
                                      cursor: 'pointer',
                                      display: 'flex', alignItems: 'center', gap: '4px'
                                    }}
                                  >
                                    📄 Complete Bill
                                  </button>
                                  <button
                                    onClick={async () => {
                                      await handleSplitBill(tableNumber);
                                    }}
                                    style={{
                                      background: 'rgba(251, 191, 36, 0.2)',
                                      color: '#fbbf24',
                                      border: '1.5px solid rgba(251, 191, 36, 0.6)',
                                      borderRadius: '6px',
                                      padding: '6px 12px',
                                      fontSize: '0.8rem',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      display: 'flex', alignItems: 'center', gap: '4px'
                                    }}
                                  >
                                    ✂️ Split Bill
                                  </button>
                                  <button
                                    onClick={() => {
                                      // Shift entire table (all KOTs) to another table
                                    

                                      // Use the first KOT for the shift process, but we'll shift all KOTs
                                      const firstKOT = tableKOTs[0];

                                      // Set up for table shift with all KOTs
                                      setShiftingKOT({
                                        ...firstKOT,
                                        allTableKOTs: tableKOTs, // Pass all KOTs for this table
                                        isTableShift: true // Flag to indicate this is a full table shift
                                      });

                                      // Get available tables (exclude current table)
                                      const availableTablesList = tables.filter(table =>
                                        table.status === 'available' && table.number !== tableNumber
                                      );

                                      setAvailableTables(availableTablesList);
                                      setShowTableShiftModal(true);
                                    }}
                                    style={{
                                      background: 'rgba(255,255,255,0.15)',
                                      color: 'white',
                                      border: '1.5px solid rgba(255,255,255,0.4)',
                                      borderRadius: '6px',
                                      padding: '6px 12px',
                                      fontSize: '0.8rem',
                                      fontWeight: '600',
                                      cursor: 'pointer',
                                      display: 'flex', alignItems: 'center', gap: '4px'
                                    }}
                                    title={`Shift entire Table ${tableNumber} (all ${tableKOTs.length} KOTs) to another table`}
                                  >
                                    🔄 Shift Table
                                  </button>
                                </div>
                              </div>

                              {/* KOTs for this table */}
                              <div style={{ display: 'grid', gap: '12px' }}>
                                {tableKOTs.map((kot, kotIndex) => (
                                  <div
                                    key={kot.id}
                                    style={{
                                      background: '#faf8f6',
                                      border: '1px solid #e8ddd8',
                                      borderRadius: '8px',
                                      padding: '12px'
                                    }}>

                                    {/* KOT Header */}
                                    <div style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      marginBottom: '12px'
                                    }}>
                                      <div>
                                        <h4 style={{ margin: '0', color: '#69221b', fontSize: '0.9rem', fontWeight: '700' }}>
                                          🍽️ {kot.kotNumber || `KOT-${kot.id?.slice(-3)}`}
                                          {offlineKOTIds.has(kot.id || kot._id) && (
                                            <span style={{ background: '#ef4444', color: 'white', padding: '1px 6px', borderRadius: '8px', fontSize: '11px', marginLeft: '4px' }}>Offline</span>
                                          )}
                                        </h4>
                                        <p style={{ margin: '2px 0 0 0', fontSize: '0.75rem', color: '#a07060' }}>
                                          {new Date(kot.createdAt).toLocaleString('en-IN', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            hour12: true
                                          })} • ₹{(kot.totalAmount || 0).toFixed(2)}
                                        </p>
                                      </div>
                                      <div style={{ display: 'flex', gap: '4px' }}>
                                        <button
                                          onClick={async () => {
                                            // Reprint KOT with same details including remarks and REPRINT watermark

                                            try {
                                              await thermalPrinter.printKOT({
                                                kotNumber: kot.kotNumber,
                                                tableNumber: kot.tableNumber,
                                                items: kot.items // This includes remarks if they exist
                                              }, {
                                                isReprint: true // Add REPRINT watermark
                                              });
                                            
                                              alert(`✅ KOT ${kot.kotNumber} reprinted successfully!`);
                                            } catch (error) {
                                              console.error('❌ Failed to reprint KOT:', error);
                                              alert(`❌ Failed to reprint KOT: ${error.message}`);
                                            }
                                          }}
                                          style={{
                                            background: '#fff5f4',
                                            color: '#69221b',
                                            border: '1.5px solid #e8ddd8',
                                            borderRadius: '6px',
                                            padding: '4px 10px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '4px'
                                          }}
                                          title="Reprint this KOT with all items and remarks"
                                        >
                                          🖨️ Reprint
                                        </button>
                                        <button
                                          onClick={() => startEditingKOT(kot)}
                                          style={{
                                            background: '#69221b',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            padding: '4px 10px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '4px'
                                          }}
                                        >
                                          ✏️ Edit
                                        </button>
                                      </div>
                                    </div>

                                    {/* KOT Items */}
                                    {editingKOT && editingKOT.id === kot.id ? (
                                      // Show editing interface (keep existing editing logic)
                                      <div style={{
                                        background: '#fff5f4',
                                        border: '2px solid #69221b',
                                        borderRadius: '8px',
                                        padding: '16px'
                                      }}>
                                        <div style={{
                                          display: 'flex',
                                          justifyContent: 'space-between',
                                          alignItems: 'center',
                                          marginBottom: '12px'
                                        }}>
                                          <h5 style={{ margin: '0', color: '#92400e', fontSize: '0.875rem' }}>
                                            ✏️ Editing Items
                                          </h5>
                                          <div style={{ display: 'flex', gap: '4px' }}>
                                            <button
                                              onClick={() => saveKOTModifications(false)}
                                              style={{
                                                background: '#10b981',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '4px 8px',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              ✅ Save
                                            </button>
                                            <button
                                              onClick={() => saveKOTModifications(true)}
                                              style={{
                                                background: '#f59e0b',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '4px 8px',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              🖨️ Save & Print
                                            </button>
                                            <button
                                              onClick={cancelKOTEdit}
                                              style={{
                                                background: '#ef4444',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                padding: '4px 8px',
                                                fontSize: '0.75rem',
                                                cursor: 'pointer'
                                              }}
                                            >
                                              ❌ Cancel
                                            </button>
                                          </div>
                                        </div>

                                        {/* Editing items interface - keep existing logic */}
                                        <div style={{ display: 'grid', gap: '8px' }}>
                                          {modifiedItems.map((item, itemIndex) => (
                                            <div
                                              key={`${item.menuItemId || item._id || item.name}-${itemIndex}`}
                                              style={{
                                                background: item.isRemoved ? '#fee2e2' : '#f0fdf4',
                                                border: item.isRemoved ? '1px solid #fca5a5' : '1px solid #bbf7d0',
                                                borderRadius: '6px',
                                                padding: '8px',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                              }}
                                            >
                                              <div style={{ flex: 1 }}>
                                                <span style={{
                                                  textDecoration: item.isRemoved ? 'line-through' : 'none',
                                                  color: item.isRemoved ? '#991b1b' : '#166534',
                                                  fontWeight: '600',
                                                  fontSize: '0.875rem'
                                                }}>
                                                  {item.name}
                                                </span>
                                                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '2px' }}>
                                                  ₹{item.price} each
                                                </div>
                                              </div>

                                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                {!item.isRemoved && (
                                                  <>
                                                    <button
                                                      onClick={() => updateItemQuantity(itemIndex, Math.max(0, item.newQuantity - 1))}
                                                      style={{
                                                        background: '#ef4444',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        padding: '2px 6px',
                                                        fontSize: '0.75rem',
                                                        cursor: 'pointer'
                                                      }}
                                                    >
                                                      -
                                                    </button>
                                                    <span style={{
                                                      minWidth: '30px',
                                                      textAlign: 'center',
                                                      fontSize: '0.875rem',
                                                      fontWeight: '600'
                                                    }}>
                                                      {item.newQuantity}
                                                    </span>
                                                    <button
                                                      onClick={() => updateItemQuantity(itemIndex, item.newQuantity + 1)}
                                                      style={{
                                                        background: '#10b981',
                                                        color: 'white',
                                                        border: 'none',
                                                        borderRadius: '4px',
                                                        padding: '2px 6px',
                                                        fontSize: '0.75rem',
                                                        cursor: 'pointer'
                                                      }}
                                                    >
                                                      +
                                                    </button>
                                                  </>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      // Show normal items view
                                      <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                        gap: '6px'
                                      }}>
                                        {kot.items?.map((item, itemIndex) => (
                                          <div key={itemIndex} style={{
                                            background: '#dcfce7',
                                            padding: '6px 10px',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem',
                                            color: '#166534'
                                          }}>
                                            <span style={{ fontWeight: '600' }}>
                                              {item.quantity}x
                                            </span>
                                            {item.name}
                                            <span style={{ color: '#15803d', marginLeft: '4px' }}>
                                              (₹{item.price})
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              <div style={{
                marginTop: '20px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                paddingTop: '16px',
                borderTop: '1px solid #e8ddd8'
              }}>
                <button
                  onClick={loadSavedKOTs}
                  disabled={kotLoading}
                  style={{
                    background: kotLoading ? '#f3f4f6' : '#fff5f4',
                    color: kotLoading ? '#9ca3af' : '#69221b',
                    border: '1.5px solid #e8ddd8',
                    borderRadius: '8px',
                    padding: '8px 18px',
                    height: '36px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: kotLoading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    transition: 'all 0.15s'
                  }}
                >
                  <RefreshCw size={14} strokeWidth={2} style={{ animation: kotLoading ? 'spin 1s linear infinite' : 'none' }} />
                  {kotLoading ? 'Refreshing...' : 'Refresh KOTs'}
                </button>

                <button
                  onClick={() => setShowKOTList(false)}
                  style={{
                    background: '#69221b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 22px',
                    height: '36px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    transition: 'all 0.15s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = '#8b2e26'}
                  onMouseOut={(e) => e.currentTarget.style.background = '#69221b'}
                >
                  <X size={14} strokeWidth={2.5} /> Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complimentary Bills Modal */}
        {showComplimentaryList && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '14px',
              padding: '24px',
              minWidth: '700px',
              maxWidth: '900px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(105,34,27,0.18)',
              border: '1px solid #e8ddd8',
              outline: 'none'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                paddingBottom: '14px',
                borderBottom: '2px solid #e8ddd8'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '8px',
                    background: '#fff5f4', border: '1.5px solid #69221b',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Gift size={18} color="#69221b" strokeWidth={2} />
                  </div>
                  <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#69221b', fontWeight: '700' }}>
                    Complimentary Bills
                  </h2>
                </div>
                <button
                  onClick={() => setShowComplimentaryList(false)}
                  style={{
                    background: '#fff5f4', color: '#69221b',
                    border: '1.5px solid #e8ddd8', borderRadius: '8px',
                    width: '32px', height: '32px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  title="Close (Alt+C)"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>

              {/* Date Selector */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#69221b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    Date
                  </span>
                  <input
                    type="date"
                    value={selectedComplimentaryDate}
                    onChange={(e) => {
                      setSelectedComplimentaryDate(e.target.value)
                      loadComplimentaryBills(e.target.value)
                    }}
                    style={{
                      padding: '6px 10px',
                      border: '1.5px solid #e8ddd8',
                      borderRadius: '7px',
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      outline: 'none',
                      color: '#2d1a18'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      const yesterday = new Date()
                      yesterday.setDate(yesterday.getDate() - 1)
                      const yesterdayStr = yesterday.toISOString().split('T')[0]
                      setSelectedComplimentaryDate(yesterdayStr)
                      loadComplimentaryBills(yesterdayStr)
                    }}
                    style={{
                      padding: '5px 12px', height: '30px',
                      border: '1.5px solid #e8ddd8', borderRadius: '6px',
                      background: '#fff', color: '#2d1a18',
                      fontSize: '0.78rem', fontWeight: '600', cursor: 'pointer'
                    }}
                  >
                    Yesterday
                  </button>

                  <button
                    onClick={() => {
                      const today = new Date().toISOString().split('T')[0]
                      setSelectedComplimentaryDate(today)
                      loadComplimentaryBills(today)
                    }}
                    style={{
                      padding: '5px 12px', height: '30px',
                      border: selectedComplimentaryDate === new Date().toISOString().split('T')[0] ? '2px solid #3b82f6' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      backgroundColor: selectedComplimentaryDate === new Date().toISOString().split('T')[0] ? '#eff6ff' : 'white',
                      color: selectedComplimentaryDate === new Date().toISOString().split('T')[0] ? '#3b82f6' : '#374151',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    Today
                  </button>

                  <button
                    onClick={() => loadComplimentaryBills(selectedComplimentaryDate)}
                    disabled={complimentaryLoading}
                    style={{
                      padding: '5px 12px', height: '30px',
                      border: '1.5px solid #e8ddd8', borderRadius: '6px',
                      background: complimentaryLoading ? '#f3f4f6' : '#fff5f4',
                      color: complimentaryLoading ? '#9ca3af' : '#69221b',
                      fontSize: '0.78rem', fontWeight: '600',
                      cursor: complimentaryLoading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '5px'
                    }}
                  >
                    <RefreshCw size={12} strokeWidth={2} style={{ animation: complimentaryLoading ? 'spin 1s linear infinite' : 'none' }} />
                    {complimentaryLoading ? 'Loading...' : 'Refresh'}
                  </button>
                </div>
              </div>

              {complimentaryLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#a07060' }}>
                  <div className="counter-spinner" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: '0.9rem' }}>Loading complimentary bills...</div>
                </div>
              ) : complimentaryBills.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#a07060' }}>
                  <Gift size={40} color="#e8ddd8" strokeWidth={1.5} style={{ marginBottom: '12px' }} />
                  <div style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '6px', color: '#2d1a18' }}>
                    No Complimentary Bills Found
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#a07060' }}>
                    No complimentary bills for {selectedComplimentaryDate === new Date().toISOString().split('T')[0] ? 'today' : new Date(selectedComplimentaryDate).toLocaleDateString('en-IN', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </div>
                  <div style={{
                    fontSize: '0.75rem', color: '#a07060', marginTop: '8px'
                  }}>
                    Try selecting a different date.
                  </div>
                </div>
              ) : (
                <>
                  <div style={{
                    marginBottom: '16px',
                    padding: '12px 14px',
                    background: '#fff5f4',
                    borderRadius: '8px',
                    border: '1.5px solid #69221b',
                    display: 'flex', gap: '24px', alignItems: 'center'
                  }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#69221b', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                      {selectedComplimentaryDate === new Date().toISOString().split('T')[0] ? "Today's Summary" : new Date(selectedComplimentaryDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#2d1a18' }}>
                      Total Bills: <strong>{complimentaryBills.length}</strong>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#2d1a18' }}>
                      Total Amount: <strong style={{ color: '#69221b' }}>₹{complimentaryBills.reduce((sum, bill) => sum + (bill.amount || 0), 0).toFixed(2)}</strong>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gap: '12px',
                    maxHeight: '400px',
                    overflowY: 'auto'
                  }}>
                    {complimentaryBills.map((bill, index) => (
                      <div key={bill.billId || index} style={{
                        background: '#faf8f6',
                        border: '1.5px solid #e8ddd8',
                        borderRadius: '10px',
                        padding: '14px 16px',
                      }}>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          marginBottom: '10px'
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{
                              fontSize: '1rem',
                              fontWeight: '700',
                              color: '#2d1a18',
                              marginBottom: '3px'
                            }}>
                              {bill.customerName}
                            </div>
                            <div style={{
                              fontSize: '0.8rem',
                              color: '#6b7280',
                              marginBottom: '4px'
                            }}>
                              Invoice: {bill.invoiceNumber} • Time: {bill.time}
                            </div>
                            {bill.categoryName && bill.categoryName !== 'N/A' && (
                              <div style={{
                                fontSize: '0.72rem',
                                color: '#69221b',
                                background: '#fff5f4',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                display: 'inline-block',
                                marginBottom: '4px',
                                border: '1px solid #e8ddd8'
                              }}>
                                {bill.categoryName}
                              </div>
                            )}
                            {bill.complimentaryBy && bill.complimentaryBy !== 'N/A' && (
                              <div style={{ fontSize: '0.75rem', color: '#a07060', marginTop: '4px' }}>
                                Marked by: {bill.complimentaryBy}
                              </div>
                            )}
                          </div>
                          <div style={{
                            fontSize: '1.1rem',
                            fontWeight: '700',
                            color: '#69221b'
                          }}>
                            ₹{(bill.amount || 0).toFixed(2)}
                          </div>
                        </div>

                        {/* Items List */}
                        {bill.items && bill.items.length > 0 && (
                          <div style={{
                            background: '#faf8f6',
                            padding: '10px',
                            borderRadius: '7px',
                            marginBottom: '10px',
                            border: '1px solid #e8ddd8'
                          }}>
                            <div style={{
                              fontSize: '0.72rem',
                              color: '#a07060',
                              fontWeight: '700',
                              marginBottom: '5px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.3px'
                            }}>
                              Items ({bill.items.length}):
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#2d1a18' }}>
                              {bill.items.map((item, idx) => (
                                <div key={idx} style={{ marginBottom: '2px' }}>
                                  • {item.name} x {item.quantity} — ₹{((item.price || 0) * (item.quantity || 0)).toFixed(2)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div style={{
                          background: '#fff5f4',
                          padding: '10px 12px',
                          borderRadius: '7px',
                          border: '1.5px solid #69221b'
                        }}>
                          <div style={{
                            fontSize: '0.72rem',
                            color: '#69221b',
                            fontWeight: '700',
                            marginBottom: '3px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.3px',
                            display: 'flex', alignItems: 'center', gap: '5px'
                          }}>
                            <Gift size={12} strokeWidth={2} /> Complimentary Reason:
                          </div>
                          <div style={{
                            fontSize: '0.85rem',
                            color: '#2d1a18',
                            fontStyle: 'italic'
                          }}>
                            {bill.reason || 'No reason provided'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div style={{
                marginTop: '24px',
                textAlign: 'center'
              }}>
                <button
                  onClick={loadComplimentaryBills}
                  disabled={complimentaryLoading}
                  style={{
                    background: '#f59e0b',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: complimentaryLoading ? 'not-allowed' : 'pointer',
                    opacity: complimentaryLoading ? 0.6 : 1,
                    marginRight: '12px'
                  }}
                >
                  {complimentaryLoading ? '🔄 Refreshing...' : '🔄 Refresh'}
                </button>

                <button
                  onClick={() => setShowComplimentaryList(false)}
                  style={{
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table Shift Modal */}
        {showTableShiftModal && shiftingKOT && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              minWidth: '600px',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
              outline: 'none'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px'
              }}>
                <h2 style={{
                  margin: 0,
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#1a202c',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🔄 {shiftingKOT.isTableShift ? `Shift Entire Table ${shiftingKOT.tableNumber}` : `Shift KOT ${shiftingKOT.kotNumber}`}
                </h2>
                <button
                  onClick={() => {
                    setShowTableShiftModal(false)
                    setShiftingKOT(null)
                    setSelectedNewTable(null)
                  }}
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  ✕ Close
                </button>
              </div>

              {/* Current KOT Info */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '24px'
              }}>
                <h3 style={{
                  margin: '0 0 12px 0',
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: '#1a202c'
                }}>
                  📋 {shiftingKOT.isTableShift ? 'Table Details' : 'KOT Details'}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {shiftingKOT.isTableShift ? (
                    <>
                      <div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>
                          Current Table:
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#dc2626' }}>
                          🪑 {shiftingKOT.tableNumber}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>
                          Total KOTs:
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1a202c' }}>
                          🍽️ {shiftingKOT.allTableKOTs?.length || 0} KOTs
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>
                          Customer:
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1a202c' }}>
                          👤 {shiftingKOT.customerName}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>
                          Total Items:
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1a202c' }}>
                          📦 {shiftingKOT.allTableKOTs?.reduce((sum, kot) => sum + (kot.items?.length || 0), 0) || 0} items
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>
                          KOT Number:
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1a202c' }}>
                          {shiftingKOT.kotNumber}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>
                          Current Table:
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#dc2626' }}>
                          🪑 {shiftingKOT.tableNumber}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>
                          Customer:
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1a202c' }}>
                          👤 {shiftingKOT.customerName}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>
                          Items:
                        </div>
                        <div style={{ fontSize: '1rem', fontWeight: '600', color: '#1a202c' }}>
                          📦 {shiftingKOT.items?.length || 0} items
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Available Tables */}
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{
                  margin: '0 0 16px 0',
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: '#1a202c'
                }}>
                  🪑 Select New Table ({availableTables.length} available)
                </h3>

                {availableTables.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: '#6b7280',
                    background: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                  }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>🚫</div>
                    <div>No available tables for shifting</div>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                    gap: '12px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    padding: '8px'
                  }}>
                    {availableTables.map((table) => (
                      <button
                        key={table._id || table.id}
                        onClick={() => setSelectedNewTable(table)}
                        style={{
                          background: selectedNewTable?.number === table.number ? '#3b82f6' : '#f8fafc',
                          color: selectedNewTable?.number === table.number ? 'white' : '#1a202c',
                          border: selectedNewTable?.number === table.number ? '2px solid #2563eb' : '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '16px 12px',
                          fontSize: '1rem',
                          fontWeight: '600',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 0.2s',
                          minHeight: '60px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        🪑 {table.number}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center'
              }}>
                <button
                  onClick={() => {
                    setShowTableShiftModal(false)
                    setShiftingKOT(null)
                    setSelectedNewTable(null)
                  }}
                  style={{
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={executeTableShift}
                  disabled={!selectedNewTable}
                  style={{
                    background: selectedNewTable ? '#3b82f6' : '#d1d5db',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: selectedNewTable ? 'pointer' : 'not-allowed',
                    opacity: selectedNewTable ? 1 : 0.6
                  }}
                >
                  🔄 Shift to Table {selectedNewTable?.number || '...'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quantity Popup Modal */}
        {showQuantityPopup && selectedMenuItem && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              minWidth: '400px',
              maxWidth: '500px',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}>
              <h2 style={{
                margin: '0 0 16px 0',
                fontSize: '1.5rem',
                color: '#1f2937',
                fontWeight: '600'
              }}>
                Add to Cart
              </h2>

              <div style={{
                padding: '16px',
                background: '#f9fafb',
                borderRadius: '8px',
                marginBottom: '24px'
              }}>
                <h3 style={{
                  margin: '0 0 8px 0',
                  fontSize: '1.1rem',
                  color: '#1f2937'
                }}>
                  {selectedMenuItem.menuItemNumber && (
                    <span style={{ color: '#f59e0b', marginRight: '8px' }}>
                      {selectedMenuItem.menuItemNumber}
                    </span>
                  )}
                  {selectedMenuItem.name}
                </h3>
                <p style={{
                  margin: '0',
                  fontSize: '1rem',
                  color: '#059669',
                  fontWeight: '600'
                }}>
                  ₹{selectedMenuItem.price.toFixed(2)}
                </p>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: '#374151'
                }}>
                  Enter Quantity:
                </label>
                <input
                  ref={quantityInputRef}
                  type="number"
                  min="1"
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleQuantityEnter()
                    } else if (e.key === 'Escape') {
                      setShowQuantityPopup(false)
                      setSelectedMenuItem(null)
                    }
                  }}
                  onFocus={(e) => {
                    // Auto-select all text when input is focused
                    e.target.select()
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '1.5rem',
                    border: '3px solid #3b82f6',
                    borderRadius: '8px',
                    textAlign: 'center',
                    fontWeight: '700',
                    color: '#2563eb',
                    backgroundColor: '#eff6ff'
                  }}
                />
              </div>

              {/* Remark field - only show for restaurant category */}
              {isRestaurantCategory && (
                <div style={{ marginBottom: '24px' }}>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    color: '#374151'
                  }}>
                    Remark (Optional):
                  </label>
                  <input
                    type="text"
                    value={remarkInput}
                    onChange={(e) => setRemarkInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleQuantityEnter()
                      } else if (e.key === 'Escape') {
                        setShowQuantityPopup(false)
                        setSelectedMenuItem(null)
                      }
                    }}
                    placeholder="Enter any special instructions..."
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '1rem',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      color: '#374151',
                      backgroundColor: '#f9fafb'
                    }}
                  />
                </div>
              )}

              <div style={{
                display: 'flex',
                gap: '12px'
              }}>
                <button
                  onClick={() => {
                    setShowQuantityPopup(false)
                    setSelectedMenuItem(null)
                  }}
                  style={{
                    flex: 1,
                    background: '#6b7280',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Cancel (Esc)
                </button>

                <button
                  onClick={handleQuantityEnter}
                  style={{
                    flex: 1,
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '12px 24px',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Add to Cart (Enter)
                </button>
              </div>
            </div>
          </div>
        )}


        {showSalesReport && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px'
            }}
          >
            <div
              style={{
                background: 'white',
                borderRadius: '14px',
                padding: '24px',
                width: '90%',
                maxWidth: '1000px',
                maxHeight: '90vh',
                overflow: 'auto',
                boxShadow: '0 20px 60px rgba(105,34,27,0.18)',
                border: '1px solid #e8ddd8'
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                  borderBottom: '2px solid #e8ddd8',
                  paddingBottom: '14px'
                }}
              >
                <div>
                  <h2
                    style={{
                      margin: '0 0 4px 0',
                      fontSize: '1.3rem',
                      color: '#69221b',
                      fontWeight: '700',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <BarChart2 size={20} color="#69221b" strokeWidth={2} />
                    Sales Report
                    {salesData?.isOfflineData && (
                      <span style={{ marginLeft: '6px', fontSize: '0.7rem', background: '#f59e0b', color: '#fff', borderRadius: '4px', padding: '2px 8px', verticalAlign: 'middle' }}>
                        Offline
                      </span>
                    )}
                  </h2>
                  <p style={{ margin: 0, color: '#a07060', fontSize: '0.85rem', fontWeight: '500' }}>
                    {salesData?.branch}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {/* Date Selector */}
                  <input
                    type="date"
                    value={selectedSalesDate}
                    onChange={(e) => {
                      setSelectedSalesDate(e.target.value);
                      loadSalesReport(e.target.value);
                    }}
                    style={{
                      padding: '8px 12px',
                      border: '2px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '0.875rem'
                    }}
                  />

                  {/* Refresh Button */}
                  <button
                    onClick={async () => {
                   
                      try {
                        await loadSalesReport(selectedSalesDate);

                      } catch (error) {
                        console.error('❌ Manual refresh failed:', error);
                      }
                    }}
                    disabled={salesLoading || kotLoading}
                    style={{
                      background: salesLoading || kotLoading ? '#f3f4f6' : '#fff5f4',
                      color: salesLoading || kotLoading ? '#9ca3af' : '#69221b',
                      border: '1.5px solid #e8ddd8',
                      borderRadius: '8px',
                      padding: '7px 14px',
                      height: '34px',
                      fontSize: '0.82rem',
                      fontWeight: '600',
                      cursor: salesLoading || kotLoading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', gap: '5px'
                    }}
                    title="Refresh sales report"
                  >
                    {salesLoading || kotLoading ? <><RefreshCw size={13} style={{animation:'spin 1s linear infinite'}}/> Refreshing...</> : <><RefreshCw size={13}/> Refresh</>}
                  </button>

                  <button
                    onClick={() => setShowSalesReport(false)}
                    style={{
                      background: '#69221b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '7px 14px',
                      height: '34px',
                      fontSize: '0.82rem',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '5px'
                    }}
                  >
                    <X size={13} strokeWidth={2.5}/> Close
                  </button>
                </div>
              </div>

              {salesLoading ? (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    padding: '60px',
                    flexDirection: 'column',
                    gap: '16px'
                  }}
                >
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      border: '4px solid #e5e7eb',
                      borderTop: '4px solid #3b82f6',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}
                  />
                  <p style={{ color: '#6b7280', fontSize: '1rem' }}>
                    Loading sales report...
                  </p>
                </div>
              ) : salesData ? (
                <div>
                  {/* Compute category-filtered summary once for all cards and orders list */}
                  {(() => {
                    const filteredOrders = preSelectedCategory
                      ? salesData.orders.filter(o => {
                          const cat = (o.categoryName || '').toLowerCase()
                          return cat === preSelectedCategory.toLowerCase() || cat.includes(preSelectedCategory.toLowerCase())
                        })
                      : salesData.orders

                    const activeFiltered = filteredOrders.filter(o => {
                      const s = (o.orderStatus || o.status || '').toLowerCase()
                      return s !== 'cancelled'
                    })
                    const cancelledFiltered = filteredOrders.filter(o => {
                      const s = (o.orderStatus || o.status || '').toLowerCase()
                      return s === 'cancelled'
                    })
                    const filteredRevenue = activeFiltered.reduce((s, o) => s + (o.totalAmount || 0), 0)
                    const filteredSummary = {
                      totalOrders: activeFiltered.length,
                      totalRevenue: filteredRevenue,
                      totalItems: activeFiltered.reduce((s, o) => s + (o.items || []).reduce((is, i) => is + (i.quantity || 1), 0), 0),
                      averageOrderValue: activeFiltered.length > 0 ? filteredRevenue / activeFiltered.length : 0,
                      totalDiscount: activeFiltered.reduce((s, o) => s + (o.discountAmount || 0), 0),
                      cancelledOrders: cancelledFiltered.length,
                      cancelledRevenue: cancelledFiltered.reduce((s, o) => s + (o.totalAmount || 0), 0),
                      offlinePendingCount: activeFiltered.filter(o => o.isOfflinePending).length,
                      offlinePendingRevenue: activeFiltered.filter(o => o.isOfflinePending).reduce((s, o) => s + (o.totalAmount || 0), 0),
                    }

                    return (<>
                  {/* Summary Cards */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '16px',
                      marginBottom: '32px'
                    }}
                  >
                    <div
                      style={{
                        background: '#fff5f4',
                        border: '2px solid #69221b',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#69221b' }}>
                        {filteredSummary.totalOrders}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#a07060', fontWeight: '600', marginTop: '4px' }}>
                        Total Orders
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#fff5f4',
                        border: '2px solid #69221b',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#69221b' }}>
                        ₹{filteredSummary.totalRevenue.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#a07060', fontWeight: '600', marginTop: '4px' }}>
                        Total Revenue
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#faf8f6',
                        border: '1.5px solid #e8ddd8',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#2d1a18' }}>
                        {filteredSummary.totalItems}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#a07060', fontWeight: '600', marginTop: '4px' }}>
                        Items Sold
                      </div>
                    </div>

                    <div
                      style={{
                        background: '#faf8f6',
                        border: '1.5px solid #e8ddd8',
                        borderRadius: '12px',
                        padding: '16px',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#2d1a18' }}>
                        ₹{filteredSummary.averageOrderValue.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#a07060', fontWeight: '600', marginTop: '4px' }}>
                        Avg Order Value
                      </div>
                    </div>

                    {/* GST Collected Card */}
                    {salesData?.summary?.totalGST > 0 && (
                      <div
                        style={{
                          background: '#f0fdf4',
                          border: '2px solid #22c55e',
                          borderRadius: '12px',
                          padding: '16px',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '1.8rem', fontWeight: '700', color: '#16a34a' }}>
                          ₹{salesData.summary.totalGST.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#15803d', fontWeight: '600', marginTop: '4px' }}>
                          Total GST Collected
                        </div>
                      </div>
                    )}

                    {filteredSummary.totalDiscount > 0 && (
                      <div
                        style={{
                          background: '#fef2f2',
                          border: '2px solid #ef4444',
                          borderRadius: '12px',
                          padding: '20px',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '2rem', fontWeight: '700', color: '#ef4444' }}>
                          ₹{filteredSummary.totalDiscount.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#dc2626', fontWeight: '600' }}>
                          Total Discounts
                        </div>
                      </div>
                    )}

                    {filteredSummary.cancelledOrders > 0 && (
                      <div
                        style={{
                          background: '#fef2f2',
                          border: '2px solid #f87171',
                          borderRadius: '12px',
                          padding: '20px',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '2rem', fontWeight: '700', color: '#dc2626' }}>
                          {filteredSummary.cancelledOrders}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#991b1b', fontWeight: '600' }}>
                          Cancelled Orders
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: '4px' }}>
                          -₹{filteredSummary.cancelledRevenue.toFixed(2)} lost
                        </div>
                      </div>
                    )}

                    {filteredSummary.offlinePendingCount > 0 && (
                      <div
                        style={{
                          background: '#fffbeb',
                          border: '2px solid #f59e0b',
                          borderRadius: '12px',
                          padding: '20px',
                          textAlign: 'center'
                        }}
                      >
                        <div style={{ fontSize: '2rem', fontWeight: '700', color: '#d97706' }}>
                          {filteredSummary.offlinePendingCount}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#92400e', fontWeight: '600' }}>
                          ⚠️ Pending Sync
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '4px' }}>
                          ₹{filteredSummary.offlinePendingRevenue.toFixed(2)} not yet on server
                        </div>
                        {navigator.onLine && (
                          <button
                            onClick={handleSyncBills}
                            disabled={syncingBills}
                            style={{
                              marginTop: '10px',
                              background: syncingBills ? '#9ca3af' : '#d97706',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '8px',
                              padding: '6px 16px',
                              fontSize: '0.8rem',
                              fontWeight: '600',
                              cursor: syncingBills ? 'not-allowed' : 'pointer',
                              width: '100%'
                            }}
                          >
                            {syncingBills ? '⏳ Uploading...' : '☁️ Upload Now'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Recent Orders Section */}
                  {(() => {
                    return (
                    <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px'
                      }}
                    >
                      <h3
                        style={{
                          fontSize: '1rem',
                          fontWeight: '700',
                          color: '#69221b',
                          margin: 0,
                          display: 'flex', alignItems: 'center', gap: '7px'
                        }}
                      >
                        <ClipboardList size={16} color="#69221b" strokeWidth={2}/>
                        Recent Orders ({filteredOrders.length})
                      </h3>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Show:</span>
                        <select
                          value={ordersPerPage}
                          onChange={(e) => {
                            setOrdersPerPage(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          style={{
                            padding: '4px 8px',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '0.875rem',
                            backgroundColor: 'white'
                          }}
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                        <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>per page</span>
                      </div>
                    </div>

                    {filteredOrders.length > 0 && (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '12px',
                          padding: '8px 12px',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          color: '#6b7280'
                        }}
                      >
                        <span>
                          Showing {((currentPage - 1) * ordersPerPage) + 1} to{' '}
                          {Math.min(currentPage * ordersPerPage, filteredOrders.length)} of{' '}
                          {filteredOrders.length} orders
                        </span>

                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            style={{
                              padding: '4px 8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              backgroundColor: currentPage === 1 ? '#f9fafb' : 'white',
                              color: currentPage === 1 ? '#9ca3af' : '#374151',
                              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                              fontSize: '0.75rem'
                            }}
                          >
                            ← Prev
                          </button>

                          {(() => {
                            const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
                            const pages = [];
                            const maxVisiblePages = 5;

                            let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

                            if (endPage - startPage + 1 < maxVisiblePages) {
                              startPage = Math.max(1, endPage - maxVisiblePages + 1);
                            }

                            for (let i = startPage; i <= endPage; i++) {
                              pages.push(
                                <button
                                  key={i}
                                  onClick={() => setCurrentPage(i)}
                                  style={{
                                    padding: '4px 8px',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '4px',
                                    backgroundColor: currentPage === i ? '#3b82f6' : 'white',
                                    color: currentPage === i ? 'white' : '#374151',
                                    cursor: 'pointer',
                                    fontSize: '0.75rem',
                                    fontWeight: currentPage === i ? '600' : '400'
                                  }}
                                >
                                  {i}
                                </button>
                              );
                            }

                            return pages;
                          })()}

                          <button
                            onClick={() =>
                              setCurrentPage((prev) =>
                                Math.min(prev + 1, Math.ceil(filteredOrders.length / ordersPerPage))
                              )
                            }
                            disabled={currentPage >= Math.ceil(filteredOrders.length / ordersPerPage)}
                            style={{
                              padding: '4px 8px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              backgroundColor:
                                currentPage >= Math.ceil(filteredOrders.length / ordersPerPage)
                                  ? '#f9fafb'
                                  : 'white',
                              color:
                                currentPage >= Math.ceil(filteredOrders.length / ordersPerPage)
                                  ? '#9ca3af'
                                  : '#374151',
                              cursor:
                                currentPage >= Math.ceil(filteredOrders.length / ordersPerPage)
                                  ? 'not-allowed'
                                  : 'pointer',
                              fontSize: '0.75rem'
                            }}
                          >
                            Next →
                          </button>
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        background: '#f9fafb',
                        borderRadius: '8px',
                        maxHeight: '400px',
                        overflow: 'auto'
                      }}
                    >
                      {filteredOrders.length === 0 ? (
                        <div
                          style={{
                            padding: '40px',
                            textAlign: 'center',
                            color: '#6b7280'
                          }}
                        >
                          No orders found for selected date and category
                        </div>
                      ) : (
                        (() => {
                          const startIndex = (currentPage - 1) * ordersPerPage;
                          const endIndex = startIndex + ordersPerPage;
                          const currentOrders = filteredOrders.slice(startIndex, endIndex);

                          return currentOrders.map((order, index) => {
                    

                            const isCancelled =
                              order.orderStatus === 'cancelled' ||
                              order.status === 'cancelled' ||
                              order.paymentStatus === 'cancelled';

                            return (
                              <div
                                key={index}
                                style={{
                                  padding: '12px 16px',
                                  borderBottom:
                                    index < Math.min(19, filteredOrders.length - 1)
                                      ? '1px solid #e5e7eb'
                                      : 'none',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  background: isCancelled ? '#fef2f2' : order.isOfflinePending ? '#fffbeb' : 'white'
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div
                                    style={{
                                      fontWeight: '600',
                                      color: '#1f2937',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px'
                                    }}
                                  >
                                    {order.orderNumber}
                                    {order.tableNumber && ` - Table ${order.tableNumber}`}
                                    {isCancelled && (
                                      <span
                                        style={{
                                          background: '#fef2f2',
                                          color: '#dc2626',
                                          padding: '2px 8px',
                                          borderRadius: '12px',
                                          fontSize: '0.75rem',
                                          fontWeight: '600',
                                          textTransform: 'uppercase',
                                          border: '1px solid #dc2626'
                                        }}
                                      >
                                        CANCELLED
                                      </span>
                                    )}
                                    {order.isOfflinePending && (
                                      <span
                                        style={{
                                          background: '#fffbeb',
                                          color: '#d97706',
                                          padding: '2px 8px',
                                          borderRadius: '12px',
                                          fontSize: '0.75rem',
                                          fontWeight: '600',
                                          border: '1px solid #f59e0b'
                                        }}
                                      >
                                        ⚠️ PENDING SYNC
                                      </span>
                                    )}
                                  </div>

                                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                    {order.time} • {order.customerName} • {order.items.length} items
                                  </div>

                                  {isCancelled && order.cancellationReason && (
                                    <div
                                      style={{
                                        marginTop: '8px',
                                        padding: '8px',
                                        background: '#fef2f2',
                                        border: '1px solid #fca5a5',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem'
                                      }}
                                    >
                                      <div
                                        style={{
                                          color: '#991b1b',
                                          fontWeight: '600',
                                          marginBottom: '4px'
                                        }}
                                      >
                                        🚫 Cancellation Details:
                                      </div>
                                      <div style={{ color: '#dc2626' }}>
                                        <strong>Reason:</strong> {order.cancellationReason}
                                      </div>
                                      {order.cancelledBy && (
                                        <div style={{ color: '#dc2626', marginTop: '2px' }}>
                                          <strong>Cancelled by:</strong> {order.cancelledBy}
                                        </div>
                                      )}
                                      {order.cancelledAt && (
                                        <div style={{ color: '#dc2626', marginTop: '2px' }}>
                                          <strong>Cancelled at:</strong>{' '}
                                          {new Date(order.cancelledAt).toLocaleString('en-IN')}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: '600', color: '#1f2937' }}>
                                      ₹{order.totalAmount.toFixed(2)}
                                    </div>
                                    {order.discountAmount > 0 && (
                                      <div style={{ fontSize: '0.75rem', color: '#ef4444' }}>
                                        -₹{order.discountAmount.toFixed(2)} discount
                                      </div>
                                    )}
                                  </div>

                                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button
                                      onClick={() => {
                                       
                                        setSelectedOrderDetails(order);
                                        setShowOrderDetails(true);
                                      }}
                                      style={{
                                        background: '#fff5f4',
                                        color: '#69221b',
                                        border: '1.5px solid #e8ddd8',
                                        borderRadius: '6px',
                                        padding: '5px 10px',
                                        fontSize: '0.75rem',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex', alignItems: 'center', gap: '4px'
                                      }}
                                      onMouseOver={(e) => (e.currentTarget.style.background = '#69221b', e.currentTarget.style.color = '#fff')}
                                      onMouseOut={(e) => (e.currentTarget.style.background = '#fff5f4', e.currentTarget.style.color = '#69221b')}
                                      title={`View items for ${order.orderNumber}`}
                                    >
                                      👁️ View
                                    </button>

                                    {!isCancelled ? (
                                      <button
                                        onClick={() => {
                                          // console.log('🚫 Cancel order clicked:', order.orderNumber);
                                          setSelectedOrderToCancel(order);
                                          setCancelReason('');
                                          setCancelledByName('');
                                          setAdminPassword('');
                                          setCancelError('');
                                          setShowCancelModal(true);
                                        }}
                                        style={{
                                          background: '#fee2e2',
                                          color: '#dc2626',
                                          border: '1.5px solid #fecaca',
                                          borderRadius: '6px',
                                          padding: '5px 10px',
                                          fontSize: '0.75rem',
                                          fontWeight: '600',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                          display: 'flex', alignItems: 'center', gap: '4px'
                                        }}
                                        onMouseOver={(e) => (e.currentTarget.style.background = '#dc2626', e.currentTarget.style.color = '#fff')}
                                        onMouseOut={(e) => (e.currentTarget.style.background = '#fee2e2', e.currentTarget.style.color = '#dc2626')}
                                        title={`Cancel order ${order.orderNumber}`}
                                      >
                                        🚫 Cancel
                                      </button>
                                    ) : (
                                      <button
                                        disabled
                                        style={{
                                          background: '#9ca3af',
                                          color: 'white',
                                          border: 'none',
                                          borderRadius: '6px',
                                          padding: '6px 12px',
                                          fontSize: '0.75rem',
                                          fontWeight: '600',
                                          cursor: 'not-allowed',
                                          opacity: 0.6
                                        }}
                                        title="Order already cancelled"
                                      >
                                        🚫 Cancelled
                                      </button>
                                    )}

                                    {!isCancelled && (
                                      ((order.categoryName &&
                                        order.categoryName.toLowerCase().includes('restaurant')) ||
                                        (customerData.selectedCategory?.name &&
                                          customerData.selectedCategory.name.toLowerCase().includes('restaurant'))) && (
                                        <button
                                          onClick={() => {
                                            // console.log('🎁 Complimentary bill clicked:', order.orderNumber);
                                            setSelectedOrderForComplimentary(order);
                                            setComplimentaryReason('');
                                            setComplimentaryByName('');
                                            setComplimentaryPassword('');
                                            setComplimentaryError('');
                                            setShowComplimentaryModal(true);
                                          }}
                                          style={{
                                            background: '#faf8f6',
                                            color: '#69221b',
                                            border: '1.5px solid #e8ddd8',
                                            borderRadius: '6px',
                                            padding: '5px 10px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex', alignItems: 'center', gap: '4px'
                                          }}
                                          onMouseOver={(e) => (e.currentTarget.style.background = '#69221b', e.currentTarget.style.color = '#fff')}
                                          onMouseOut={(e) => (e.currentTarget.style.background = '#faf8f6', e.currentTarget.style.color = '#69221b')}
                                          title={`Generate complimentary bill for ${order.orderNumber}`}
                                        >
                                          🎁 Complimentary
                                        </button>
                                      )
                                    )}

                                    {!isCancelled && (
                                      ((order.categoryName &&
                                        order.categoryName.toLowerCase().includes('restaurant')) ||
                                        (customerData.selectedCategory?.name &&
                                          customerData.selectedCategory.name.toLowerCase().includes('restaurant'))) && (
                                        <button
                                          onClick={async () => {
                                            // console.log('🖨️ Printing receipt for order:', order.orderNumber);
                                            // console.log('🖨️ Order discount info:', {
                                            //   discountAmount: order.discountAmount,
                                            //   discount: order.discount,
                                            //   hasDiscount: !!(order.discountAmount && order.discountAmount > 0)
                                            // });

                                            try {
                                              const calculatedSubtotal = order.items.reduce(
                                                (sum, item) => sum + item.price * item.quantity,
                                                0
                                              );
                                              const actualDiscountAmount =
                                                order.discountAmount || calculatedSubtotal - order.totalAmount;

                                              const printData = {
                                                selectedBranch: customerData.selectedBranch,
                                                selectedTable: order.tableNumber
                                                  ? { tableNumber: order.tableNumber, number: order.tableNumber }
                                                  : null,
                                                selectedCategory: customerData.selectedCategory,
                                                invoiceNumber: order.orderNumber,
                                                date: selectedSalesDate,
                                                time: order.time,
                                                customerName: order.customerName,
                                                phoneNumber: order.phoneNumber || '0000000000',
                                                cartItems: order.items.map((item) => ({
                                                  name: item.name,
                                                  price: item.price,
                                                  quantity: item.quantity
                                                })),
                                                subtotal: calculatedSubtotal,
                                                total: order.totalAmount,
                                                discountAmount: actualDiscountAmount,
                                                discountRemark:
                                                  order.discount?.remark ||
                                                  (actualDiscountAmount > 0 ? 'Discount Applied' : ''),
                                                discount:
                                                  order.discount ||
                                                  (actualDiscountAmount > 0
                                                    ? {
                                                      type: 'amount',
                                                      value: actualDiscountAmount,
                                                      amount: actualDiscountAmount,
                                                      remark: 'Discount Applied'
                                                    }
                                                    : null),
                                                paymentMethod: 'Completed',
                                                amountReceived: order.totalAmount,
                                                change: 0
                                              };

                                              // console.log('🖨️ Print data prepared:', printData);

                                              const printerSettings = JSON.parse(
                                                localStorage.getItem('thermalPrinterSettings') || '{}'
                                              );
                                              // console.log('🖨️ Printer settings:', printerSettings);

                                              const receiptText = thermalPrinter.generateThermalReceipt(printData);
                                              // console.log(
                                              //   '🖨️ Receipt text generated, length:',
                                              //   receiptText.length
                                              // );

                                              const backendUrl =
                                                import.meta.env.VITE_BACKEND_PRIMARY ||
                                                'https://billing.jagalikoota.com/api/v1/hotel';
                                              const printerIP = printerSettings.ip || '192.168.1.100';
                                              const port = printerSettings.port || 9100;

                                              // console.log('🖨️ Attempting network print to:', `${printerIP}:${port}`);

                                              const controller = new AbortController();
                                              const timeoutId = setTimeout(() => controller.abort(), 3000);

                                              const response = await fetch(
                                                `${backendUrl}/print-thermal/network`,
                                                {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({
                                                    text: receiptText,
                                                    printerIP,
                                                    port
                                                  }),
                                                  signal: controller.signal
                                                }
                                              );

                                              clearTimeout(timeoutId);

                                              if (response.ok) {
                                                // console.log(
                                                //   '✅ Receipt printed successfully for order:',
                                                //   order.orderNumber
                                                // );
                                                alert(`✅ Receipt printed successfully for order ${order.orderNumber}`);
                                              } else {
                                                throw new Error('Thermal printer not responding');
                                              }
                                            } catch (error) {
                                              console.log(
                                                '❌ Network printing failed, trying thermal printer service:',
                                                error.message
                                              );

                                              try {
                                                const printerSettings = JSON.parse(
                                                  localStorage.getItem('thermalPrinterSettings') || '{}'
                                                );
                                                const options = {
                                                  method: 'network',
                                                  printerIP: printerSettings.ip || '192.168.1.100',
                                                  port: printerSettings.port || 9100
                                                };

                                                const calculatedSubtotal = order.items.reduce(
                                                  (sum, item) => sum + item.price * item.quantity,
                                                  0
                                                );
                                                const actualDiscountAmount =
                                                  order.discountAmount || calculatedSubtotal - order.totalAmount;

                                                const printData = {
                                                  selectedBranch: customerData.selectedBranch,
                                                  selectedTable: order.tableNumber
                                                    ? {
                                                      tableNumber: order.tableNumber,
                                                      number: order.tableNumber
                                                    }
                                                    : null,
                                                  selectedCategory: customerData.selectedCategory,
                                                  invoiceNumber: order.orderNumber,
                                                  date: selectedSalesDate,
                                                  time: order.time,
                                                  customerName: order.customerName,
                                                  phoneNumber: order.phoneNumber || '0000000000',
                                                  cartItems: order.items.map((item) => ({
                                                    name: item.name,
                                                    price: item.price,
                                                    quantity: item.quantity
                                                  })),
                                                  subtotal: calculatedSubtotal,
                                                  total: order.totalAmount,
                                                  discountAmount: actualDiscountAmount,
                                                  discountRemark:
                                                    order.discount?.remark ||
                                                    (actualDiscountAmount > 0 ? 'Discount Applied' : ''),
                                                  discount:
                                                    order.discount ||
                                                    (actualDiscountAmount > 0
                                                      ? {
                                                        type: 'amount',
                                                        value: actualDiscountAmount,
                                                        amount: actualDiscountAmount,
                                                        remark: 'Discount Applied'
                                                      }
                                                      : null),
                                                  paymentMethod: 'Completed',
                                                  amountReceived: order.totalAmount,
                                                  change: 0
                                                };

                                                await thermalPrinter.printReceipt(printData, options);
                                                // console.log(
                                                //   '✅ Receipt printed via thermal printer service for order:',
                                                //   order.orderNumber
                                                // );
                                                alert(
                                                  `✅ Receipt printed via thermal printer service for order ${order.orderNumber}`
                                                );
                                              } catch (fallbackError) {
                                                console.error('❌ All printing methods failed:', fallbackError);
                                                alert(
                                                  `❌ Printing failed: ${fallbackError.message}. Please check printer connection.`
                                                );
                                              }
                                            }
                                          }}
                                          style={{
                                            background: '#69221b',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            padding: '5px 10px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex', alignItems: 'center', gap: '4px'
                                          }}
                                          onMouseOver={(e) => (e.currentTarget.style.background = '#8b2e26')}
                                          onMouseOut={(e) => (e.currentTarget.style.background = '#69221b')}
                                          title={`Print receipt for ${order.orderNumber}`}
                                        >
                                          🖨️ Print
                                        </button>
                                      )
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()
                      )}
                    </div>
                  </div>
                  )
                  })()}
                  </>)
                  })()}
                </div>
              ) : (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '60px',
                    color: '#6b7280'
                  }}
                >
                  <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📊</div>
                  <p>No sales data available for the selected date.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Order Details Modal */}
        {showOrderDetails && selectedOrderDetails && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
            }}>
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
                paddingBottom: '16px',
                borderBottom: '2px solid #e5e7eb'
              }}>
                <h2 style={{
                  fontSize: '1.5rem',
                  fontWeight: '700',
                  color: '#1f2937',
                  margin: 0
                }}>
                  📋 Order Details
                </h2>
                <button
                  onClick={() => {
                    setShowOrderDetails(false)
                    setSelectedOrderDetails(null)
                  }}
                  style={{
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 16px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  ✕ Close
                </button>
              </div>

              {/* Order Info */}
              <div style={{
                background: '#f9fafb',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px'
              }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px'
                }}>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>
                      Bill Number:
                    </div>
                    <div style={{ fontWeight: '600', color: '#1f2937' }}>
                      {selectedOrderDetails.orderNumber}
                    </div>
                  </div>
                  {selectedOrderDetails.tableNumber && (
                    <div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>
                        Table:
                      </div>
                      <div style={{ fontWeight: '600', color: '#1f2937' }}>
                        🪑 {selectedOrderDetails.tableNumber}
                      </div>
                    </div>
                  )}
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>
                      Customer:
                    </div>
                    <div style={{ fontWeight: '600', color: '#1f2937' }}>
                      {selectedOrderDetails.customerName}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '4px' }}>
                      Time:
                    </div>
                    <div style={{ fontWeight: '600', color: '#1f2937' }}>
                      {selectedOrderDetails.time}
                    </div>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h3 style={{
                  fontSize: '1.125rem',
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '16px'
                }}>
                  Items ({selectedOrderDetails.items.length})
                </h3>
                <div style={{
                  background: '#f9fafb',
                  borderRadius: '8px',
                  overflow: 'hidden'
                }}>
                  {selectedOrderDetails.items.map((item, index) => (
                    <div key={index} style={{
                      padding: '16px',
                      borderBottom: index < selectedOrderDetails.items.length - 1 ? '1px solid #e5e7eb' : 'none',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '4px' }}>
                          {item.name}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                          ₹{item.price} × {item.quantity}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '600', color: '#1f2937' }}>
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div style={{
                marginTop: '24px',
                paddingTop: '16px',
                borderTop: '2px solid #e5e7eb'
              }}>
                {/* Calculate subtotal from items */}
                {(() => {
                  const calculatedSubtotal = selectedOrderDetails.items.reduce((sum, item) =>
                    sum + (item.price * item.quantity), 0
                  )
                  const actualTotal = selectedOrderDetails.totalAmount
                  const impliedDiscount = calculatedSubtotal - actualTotal
                  const hasDiscount = selectedOrderDetails.discountAmount > 0 || impliedDiscount > 0
                  const discountAmount = selectedOrderDetails.discountAmount || impliedDiscount

                  // console.log('💰 Order Details calculation:', {
                  //   calculatedSubtotal,
                  //   actualTotal,
                  //   impliedDiscount,
                  //   savedDiscountAmount: selectedOrderDetails.discountAmount,
                  //   finalDiscountAmount: discountAmount,
                  //   hasDiscount
                  // })

                  if (hasDiscount && discountAmount > 0) {
                    return (
                      <>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px'
                        }}>
                          <span style={{ fontSize: '1rem', fontWeight: '500', color: '#6b7280' }}>
                            Subtotal:
                          </span>
                          <span style={{ fontSize: '1rem', fontWeight: '600', color: '#6b7280' }}>
                            ₹{calculatedSubtotal.toFixed(2)}
                          </span>
                        </div>
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px'
                        }}>
                          <span style={{ fontSize: '1rem', fontWeight: '500', color: '#ef4444' }}>
                            Discount:
                          </span>
                          <span style={{ fontSize: '1rem', fontWeight: '600', color: '#ef4444' }}>
                            -₹{discountAmount.toFixed(2)}
                          </span>
                        </div>
                        {/* Show discount reason if available */}
                        {selectedOrderDetails.discount && selectedOrderDetails.discount.remark && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '8px'
                          }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280' }}>
                              Reason:
                            </span>
                            <span style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280', fontStyle: 'italic' }}>
                              {selectedOrderDetails.discount.remark}
                            </span>
                          </div>
                        )}
                        <hr style={{ border: 'none', borderTop: '1px solid #d1d5db', margin: '12px 0' }} />
                      </>
                    )
                  }
                  return null;
                })()}

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '8px'
                }}>
                  <span style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937' }}>
                    {(() => {
                      const calculatedSubtotal = selectedOrderDetails.items.reduce((sum, item) =>
                        sum + (item.price * item.quantity), 0
                      )
                      const impliedDiscount = calculatedSubtotal - selectedOrderDetails.totalAmount
                      const hasDiscount = selectedOrderDetails.discountAmount > 0 || impliedDiscount > 0
                      return hasDiscount ? 'Final Amount:' : 'Total Amount:'
                    })()}
                  </span>
                  <span style={{ fontSize: '1.25rem', fontWeight: '700', color: '#059669' }}>
                    ₹{selectedOrderDetails.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cancel Order Modal */}
        {showCancelModal && selectedOrderToCancel && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}>
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '24px'
              }}>
                <div style={{
                  fontSize: '2rem',
                  background: '#fee2e2',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  🚫
                </div>
                <div>
                  <h2 style={{ margin: '0 0 4px 0', color: '#1a202c', fontSize: '1.5rem' }}>
                    Cancel Order
                  </h2>
                  <p style={{ margin: 0, color: '#718096', fontSize: '0.875rem' }}>
                    {selectedOrderToCancel.orderNumber} - ₹{selectedOrderToCancel.totalAmount?.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Warning */}
              <div style={{
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '24px',
                fontSize: '0.875rem',
                color: '#991b1b'
              }}>
                ⚠️ This action cannot be undone. Please provide details below.
              </div>

              {/* Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Cancelled By Name */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '600',
                    color: '#4a5568',
                    fontSize: '0.875rem'
                  }}>
                    Your Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={cancelledByName}
                    onChange={(e) => setCancelledByName(e.target.value)}
                    placeholder="Enter your name"
                    disabled={cancelling}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Cancellation Reason */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '600',
                    color: '#4a5568',
                    fontSize: '0.875rem'
                  }}>
                    Cancellation Reason <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="e.g., Customer request, Wrong order, Kitchen issue..."
                    disabled={cancelling}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Admin Password */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '600',
                    color: '#4a5568',
                    fontSize: '0.875rem'
                  }}>
                    Cancel Order Password <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter cancel order password"
                    disabled={cancelling}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <p style={{
                    margin: '4px 0 0 0',
                    fontSize: '0.75rem',
                    color: '#718096'
                  }}>
                    {cancelOrderPassword
                      ? `Enter the cancel order password for ${customerData?.selectedCategory?.name || 'this category'}`
                      : 'Contact admin if you don\'t have the password'}
                  </p>
                </div>

                {/* Error Message */}
                {cancelError && (
                  <div style={{
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '0.875rem',
                    color: '#991b1b'
                  }}>
                    {cancelError}
                  </div>
                )}

                {/* Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  marginTop: '8px'
                }}>
                  <button
                    onClick={handleCloseCancelModal}
                    disabled={cancelling}
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: cancelling ? 'not-allowed' : 'pointer',
                      background: 'white',
                      color: '#4a5568',
                      opacity: cancelling ? 0.5 : 1
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCancelOrderSubmit}
                    disabled={cancelling || !cancelReason.trim() || !cancelledByName.trim() || !adminPassword.trim()}
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: (cancelling || !cancelReason.trim() || !cancelledByName.trim() || !adminPassword.trim()) ? 'not-allowed' : 'pointer',
                      background: (cancelling || !cancelReason.trim() || !cancelledByName.trim() || !adminPassword.trim()) ? '#cbd5e0' : '#ef4444',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {cancelling ? 'Cancelling...' : '🚫 Cancel Order'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Split Bill Modal */}
        {showSplitBillModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1a202c' }}>
                  ✂️ Split Bill - Table {splitBillTableNumber}
                </h3>
                <button
                  onClick={() => setShowSplitBillModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#718096' }}
                >×</button>
              </div>

              <p style={{ margin: '0 0 16px 0', fontSize: '0.9rem', color: '#4a5568' }}>
                Select items you want to generate a separate bill for. Unselected items will stay on the table.
              </p>

              {/* Select All / Deselect All */}
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button
                  onClick={() => {
                    const all = {}
                    splitBillItems.forEach((_, i) => { all[i] = true })
                    setSplitBillSelectedItems(all)
                  }}
                  style={{
                    background: '#10b981', color: 'white', border: 'none', borderRadius: '6px',
                    padding: '6px 12px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  Select All
                </button>
                <button
                  onClick={() => setSplitBillSelectedItems({})}
                  style={{
                    background: '#6b7280', color: 'white', border: 'none', borderRadius: '6px',
                    padding: '6px 12px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  Deselect All
                </button>
              </div>

              {/* Items List with Checkboxes */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                {splitBillItems.map((item, index) => (
                  <div
                    key={index}
                    onClick={() => {
                      setSplitBillSelectedItems(prev => ({ ...prev, [index]: !prev[index] }))
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '12px 16px',
                      borderBottom: index < splitBillItems.length - 1 ? '1px solid #e2e8f0' : 'none',
                      background: splitBillSelectedItems[index] ? '#f0fdf4' : 'white',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={splitBillSelectedItems[index] || false}
                      onChange={() => {}}
                      style={{ width: '18px', height: '18px', accentColor: '#10b981', cursor: 'pointer' }}
                    />
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: '0 0 2px 0', fontWeight: '500', color: '#1a202c', fontSize: '0.95rem' }}>
                        {item.name}
                      </p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#718096' }}>
                        KOT: {item.kotNumber} • Qty: {item.quantity} • ₹{item.price.toFixed(2)} each
                      </p>
                    </div>
                    <div style={{ fontWeight: '600', color: '#1a202c', fontSize: '0.95rem' }}>
                      ₹{(item.price * item.quantity).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Selected Total */}
              <div style={{
                marginTop: '16px',
                padding: '12px 16px',
                background: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9rem', color: '#4a5568' }}>
                    Selected: {Object.values(splitBillSelectedItems).filter(Boolean).length} item(s)
                  </span>
                  <span style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1a202c' }}>
                    ₹{splitBillItems
                      .filter((_, i) => splitBillSelectedItems[i])
                      .reduce((sum, item) => sum + (item.price * item.quantity), 0)
                      .toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                <button
                  onClick={() => setShowSplitBillModal(false)}
                  style={{
                    flex: 1, padding: '12px', background: '#f3f4f6', color: '#374151',
                    border: '1px solid #d1d5db', borderRadius: '10px', fontSize: '0.9rem',
                    fontWeight: '600', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSplitBillGenerate}
                  disabled={Object.values(splitBillSelectedItems).filter(Boolean).length === 0}
                  style={{
                    flex: 1, padding: '12px',
                    background: Object.values(splitBillSelectedItems).filter(Boolean).length > 0 ? '#10b981' : '#d1d5db',
                    color: 'white', border: 'none', borderRadius: '10px', fontSize: '0.9rem',
                    fontWeight: '700', cursor: Object.values(splitBillSelectedItems).filter(Boolean).length > 0 ? 'pointer' : 'not-allowed'
                  }}
                >
                  Generate Bill for Selected Items
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complimentary Bill Modal */}
        {showComplimentaryModal && selectedOrderForComplimentary && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '500px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}>
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '24px'
              }}>
                <div style={{
                  fontSize: '2rem',
                  background: '#f3e8ff',
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  🎁
                </div>
                <div>
                  <h2 style={{ margin: '0 0 4px 0', color: '#1a202c', fontSize: '1.5rem' }}>
                    Complimentary Bill
                  </h2>
                  <p style={{ margin: 0, color: '#718096', fontSize: '0.875rem' }}>
                    {selectedOrderForComplimentary.orderNumber} - ₹{selectedOrderForComplimentary.totalAmount?.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Info */}
              <div style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '24px',
                fontSize: '0.875rem',
                color: '#0c4a6e'
              }}>
                ℹ️ This will mark the order as complimentary (free). Please provide a reason.
              </div>

              {/* Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Name */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '600',
                    color: '#4a5568',
                    fontSize: '0.875rem'
                  }}>
                    Your Name <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={complimentaryByName}
                    onChange={(e) => setComplimentaryByName(e.target.value)}
                    placeholder="Enter your name"
                    disabled={processingComplimentary}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Reason */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '600',
                    color: '#4a5568',
                    fontSize: '0.875rem'
                  }}>
                    Reason for Complimentary <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <textarea
                    value={complimentaryReason}
                    onChange={(e) => setComplimentaryReason(e.target.value)}
                    placeholder="e.g., VIP guest, Special occasion, Compensation, Management approval..."
                    disabled={processingComplimentary}
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      outline: 'none',
                      resize: 'vertical',
                      fontFamily: 'inherit',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Password */}
                <div>
                  <label style={{
                    display: 'block',
                    marginBottom: '8px',
                    fontWeight: '600',
                    color: '#4a5568',
                    fontSize: '0.875rem'
                  }}>
                    Authorization Password <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="password"
                    value={complimentaryPassword}
                    onChange={(e) => setComplimentaryPassword(e.target.value)}
                    placeholder="Enter authorization password"
                    disabled={processingComplimentary}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                  <p style={{
                    margin: '4px 0 0 0',
                    fontSize: '0.75rem',
                    color: '#718096'
                  }}>
                    {cancelOrderPassword
                      ? `Enter the authorization password for ${customerData?.selectedCategory?.name || 'this category'}`
                      : 'Contact admin if you don\'t have the password'}
                  </p>
                </div>

                {/* Error Message */}
                {complimentaryError && (
                  <div style={{
                    background: '#fef2f2',
                    border: '1px solid #fca5a5',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '0.875rem',
                    color: '#991b1b'
                  }}>
                    {complimentaryError}
                  </div>
                )}

                {/* Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  marginTop: '8px'
                }}>
                  <button
                    onClick={handleCloseComplimentaryModal}
                    disabled={processingComplimentary}
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: processingComplimentary ? 'not-allowed' : 'pointer',
                      background: 'white',
                      color: '#4a5568',
                      opacity: processingComplimentary ? 0.5 : 1
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleComplimentaryBillSubmit}
                    disabled={processingComplimentary || !complimentaryReason.trim() || !complimentaryByName.trim() || !complimentaryPassword.trim()}
                    style={{
                      flex: 1,
                      padding: '12px',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      cursor: (processingComplimentary || !complimentaryReason.trim() || !complimentaryByName.trim() || !complimentaryPassword.trim()) ? 'not-allowed' : 'pointer',
                      background: (processingComplimentary || !complimentaryReason.trim() || !complimentaryByName.trim() || !complimentaryPassword.trim()) ? '#cbd5e0' : '#8b5cf6',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {processingComplimentary ? 'Processing...' : '🎁 Generate Complimentary Bill'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
export default MenuScreen