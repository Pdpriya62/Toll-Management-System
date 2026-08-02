import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useSocket } from '../../context/SocketContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function LaneCard({ lane, counts, onRefresh }) {
  const total = counts.reduce((sum, c) => sum + Number(c.count), 0);
  const revenue = counts.reduce((sum, c) => sum + (c.status === 'SETTLED' || c.status === 'COMPLETED' ? Number(c.count) * 50 : 0), 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800">Lane {lane.lane_number}</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${lane.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {lane.status}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center mb-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-gray-900">{total}</p>
          <p className="text-xs text-gray-500">Transactions</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-green-600">₹{revenue.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Revenue</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-2xl font-bold text-red-600">
            {counts.find(c => c.status === 'EXCEPTION')?.count || 0}
          </p>
          <p className="text-xs text-gray-500">Exceptions</p>
        </div>
      </div>
      <div className="flex gap-2 text-xs text-gray-500">
        {counts.map(c => (
          <span key={c.status} className="px-2 py-0.5 bg-gray-100 rounded">
            {c.status}: {c.count}
          </span>
        ))}
      </div>
    </div>
  );
}

function RevenueChart({ data }) {
  if (!data?.length) return <div className="h-64 flex items-center justify-center text-gray-400">No data</div>;
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="lane" stroke="#9ca3af" fontSize={12} />
          <YAxis stroke="#9ca3af" fontSize={12} />
          <Tooltip formatter={(v) => [`₹${v}`, 'Revenue']} />
          <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function PaymentModePie({ data }) {
  if (!data?.length) return <div className="h-64 flex items-center justify-center text-gray-400">No data</div>;
  const items = [
    { name: 'Cash', value: data.reduce((s, d) => s + Number(d.cash_revenue || 0), 0) },
    { name: 'QR', value: data.reduce((s, d) => s + Number(d.qr_revenue || 0), 0) },
    { name: 'FASTag', value: data.reduce((s, d) => s + Number(d.fastag_revenue || 0), 0) },
  ].filter(d => d.value > 0);

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={items}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          >
            {items.map((_, i) => <Cell key={`cell-${i}`} fill={COLORS[i]} />)}
          </Pie>
          <Tooltip formatter={(v) => [`₹${v}`, 'Revenue']} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function SupervisorDashboard() {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dailyReport, setDailyReport] = useState(null);
  const [laneSummary, setLaneSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const { joinSupervisor, onTransactionCreated, onTransactionUpdated } = useSocket();

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const [daily, lanes] = await Promise.all([
        api.reports.daily(null, date),
        api.reports.laneSummary(null, null, date),
      ]);
      setDailyReport(daily);
      setLaneSummary(lanes);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [date]);

  useEffect(() => {
    joinSupervisor();
    fetchReports();
  }, [joinSupervisor, fetchReports]);

  useEffect(() => {
    const offCreated = onTransactionCreated(() => fetchReports());
    const offUpdated = onTransactionUpdated(() => fetchReports());
    return () => { offCreated(); offUpdated(); };
  }, [onTransactionCreated, onTransactionUpdated, fetchReports]);

  const plazaData = dailyReport?.plazas || [];
  const laneData = laneSummary?.lanes || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Supervisor Dashboard</h1>
          <p className="text-gray-500">Live overview of plaza operations</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg"
          />
          <button onClick={fetchReports} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Transactions</p>
          <p className="text-3xl font-bold text-gray-900">
            {plazaData.reduce((s, p) => s + Number(p.total_transactions || 0), 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-3xl font-bold text-green-600">
            ₹{plazaData.reduce((s, p) => s + Number(p.total_revenue || 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Exceptions</p>
          <p className="text-3xl font-bold text-red-600">
            {plazaData.reduce((s, p) => s + Number(p.exceptions || 0), 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <p className="text-sm text-gray-500">Active Lanes</p>
          <p className="text-3xl font-bold text-blue-600">
            {laneData.filter(l => l.completed > 0 || l.settled > 0).length}
          </p>
        </div>
      </div>

      {/* Lane Status Cards */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Lane Status (Live)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {laneData.map(lane => (
            <LaneCard key={lane.lane_id} lane={{ lane_number: lane.lane_number, status: 'open' }} counts={[
              { status: 'COMPLETED', count: lane.completed },
              { status: 'SETTLED', count: lane.settled },
              { status: 'EXCEPTION', count: lane.exceptions },
            ]} />
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Revenue by Lane</h3>
          <RevenueChart data={laneData.map(l => ({ lane: `L${l.lane_number}`, revenue: Number(l.total_revenue || 0) }))} />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Payment Mode Distribution</h3>
          <PaymentModePie data={plazaData} />
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">Plaza Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-500">
                <th className="p-3">Plaza</th>
                <th className="p-3">Transactions</th>
                <th className="p-3">Revenue</th>
                <th className="p-3">Cash</th>
                <th className="p-3">QR</th>
                <th className="p-3">FASTag</th>
                <th className="p-3">Exceptions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {plazaData.map(p => (
                <tr key={p.plaza_id} className="hover:bg-gray-50">
                  <td className="p-3 font-medium">{p.plaza_name}</td>
                  <td className="p-3">{p.total_transactions}</td>
                  <td className="p-3 font-medium text-green-600">₹{Number(p.total_revenue || 0).toLocaleString()}</td>
                  <td className="p-3">₹{Number(p.cash_revenue || 0).toLocaleString()}</td>
                  <td className="p-3">₹{Number(p.qr_revenue || 0).toLocaleString()}</td>
                  <td className="p-3">₹{Number(p.fastag_revenue || 0).toLocaleString()}</td>
                  <td className="p-3 text-red-600 font-medium">{p.exceptions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}