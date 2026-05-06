import {
  ref, set, get, update, onValue, off,
  type DataSnapshot,
} from "firebase/database";
import { getFirebaseDb } from "./firebase";
import { type RoomState, defaultRoomState } from "./store";

// ── Room code generation ──────────────────────────────────────
function randomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function roomExists(code: string): Promise<boolean> {
  const db = getFirebaseDb();
  const snap = await get(ref(db, `rooms/${code}/roomCode`));
  return snap.exists();
}

export async function generateUniqueCode(): Promise<string> {
  let code = randomCode();
  let attempts = 0;
  while ((await roomExists(code)) && attempts < 10) {
    code = randomCode();
    attempts++;
  }
  return code;
}

// ── Create room ───────────────────────────────────────────────
export async function createRoom(code: string): Promise<RoomState> {
  const db = getFirebaseDb();
  const state = defaultRoomState(code);
  await set(ref(db, `rooms/${code}`), state);
  return state;
}

// ── Get room once ─────────────────────────────────────────────
export async function getRoom(code: string): Promise<RoomState | null> {
  const db = getFirebaseDb();
  const snap = await get(ref(db, `rooms/${code}`));
  return snap.exists() ? (snap.val() as RoomState) : null;
}

// ── Update room (partial) ─────────────────────────────────────
export async function updateRoom(code: string, updates: Partial<RoomState>): Promise<void> {
  const db = getFirebaseDb();
  await update(ref(db, `rooms/${code}`), updates);
}

// ── Subscribe to room (real-time) ─────────────────────────────
export function subscribeToRoom(
  code: string,
  callback: (state: RoomState | null) => void
): () => void {
  const db = getFirebaseDb();
  const roomRef = ref(db, `rooms/${code}`);
  const handler = (snap: DataSnapshot) => {
    callback(snap.exists() ? (snap.val() as RoomState) : null);
  };
  onValue(roomRef, handler);
  return () => off(roomRef, "value", handler);
}

// ── Join room as participant ───────────────────────────────────
export async function joinRoom(
  code: string,
  playerId: string,
  playerName: string
): Promise<boolean> {
  const db = getFirebaseDb();
  const exists = await roomExists(code);
  if (!exists) return false;
  await update(ref(db, `rooms/${code}/players/${playerId}`), {
    name: playerName,
    joinedAt: Date.now(),
  });
  return true;
}

// ── Delete room ───────────────────────────────────────────────
export async function deleteRoom(code: string): Promise<void> {
  const db = getFirebaseDb();
  await set(ref(db, `rooms/${code}`), null);
}
