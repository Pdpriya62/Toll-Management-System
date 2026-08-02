import { useState, useEffect } from 'react';
import { api } from '../../services/api';

function VehicleList({ title, vehicles, onDelete, loading, emptyMessage }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">{title}</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {vehicles.length === 0 ? (
          <div className="p-8 text-center text-gray-500">{emptyMessage}</div>
        ) : (
          vehicles.map(v => (
            <div key={v.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="font-mono text-lg font-medium text-gray-800">{v.vehicle_number}</span>
                {v.reason && <span className="text-sm text-gray-500">{v.reason}</span>}
              </div>
              <button
                onClick={() => onDelete(v.vehicle_number)}
                disabled={loading}
                className="px-3 py-1.5 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AddForm({ title, onSubmit, loading }) {
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!vehicleNumber.trim()) return;
    onSubmit(vehicleNumber.toUpperCase().trim(), reason.trim());
    setVehicleNumber('');
    setReason('');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <h3 className="font-semibold text-gray-800 mb-3">Add to {title}</h3>
      <form onSubmit={handleSubmit} className="flex gap-3">
        <input
          type="text"
          placeholder="Vehicle Number (e.g., MH12AB1234)"
          value={vehicleNumber}
          onChange={e => setVehicleNumber(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          required
        />
        <input
          type="text"
          placeholder="Reason (optional)"
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
          {loading ? 'Adding...' : 'Add'}
        </button>
      </form>
    </div>
  );
}

export default function SupervisorVehicles() {
  const [blacklist, setBlacklist] = useState([]);
  const [exempt, setExempt] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLists = async () => {
    try {
      const [bl, ex] = await Promise.all([
        api.rates.list().then(() => fetch('/api/vehicles/blacklist', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json())),
        api.rates.list().then(() => fetch('/api/vehicles/exempt', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }).then(r => r.json())),
      ]);
      setBlacklist(bl);
      setExempt(ex);
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchLists(); }, []);

  const addBlacklist = async (vn, reason) => {
    setLoading(true);
    try {
      await fetch('/api/vehicles/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ vehicleNumber: vn, reason })
      });
      fetchLists();
    } finally { setLoading(false); }
  };

  const addExempt = async (vn, reason) => {
    setLoading(true);
    try {
      await fetch('/api/vehicles/exempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ vehicleNumber: vn, reason })
      });
      fetchLists();
    } finally { setLoading(false); }
  };

  const removeBlacklist = async (vn) => {
    if (!confirm(`Remove ${vn} from blacklist?`)) return;
    try {
      await fetch(`/api/vehicles/blacklist/${vn}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchLists();
    } catch (err) { console.error(err); }
  };

  const removeExempt = async (vn) => {
    if (!confirm(`Remove ${vn} from exempt list?`)) return;
    try {
      await fetch(`/api/vehicles/exempt/${vn}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchLists();
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Vehicle Lists</h1>
        <p className="text-gray-500">Manage blacklisted and exempt vehicles</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <AddForm title="Blacklist" onSubmit={addBlacklist} loading={loading} />
          <VehicleList
            title="Blacklisted Vehicles"
            vehicles={blacklist}
            onDelete={removeBlacklist}
            loading={loading}
            emptyMessage="No blacklisted vehicles"
          />
        </div>

        <div className="space-y-4">
          <AddForm title="Exempt List" onSubmit={addExempt} loading={loading} />
          <VehicleList
            title="Exempt Vehicles"
            vehicles={exempt}
            onDelete={removeExempt}
            loading={loading}
            emptyMessage="No exempt vehicles"
          />
        </div>
      </div>
    </div>
  );
}