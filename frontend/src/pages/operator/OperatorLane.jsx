import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useSocket } from '../../context/SocketContext';

const STATUS_ORDER = ['INITIATED', 'VALIDATED', 'AUTHORIZED', 'COMPLETED', 'SETTLED'];
const STATUS_LABELS = {
  INITIATED: 'Detected',
  VALIDATED: 'Validated',
  AUTHORIZED: 'Authorized',
  COMPLETED: 'Completed',
  SETTLED: 'Settled',
  EXCEPTION: 'Exception',
  VOIDED: 'Voided',
};
const STATUS_COLORS = {
  INITIATED: 'bg-yellow-100 text-yellow-800',
  VALIDATED: 'bg-blue-100 text-blue-800',
  AUTHORIZED: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  SETTLED: 'bg-gray-100 text-gray-800',
  EXCEPTION: 'bg-red-100 text-red-800',
  VOIDED: 'bg-gray-100 text-gray-500 line-through',
};

const VEHICLE_CLASSES = ['CAR', 'LCV', 'TRUCK', 'BUS', 'TWO_WHEELER'];
const PAYMENT_MODES = ['CASH', 'QR', 'FASTAG', 'EXEMPT'];

function StatusBadge({ status }) {
  return (
    <span className={`px-3 py-1 rounded-full text-sm font-medium ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-800'}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

function VehicleCard({ txn, onTransition, disabled }) {
  const currentIdx = STATUS_ORDER.indexOf(txn.status);
  const nextStatus = currentIdx >= 0 && currentIdx < STATUS_ORDER.length - 1 ? STATUS_ORDER[currentIdx + 1] : null;
  const canTransition = nextStatus && !disabled && !['SETTLED', 'EXCEPTION', 'VOIDED'].includes(txn.status);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{txn.vehicle_class}</h2>
          <p className="text-gray-500">Plate: {txn.vehicle_number || '—'}</p>
        </div>
        <StatusBadge status={txn.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Fee</p>
          <p className="text-3xl font-bold text-gray-900">₹{txn.fee}</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Payment Mode</p>
          <select
            value={txn.payment_mode}
            onChange={(e) => onTransition(txn.id, 'UPDATE_PAYMENT', e.target.value)}
            disabled={disabled || txn.status !== 'INITIATED'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Transaction ID</p>
          <p className="font-mono text-sm text-gray-700">#{txn.id}</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1 flex items-center gap-2 text-sm text-gray-500">
          {STATUS_ORDER.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex-1 h-1.5 rounded ${i <= currentIdx ? 'bg-blue-500' : 'bg-gray-200'}`} />
              {i < STATUS_ORDER.length - 1 && <span className="w-4" />}
            </React.Fragment>
          ))}
        </div>
        {canTransition && (
          <button
            onClick={() => onTransition(txn.id, nextStatus)}
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
          >
            {STATUS_LABELS[nextStatus]}
          </button>
        )}
        {txn.status === 'SETTLED' && (
          <span className="px-4 py-2 bg-green-100 text-green-700 rounded-lg font-medium">Done</span>
        )}
      </div>
    </div>
  );
}

function TransactionList({ transactions, onTransition }) {
  if (!transactions.length) {
    return <p className="text-center text-gray-500 py-8">No transactions yet</p>;
  }
  return (
    <div className="space-y-3">
      {transactions.map(txn => (
        <div key={txn.id} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <StatusBadge status={txn.status} />
            <div className="min-w-0">
              <p className="font-medium text-gray-800 truncate">{txn.vehicle_class} — {txn.vehicle_number || 'No plate'}</p>
              <p className="text-sm text-gray-500">₹{txn.fee} · {txn.payment_mode} · #{txn.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {txn.status === 'INITIATED' && (
              <button onClick={() => onTransition(txn.id, 'VALIDATED')} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Validate</button>
            )}
            {txn.status === 'VALIDATED' && (
              <button onClick={() => onTransition(txn.id, 'AUTHORIZED')} className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700">Authorize</button>
            )}
            {txn.status === 'AUTHORIZED' && (
              <button onClick={() => onTransition(txn.id, 'COMPLETED')} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700">Complete</button>
            )}
            {txn.status === 'COMPLETED' && (
              <button onClick={() => onTransition(txn.id, 'SETTLED')} className="px-3 py-1.5 text-xs bg-gray-600 text-white rounded hover:bg-gray-700">Settle</button>
            )}
            {['SETTLED', 'EXCEPTION', 'VOIDED'].includes(txn.status) && (
              <span className="px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded">Final</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function OperatorLane() {
  const [laneId, setLaneId] = useState(1);
  const [currentTxn, setCurrentTxn] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [laneStatus, setLaneStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { joinLane, onTransactionCreated, onTransactionUpdated } = useSocket();

  const fetchLaneStatus = useCallback(async () => {
    try {
      const data = await api.lanes.status(laneId);
      setLaneStatus(data.lane);
    } catch (err) { console.error(err); }
  }, [laneId]);

  const fetchTransactions = useCallback(async () => {
    try {
      const data = await api.lanes.transactions(laneId, { limit: 20 });
      setTransactions(data);
    } catch (err) { console.error(err); }
  }, [laneId]);

  useEffect(() => {
    joinLane(laneId);
    fetchLaneStatus();
    fetchTransactions();
  }, [laneId, joinLane, fetchLaneStatus, fetchTransactions]);

  useEffect(() => {
    const offCreated = onTransactionCreated((txn) => {
      if (txn.lane_id === laneId) {
        setCurrentTxn(txn);
        fetchTransactions();
      }
    });
    const offUpdated = onTransactionUpdated((txn) => {
      if (txn.lane_id === laneId) {
        setTransactions(prev => prev.map(t => t.id === txn.id ? txn : t));
        if (currentTxn?.id === txn.id) setCurrentTxn(txn);
      }
    });
    return () => { offCreated(); offUpdated(); };
  }, [laneId, onTransactionCreated, onTransactionUpdated, currentTxn, fetchTransactions]);

  const handleEvent = async (vehicleClass, vehicleNumber, paymentMode) => {
    setLoading(true);
    setError('');
    try {
      const txn = await api.lanes.event(laneId, vehicleClass, vehicleNumber, paymentMode);
      setCurrentTxn(txn);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTransition = async (id, status, evidenceRef) => {
    if (status === 'UPDATE_PAYMENT') return;
    try {
      await api.lanes.transition(id, status, evidenceRef);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Lane Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Lane Console</h1>
            <p className="text-gray-500">Lane {laneStatus?.lane_number || laneId} — {laneStatus?.plaza_code || 'Plaza'}</p>
          </div>
          <div className="flex items-center gap-4">
            <select
              value={laneId}
              onChange={(e) => setLaneId(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value={1}>Lane 1</option>
            </select>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${laneStatus?.status === 'open' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {laneStatus?.status || 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">{error}</div>}

      {/* Vehicle Detection Form (when no active transaction) */}
      {!currentTxn && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">New Vehicle Detection</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Class</label>
              <select
                id="vehicleClass"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {VEHICLE_CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle Number (optional)</label>
              <input
                type="text"
                id="vehicleNumber"
                placeholder="MH12AB1234"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Mode</label>
              <select
                id="paymentMode"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-4">
            <button
              onClick={() => {
                const vc = document.getElementById('vehicleClass').value;
                const vn = document.getElementById('vehicleNumber').value || undefined;
                const pm = document.getElementById('paymentMode').value;
                handleEvent(vc, vn, pm);
              }}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Detecting...' : 'Detect Vehicle'}
            </button>
          </div>
        </div>
      )}

      {/* Active Transaction Card */}
      {currentTxn && (
        <VehicleCard
          txn={currentTxn}
          onTransition={handleTransition}
          disabled={loading}
        />
      )}

      {/* Transaction History */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">Today's Transactions</h2>
          <button onClick={fetchTransactions} className="text-sm text-blue-600 hover:underline">Refresh</button>
        </div>
        <TransactionList transactions={transactions} onTransition={handleTransition} />
      </div>
    </div>
  );
}