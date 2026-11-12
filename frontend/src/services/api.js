const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = localStorage.getItem('token');
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  auth: {
    login: (username, password) => request('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
    me: () => request('/api/auth/me'),
    changePassword: (currentPassword, newPassword) => request('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
    listUsers: () => request('/api/auth/users'),
    createUser: (data) => request('/api/auth/users', { method: 'POST', body: JSON.stringify(data) }),
  },
  lanes: {
    event: (laneId, vehicleClass, vehicleNumber, paymentMode, evidenceRef) =>
      request('/api/lanes/event', { method: 'POST', body: JSON.stringify({ laneId, vehicleClass, vehicleNumber, paymentMode, evidenceRef }) }),
    status: (laneId) => request(`/api/lanes/${laneId}/status`),
    transactions: (laneId, params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/api/lanes/${laneId}/transactions?${qs}`);
    },
    summary: (laneId, date) => request(`/api/lanes/${laneId}/summary?date=${date}`),
    transition: (id, status, evidenceRef) =>
      request(`/api/lanes/${id}/transition`, { method: 'PATCH', body: JSON.stringify({ status, evidenceRef }) }),
  },
  rates: {
    list: (plazaId) => request(`/api/rates?plazaId=${plazaId || ''}`),
    create: (data) => request('/api/rates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/api/rates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => request(`/api/rates/${id}`, { method: 'DELETE' }),
  },
  reports: {
    daily: (plazaId, date) => request(`/api/reports/daily?plazaId=${plazaId || ''}&date=${date || ''}`),
    laneSummary: (plazaId, laneId, date) => request(`/api/reports/lane-summary?plazaId=${plazaId || ''}&laneId=${laneId || ''}&date=${date || ''}`),
    shift: (shiftId) => request(`/api/reports/shift?shiftId=${shiftId}`),
    exportCsv: (fromDate, toDate, plazaId) => request(`/api/reports/export/csv?fromDate=${fromDate}&toDate=${toDate}&plazaId=${plazaId || ''}`),
  },
};