import { useState, useEffect } from "react"
import { Routes, Route, Navigate } from "react-router-dom"
import { syncManager } from "./services/syncManager"
import counterApi from "./services/counterApi"
import { localCache } from "./services/localCache"
import { offlineQueue } from "./services/offlineQueue"
import CounterLogin from "./pages/CounterLogin"
import BranchSelection from "./pages/BranchSelection"
import CategorySelection from "./pages/CategorySelection"
import CustomerDetails from "./pages/CustomerDetails"
import MenuScreen from "./pages/MenuScreen"
import KOTGeneration from "./pages/KOTGeneration"
import BillGeneration from "./pages/BillGeneration"
import PaymentScreen from "./pages/PaymentScreen"
import PaymentSuccess from "./pages/PaymentSuccess"
import OrderList from "./pages/OrderList"
import PrintSettings from "./pages/PrintSettings"
import PrintTest from "./pages/PrintTest"
import SalesReports from "./pages/SalesReports"
import "./CounterApp.css"

// Protected route component for counter
const CounterProtectedRoute = ({ children }) => {
  const isCounterAuthenticated = localStorage.getItem("counterAuthenticated") === "true"

  if (!isCounterAuthenticated) {
    return <Navigate to="/counter/login" replace />
  }

  return children
}

function CounterApp() {
  const [isCounterAuthenticated, setIsCounterAuthenticated] = useState(false)

  useEffect(() => {
    // console.log("🔄 CounterApp loaded!")
    // Check if counter user is authenticated
    const authStatus = localStorage.getItem("counterAuthenticated") === "true"
    setIsCounterAuthenticated(authStatus)

    // Initialise offline sync manager (registers online/offline listeners)
    syncManager.init()

    // Purge stale storage on every app start — keeps IndexedDB and localStorage lean
    localCache.purgeStaleLocalStorageKeys()
    localCache.purgeStaleBills(2).catch(() => {})       // keep last 2 days of bills (1000/day × 2 = ~6MB max)
    offlineQueue.purgeSyncedEntries().catch(() => {})   // remove already-uploaded queue entries

    // Seed local bill/KOT counters from server so numbers never go backwards
    // This runs in background — doesn't block the UI
    const seedCounters = async () => {
      try {
        const branchRaw = localStorage.getItem('selectedBranch')
        if (!branchRaw || !navigator.onLine) return
        const branch = JSON.parse(branchRaw)
        const branchId = branch?._id || branch?.id
        if (!branchId) return
        const res = await counterApi.request(`/counter-invoice/counters/${branchId}`, { _timeout: 5000 })
        const counters = res?.counters ?? (Array.isArray(res) ? res : null)
        if (Array.isArray(counters) && counters.length > 0) {
          localCache.seedLocalCounters(branchId, counters)
        }
      } catch (_) {
        // Silently ignore — local counters will be used as-is
      }
    }
    seedCounters()

    // Re-seed when coming back online
    window.addEventListener('online', seedCounters)

    // Add event listener for storage changes (for multi-tab support)
    const handleStorageChange = () => {
      setIsCounterAuthenticated(localStorage.getItem("counterAuthenticated") === "true")
    }

    window.addEventListener("storage", handleStorageChange)
    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener('online', seedCounters)
    }
  }, [])

  return (
    <div className="counter-app">
      <Routes>
        <Route path="login" element={<CounterLogin />} />
        <Route
          path="branch-selection"
          element={
            <CounterProtectedRoute>
              <BranchSelection />
            </CounterProtectedRoute>
          }
        />
        <Route
          path="category-selection"
          element={
            <CounterProtectedRoute>
              <CategorySelection />
            </CounterProtectedRoute>
          }
        />
        <Route
          path="customer-details"
          element={<Navigate to="/counter/branch-selection" replace />}
        />
        <Route
          path="menu"
          element={
            <CounterProtectedRoute>
              <MenuScreen />
            </CounterProtectedRoute>
          }
        />
        <Route
          path="kot-generation"
          element={
            <CounterProtectedRoute>
              <KOTGeneration />
            </CounterProtectedRoute>
          }
        />
        <Route
          path="bill-generation"
          element={
            <CounterProtectedRoute>
              <BillGeneration />
            </CounterProtectedRoute>
          }
        />
        <Route
          path="payment"
          element={
            <CounterProtectedRoute>
              <PaymentScreen />
            </CounterProtectedRoute>
          }
        />
        <Route
          path="payment-success"
          element={
            <CounterProtectedRoute>
              <PaymentSuccess />
            </CounterProtectedRoute>
          }
        />
        <Route
          path="orders"
          element={
            <CounterProtectedRoute>
              <OrderList />
            </CounterProtectedRoute>
          }
        />
        <Route
          path="print-settings"
          element={
            <CounterProtectedRoute>
              <PrintSettings />
            </CounterProtectedRoute>
          }
        />
        <Route
          path="print-test"
          element={
            <CounterProtectedRoute>
              <PrintTest />
            </CounterProtectedRoute>
          }
        />
        <Route
          path="sales-reports"
          element={
            <CounterProtectedRoute>
              <SalesReports />
            </CounterProtectedRoute>
          }
        />
        <Route path="" element={<Navigate to="login" replace />} />
      </Routes>
    </div>
  )
}

export default CounterApp