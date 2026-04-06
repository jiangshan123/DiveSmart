import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { NZDiveMap } from './components/NZDiveMap'
import { DiveSpotDetail } from './components/DiveSpotDetail'
import './App.css'

function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<NZDiveMap />} />
          <Route path="/detail/:id" element={<DiveSpotDetail />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App
