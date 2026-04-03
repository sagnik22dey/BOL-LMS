import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import theme from './theme';

import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardHome from './pages/DashboardHome';

import { Organizations, Courses, CourseBuilder, Users, CourseBundles, Analytics, AssessmentStatus } from './pages/admin';
import { MyLearning, CourseView, Cart } from './pages/learning';

import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';

function App() {
  const { fetchMe, token, user, initializing } = useAuthStore();

  useEffect(() => {
    // If there is a stored token but we don't have the user object yet,
    // hydrate the session from the server.
    if (token && !user) {
      fetchMe();
    }
  }, [token, user, fetchMe]);

  // Block rendering until the initial auth check is complete so that
  // ProtectedRoute never sees a transient "not authenticated" state.
  if (initializing) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
          }}
        >
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route element={<MainLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardHome />} />

              {/* Super Admin Routes */}
              <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
                <Route path="/dashboard/organizations" element={<Organizations />} />
                <Route path="/dashboard/analytics" element={<Analytics />} />
              </Route>

              {/* Admin Routes */}
              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/dashboard/courses/builder/:courseId?" element={<CourseBuilder />} />
                <Route path="/dashboard/courses/:courseId/assessments" element={<AssessmentStatus />} />
                <Route path="/dashboard/course-bundles" element={<CourseBundles />} />
              </Route>

              {/* Shared Admin/SuperAdmin Routes */}
              <Route element={<ProtectedRoute allowedRoles={['super_admin', 'admin']} />}>
                <Route path="/dashboard/users" element={<Users />} />
              </Route>

              {/* Shared Admin/User Routes */}
              <Route element={<ProtectedRoute allowedRoles={['admin', 'user']} />}>
                <Route path="/dashboard/courses" element={<Courses />} />
              </Route>

              {/* Student/User routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard/learning" element={<MyLearning />} />
                <Route path="/dashboard/learning/:courseId" element={<CourseView />} />
                <Route path="/dashboard/cart" element={<Cart />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
