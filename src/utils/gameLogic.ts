import type { 
  Card, 
  Race, 
  Rank, 
  GameState, 
  Player, 
  FieldCard, 
  RaceMatchup
} from '../types/game';
import { WINNING_POINTS } from '../types/game';

// ランクから点数を取得
export function getRankValue(rank: Rank): number {
  if (rank === 'A') return 1;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 0;
  return parseInt(rank);
}

// カードIDを生成
function generateCardId(race: Race, rank: Rank): string {
  return `${race}-${rank}`;
}

// デッキを生成
export function createDeck(): Card[] {
  const races: Race[] = ['elf', 'goblin', 'human', 'demon'];
  const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  
  const deck: Card[] = [];
  
  for (const race of races) {
    for (const rank of ranks) {
      deck.push({
        id: generateCardId(race, rank),
        rank,
        race,
        value: getRankValue(rank),
      });
    }
  }
  
  return deck;
}

// デッキをシャッフル
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// プレイヤーを初期化
function createPlayer(id: 'player1' | 'player2', name: string): Player {
  return {
    id,
    name,
    hand: [],
    field: [],
    kings: 0,
  };
}

// ゲームの初期状態を作成
export function createInitialGameState(): GameState {
  const deck = shuffleDeck(createDeck());
  
  const player1 = createPlayer('player1', 'プレイヤー1');
  const player2 = createPlayer('player2', 'プレイヤー2');
  
  // カードを配る（先攻5枚、後攻6枚）
  player1.hand = deck.splice(0, 5);
  player2.hand = deck.splice(0, 6);
  
  return {
    deck,
    scrapPile: [],
    player1,
    player2,
    currentPlayer: 'player1', // 先攻
    phase: 'selectAction',
    winner: null,
    turnCount: 1,
    consecutivePasses: 0,
    selectedCard: null,
    selectedAction: null,
    targetCard: null,
    message: 'プレイヤー1のターン',
    opponentHandRevealed: { player1: false, player2: false },
  };
}

// 種族相性を判定（同数字スカトル時のみ使用）
// 強さ: エルフ(0) < ゴブリン(1) < 人間(2) < デーモン(3)
// 例外: エルフはデーモンにのみ勝てる
export function getRaceMatchup(attacker: Race, defender: Race): RaceMatchup {
  // 同じ種族は相打ち
  if (attacker === defender) return 'draw';
  
  // 種族の強さ（数字が大きいほど強い）
  const strength: Record<Race, number> = {
    elf: 0,      // 最弱
    goblin: 1,
    human: 2,
    demon: 3,    // 最強
  };
  
  // 特殊ルール：エルフはデーモンにのみ勝てる
  if (attacker === 'elf' && defender === 'demon') return 'win';
  if (attacker === 'demon' && defender === 'elf') return 'lose';
  
  // 通常の強さ比較
  if (strength[attacker] > strength[defender]) return 'win';
  if (strength[attacker] < strength[defender]) return 'lose';
  
  return 'draw';
}

// スカトルが可能かどうか判定
export function canScuttle(
  attackerCard: Card, 
  defenderCard: FieldCard,
  hasQueen: boolean
): { canScuttle: boolean; result: 'success' | 'fail' | 'mutual' | 'blocked' } {
  // 魔術師で保護されている場合
  if (hasQueen) {
    return { canScuttle: false, result: 'blocked' };
  }
  
  const attackerValue = attackerCard.value;
  const defenderValue = defenderCard.card.value;
  
  // 絵札は点数カードではないのでスカトル不可
  if (attackerValue === 0 || defenderValue === 0) {
    return { canScuttle: false, result: 'blocked' };
  }
  
  // 攻撃側の数字が大きい場合は無条件で成功
  if (attackerValue > defenderValue) {
    return { canScuttle: true, result: 'success' };
  }
  
  // 攻撃側の数字が小さい場合は不可
  if (attackerValue < defenderValue) {
    return { canScuttle: false, result: 'blocked' };
  }
  
  // 同じ数字の場合は種族相性で判定
  const matchup = getRaceMatchup(attackerCard.race, defenderCard.card.race);
  
  switch (matchup) {
    case 'win':
      return { canScuttle: true, result: 'success' };
    case 'lose':
      return { canScuttle: true, result: 'fail' }; // スカトル失敗（自分のカードのみ捨て）
    case 'draw':
      return { canScuttle: true, result: 'mutual' }; // 相打ち
  }
}

// プレイヤーの合計点数を計算
export function calculatePlayerPoints(player: Player): number {
  let points = 0;
  
  for (const fieldCard of player.field) {
    // 自分が支配しているカードのみカウント
    if (fieldCard.controller === player.id && fieldCard.card.value > 0) {
      points += fieldCard.card.value;
    }
  }
  
  // 相手の場にあるが騎士で奪っているカードもカウント
  // （これはfieldCardのcontrollerで管理される）
  
  return points;
}

// 勝利条件をチェック
export function checkWinCondition(state: GameState): 'player1' | 'player2' | null {
  const p1Points = calculatePlayerPoints(state.player1);
  const p2Points = calculatePlayerPoints(state.player2);
  
  const p1Target = WINNING_POINTS[Math.min(state.player1.kings, 4)];
  const p2Target = WINNING_POINTS[Math.min(state.player2.kings, 4)];
  
  if (p1Points >= p1Target) return 'player1';
  if (p2Points >= p2Target) return 'player2';
  
  return null;
}

// 魔術師を持っているかチェック
export function hasQueen(player: Player): boolean {
  return player.field.some(fc => fc.card.rank === 'Q' && fc.controller === player.id);
}

// 8（メガネ）を持っているかチェック
export function hasGlasses(player: Player): boolean {
  return player.field.some(fc => 
    fc.card.rank === '8' && 
    fc.card.value === 0 && // 永続効果として出されている
    fc.controller === player.id
  );
}

// 相手プレイヤーを取得
export function getOpponent(playerId: 'player1' | 'player2'): 'player1' | 'player2' {
  return playerId === 'player1' ? 'player2' : 'player1';
}

// カードを手札から場に出す
export function playCardToField(
  state: GameState, 
  playerId: 'player1' | 'player2', 
  card: Card,
  asPermanent: boolean = false
): GameState {
  const newState = { ...state };
  const player = newState[playerId];
  
  // 手札から削除
  player.hand = player.hand.filter(c => c.id !== card.id);
  
  // 場に追加
  const fieldCard: FieldCard = {
    card: asPermanent && card.rank === '8' ? { ...card, value: 0 } : card,
    attachedKnights: [],
    owner: playerId,
    controller: playerId,
  };
  
  player.field.push(fieldCard);
  
  // 王の場合はカウントを増やす
  if (card.rank === 'K') {
    player.kings++;
  }
  
  return newState;
}

// カードを捨て札に送る
export function sendToScrap(state: GameState, card: Card): GameState {
  const newState = { ...state };
  newState.scrapPile = [...newState.scrapPile, card];
  return newState;
}

// ターンを終了して次のプレイヤーへ
export function endTurn(state: GameState): GameState {
  const newState = { ...state };
  newState.currentPlayer = getOpponent(state.currentPlayer);
  newState.turnCount++;
  newState.phase = 'selectAction';
  newState.selectedCard = null;
  newState.selectedAction = null;
  newState.targetCard = null;
  newState.message = `${newState.currentPlayer === 'player1' ? 'プレイヤー1' : 'プレイヤー2'}のターン`;
  
  // 勝利条件チェック
  const winner = checkWinCondition(newState);
  if (winner) {
    newState.winner = winner;
    newState.phase = 'gameOver';
    newState.message = `${winner === 'player1' ? 'プレイヤー1' : 'プレイヤー2'}の勝利！`;
  }
  
  return newState;
}

// ドロー
export function drawCard(state: GameState): GameState {
  if (state.deck.length === 0) {
    return { ...state, message: '山札がありません' };
  }
  
  const newState = { ...state };
  const player = newState[newState.currentPlayer];
  const drawnCard = newState.deck.shift()!;
  player.hand = [...player.hand, drawnCard];
  newState.consecutivePasses = 0;
  
  return endTurn(newState);
}

// パス
export function pass(state: GameState): GameState {
  if (state.deck.length > 0) {
    return { ...state, message: '山札があるのでパスできません' };
  }
  
  const newState = { ...state };
  newState.consecutivePasses++;
  
  // 3回連続パスで引き分け
  if (newState.consecutivePasses >= 3) {
    newState.phase = 'gameOver';
    newState.message = '引き分け！';
    return newState;
  }
  
  return endTurn(newState);
}

