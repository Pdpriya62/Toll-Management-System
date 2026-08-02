import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function SupervisorLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/supervisor', label: 'Dashboard' },
    { path: '/supervisor/rates', label: 'Rates' },
    { path: '/supervisor/reports', label: 'Reports' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/supervisor" className="text-xl font-bold text-blue-600">TollEase</Link>
            <nav className="hidden md:flex gap-4">
              {navItems.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition ${
                    location.pathname === item.path
                      ? 'bg-blue-50 text-blue-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.fullName || user?.username} (Supervisor)</span>
            <button onClick={logout} className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700">Logout</button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-7xl mx-auto w-full p-4">
        <Outlet />
      </main>
    </div>
  );
}