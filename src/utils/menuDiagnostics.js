/**
 * Menu Diagnostics Utility
 * Run this in browser console to diagnose QR menu issues
 */

export const runMenuDiagnostics = async (branchId) => {
  const baseURL = import.meta.env.VITE_BACKEND_PRIMARY || "https://billing.jagalikoota.com/api/v1/hotel"
  
  console.log("🔍 Starting Menu Diagnostics...")
  console.log("📍 Branch ID:", branchId)
  console.log("🌐 API Base URL:", baseURL)
  console.log("=" .repeat(60))

  try {
    // Test 1: Check if API is reachable
    console.log("\n✅ Test 1: Checking API connectivity...")
    const healthCheck = await fetch(baseURL.replace('/api/v1/hotel', '/health')).catch(() => null)
    if (healthCheck && healthCheck.ok) {
      console.log("✅ API is reachable")
    } else {
      console.warn("⚠️ API health check failed, but continuing...")
    }

    // Test 2: Fetch menu items
    console.log("\n✅ Test 2: Fetching menu items...")
    const menuResponse = await fetch(`${baseURL}/menu?branchId=${branchId}`)
    console.log("📊 Menu Response Status:", menuResponse.status)
    
    if (!menuResponse.ok) {
      console.error("❌ Menu API returned error:", menuResponse.status, menuResponse.statusText)
      return
    }

    const menuData = await menuResponse.json()
    console.log("📦 Menu Data Type:", Array.isArray(menuData) ? "Array" : typeof menuData)
    console.log("📦 Total Menu Items:", Array.isArray(menuData) ? menuData.length : "Not an array!")
    
    if (Array.isArray(menuData) && menuData.length > 0) {
      console.log("\n📋 Sample Menu Item:")
      console.log(JSON.stringify(menuData[0], null, 2))
      
      // Analyze menu items
      const activeItems = menuData.filter(item => item.isActive !== false)
      const inactiveItems = menuData.filter(item => item.isActive === false)
      const itemsWithPrice = menuData.filter(item => item.price || item.prices)
      const itemsWithCategory = menuData.filter(item => item.categoryId)
      const itemsWithBranch = menuData.filter(item => item.branchId === branchId)
      
      console.log("\n📊 Menu Items Analysis:")
      console.log("  ✅ Active items:", activeItems.length)
      console.log("  ❌ Inactive items:", inactiveItems.length)
      console.log("  💰 Items with price:", itemsWithPrice.length)
      console.log("  📂 Items with category:", itemsWithCategory.length)
      console.log("  🏢 Items matching branch:", itemsWithBranch.length)
      
      // Category distribution
      const categoryMap = {}
      menuData.forEach(item => {
        const catId = typeof item.categoryId === 'object' ? item.categoryId?._id : item.categoryId
        if (catId) {
          categoryMap[catId] = (categoryMap[catId] || 0) + 1
        }
      })
      console.log("\n📂 Items per Category:")
      Object.entries(categoryMap).forEach(([catId, count]) => {
        console.log(`  ${catId}: ${count} items`)
      })
    } else if (Array.isArray(menuData)) {
      console.warn("⚠️ Menu API returned empty array - no items found!")
    } else {
      console.error("❌ Menu API returned unexpected format:", menuData)
    }

    // Test 3: Fetch categories
    console.log("\n✅ Test 3: Fetching categories...")
    const categoryResponse = await fetch(`${baseURL}/category?branchId=${branchId}`)
    console.log("📊 Category Response Status:", categoryResponse.status)
    
    if (!categoryResponse.ok) {
      console.error("❌ Category API returned error:", categoryResponse.status)
      return
    }

    const categoryData = await categoryResponse.json()
    console.log("📂 Category Data Type:", Array.isArray(categoryData) ? "Array" : typeof categoryData)
    console.log("📂 Total Categories:", Array.isArray(categoryData) ? categoryData.length : "Not an array!")
    
    if (Array.isArray(categoryData) && categoryData.length > 0) {
      console.log("\n📋 Categories:")
      categoryData.forEach(cat => {
        console.log(`  - ${cat.name} (${cat._id})`)
      })
    }

    // Test 4: Fetch tables
    console.log("\n✅ Test 4: Fetching tables...")
    const tableResponse = await fetch(`${baseURL}/table?branchId=${branchId}`)
    console.log("📊 Table Response Status:", tableResponse.status)
    
    if (tableResponse.ok) {
      const tableData = await tableResponse.json()
      const tables = Array.isArray(tableData) ? tableData : tableData.data || []
      console.log("🪑 Total Tables:", tables.length)
      
      if (tables.length > 0) {
        console.log("\n📋 Sample Table:")
        console.log(JSON.stringify(tables[0], null, 2))
        
        const tablesWithCategory = tables.filter(t => t.categoryId)
        console.log("\n🪑 Tables with category assigned:", tablesWithCategory.length)
      }
    }

    // Summary
    console.log("\n" + "=".repeat(60))
    console.log("📊 DIAGNOSTIC SUMMARY")
    console.log("=".repeat(60))
    
    if (Array.isArray(menuData) && menuData.length > 0) {
      console.log("✅ Menu items are being fetched successfully")
      console.log(`✅ Found ${menuData.length} total items`)
      
      const activeItems = menuData.filter(item => item.isActive !== false)
      if (activeItems.length === 0) {
        console.error("❌ ISSUE: All menu items are marked as inactive!")
        console.log("💡 FIX: Set isActive: true on your menu items in the database")
      } else {
        console.log(`✅ ${activeItems.length} active items available`)
      }
      
      const itemsWithBranch = menuData.filter(item => item.branchId === branchId)
      if (itemsWithBranch.length === 0) {
        console.error("❌ ISSUE: No menu items match this branch ID!")
        console.log("💡 FIX: Ensure menu items have the correct branchId in the database")
      }
    } else {
      console.error("❌ ISSUE: No menu items found!")
      console.log("💡 FIX: Add menu items to the database for this branch")
    }

  } catch (error) {
    console.error("❌ Diagnostic Error:", error)
    console.error("Error details:", error.message)
  }
}

// Make it available globally for easy testing
if (typeof window !== 'undefined') {
  window.runMenuDiagnostics = runMenuDiagnostics
}

export default runMenuDiagnostics
