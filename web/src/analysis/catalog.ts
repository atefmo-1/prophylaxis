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
