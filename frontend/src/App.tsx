import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './components/AuthContext'
import { Layout } from './components/Layout'
import { NZDiveMap } from './components/NZDiveMap'
import { DiveSpotDetail } from './components/DiveSpotDetail'
import { Forum } from './components/Forum'
import { Login } from './components/Login'
import { Register } from './components/Register'
import { ForgotPassword } from './components/ForgotPassword'
import { ResetPassword } from './components/ResetPassword'
import { OAuthCallback } from './components/OAuthCallback'
import { Profile } from './components/Profile'
import './App.css'

function App() {
  return (
    <Router>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<NZDiveMap />} />
            <Route path="/detail/:id" element={<DiveSpotDetail />} />
            <Route path="/forum" element={<Forum />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<OAuthCallback />} />
            <Route path="/profile" element={<Profile />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </Router>
  )
}

export default App
