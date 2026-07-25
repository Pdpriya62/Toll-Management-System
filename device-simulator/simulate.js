import fetch from 'node-fetch';
import { io } from 'socket.io-client';

const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const LANE_ID = parseInt(process.env.LANE_ID) || 1;
const OPERATOR_USER = process.env.OPERATOR_USER || 'operator';
const OPERATOR_PASS = process.env.OPERATOR_PASS || 'op123';

const vehicleClasses = ['CAR', 'LCV', 'TRUCK', 'BUS', 'TWO_WHEELER'];
const paymentModes = ['CASH', 'QR', 'FASTAG'];

let authToken = null;
let socket = null;

function randomPlate() {
  const states = ['MH', 'DL', 'KA', 'TN', 'GJ', 'UP', 'RJ', 'WB'];
  const state = states[Math.floor(Math.random() * states.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  const letters = String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `${state}${num}${letters}`;
}

async function login() {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: OPERATOR_USER, password: OPERATOR_PASS }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  authToken = data.token;
  console.log('Logged in as', OPERATOR_USER);
  return data.token;
}

async function sendLaneEvent(vehicleClass, vehicleNumber, paymentMode) {
  const res = await fetch(`${API_BASE}/api/lanes/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      laneId: LANE_ID,
      vehicleClass,
      vehicleNumber,
      paymentMode,
      evidenceRef: `IMG_${Date.now()}`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Event failed');
  return data;
}

async function transitionTransaction(transactionId, status) {
  const res = await fetch(`${API_BASE}/api/lanes/${transactionId}/transition`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({ status }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Transition failed');
  return data;
}

function connectSocket() {
  socket = io(API_BASE, { transports: ['websocket', 'polling'] });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
    socket.emit('join_lane', LANE_ID);
  });

  socket.on('transaction_created', (txn) => {
    console.log('\n📍 NEW TRANSACTION:', txn.id, txn.vehicle_class, txn.vehicle_number, '₹' + txn.fee, txn.payment_mode);
  });

  socket.on('transaction_updated', (txn) => {
    console.log('🔄 TRANSITION:', txn.id, '→', txn.status);
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('connect_error', (err) => {
    console.error('Socket error:', err.message);
  });
}

async function simulateVehicle() {
  const vehicleClass = vehicleClasses[Math.floor(Math.random() * vehicleClasses.length)];
  const vehicleNumber = randomPlate();
  const paymentMode = paymentModes[Math.floor(Math.random() * paymentModes.length)];

  console.log(`\n🚗 Vehicle detected: ${vehicleNumber} (${vehicleClass}) - ${paymentMode}`);

  try {
    const txn = await sendLaneEvent(vehicleClass, vehicleNumber, paymentMode);
    console.log('✅ Transaction created:', txn.id, 'Status:', txn.status);

    // Auto-transition through states
    setTimeout(async () => {
      try {
        await transitionTransaction(txn.id, 'VALIDATED');
      } catch (e) { console.error('Validate error:', e.message); }
    }, 500);

    setTimeout(async () => {
      try {
        await transitionTransaction(txn.id, 'AUTHORIZED');
      } catch (e) { console.error('Authorize error:', e.message); }
    }, 1000);

    setTimeout(async () => {
      try {
        await transitionTransaction(txn.id, 'COMPLETED');
      } catch (e) { console.error('Complete error:', e.message); }
    }, 1500);

    setTimeout(async () => {
      try {
        await transitionTransaction(txn.id, 'SETTLED');
      } catch (e) { console.error('Settle error:', e.message); }
    }, 2000);

  } catch (err) {
    console.error('❌ Event error:', err.message);
  }
}

async function run() {
  console.log('=== TollEase Device Simulator ===');
  console.log('API:', API_BASE);
  console.log('Lane:', LANE_ID);
  console.log('Operator:', OPERATOR_USER);

  try {
    await login();
    connectSocket();

    console.log('\nStarting simulation... Press Ctrl+C to stop\n');

    // Initial burst
    for (let i = 0; i < 3; i++) {
      await simulateVehicle();
      await new Promise(r => setTimeout(r, 800));
    }

    // Continuous simulation
    setInterval(async () => {
      await simulateVehicle();
    }, 5000 + Math.random() * 5000);

  } catch (err) {
    console.error('Fatal error:', err.message);
    process.exit(1);
  }
}

run();