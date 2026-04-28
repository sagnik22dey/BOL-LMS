import { lazy, Suspense, useEffect } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

import theme from './theme';
import { useAuthStore } from './store/authStore';

// Layouts and the auth guard are tiny and used on essentially every navigation,
// so keep them in the main bundle.
import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';

// PERF: Every page below is loaded on demand. The public Home / Login /
// Register pages no longer drag in the dashboard, course-builder, react-pdf,
// react-player, dnd-kit, or doc-viewer code. This is the single biggest win
// for first-paint time.
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const DashboardHome = lazy(() => import('./pages/DashboardHome'));

const Organizations = lazy(() => import('./pages/admin/Organizations'));
const Analytics = lazy(() => import('./pages/admin/Analytics'));
const MyOrganization = lazy(() => import('./pages/admin/MyOrganization'));
const CourseBuilder = lazy(() => import('./pages/admin/CourseBuilder'));
const AssessmentStatus = lazy(() => import('./pages/admin/AssessmentStatus'));
const CourseBundles = lazy(() => import('./pages/admin/CourseBundles'));
const Users = lazy(() => import('./pages/admin/Users'));
const Courses = lazy(() => import('./pages/admin/Courses'));
const CourseAPIKeys = lazy(() => import('./pages/admin/CourseAPIKeys'));

const MyLearning = lazy(() => import('./pages/learning/MyLearning'));
const CourseView = lazy(() => import('./pages/learning/CourseView'));
const Cart = lazy(() => import('./pages/learning/Cart'));

const NotificationsList = lazy(() => import('./pages/notifications/NotificationsList'));
const NotificationDetail = lazy(() => import('./pages/notifications/NotificationDetail'));

function FullScreenLoader() {
  return (
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
  );
}

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
        <FullScreenLoader />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Suspense fallback={<FullScreenLoader />}>
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
                  <Route path="/dashboard/my-organization" element={<MyOrganization />} />
                  <Route path="/dashboard/courses/builder/:courseId?" element={<CourseBuilder />} />
                  <Route path="/dashboard/courses/:courseId/assessments" element={<AssessmentStatus />} />
                  <Route path="/dashboard/course-bundles" element={<CourseBundles />} />
                  <Route path="/dashboard/api-keys" element={<CourseAPIKeys />} />
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

                {/* Notifications — accessible to all authenticated roles */}
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard/notifications" element={<NotificationsList />} />
                  <Route path="/dashboard/notifications/:id" element={<NotificationDetail />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
