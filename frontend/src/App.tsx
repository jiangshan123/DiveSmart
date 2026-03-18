import { useState, useEffect } from 'react'
import axios from 'axios'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'

function App() {
  const [count, setCount] = useState(0)
  const [backendStatus, setBackendStatus] = useState('Checking...')
  const [diveSpots, setDiveSpots] = useState([])
  const [loading, setLoading] = useState(false)

  // Test backend connection
  const testBackendConnection = async () => {
    try {
      setBackendStatus('Connecting...')
      const response = await axios.get('http://localhost:5000/health')
      setBackendStatus(`Connected! Server uptime: ${Math.round(response.data.uptime)}s`)
    } catch (error) {
      setBackendStatus('Connection failed - Please ensure backend server is running')
      console.error('Backend connection error:', error)
    }
  }

  // Fetch dive spots data
  const fetchDiveSpots = async () => {
    try {
      setLoading(true)
      const response = await axios.get('http://localhost:5000/api/dive-spots')
      setDiveSpots(response.data.data)
      console.log('Dive spots:', response.data)
    } catch (error) {
      console.error('Failed to fetch dive spots:', error)
      alert('Failed to fetch dive spots data. Please ensure backend server is running')
    } finally {
      setLoading(false)
    }
  }

  // Auto test connection on page load
  useEffect(() => {
    testBackendConnection()
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white p-8 rounded-lg shadow-lg mb-6">
          <div className="flex justify-center space-x-4 mb-8">
            <a href="https://vite.dev" target="_blank">
              <img src={viteLogo} className="h-16 w-16 hover:scale-110 transition-transform" alt="Vite logo" />
            </a>
            <a href="https://react.dev" target="_blank">
              <img src={reactLogo} className="h-16 w-16 hover:scale-110 transition-transform animate-spin" alt="React logo" />
            </a>
          </div>
          <h1 className="text-4xl font-bold text-center text-gray-800 mb-4">SmartDive</h1>
          <p className="text-center text-gray-600 mb-6">Dive Spot Management System - Frontend-Backend Connection Test</p>
          
          {/* Backend connection status */}
          <div className="text-center mb-6">
            <div className="inline-block bg-gray-50 px-4 py-2 rounded-lg">
              <span className="text-sm font-medium text-gray-700">Backend Status: </span>
              <span className="text-sm">{backendStatus}</span>
            </div>
          </div>

          {/* Function buttons */}
          <div className="flex justify-center space-x-4 mb-6">
            <button 
              onClick={testBackendConnection}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              Test Connection
            </button>
            <button 
              onClick={fetchDiveSpots}
              disabled={loading}
              className="bg-green-500 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition-colors"
            >
              {loading ? 'Loading...' : 'Fetch Dive Spots'}
            </button>
          </div>

          {/* Classic counter */}
          <div className="text-center border-t pt-6">
            <button 
              onClick={() => setCount((count) => count + 1)}
              className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition-colors shadow-md"
            >
              count is {count}
            </button>
          </div>
        </div>

        {/* Dive spots data display */}
        {diveSpots.length > 0 && (
          <div className="bg-white p-6 rounded-lg shadow-lg">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Dive Spots Data ({diveSpots.length} spots)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {diveSpots.map((spot: any) => (
                <div key={spot.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <h3 className="font-bold text-lg text-gray-800 mb-2">{spot.name}</h3>
                  <p className="text-sm text-gray-600 mb-1">Location: {spot.region}</p>
                  <p className="text-sm text-gray-600 mb-1">Difficulty: {spot.difficulty_level}</p>
                  <p className="text-sm text-gray-600 mb-1">Max Depth: {spot.depth_max_meters}m</p>
                  <p className="text-xs text-gray-500 mt-2">Latitude: {spot.latitude}, Longitude: {spot.longitude}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
