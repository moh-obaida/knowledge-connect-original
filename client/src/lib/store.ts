// ═══════════════════════════════════════════════════════════════
// وصلة المعرفة — Data Models
// ═══════════════════════════════════════════════════════════════

export interface BoardCell {
  id: string;
  label: string;
  position: number;
  row?: number;
  col?: number;
  selected?: boolean;
  disabled?: boolean;
  isWinningPath?: boolean;
  questionId?: string;
  question: string;
  answer: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  hint: string;
  explanation: string;
  acceptedAnswers?: string[];
  commonMistakes?: string[];
  teacherNote?: string;
  topic?: string;
  gradeLevel?: string;
  used: boolean;
  claimedBy: 0 | 1 | 2;
}

export interface Team {
  id?: "blue" | "red" | string;
  name: string;
  color: string;
  initials: string;
  direction?: "left-right" | "top-bottom";
  score?: number;
}

export type QuestionTypeValue = "fill" | "mcq" | "tf" | "image" | "open";

export interface ActiveQuestion {
  cellId: string;
  cellLabel: string;
  question: string;
  answer: string;
  category: string;
  difficulty: "easy" | "medium" | "hard";
  points: number;
  hint: string;
  explanation: string;
  type?: QuestionTypeValue;
  choices?: string[];
  imageUrl?: string;
}

export interface Player {
  id: string;
  name: string;
  team: 0 | 1 | 2;
  joinedAt: number;
  joinMethod: "self" | "manual";
}

export const CURRENT_SCHEMA_VERSION = 2;
export const CURRENT_BOARD_VERSION = "arabic-5x5-alif-v2";

export type RoomLifecycleStatus = "setup" | "active" | "paused" | "ended" | "archived";
export type GameEventType =
  | "room_created"
  | "game_started"
  | "cell_selected"
  | "answer_revealed"
  | "hint_revealed"
  | "cell_claimed"
  | "question_skipped"
  | "team_switched"
  | "timer_updated"
  | "game_ended"
  | "room_normalized";

export interface GameEvent {
  id: string;
  type: GameEventType;
  timestamp: number;
  teamId?: 1 | 2;
  cellId?: string;
  letter?: string;
  questionId?: string;
  message: string;
}

export interface RoomFeatureFlags {
  authReady: boolean;
  aiReady: boolean;
  integrationsReady: boolean;
  powerUpsEnabled: boolean;
  practiceModeEnabled: boolean;
}

export interface RoomSettings {
  defaultTimerSeconds: number;
  gameMode: "classic" | "speed" | "points" | "connection" | "teacher" | "training";
  hintsEnabled: boolean;
  powerUpsEnabled: boolean;
  soundEnabled: boolean;
  reducedMotion: boolean;
  displayTheme: "classic" | "night" | "gold" | "high-contrast" | "school";
}

export interface LocalAnalyticsSnapshot {
  gamesPlayed: number;
  questionsUsed: number;
  mostUsedLetters: string[];
  reviewLetters: string[];
  averageDurationMs: number;
}

export interface RoomState {
  id?: string;
  code?: string;
  roomCode: string;
  status?: RoomLifecycleStatus;
  schemaVersion?: number;
  boardVersion?: string;
  gameTitle: string;
  logoText: string;
  createdAt: number;
  updatedAt?: number;
  gameStatus: "lobby" | "active" | "finished";
  gridSize: 4 | 5 | 6;
  cellLabelStyle: "arabic" | "english" | "numbers";
  winningMode: "path" | "points" | "manual";
  timerSetting: number;
  stealMode: "none" | "steal" | "manual";
  team1: Team;
  team2: Team;
  team1Score: number;
  team2Score: number;
  board: BoardCell[];
  selectedCellId: string;
  activeQuestion: ActiveQuestion | null;
  answerVisibleToHost: boolean;
  answerVisibleToParticipants: boolean;
  hintVisibleToParticipants: boolean;
  activeTeam: 1 | 2;
  timerValue: number;
  timerRunning: boolean;
  timerMax: number;
  winnerMessage: string;
  winnerTeam: 0 | 1 | 2;
  winningPath?: string[];
  questionStatus: "idle" | "active" | "answer_revealed" | "correct" | "wrong" | "skipped" | "time_up";
  gameMode?: "classic" | "speed" | "points" | "connection" | "teacher" | "training";
  activePowerUp?: "none" | "double_points" | "extra_time" | "switch_question";
  buzzerEnabled?: boolean;
  buzzerFirstPlayer?: string;
  buzzerAt?: number;
  roundNumber: number;
  players: Record<string, Player>;
  eventLog?: GameEvent[];
  questionHistory?: GameEvent[];
  participants?: Record<string, Player>;
  settings?: RoomSettings;
  featureFlags?: RoomFeatureFlags;
  analytics?: LocalAnalyticsSnapshot;
}

// ── Arabic letter sets ────────────────────────────────────────
const ARABIC_4x4 = ["ا","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط"];
const ARABIC_5x5 = ["ا","ب","ت","ث","ج","ح","خ","د","ذ","ر","ز","س","ش","ص","ض","ط","ظ","ع","غ","ف","ق","ك","ل","م","ن"];
const ARABIC_6x6 = [...ARABIC_5x5,"هـ","و","ي","ء","ؤ","ئ","ة","ى","لا","آ","إ"];
const ENGLISH_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const LEGACY_DISPLAY_LETTERS: Record<string, string> = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا" };

export function normalizeLetterForDisplay(label: string): string {
  return LEGACY_DISPLAY_LETTERS[label] || label;
}

export function getDefaultLabels(gridSize: 4 | 5 | 6, style: RoomState["cellLabelStyle"]): string[] {
  const count = gridSize * gridSize;
  if (style === "arabic") {
    const src = gridSize === 4 ? ARABIC_4x4 : gridSize === 5 ? ARABIC_5x5 : ARABIC_6x6;
    return Array.from({ length: count }, (_, i) => src[i] ?? String(i + 1));
  }
  if (style === "english") {
    return Array.from({ length: count }, (_, i) => i < ENGLISH_LETTERS.length ? ENGLISH_LETTERS[i] : String(i + 1));
  }
  return Array.from({ length: count }, (_, i) => String(i + 1));
}

export function generateBoard(gridSize: 4 | 5 | 6, cellLabelStyle: RoomState["cellLabelStyle"]): BoardCell[] {
  const labels = getDefaultLabels(gridSize, cellLabelStyle);
  return labels.map((label, i) => ({
    id: `cell-${i}`,
    label,
    position: i,
    row: Math.floor(i / gridSize),
    col: i % gridSize,
    question: "",
    answer: "",
    category: "",
    difficulty: "easy" as const,
    points: 1,
    hint: "",
    explanation: "",
    used: false,
    claimedBy: 0 as const,
  }));
}

export function shuffleBoard(board: BoardCell[]): BoardCell[] {
  const positions = board.map((_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return board.map((cell, i) => ({ ...cell, position: positions[i] }));
}

export function sortedBoard(board: BoardCell[]): BoardCell[] {
  return [...board].sort((a, b) => a.position - b.position);
}

export function normalizeBoardForDisplay(board: BoardCell[], gridSize: RoomState["gridSize"] = 5): BoardCell[] {
  if (!Array.isArray(board) || board.length === 0) return generateBoard(gridSize, "arabic");
  return board.map((cell, index) => {
    const position = typeof cell.position === "number" && Number.isFinite(cell.position) ? cell.position : index;
    return {
      ...cell,
      id: cell.id || `cell-${index}`,
      label: normalizeLetterForDisplay(cell.label || ""),
      position,
      row: typeof cell.row === "number" && Number.isFinite(cell.row) ? cell.row : Math.floor(position / gridSize),
      col: typeof cell.col === "number" && Number.isFinite(cell.col) ? cell.col : position % gridSize,
      question: cell.question || "",
      answer: cell.answer || "",
      category: cell.category || "",
      difficulty: cell.difficulty || "easy",
      points: Number(cell.points) || 1,
      hint: cell.hint || "",
      explanation: cell.explanation || "",
      used: Boolean(cell.used),
      claimedBy: cell.claimedBy === 1 || cell.claimedBy === 2 ? cell.claimedBy : 0,
    };
  });
}

export function roomStatusFromGameStatus(gameStatus: RoomState["gameStatus"]): RoomLifecycleStatus {
  if (gameStatus === "active") return "active";
  if (gameStatus === "finished") return "ended";
  return "setup";
}

export function createGameEvent(type: GameEventType, message: string, details: Partial<GameEvent> = {}): GameEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type,
    timestamp: Date.now(),
    message,
    ...details,
  };
}

export function isLegacyRoom(room: Partial<RoomState> | null | undefined): boolean {
  if (!room) return false;
  const schemaVersion = Number(room.schemaVersion || 0);
  const hasLegacyLetters = Array.isArray(room.board) && room.board.some((cell) => cell?.label === "أ");
  return schemaVersion < CURRENT_SCHEMA_VERSION || room.boardVersion !== CURRENT_BOARD_VERSION || hasLegacyLetters;
}

export function canSafelyUpgradeRoom(room: Partial<RoomState> | null | undefined): boolean {
  if (!room || !Array.isArray(room.board)) return false;
  const gridSize = room.gridSize || 5;
  const hasClaims = room.board.some((cell) => cell.claimedBy !== 0 || cell.used);
  return gridSize === 5 && room.board.length === 25 && !hasClaims && (room.gameStatus || "lobby") === "lobby";
}

export function normalizeRoomState(raw: Partial<RoomState> | null): RoomState | null {
  if (!raw) return null;
  const code = raw.roomCode || raw.code || "";
  const gridSize = ([4, 5, 6].includes(raw.gridSize as number) ? raw.gridSize : 5) as 4 | 5 | 6;
  const base = defaultRoomState(code);
  const merged: RoomState = {
    ...base,
    ...raw,
    id: raw.id || code,
    code,
    roomCode: code,
    schemaVersion: Number(raw.schemaVersion || 1),
    boardVersion: raw.boardVersion || "legacy",
    updatedAt: Number(raw.updatedAt || raw.createdAt || Date.now()),
    gridSize,
    board: normalizeBoardForDisplay(raw.board || base.board, gridSize),
    team1: { ...base.team1, ...(raw.team1 || {}), id: "blue", direction: "left-right", score: raw.team1Score ?? raw.team1?.score ?? 0 },
    team2: { ...base.team2, ...(raw.team2 || {}), id: "red", direction: "top-bottom", score: raw.team2Score ?? raw.team2?.score ?? 0 },
    status: raw.status || roomStatusFromGameStatus(raw.gameStatus || base.gameStatus),
    settings: { ...base.settings!, ...(raw.settings || {}) },
    featureFlags: { ...base.featureFlags!, ...(raw.featureFlags || {}) },
    eventLog: Array.isArray(raw.eventLog) ? raw.eventLog.slice(-80) : base.eventLog,
    questionHistory: Array.isArray(raw.questionHistory) ? raw.questionHistory.slice(-80) : base.questionHistory,
    participants: raw.participants || raw.players || {},
    analytics: { ...base.analytics!, ...(raw.analytics || {}) },
  };
  return merged;
}

export function upgradeRoomBoardVersion(room: RoomState): Partial<RoomState> {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    boardVersion: CURRENT_BOARD_VERSION,
    updatedAt: Date.now(),
    board: normalizeBoardForDisplay(room.board, room.gridSize),
    status: roomStatusFromGameStatus(room.gameStatus),
    eventLog: [
      ...(room.eventLog || []).slice(-79),
      createGameEvent("room_normalized", "تم تحديث اللوحة للإصدار الحالي."),
    ],
  };
}

export function defaultRoomState(roomCode: string): RoomState {
  const gridSize: 4 | 5 | 6 = 5;
  const language: "ar" = "ar";
  const cellLabelStyle: RoomState["cellLabelStyle"] = "arabic";
  return {
    roomCode,
    id: roomCode,
    code: roomCode,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    boardVersion: CURRENT_BOARD_VERSION,
    gameTitle: "وصلة المعرفة",
    logoText: "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "setup",
    gameStatus: "lobby",
    gridSize,
    cellLabelStyle,
    winningMode: "path",
    timerSetting: 0,
    stealMode: "none",
    team1: { id: "blue", name: "الفريق الأزرق", color: "#2563eb", initials: "أز", direction: "left-right", score: 0 },
    team2: { id: "red", name: "الفريق الأحمر", color: "#ef4444", initials: "أح", direction: "top-bottom", score: 0 },
    team1Score: 0,
    team2Score: 0,
    board: generateBoard(gridSize, cellLabelStyle),
    selectedCellId: "",
    activeQuestion: null,
    answerVisibleToHost: false,
    answerVisibleToParticipants: false,
    hintVisibleToParticipants: false,
    activeTeam: 1,
    timerValue: 0,
    timerRunning: false,
    timerMax: 0,
    winnerMessage: "",
    winnerTeam: 0,
    questionStatus: "idle",
    gameMode: "classic",
    activePowerUp: "none",
    buzzerEnabled: false,
    buzzerFirstPlayer: "",
    buzzerAt: 0,
    roundNumber: 1,
    players: {},
    participants: {},
    eventLog: [createGameEvent("room_created", "تم إنشاء الغرفة.")],
    questionHistory: [],
    settings: {
      defaultTimerSeconds: 0,
      gameMode: "classic",
      hintsEnabled: true,
      powerUpsEnabled: false,
      soundEnabled: false,
      reducedMotion: false,
      displayTheme: "classic",
    },
    featureFlags: {
      authReady: false,
      aiReady: false,
      integrationsReady: false,
      powerUpsEnabled: false,
      practiceModeEnabled: true,
    },
    analytics: {
      gamesPlayed: 0,
      questionsUsed: 0,
      mostUsedLetters: [],
      reviewLetters: [],
      averageDurationMs: 0,
    },
  };
}

// ── localStorage ──────────────────────────────────────────────
const LS_LAST_ROOM = "kc_last_room";
function safeGet<T>(key: string, fb: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) as T : fb; } catch { return fb; }
}
function safeSet(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.error(e); }
}
export const loadLastRoomCode = (): string => safeGet<string>(LS_LAST_ROOM, "");
export const saveLastRoomCode = (code: string) => safeSet(LS_LAST_ROOM, code);

// ── BFS path-win ──────────────────────────────────────────────
export function checkWinner(board: BoardCell[], gridSize: number): 0 | 1 | 2 {
  if (findWinningPath(board, gridSize, 1).length) return 1;
  if (findWinningPath(board, gridSize, 2).length) return 2;
  return 0;
}
export function getHexNeighbors(index: number, size: number): number[] {
  const r = Math.floor(index / size), c = index % size;
  // Board rendering uses odd rows shifted to the right (odd-r horizontal layout).
  // Neighbor offsets must follow the same coordinate system to correctly detect
  // curved / zigzag connected paths for Hex wins.
  const deltas = r % 2 === 0
    ? [[-1, 0], [-1, -1], [0, -1], [0, 1], [1, 0], [1, -1]]
    : [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]];
  const out: number[] = [];
  for (const [dr, dc] of deltas) {
    const nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
    out.push(nr * size + nc);
  }
  return out;
}
export function findWinningPath(board: BoardCell[], size: number, team: 1|2): string[] {
  const s = sortedBoard(board);
  const queue: number[] = [];
  const visited = new Set<number>();
  const parent = new Map<number, number>();
  const horizontal = team === 1;

  for (let i = 0; i < s.length; i++) {
    const r = Math.floor(i / size), c = i % size;
    const isStart = horizontal ? c === 0 : r === 0;
    if (isStart && s[i]?.claimedBy === team) { queue.push(i); visited.add(i); }
  }
  while (queue.length) {
    const cur = queue.shift()!;
    const r = Math.floor(cur / size), c = cur % size;
    const isTarget = horizontal ? c === size - 1 : r === size - 1;
    if (isTarget) {
      const path: number[] = [cur];
      let p = cur;
      while (parent.has(p)) { p = parent.get(p)!; path.push(p); }
      path.reverse();
      return path.map(i => s[i].id);
    }
    for (const ni of getHexNeighbors(cur, size)) {
      if (visited.has(ni)) continue;
      if (s[ni]?.claimedBy !== team) continue;
      visited.add(ni);
      parent.set(ni, cur);
      queue.push(ni);
    }
  }
  return [];
}
