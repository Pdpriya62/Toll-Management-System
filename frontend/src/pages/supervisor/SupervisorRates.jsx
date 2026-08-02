import { useState, useEffect } from 'react';
import { api } from '../../services/api';

const VEHICLE_CLASSES = ['CAR', 'LCV', 'TRUCK', 'BUS', 'TWO_WHEELER'];

export default function SupervisorRates() {
  const [rates, setRates] = useState([]);
  const [plazas, setPlazas] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ plazaId: '', vehicleClass: '', fee: '', effectiveFrom: '', effectiveTo: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchRates = async () => {
    try {
      const data = await api.rates.list();
      setRates(data);
    } catch (err) { setError(err.message); }
  };

  const fetchPlazas = async () => {
    try {
      const ratesData = await api.rates.list();
      const uniquePlazas = [...new Map(ratesData.map(r => [r.plaza_id, { id: r.plaza_id, code: r.plaza_code }])).values()];
      setPlazas(uniquePlazas);
      if (uniquePlazas.length && !form.plazaId) setForm(f => ({ ...f, plazaId: uniquePlazas[0].id }));
    } catch (err) { console.error(err); }
  };

  useEffect(() => { fetchRates(); fetchPlazas(); }, []);

  const resetForm = () => setForm({ plazaId: plazas[0]?.id || '', vehicleClass: '', fee: '', effectiveFrom: new Date().toISOString().split('T')[0], effectiveTo: '' });

  const openCreate = () => { resetForm(); setEditing(null); setShowModal(true); };
  const openEdit = (rate) => { setForm({ plazaId: rate.plaza_id, vehicleClass: rate.vehicle_class, fee: rate.fee, effectiveFrom: rate.effective_from, effectiveTo: rate.effective_to || '' }); setEditing(rate); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (editing) {
        await api.rates.update(editing.id, { fee: Number(form.fee), effectiveTo: form.effectiveTo || null });
      } else {
        await api.rates.create({ plazaId: Number(form.plazaId), vehicleClass: form.vehicleClass, fee: Number(form.fee), effectiveFrom: form.effectiveFrom, effectiveTo: form.effectiveTo || null });
      }
      setShowModal(false);
      fetchRates();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this rate card?')) return;
    try {
      await api.rates.delete(id);
      fetchRates();
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Rate Management</h1>
          <p className="text-gray-500">Configure toll fees by vehicle class</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Add Rate</button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr className="text-left text-sm text-gray-500">
                <th className="p-3">Plaza</th>
                <th className="p-3">Vehicle Class</th>
                <th className="p-3">Fee</th>
                <th className="p-3">Effective From</th>
                <th className="p-3">Effective To</th>
                <th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {rates.map(rate => (
                <tr key={rate.id} className="hover:bg-gray-50">
                  <td className="p-3">{rate.plaza_code}</td>
                  <td className="p-3 font-medium">{rate.vehicle_class}</td>
                  <td className="p-3 font-medium text-green-600">₹{Number(rate.fee).toFixed(2)}</td>
                  <td className="p-3">{rate.effective_from}</td>
                  <td className="p-3">{rate.effective_to || '—'}</td>
                  <td className="p-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(rate)} className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800">Edit</button>
                      <button onClick={() => handleDelete(rate.id)} className="px-3 py-1 text-sm text-red-600 hover:text-red-800">Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rates.length === 0 && (
          <div className="p-8 text-center text-gray-500">No rate cards configured. Click "Add Rate" to create one.</div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">{editing ? 'Edit Rate' : 'Add Rate'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plaza</label>
                <select value={form.plazaId} onChange={e => setForm(f => ({ ...f, plazaId: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                  {plazas.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Class</label>
                <select value={form.vehicleClass} onChange={e => setForm(f => ({ ...f, vehicleClass: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required>
                  {VEHICLE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fee (₹)</label>
                <input type="number" step="0.01" min="0" value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
                <input type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Effective To (optional)</label>
                <input type="date" value={form.effectiveTo} onChange={e => setForm(f => ({ ...f, effectiveTo: e.target.value }))} className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{loading ? 'Saving...' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}