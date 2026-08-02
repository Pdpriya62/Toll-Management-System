import { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function SupervisorReports() {
  const [activeTab, setActiveTab] = useState('daily');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dailyReport, setDailyReport] = useState(null);
  const [laneSummary, setLaneSummary] = useState(null);
  const [shiftReport, setShiftReport] = useState(null);
  const [shiftId, setShiftId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchDaily = async () => {
    setLoading(true);
    try {
      const [daily, lanes] = await Promise.all([
        api.reports.daily(null, date),
        api.reports.laneSummary(null, null, date),
      ]);
      setDailyReport(daily);
      setLaneSummary(lanes);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const fetchShift = async () => {
    if (!shiftId) return;
    setLoading(true);
    try {
      const data = await api.reports.shift(shiftId);
      setShiftReport(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const exportCsv = async () => {
    try {
      const csv = await api.reports.exportCsv(fromDate, toDate, null);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transactions-${fromDate}-to-${toDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
  };

  useEffect(() => { fetchDaily(); }, [date]);
  useEffect(() => { fetchShift(); }, [shiftId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
          <p className="text-gray-500">View and export plaza reports</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <nav className="flex gap-1 mb-4" role="tablist">
          {['daily', 'lane', 'shift', 'export'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              role="tab"
              aria-selected={activeTab === tab}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === tab ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>

        {error && <div className="mb-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

        {/* Daily Report */}
        {activeTab === 'daily' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
              <button onClick={fetchDaily} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            {dailyReport && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {dailyReport.plazas.map(p => (
                  <div key={p.plaza_id} className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-800 mb-2">{p.plaza_name}</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span>Transactions:</span><span className="font-medium">{p.total_transactions}</span></div>
                      <div className="flex justify-between"><span>Revenue:</span><span className="font-medium text-green-600">₹{Number(p.total_revenue || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>Cash:</span><span>₹{Number(p.cash_revenue || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>QR:</span><span>₹{Number(p.qr_revenue || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>FASTag:</span><span>₹{Number(p.fastag_revenue || 0).toLocaleString()}</span></div>
                      <div className="flex justify-between text-red-600"><span>Exceptions:</span><span className="font-medium">{p.exceptions}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Lane Summary */}
        {activeTab === 'lane' && (
          <div>
            <div className="flex items-center gap-4 mb-4">
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg" />
              <button onClick={fetchDaily} disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Refresh</button>
            </div>
            {laneSummary && (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr className="text-left text-sm text-gray-500">
                    <th className="p-3">Lane</th>
                    <th className="p-3">Transactions</th>
                    <th className="p-3">Revenue</th>
                    <th className="p-3">Cash</th>
                    <th className="p-3">QR</th>
                    <th className="p-3">FASTag</th>
                    <th className="p-3">Completed</th>
                    <th className="p-3">Settled</th>
                    <th className="p-3">Exceptions</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-200">
                    {laneSummary.lanes.map(l => (
                      <tr key={l.lane_id} className="hover:bg-gray-50">
                        <td className="p-3 font-medium">Lane {l.lane_number}</td>
                        <td className="p-3">{l.total_transactions}</td>
                        <td className="p-3 font-medium text-green-600">₹{Number(l.total_revenue || 0).toLocaleString()}</td>
                        <td className="p-3">₹{Number(l.cash_revenue || 0).toLocaleString()}</td>
                        <td className="p-3">₹{Number(l.qr_revenue || 0).toLocaleString()}</td>
                        <td className="p-3">₹{Number(l.fastag_revenue || 0).toLocaleString()}</td>
                        <td className="p-3">{l.completed}</td>
                        <td className="p-3">{l.settled}</td>
                        <td className="p-3 text-red-600 font-medium">{l.exceptions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Shift Report */}
        {activeTab === 'shift' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input type="text" placeholder="Shift ID" value={shiftId} onChange={e => setShiftId(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg w-64" />
              <button onClick={fetchShift} disabled={loading || !shiftId} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Load Shift</button>
            </div>
            {shiftReport && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Shift Info</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span>Shift ID:</span><span className="font-medium">{shiftReport.shift.id}</span></div>
                    <div className="flex justify-between"><span>Operator:</span><span>{shiftReport.shift.operator_name}</span></div>
                    <div className="flex justify-between"><span>Lane:</span><span>{shiftReport.shift.lane_number}</span></div>
                    <div className="flex justify-between"><span>Plaza:</span><span>{shiftReport.shift.plaza_code}</span></div>
                    <div className="flex justify-between"><span>Started:</span><span>{new Date(shiftReport.shift.started_at).toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>Ended:</span><span>{shiftReport.shift.ended_at ? new Date(shiftReport.shift.ended_at).toLocaleString() : 'Active'}</span></div>
                    <div className="flex justify-between"><span>Status:</span><span className="font-medium capitalize">{shiftReport.shift.status}</span></div>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Reconciliation</h4>
                  <div className="space-y-2">
                    <div className="p-3 bg-white rounded border">
                      <div className="text-sm text-gray-500">Cash</div>
                      <div className="flex justify-between text-sm">
                        <span>Declared: ₹{shiftReport.reconciliation.cash.declared.toFixed(2)}</span>
                        <span>System: ₹{shiftReport.reconciliation.cash.system.toFixed(2)}</span>
                      </div>
                      <div className={`text-sm font-medium ${shiftReport.reconciliation.cash.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        Diff: ₹{shiftReport.reconciliation.cash.diff.toFixed(2)}
                      </div>
                    </div>
                    <div className="p-3 bg-white rounded border">
                      <div className="text-sm text-gray-500">QR</div>
                      <div className="flex justify-between text-sm">
                        <span>Declared: ₹{shiftReport.reconciliation.qr.declared.toFixed(2)}</span>
                        <span>System: ₹{shiftReport.reconciliation.qr.system.toFixed(2)}</span>
                      </div>
                      <div className={`text-sm font-medium ${shiftReport.reconciliation.qr.diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        Diff: ₹{shiftReport.reconciliation.qr.diff.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <h4 className="font-semibold text-gray-800 mb-2">Transactions</h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50"><tr className="text-left text-sm text-gray-500">
                      <th className="p-2">ID</th><th className="p-2">Vehicle</th><th className="p-2">Class</th><th className="p-2">Fee</th><th className="p-2">Mode</th><th className="p-2">Status</th><th className="p-2">Time</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-200">
                      {shiftReport.transactions.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="p-2 text-sm">#{t.id}</td>
                          <td className="p-2 text-sm">{t.vehicle_number || '—'}</td>
                          <td className="p-2 text-sm">{t.vehicle_class}</td>
                          <td className="p-2 text-sm">₹{t.fee}</td>
                          <td className="p-2 text-sm">{t.payment_mode}</td>
                          <td className="p-2 text-sm capitalize">{t.status.toLowerCase()}</td>
                          <td className="p-2 text-sm">{new Date(t.initiated_at).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Export */}
        {activeTab === 'export' && (
          <div className="max-w-md">
            <h3 className="font-semibold text-gray-800 mb-4">Export Transactions (CSV)</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <button onClick={exportCsv} disabled={loading} className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {loading ? 'Generating...' : 'Download CSV'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}