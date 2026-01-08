// 種族
export type Race = 'elf' | 'goblin' | 'human' | 'demon';

// カードのランク
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

// カードの種類
export interface Card {
  id: string;
  rank: Rank;
  race: Race;
  value: number; // 点数 (J,Q,Kは0)
}

// プレイヤー
export interface Player {
  id: 'player1' | 'player2';
  name: string;
  hand: Card[];
  field: FieldCard[];
  kings: number; // 場に出ている王の数
}

// 場に出ているカード（騎士が付いている可能性がある）
export interface FieldCard {
  card: Card;
  attachedKnights: Card[]; // 付いている騎士
  owner: 'player1' | 'player2'; // 元の所有者
  controller: 'player1' | 'player2'; // 現在の支配者
}

// ゲームの状態
export interface GameState {
  deck: Card[];
  scrapPile: Card[];
  player1: Player;
  player2: Player;
  currentPlayer: 'player1' | 'player2';
  phase: GamePhase;
  winner: 'player1' | 'player2' | null;
  turnCount: number;
  consecutivePasses: number;
  selectedCard: Card | null;
  selectedAction: ActionType | null;
  targetCard: FieldCard | null;
  message: string;
  opponentHandRevealed: { player1: boolean; player2: boolean };
  sevenChoices?: Card[]; // 7の効果で選択する山札トップ2枚
}

// ゲームフェーズ
export type GamePhase = 
  | 'waiting'        // ゲーム開始待ち
  | 'selectAction'   // アクション選択中
  | 'selectTarget'   // ターゲット選択中
  | 'opponentDiscard'// 相手が手札を捨てる（4の効果）
  | 'sevenChoice'    // 7の選択
  | 'gameOver';      // ゲーム終了

// アクションの種類
export type ActionType = 
  | 'draw'           // ドロー
  | 'playPoint'      // 点数カードとして配置
  | 'playOneOff'     // ワンオフ効果
  | 'playPermanent'  // 永続効果
  | 'playKnight'     // 騎士で略奪（直接実行用）
  | 'scuttle'        // スカトル
  | 'pass';          // パス

// 種族相性の結果
export type RaceMatchup = 'win' | 'lose' | 'draw';

// 種族の絵文字
export const RACE_EMOJI: Record<Race, string> = {
  elf: '🧝',
  goblin: '👺',
  human: '👤',
  demon: '😈',
};

// 種族の日本語名
export const RACE_NAME: Record<Race, string> = {
  elf: 'エルフ',
  goblin: 'ゴブリン',
  human: '人間',
  demon: 'デーモン',
};

// 役職名（絵札用）
export const ROLE_NAME: Record<string, string> = {
  J: '騎士',
  Q: '魔術師',
  K: '王',
};

// 勝利に必要な点数（王の枚数別）
export const WINNING_POINTS: Record<number, number> = {
  0: 21,
  1: 14,
  2: 10,
  3: 7,
  4: 5,
};

