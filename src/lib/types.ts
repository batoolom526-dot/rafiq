export type Lang = 'en' | 'ar';
export type Palette = 'muse' | 'thinker' | 'bloom';
export type Mode = 'light' | 'dark' | 'system';
export type Energy = 'high' | 'normal' | 'low' | 'overwhelmed' | 'scattered';
export type SpaceId = 'study' | 'work' | 'health' | 'home' | 'money' | 'growth';
export type TaskKind = 'task' | 'exam' | 'assignment' | 'habit';
export type Pose = 'laugh' | 'focus' | 'eat' | 'sleep' | 'cheer' | 'calm' | 'think' | 'wave';
export type Dialect = 'en' | 'msa' | 'eg' | 'gulf' | 'lev' | 'iq' | 'ma';
export type Tone = 'gentle' | 'fun' | 'serious' | 'tough';

export interface Anchor {
  id: string;
  label: string;
  time: string; // HH:MM
  minutes: number;
  kind: 'meal' | 'class' | 'work' | 'prayer' | 'other';
}

export interface Profile {
  name: string;
  lang: Lang;
  palette: Palette;
  mode: Mode;
  spaces: SpaceId[];
  sleep: string; // HH:MM
  wake: string; // HH:MM
  anchors: Anchor[];
  interests: string[];
  toughLove: boolean;
  onboarded: boolean;
  createdAt: number;
}

export interface Step {
  id: string;
  title: string;
  minutes: number;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  space: SpaceId;
  kind: TaskKind;
  notes: string;
  due?: string; // YYYY-MM-DD
  scheduledFor?: string; // YYYY-MM-DD
  importance: 1 | 2 | 3;
  difficulty: 1 | 2 | 3;
  estimateMin: number;
  actualMin: number;
  steps: Step[];
  status: 'todo' | 'done';
  postponed: number;
  postponeReasons: string[];
  createdAt: number;
  doneAt?: number;
  reentry?: string; // "where I left off"
  parentExamId?: string;
}

export interface Session {
  id: string;
  taskId?: string;
  title: string;
  start: number;
  end: number;
  plannedMin: number;
  actualMin: number;
  kind: 'focus' | 'start';
  energy: Energy;
  completed: boolean;
}

export interface FocusState {
  phase: 'idle' | 'focus' | 'break' | 'paused';
  taskId?: string;
  title: string;
  plannedMin: number;
  breakMin: number;
  endsAt: number; // ms timestamp
  remainingMs: number; // used while paused
  startedAt: number;
  pausedFrom?: 'focus' | 'break';
  kind: 'focus' | 'start';
}

export interface ParkItem {
  id: string;
  text: string;
  createdAt: number;
  done: boolean;
}

export interface Checkin {
  date: string;
  energy: Energy;
  availableMin: number;
  ts: number;
}

export interface TrackerEntry {
  id: string;
  date: string;
  value: number;
  note: string;
}

export interface Tracker {
  id: string;
  name: string;
  space: SpaceId;
  unit: string;
  higherIsBetter: boolean;
  goal?: number;
  entries: TrackerEntry[];
}

export interface Card {
  id: string;
  front: string;
  back: string;
  due: string; // YYYY-MM-DD
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
}

export interface Source {
  id: string;
  name: string;
  text: string;
  addedAt: number;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface QuizResult {
  date: string;
  score: number;
  total: number;
  weak: string[];
}

export interface Notebook {
  id: string;
  title: string;
  space: SpaceId;
  sources: Source[];
  cards: Card[];
  chat: ChatTurn[];
  summary?: string;
  guide?: string;
  quizzes: QuizResult[];
  weakTopics: string[];
  createdAt: number;
  updatedAt: number;
}

export interface Ledger {
  id: string;
  ts: number;
  amount: number;
  reason: string;
}

export interface RewardItem {
  id: string;
  title: string;
  cost: number;
  redeemed: number;
}

export interface Rewards {
  sparks: number;
  ledger: Ledger[];
  bank: RewardItem[];
  owned: string[]; // shop item ids
}

export interface Memory {
  id: string;
  text: string;
  ts: number;
  source: 'reflection' | 'postpone' | 'goal' | 'dump';
}

export interface Reflection {
  id: string;
  date: string;
  text: string;
  win: string;
}

export interface MonthlyReport {
  month: string; // YYYY-MM
  createdAt: number;
  stats: ReportStats;
  areas: { title: string; why: string; plan: string }[];
  narrative?: string;
}

export interface ReportStats {
  focusMin: number;
  sessions: number;
  starts: number;
  tasksDone: number;
  activeDays: number;
  bySpace: Record<string, number>;
  bestHour: number | null;
  mirror: number | null;
  mostPostponed: string | null;
  sparks: number;
}

export interface CharacterInfo {
  sheetUrl?: string; // asset url or bundled sample path
  source: 'none' | 'sample' | 'upload';
  updatedAt: number;
}

export interface Settings {
  aiProvider: 'auto' | 'claude' | 'gemini' | 'off';
  geminiKey: string;
  geminiModel: string;
  voice: 'buttery' | 'airy' | 'glassy' | 'rounded';
  voiceRate: number;
  sound: 'off' | 'brown' | 'pink' | 'rain';
  chime: boolean;
}

export interface DialectStats {
  counts: Partial<Record<Dialect, number>>;
}

export interface AppData {
  profile: Profile;
  settings: Settings;
  tasks: Task[];
  sessions: Session[];
  focus: FocusState;
  park: ParkItem[];
  checkins: Checkin[];
  trackers: Tracker[];
  notebooks: Notebook[];
  rewards: Rewards;
  memories: Memory[];
  reflections: Reflection[];
  reports: MonthlyReport[];
  character: CharacterInfo;
  dialect: DialectStats;
  lastOpen: number;
  prevOpen: number;
}
