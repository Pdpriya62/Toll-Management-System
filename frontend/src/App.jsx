import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import OperatorLayout from './pages/operator/OperatorLayout';
import OperatorLane from './pages/operator/OperatorLane';
import SupervisorLayout from './pages/supervisor/SupervisorLayout';
import SupervisorDashboard from './pages/supervisor/SupervisorDashboard';
import SupervisorRates from './pages/supervisor/SupervisorRates';
import SupervisorReports from './pages/supervisor/SupervisorReports';

function PrivateRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/operator/*"
        element={
          <PrivateRoute allowedRoles={['operator', 'supervisor']}>
            <OperatorLayout />
          </PrivateRoute>
        }
      />
      <Route
        path="/supervisor/*"
        element={
          <PrivateRoute allowedRoles={['supervisor']}>
            <SupervisorLayout />
          </PrivateRoute>
        }
      />
      <Route path="/" element={<Navigate to={user?.role === 'supervisor' ? '/supervisor' : '/operator'} replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  const { user } = useAuth();
  return (
    <SocketProvider user={user}>
      <div className="min-h-screen bg-gray-50">
        <AppRoutes />
      </div>
    </SocketProvider>
  );
}