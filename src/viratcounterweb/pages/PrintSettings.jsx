import { useState, useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import thermalPrinter from "../services/thermalPrinter"

const PrintSettings = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { returnTo, paymentData, orderData } = location.state || {}

  const [settings, setSettings] = useState({
    method: 'auto',
    ip: '192.168.1.100',
    port: '9100',
    devicePath: '/dev/usb/lp0'
  })
  const [discovering, setDiscovering] = useState(false)
  const [availablePrinters, setAvailablePrinters] = useState([])
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)

  useEffect(() => {
    // Load saved settings
    const savedSettings = localStorage.getItem('thermalPrinterSettings')
    if (savedSettings) {
      setSettings({ ...settings, ...JSON.parse(savedSettings) })
    }
  }, [])

  const handleSaveSettings = () => {
    localStorage.setItem('thermalPrinterSettings', JSON.stringify(settings))
    alert('Printer settings saved successfully!')
    
    if (returnTo) {
      if (returnTo === "/counter/bill-generation" && orderData) {
        navigate(returnTo, { state: orderData })
      } else {
        navigate(returnTo, { state: { paymentData } })
      }
    } else {
      navigate("/counter/branch-selection")
    }
  }

  const handleDiscoverPrinters = async () => {
    setDiscovering(true)
    setAvailablePrinters([])
    
    try {
      // Use the backend URL from environment or default to localhost:9000
      const backendUrl = import.meta.env.VITE_BACKEND_PRIMARY || 'https://billing.jagalikoota.com/api/v1/hotel';
      const response = await fetch(`${backendUrl}/print-thermal/discover`)
      const data = await response.json()
      
      if (data.success) {
        setAvailablePrinters(data.printers)
        if (data.printers.length === 0) {
          alert('No thermal printers found on the network. Make sure your thermal printer is connected to the same network and powered on.')
        }
      } else {
        alert('Failed to discover printers: ' + data.message)
      }
    } catch (error) {
      alert('Failed to discover printers. Make sure the backend server is running on port 9000.')
    } finally {
      setDiscovering(false)
    }
  }

  const handleTestPrint = async () => {
    setTesting(true)
    setTestResult(null)
    
    try {
      const testData = {
        selectedBranch: {
          name: "Test Restaurant",
          address: "123 Test Street, Test City",
          phone: "123-456-7890"
        },
        invoiceNumber: "TEST-" + Date.now(),
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        customerName: "Test Customer",
        phoneNumber: "1234567890",
        cartItems: [
          { name: "Test Item 1", price: 10.00, quantity: 2 },
          { name: "Test Item 2", price: 15.50, quantity: 1 }
        ],
        total: 35.50,
        paymentMethod: "cash",
        amountReceived: 40.00,
        change: 4.50
      }

      await thermalPrinter.printReceipt(testData, {
        method: settings.method,
        printerIP: settings.ip,
        port: parseInt(settings.port)
      })
      
      setTestResult({ type: 'success', message: 'Test receipt printed successfully!' })
    } catch (error) {
      setTestResult({ type: 'error', message: error.message })
    } finally {
      setTesting(false)
    }
  }

  const handleSelectPrinter = (printer) => {
    setSettings({
      ...settings,
      ip: printer.ip,
      port: printer.port.toString(),
      method: 'network'
    })
  }

  return (
    <div className="counter-container">
      <div className="counter-card">
        <div className="counter-header">
          <h1 className="counter-title">Thermal Printer Settings</h1>
          <p className="counter-subtitle">Configure your thermal printer for receipt printing</p>
        </div>

        {/* Print Method Selection */}
        <div style={{ marginBottom: '24px' }}>
          <label className="counter-label">Print Method</label>
          <select
            className="counter-input"
            value={settings.method}
            onChange={(e) => setSettings({ ...settings, method: e.target.value })}
          >
            <option value="auto">Auto (Try all methods)</option>
            <option value="network">Network Printer</option>
            <option value="serial">USB/Serial Printer</option>
            <option value="browser">Browser Print (Fallback)</option>
          </select>
        </div>

        {/* Network Printer Settings */}
        {(settings.method === 'network' || settings.method === 'auto') && (
          <div style={{ 
            background: '#f7fafc', 
            padding: '16px', 
            borderRadius: '8px', 
            marginBottom: '24px' 
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>Network Printer Settings</h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
              <div>
                <label className="counter-label">Printer IP Address</label>
                <input
                  type="text"
                  className="counter-input"
                  value={settings.ip}
                  onChange={(e) => setSettings({ ...settings, ip: e.target.value })}
                  placeholder="192.168.1.100"
                />
                <p style={{ fontSize: '0.75rem', color: '#718096', margin: '4px 0 0 0' }}>
                  Enter your thermal printer's IP address. Leave as default (192.168.1.100) to skip network printing and use browser fallback.
                </p>
              </div>
              <div>
                <label className="counter-label">Port</label>
                <input
                  type="number"
                  className="counter-input"
                  value={settings.port}
                  onChange={(e) => setSettings({ ...settings, port: e.target.value })}
                  placeholder="9100"
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <button
                className="counter-button-secondary"
                onClick={handleDiscoverPrinters}
                disabled={discovering}
                style={{ flex: 1 }}
              >
                {discovering ? '🔍 Discovering...' : '🔍 Discover Printers'}
              </button>
              <button
                className="counter-button-secondary"
                onClick={handleTestPrint}
                disabled={testing}
                style={{ flex: 1 }}
              >
                {testing ? '🧪 Testing...' : '🧪 Test Print'}
              </button>
            </div>

            {/* Available Printers */}
            {availablePrinters.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.875rem', color: '#4a5568' }}>
                  Found Printers:
                </h4>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {availablePrinters.map((printer, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleSelectPrinter(printer)}
                    >
                      <span style={{ fontWeight: '500' }}>
                        {printer.ip}:{printer.port}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#718096' }}>
                        {printer.responseTime}ms
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* USB/Serial Printer Settings */}
        {(settings.method === 'serial' || settings.method === 'auto') && (
          <div style={{ 
            background: '#f7fafc', 
            padding: '16px', 
            borderRadius: '8px', 
            marginBottom: '24px' 
          }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem' }}>USB/Serial Printer Settings</h3>
            
            <div>
              <label className="counter-label">Device Path</label>
              <input
                type="text"
                className="counter-input"
                value={settings.devicePath}
                onChange={(e) => setSettings({ ...settings, devicePath: e.target.value })}
                placeholder="/dev/usb/lp0"
              />
              <p style={{ fontSize: '0.75rem', color: '#718096', margin: '4px 0 0 0' }}>
                Common paths: /dev/usb/lp0, /dev/ttyUSB0, COM1 (Windows)
              </p>
            </div>
          </div>
        )}

        {/* Test Result */}
        {testResult && (
          <div style={{ 
            background: testResult.type === 'success' ? '#f0fff4' : '#fed7d7', 
            padding: '12px', 
            borderRadius: '8px',
            border: `1px solid ${testResult.type === 'success' ? '#68d391' : '#fc8181'}`,
            marginBottom: '24px',
            textAlign: 'center'
          }}>
            <div style={{ 
              color: testResult.type === 'success' ? '#22543d' : '#742a2a', 
              fontWeight: '600' 
            }}>
              {testResult.type === 'success' ? '✅' : '❌'} {testResult.message}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div style={{ 
          background: '#e6fffa', 
          padding: '16px', 
          borderRadius: '8px', 
          marginBottom: '24px',
          border: '1px solid #81e6d9'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '1rem', color: '#234e52' }}>
            📋 Setup Instructions
          </h3>
          <ul style={{ margin: '0', paddingLeft: '20px', color: '#2d3748', fontSize: '0.875rem' }}>
            <li><strong>Network Printer:</strong> Connect your thermal printer to the same network and note its IP address</li>
            <li><strong>USB Printer:</strong> Connect via USB and check device path in system settings</li>
            <li><strong>Auto Mode:</strong> Tries all methods automatically, recommended for most users</li>
            <li><strong>Browser Fallback:</strong> Uses regular browser printing with thermal-optimized formatting</li>
          </ul>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '16px' }}>
          <button
            className="counter-button-secondary"
            onClick={() => navigate(returnTo || "/counter/branch-selection", { 
              state: returnTo === "/counter/bill-generation" ? orderData : { paymentData } 
            })}
            style={{ flex: 1 }}
          >
            ← Cancel
          </button>
          <button
            className="counter-button"
            onClick={handleSaveSettings}
            style={{ flex: 2 }}
          >
            💾 Save Settings
          </button>
        </div>
      </div>
    </div>
  )
}

export default PrintSettings