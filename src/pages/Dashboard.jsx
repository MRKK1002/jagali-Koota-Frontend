import { useState, useEffect } from "react"

const Dashboard = () => {
  console.log("Dashboard component rendering")
  
  return (
    <div style={{ padding: "20px" }}>
      <div className="page-header">
        <h1>Dashboard</h1>
        <div className="date-display">
          {new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon orange">
            <span>📊</span>
          </div>
          <div className="stat-content">
            <h3>Total Orders</h3>
            <p className="stat-number">0</p>
            <div className="stat-change positive">
              <span>↗</span> 0% from last month
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <span>💰</span>
          </div>
          <div className="stat-content">
            <h3>Total Revenue</h3>
            <p className="stat-number">₹0</p>
            <div className="stat-change positive">
              <span>↗</span> 0% from last month
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <span>👥</span>
          </div>
          <div className="stat-content">
            <h3>Total Users</h3>
            <p className="stat-number">0</p>
            <div className="stat-change positive">
              <span>↗</span> 0% from last month
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <span>🏨</span>
          </div>
          <div className="stat-content">
            <h3>Room Bookings</h3>
            <p className="stat-number">0</p>
            <div className="stat-change positive">
              <span>↗</span> 0% from last month
            </div>
          </div>
        </div>
      </div>

      <div className="charts-container">
        <div className="card">
          <div className="card-header">
            <h3>Recent Orders</h3>
            <button className="btn btn-outline">View All</button>
          </div>
          <div className="card-content">
            <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
              No recent orders to display
            </p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Revenue Overview</h3>
            <button className="btn btn-outline">View Details</button>
          </div>
          <div className="card-content">
            <p style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
              Revenue chart will be displayed here
            </p>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Quick Actions</h3>
        </div>
        <div className="card-content">
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '16px',
            padding: '20px 0'
          }}>
            <button className="btn btn-primary" style={{ padding: '12px 20px' }}>
              📝 New Order
            </button>
            <button className="btn btn-primary" style={{ padding: '12px 20px' }}>
              🏨 New Booking
            </button>
            <button className="btn btn-primary" style={{ padding: '12px 20px' }}>
              👤 Add User
            </button>
            <button className="btn btn-primary" style={{ padding: '12px 20px' }}>
              📊 View Reports
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Dashboard