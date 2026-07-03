import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import AuthLayout from './layouts/AuthLayout';
import MainLayout from './layouts/MainLayout';

// Pages
import HomePublic from './pages/HomePublic';
import HomeUser from './pages/HomeUser';
import Bookmarks from './pages/Bookmarks';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Signup from './pages/Signup';
import PaperDetail from './pages/PaperDetail';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomePublic />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/paper/:id" element={<PaperDetail />} />

          {/* Protected Routes - Wrapped in AuthLayout */}
          <Route element={<AuthLayout />}>
            <Route element={<MainLayout />}>
              <Route path="/workspace" element={<HomeUser />} />
              <Route path="/bookmarks" element={<Bookmarks />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}