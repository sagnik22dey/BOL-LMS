import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';

const ProtectedRoute = ({ allowedRoles }) => {
  const { isAuthenticated, initializing, user } = useAuthStore();

  // While the app is still verifying the stored token with the server,
  // show a spinner instead of redirecting prematurely to /login.
  if (initializing) {
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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If specific roles are required and the user doesn't have them
  if (allowedRoles && (!user || !allowedRoles.includes(user.role))) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
