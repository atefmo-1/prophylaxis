// Generated from src/coach/stats.py (TAG_INFO, ENDINGS) so the extension words habits exactly like the site.
import type { TagInfo } from "../types";

export const TAG_INFO: Record<string, TagInfo> = {
  "hanging_piece": {
    "kind": "allowed",
    "title": "Leaving pieces hanging",
    "what": "After your move, a piece could be taken for free or by a cheaper piece.",
    "fix": "Before you move, check every piece of yours: is it attacked, and is it defended?"
  },
  "allowed_fork": {
    "kind": "allowed",
    "title": "Walking into forks",
    "what": "Your move let one enemy piece attack two of yours at once.",
    "fix": "Look for squares where an enemy knight or pawn could hit two of your pieces."
  },
  "allowed_mate": {
    "kind": "allowed",
    "title": "Missing checkmate threats",
    "what": "Your move allowed a forced checkmate.",
    "fix": "Before every move, list your opponent's checks. Can any of them lead to mate?"
  },
  "back_rank_mate": {
    "kind": "allowed",
    "title": "Back-rank weakness",
    "what": "You allowed mate on your back rank, with your king boxed in by its own pawns.",
    "fix": "After castling, push one pawn in front of your king to give it an escape square."
  },
  "lost_material": {
    "kind": "allowed",
    "title": "Losing material to threats",
    "what": "Your move let your opponent win material with a short sequence of moves.",
    "fix": "Look one move deeper: after your opponent's best reply, is anything of yours under attack?"
  },
  "allowed_stalemate": {
    "kind": "allowed",
    "title": "Stalemating won games",
    "what": "You were winning and left your opponent with no legal moves, which is a draw.",
    "fix": "When far ahead, make sure the enemy king always has a move unless you are giving mate."
  },
  "missed_free_piece": {
    "kind": "missed",
    "title": "Missing free pieces",
    "what": "You could win a piece for free, or with a cheaper piece, and played something else.",
    "fix": "Start every move by asking: what can I capture, and is it defended?"
  },
  "missed_fork": {
    "kind": "missed",
    "title": "Missing forks",
    "what": "You had a move that attacked two pieces at once and won material.",
    "fix": "Look for checks and for moves that attack two things at the same time."
  },
  "missed_mate": {
    "kind": "missed",
    "title": "Missing checkmates",
    "what": "You had a forced checkmate and played something else.",
    "fix": "Look at every check you have before considering any other move."
  },
  "missed_tactic": {
    "kind": "missed",
    "title": "Missing winning tactics",
    "what": "You had a check or capture that started a sequence winning material.",
    "fix": "When enemy pieces are loose or lined up, look for forcing moves: checks, captures, threats."
  },
  "allowed_discovered_attack": {
    "kind": "allowed",
    "title": "Walking into discovered attacks",
    "what": "Your move let your opponent move one piece out of the way and attack with the piece behind it.",
    "fix": "Watch enemy queens, rooks and bishops that sit behind their own pieces and point at yours."
  },
  "allowed_pin": {
    "kind": "allowed",
    "title": "Walking into pins",
    "what": "Your move let your opponent pin one of your pieces to a more valuable one behind it.",
    "fix": "Don't line up your king or queen behind another piece on a line an enemy bishop, rook or queen can reach."
  },
  "allowed_skewer": {
    "kind": "allowed",
    "title": "Walking into skewers",
    "what": "Your move let a long-range piece attack a valuable piece of yours and win the one behind it.",
    "fix": "Keep your king and queen off lines shared with your other pieces when enemy rooks, bishops or queens are near."
  },
  "trapped_piece": {
    "kind": "allowed",
    "title": "Getting pieces trapped",
    "what": "Your move left one of your pieces with no safe square, so it could be attacked and won.",
    "fix": "Before sending a piece deep into enemy territory, check that it has a safe way back."
  },
  "missed_discovered_attack": {
    "kind": "missed",
    "title": "Missing discovered attacks",
    "what": "You could move one piece out of the way with a threat and attack with the piece behind it.",
    "fix": "Look at your queen, rooks and bishops: which of your own pieces block them, and what if that piece moved with a threat?"
  },
  "missed_pin": {
    "kind": "missed",
    "title": "Missing pins",
    "what": "You had a move that pinned an enemy piece to a more valuable one and won material.",
    "fix": "Look for enemy pieces lined up with their king or queen on a line your bishop, rook or queen can reach."
  },
  "missed_skewer": {
    "kind": "missed",
    "title": "Missing skewers",
    "what": "You could attack a valuable enemy piece and win the one behind it once it moved.",
    "fix": "When the enemy king or queen shares a line with another piece, look for a check or attack along that line."
  },
  "missed_trapped_piece": {
    "kind": "missed",
    "title": "Missing trapped pieces",
    "what": "An enemy piece had no safe square, and you could have attacked it and won it.",
    "fix": "When an enemy piece is far from home, count its escape squares: can you take them all away?"
  },
  "time_pressure": {
    "kind": "clock",
    "title": "Blundering under time pressure",
    "what": "A mistake or blunder played with less than a minute on your clock.",
    "fix": "Spend less time on routine moves early so you have time left for hard positions."
  },
  "rushed": {
    "kind": "clock",
    "title": "Moving too fast",
    "what": "A mistake or blunder played in under 3 seconds while you still had time.",
    "fix": "Take five seconds before each move to ask what your opponent's last move threatens."
  }
};

export const ENDINGS: Record<string, string> = {
  "win:checkmated": "Won by checkmate",
  "win:resigned": "Won by resignation",
  "win:timeout": "Won on time",
  "win:abandoned": "Won, opponent left",
  "loss:checkmated": "Lost by checkmate",
  "loss:resigned": "Resigned",
  "loss:timeout": "Lost on time",
  "loss:abandoned": "Left the game",
  "draw:stalemate": "Draw by stalemate",
  "draw:repetition": "Draw by repetition",
  "draw:agreed": "Draw agreed",
  "draw:insufficient": "Draw, insufficient material",
  "draw:timevsinsufficient": "Draw, time out vs. insufficient material",
  "draw:50move": "Draw, 50-move rule"
};
