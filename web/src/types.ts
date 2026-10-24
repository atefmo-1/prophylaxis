// Shapes of the JSON written by `coach export` (src/coach/stats.py).

export type Color = "white" | "black";
export type Result = "win" | "loss" | "draw";
export type MoveClass = "great" | "best" | "excellent" | "good" | "inaccuracy" | "mistake" | "miss" | "blunder";

export interface Interval {
  k: number;
  n: number;
  rate: number;
  lo: number;
  hi: number;
}

export interface WinRecord {
  games: number;
  win: number;
  loss: number;
  draw: number;
  score: number | null;
}

export interface Example {
  game_id: string;
  ply: number;
  move_number: number;
  fen: string;
  played: string;
  played_uci: string;
  best: string | null;
  best_uci: string | null;
  win_loss: number;
  opponent: string;
  date: number;
  color: Color;
  detail: { [key: string]: unknown };
}

export interface TagInfo {
  kind: "allowed" | "missed" | "clock";
  title: string;
  what: string;
  fix: string;
}

export interface Weakness extends TagInfo {
  tag: string;
  occurrences: number;
  per_game: number;
  games: Interval;
  avg_loss: number;
  impact: number;
  windows: { size: number; last: number; prev: number | null };
  trend: { recent: number; before: number; games: number; direction: "rising" | "falling" | "steady" } | null;
  examples: Example[];
  latest: Example | null;
}

export interface Skill {
  key: string;
  title: string;
  question: string;
  unit: string;
  better: "higher" | "lower";
  recent: number | null;
  before: number | null;
  games: number;
}

export interface PracticePosition {
  id: string;
  game: string;
  ply: number;
  fen: string;
  color: Color;
  san: string;
  uci: string;
  best: string | null;
  best_uci: string | null;
  class: MoveClass;
  before: number;
  after: number;
  reply: string | null;
  tags: MoveTag[];
  opponent: string;
  t: number;
  accept: string[];
  wins: { [uci: string]: number };
}

export interface Bucket {
  label: string;
  moves: number;
  mistake_rate: Interval | null;
}

export interface Overview {
  empty?: boolean;
  generated_at: number;
  player: WinRecord & {
    username: string;
    rating: number;
    peak: number;
    start_rating: number;
    accuracy: number | null;
    opp_accuracy: number | null;
    first_game: number;
    last_game: number;
    moves: number;
    played: number;
    unplayed: number;
    time_classes: string[];
  };
  series: {
    game_id: string;
    t: number;
    rating: number;
    opp_rating: number;
    result: Result;
    accuracy: number | null;
    accuracy_avg10: number | null;
  }[];
  move_quality: { class: MoveClass; mine: number; mine_per_game: number; theirs: number; theirs_per_game: number }[];
  phases: { phase: string; moves: number; games: number; accuracy: number | null; mistakes: number; mistake_rate: Interval | null }[];
  first_mistake_move: number | null;
  games_without_mistake: number;
  colors: (WinRecord & { color: Color; accuracy: number | null })[];
  openings: (WinRecord & { family: string; color: Color; accuracy: number | null })[];
  clock: { buckets: Bucket[]; speed: Bucket[]; median_time_per_move: number | null; lost_on_time: number };
  terminations: { label: string; result: Result; count: number }[];
  conversion: { winning: Interval | null; losing: Interval | null };
  sessions: { win: WinRecord & { accuracy: number | null }; loss: WinRecord & { accuracy: number | null } };
  weaknesses: Weakness[];
  skills: Skill[];
  great_moves: { count: number; examples: Example[] };
  validation: { pairs: { ours: number; chesscom: number }[]; pearson: number | null; mean_abs_diff: number | null };
  method: { engine: string; nodes: number; analysis_version: number };
}

export interface GameSummary {
  id: string;
  t: number;
  color: Color;
  opponent: string;
  opp_rating: number;
  rating: number;
  result: Result;
  ending: string;
  opening: string;
  family: string;
  time_control: string;
  accuracy: number | null;
  opp_accuracy: number | null;
  blunders: number;
  mistakes: number;
  moves: number;
  habit: { tag: string; title: string } | null;
}

export interface MoveTag {
  tag: string;
  detail: { [key: string]: unknown };
}

export interface Move {
  ply: number;
  color: Color;
  mine: boolean;
  san: string;
  uci: string;
  fen: string;
  clock: number | null;
  time_spent: number | null;
  win_white: number;
  eval_cp: number | null;
  eval_mate: number | null;
  win_loss: number;
  class: MoveClass;
  best: string | null;
  best_uci: string | null;
  best_line: string[];
  reply_line: string[];
  phase: string;
  tags: MoveTag[];
  decided: boolean;
  retry: { accept: string[]; wins: { [uci: string]: number } } | null;
}

export interface GameReview {
  game: {
    id: string;
    url: string;
    t: number;
    color: Color;
    opponent: string;
    opp_rating: number;
    rating: number;
    result: Result;
    ending: string;
    opening: string;
    time_control: string;
    accuracy: number | null;
    opp_accuracy: number | null;
    chesscom_accuracy: number | null;
    rating_change: number | null;
  };
  phases: { phase: string; first_ply: number; moves: number; mistakes: number; accuracy: number | null; worst_class: MoveClass }[];
  habits: { [tag: string]: { rank: number | null; recent_games: number; window: number } };
  start_fen: string;
  start_win_white: number;
  moves: Move[];
  key_moments: number[];
  summary: { mine: Partial<{ [k in MoveClass]: number }>; theirs: Partial<{ [k in MoveClass]: number }> };
  tag_info: { [tag: string]: TagInfo };
}
