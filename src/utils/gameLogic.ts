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

// ============================================
// ユーティリティ関数
// ============================================

// ランクから点数を取得
export function getRankValue(rank: Rank): number {
  if (rank === 'A') return 1;
  if (rank === 'J' || rank === 'Q' || rank === 'K') return 0;
  return parseInt(rank);
}

// カードの効果説明を取得
export function getCardEffect(card: Card): string {
  const effectMap: Record<string, string> = {
    'A': '相手の点数カードを1つ破壊',
    '2': '相手の永続効果を1つ破壊',
    '3': '墓地からカードを1枚回収',
    '4': '相手は手札を2枚捨てる',
    '5': '山札から2枚ドロー',
    '6': '全ての永続効果を破壊',
    '7': '山札を見て1枚ドロー',
    '8': '相手の手札を見れる（永続）',
    '9': '相手のカード1枚を手札に戻す',
    '10': '相手の点数カードを手札に戻す',
    'J': '相手の点数カードを略奪',
    'Q': '点数カードを効果から保護',
    'K': '勝利点数を-7する',
  };
  return effectMap[card.rank] || '';
}

// カードIDを生成
function generateCardId(race: Race, rank: Rank): string {
  return `${race}-${rank}`;
}

// 深いコピーでプレイヤーを複製
function clonePlayer(player: Player): Player {
  return {
    ...player,
    hand: [...player.hand],
    field: player.field.map(fc => ({
      ...fc,
      card: { ...fc.card },
      attachedKnights: [...fc.attachedKnights],
    })),
  };
}

// 深いコピーでゲーム状態を複製
function cloneGameState(state: GameState): GameState {
  return {
    ...state,
    deck: [...state.deck],
    scrapPile: [...state.scrapPile],
    player1: clonePlayer(state.player1),
    player2: clonePlayer(state.player2),
    opponentHandRevealed: { ...state.opponentHandRevealed },
  };
}

// 相手プレイヤーIDを取得
export function getOpponent(playerId: 'player1' | 'player2'): 'player1' | 'player2' {
  return playerId === 'player1' ? 'player2' : 'player1';
}

// ============================================
// デッキ生成
// ============================================

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

export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================
// ゲーム初期化
// ============================================

function createPlayer(id: 'player1' | 'player2', name: string): Player {
  return {
    id,
    name,
    hand: [],
    field: [],
    kings: 0,
  };
}

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
    currentPlayer: 'player1',
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

// ============================================
// 種族相性（スカトル用）
// ============================================

// 強さ: エルフ(最弱) < ゴブリン < 人間 < デーモン(最強)
// 例外: エルフはデーモンにのみ勝てる
export function getRaceMatchup(attacker: Race, defender: Race): RaceMatchup {
  if (attacker === defender) return 'draw';
  
  const strength: Record<Race, number> = {
    elf: 0,
    goblin: 1,
    human: 2,
    demon: 3,
  };
  
  // 特殊ルール：エルフはデーモンにのみ勝てる
  if (attacker === 'elf' && defender === 'demon') return 'win';
  if (attacker === 'demon' && defender === 'elf') return 'lose';
  
  if (strength[attacker] > strength[defender]) return 'win';
  if (strength[attacker] < strength[defender]) return 'lose';
  
  return 'draw';
}

// スカトル可否判定（ファンタジー改変版：同数字は種族相性で勝敗）
// result: 'win'=相手のみ捨て札, 'fail'=自分のみ捨て札, 'mutual'=両方捨て札, 'blocked'=不可
export function canScuttle(
  attackerCard: Card, 
  defenderCard: FieldCard,
  defenderHasQueen: boolean
): { canScuttle: boolean; result: 'win' | 'fail' | 'mutual' | 'blocked' } {
  // 魔術師で保護されている場合
  if (defenderHasQueen) {
    return { canScuttle: false, result: 'blocked' };
  }
  
  const attackerValue = attackerCard.value;
  const defenderValue = defenderCard.card.value;
  
  // 点数カード同士でないとスカトル不可
  if (attackerValue === 0 || defenderValue === 0) {
    return { canScuttle: false, result: 'blocked' };
  }
  
  // 攻撃側の数字が大きい場合は成功（相打ち）
  if (attackerValue > defenderValue) {
    return { canScuttle: true, result: 'mutual' };
  }
  
  // 攻撃側の数字が小さい場合は不可
  if (attackerValue < defenderValue) {
    return { canScuttle: false, result: 'blocked' };
  }
  
  // 同じ数字の場合は種族相性で勝敗を判定
  const matchup = getRaceMatchup(attackerCard.race, defenderCard.card.race);
  
  switch (matchup) {
    case 'win':
      // 種族有利 → 相手のカードのみ捨て札
      return { canScuttle: true, result: 'win' };
    case 'lose':
      // 種族不利 → 自分のカードのみ捨て札（スカトル失敗）
      return { canScuttle: false, result: 'fail' };
    case 'draw':
      // 同じ種族 → 両方捨て札
      return { canScuttle: true, result: 'mutual' };
  }
}

// ============================================
// 点数計算（両方のフィールドからcontrollerが自分のカードを合計）
// ============================================

export function calculatePlayerPointsFromState(state: GameState, playerId: 'player1' | 'player2'): number {
  let points = 0;
  
  // 両プレイヤーのフィールドを確認
  const allFieldCards = [...state.player1.field, ...state.player2.field];
  
  for (const fieldCard of allFieldCards) {
    // 自分が支配しているカードの点数をカウント
    // 永続効果として出した8は value=0 なのでカウントされない
    if (fieldCard.controller === playerId && fieldCard.card.value > 0) {
      points += fieldCard.card.value;
    }
  }
  
  return points;
}

// 後方互換性のため（単体Playerからは計算できないのでstateが必要）
export function calculatePlayerPoints(player: Player): number {
  let points = 0;
  for (const fieldCard of player.field) {
    if (fieldCard.controller === player.id && fieldCard.card.value > 0) {
      points += fieldCard.card.value;
    }
  }
  return points;
}

// 勝利条件チェック（両フィールドから正確に計算）
export function checkWinCondition(state: GameState): 'player1' | 'player2' | null {
  const p1Points = calculatePlayerPointsFromState(state, 'player1');
  const p2Points = calculatePlayerPointsFromState(state, 'player2');
  
  const p1Target = WINNING_POINTS[Math.min(state.player1.kings, 4)];
  const p2Target = WINNING_POINTS[Math.min(state.player2.kings, 4)];
  
  if (p1Points >= p1Target) return 'player1';
  if (p2Points >= p2Target) return 'player2';
  
  return null;
}

// ============================================
// 状態チェック
// ============================================

export function hasQueen(player: Player): boolean {
  return player.field.some(fc => 
    fc.card.rank === 'Q' && fc.controller === player.id
  );
}

export function hasGlasses(player: Player): boolean {
  return player.field.some(fc => 
    fc.card.rank === '8' && 
    fc.card.value === 0 && // 永続効果として出されている
    fc.controller === player.id
  );
}

// ============================================
// カード操作
// ============================================

// カードを場に出す
export function playCardToField(
  state: GameState, 
  playerId: 'player1' | 'player2', 
  card: Card,
  asPermanent: boolean = false
): GameState {
  const newState = cloneGameState(state);
  const player = newState[playerId];
  
  // 手札から削除
  player.hand = player.hand.filter(c => c.id !== card.id);
  
  // 場に追加（8を永続として出す場合はvalue=0にする）
  const fieldCard: FieldCard = {
    card: (asPermanent && card.rank === '8') 
      ? { ...card, value: 0 } 
      : { ...card },
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
  const newState = cloneGameState(state);
  newState.scrapPile.push({ ...card });
  return newState;
}

// ============================================
// ターン管理
// ============================================

export function endTurn(state: GameState): GameState {
  const newState = cloneGameState(state);
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
  
  const newState = cloneGameState(state);
  const player = newState[newState.currentPlayer];
  const drawnCard = newState.deck.shift()!;
  player.hand.push(drawnCard);
  newState.consecutivePasses = 0;
  
  return endTurn(newState);
}

// パス
export function pass(state: GameState): GameState {
  if (state.deck.length > 0) {
    return { ...state, message: '山札があるのでパスできません' };
  }
  
  const newState = cloneGameState(state);
  newState.consecutivePasses++;
  
  // 3回連続パスで引き分け
  if (newState.consecutivePasses >= 3) {
    newState.phase = 'gameOver';
    newState.message = '引き分け！';
    return newState;
  }
  
  return endTurn(newState);
}
