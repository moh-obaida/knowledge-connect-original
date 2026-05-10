import { ref, set, get, update, onValue, off, type DataSnapshot } from "firebase/database";
import { getFirebaseDb } from "./firebase";
import {
  type RoomState,
  type Player,
  defaultRoomState,
  normalizeRoomState,
  roomStatusFromGameStatus,
} from "./store";

function randomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function roomExists(code: string): Promise<boolean> {
  const db = getFirebaseDb();
  const snap = await get(ref(db, `rooms/${code}/roomCode`));
  return snap.exists();
}

const MAX_UNIQUE_CODE_ATTEMPTS = 10;

export async function generateUniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_UNIQUE_CODE_ATTEMPTS; attempt++) {
    const code = randomCode();
    if (!(await roomExists(code))) return code;
  }
  // Bail out instead of silently returning a colliding code, which would let
  // createRoom() overwrite an existing room in Firebase.
  throw new Error(
    `Failed to generate a unique room code after ${MAX_UNIQUE_CODE_ATTEMPTS} attempts.`,
  );
}

export async function createRoom(code: string): Promise<RoomState> {
  const db = getFirebaseDb();
  const state = defaultRoomState(code);
  await set(ref(db, `rooms/${code}`), state);
  return state;
}

export async function getRoom(code: string): Promise<RoomState | null> {
  const db = getFirebaseDb();
  const snap = await get(ref(db, `rooms/${code}`));
  return snap.exists() ? normalizeRoomState(snap.val() as Partial<RoomState>) : null;
}

export async function updateRoom(code: string, updates: Partial<RoomState>): Promise<void> {
  const db = getFirebaseDb();
  await update(ref(db, `rooms/${code}`), {
    ...updates,
    updatedAt: Date.now(),
    ...(updates.gameStatus ? { status: roomStatusFromGameStatus(updates.gameStatus) } : {}),
  });
}

export function subscribeToRoom(code: string, callback: (state: RoomState | null) => void): () => void {
  const db = getFirebaseDb();
  const roomRef = ref(db, `rooms/${code}`);
  const handler = (snap: DataSnapshot) => callback(snap.exists() ? normalizeRoomState(snap.val() as Partial<RoomState>) : null);
  onValue(roomRef, handler);
  return () => off(roomRef, "value", handler);
}

// ── Self-join (participant opens /join) ───────────────────────
export async function joinRoom(code: string, playerId: string, playerName: string): Promise<boolean> {
  const db = getFirebaseDb();
  const exists = await roomExists(code);
  if (!exists) return false;
  const player: Player = {
    id: playerId,
    name: playerName,
    team: 0,
    joinedAt: Date.now(),
    joinMethod: "self",
  };
  await update(ref(db, `rooms/${code}/players/${playerId}`), player);
  return true;
}

// ── Manual add by host ────────────────────────────────────────
export async function addPlayerManually(
  code: string,
  playerName: string,
  team: 0 | 1 | 2
): Promise<void> {
  const db = getFirebaseDb();
  const playerId = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const player: Player = {
    id: playerId,
    name: playerName,
    team,
    joinedAt: Date.now(),
    joinMethod: "manual",
  };
  await update(ref(db, `rooms/${code}/players/${playerId}`), player);
}

// ── Assign player to team ─────────────────────────────────────
export async function assignPlayerTeam(
  code: string,
  playerId: string,
  team: 0 | 1 | 2
): Promise<void> {
  const db = getFirebaseDb();
  await update(ref(db, `rooms/${code}/players/${playerId}`), { team });
}

// ── Remove player ─────────────────────────────────────────────
export async function removePlayer(code: string, playerId: string): Promise<void> {
  const db = getFirebaseDb();
  await set(ref(db, `rooms/${code}/players/${playerId}`), null);
}

export async function deleteRoom(code: string): Promise<void> {
  const db = getFirebaseDb();
  await set(ref(db, `rooms/${code}`), null);
}
