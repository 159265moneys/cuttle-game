import type { GameState, Card, FieldCard } from '../types/game';
import { 
  calculatePlayerPoints, 
  hasQueen, 
  canScuttle
} from './gameLogic';
import { WINNING_POINTS } from '../types/game';

interface AIAction {
  type: 'draw' | 'playPoint' | 'playOneOff' | 'playPermanent' | 'scuttle' | 'pass';
  card?: Card;
  target?: FieldCard | Card;
}

// CPUのターンを実行
export function getCPUAction(state: GameState): AIAction {
  const cpuId = 'player2';
  const playerId = 'player1';
  const cpu = state[cpuId];
  const player = state[playerId];
  
  const cpuPoints = calculatePlayerPoints(cpu);
  const playerPoints = calculatePlayerPoints(player);
  const cpuTarget = WINNING_POINTS[Math.min(cpu.kings, 4)];
  const playerTarget = WINNING_POINTS[Math.min(player.kings, 4)];
  
  // 手札を分類
  const pointCards = cpu.hand.filter(c => c.value > 0);
  const royalCards = cpu.hand.filter(c => c.rank === 'J' || c.rank === 'Q' || c.rank === 'K');
  const eightCards = cpu.hand.filter(c => c.rank === '8');
  
  // 1. 勝てるなら点数カードを出す
  for (const card of pointCards.sort((a, b) => b.value - a.value)) {
    if (cpuPoints + card.value >= cpuTarget) {
      return { type: 'playPoint', card };
    }
  }
  
  // 2. 相手が勝ちそうなら妨害
  if (playerPoints >= playerTarget - 5) {
    // Aで相手の高得点カードを破壊
    const aceCard = cpu.hand.find(c => c.rank === 'A');
    if (aceCard && !hasQueen(player)) {
      const targetField = player.field
        .filter(fc => fc.card.value > 0 && fc.controller === playerId)
        .sort((a, b) => b.card.value - a.card.value)[0];
      if (targetField) {
        return { type: 'playOneOff', card: aceCard, target: targetField };
      }
    }
    
    // スカトルで妨害
    for (const card of pointCards.sort((a, b) => b.value - a.value)) {
      const targets = player.field.filter(fc => 
        fc.card.value > 0 && 
        fc.controller === playerId &&
        canScuttle(card, fc, hasQueen(player)).canScuttle
      );
      if (targets.length > 0) {
        const bestTarget = targets.sort((a, b) => b.card.value - a.card.value)[0];
        return { type: 'scuttle', card, target: bestTarget };
      }
    }
  }
  
  // 3. 王を出す（勝利条件緩和）
  const kingCard = royalCards.find(c => c.rank === 'K');
  if (kingCard && cpu.kings < 2) {
    return { type: 'playPermanent', card: kingCard };
  }
  
  // 4. 魔術師を出す（防御）
  const queenCard = royalCards.find(c => c.rank === 'Q');
  if (queenCard && !hasQueen(cpu) && cpu.field.some(fc => fc.card.value > 0)) {
    return { type: 'playPermanent', card: queenCard };
  }
  
  // 5. 相手の永続カードを破壊
  const twoCard = cpu.hand.find(c => c.rank === '2');
  if (twoCard) {
    const targetPermanent = player.field.find(fc => 
      fc.card.rank === 'Q' || fc.card.rank === 'K' || 
      (fc.card.rank === '8' && fc.card.value === 0)
    );
    if (targetPermanent) {
      return { type: 'playOneOff', card: twoCard, target: targetPermanent };
    }
  }
  
  // 6. 高得点カードを配置
  const highPointCard = pointCards.sort((a, b) => b.value - a.value)[0];
  if (highPointCard && highPointCard.value >= 7) {
    return { type: 'playPoint', card: highPointCard };
  }
  
  // 7. 5を使ってドロー
  const fiveCard = cpu.hand.find(c => c.rank === '5');
  if (fiveCard && state.deck.length >= 2) {
    return { type: 'playOneOff', card: fiveCard };
  }
  
  // 8. 騎士で相手のカードを奪う
  const jackCard = royalCards.find(c => c.rank === 'J');
  if (jackCard && !hasQueen(player)) {
    const targetField = player.field
      .filter(fc => fc.card.value > 0 && fc.controller === playerId)
      .sort((a, b) => b.card.value - a.card.value)[0];
    if (targetField) {
      return { type: 'playPermanent', card: jackCard, target: targetField };
    }
  }
  
  // 9. 8を永続効果として配置（相手の手札を見る）
  const eightCard = eightCards[0];
  if (eightCard && !state.opponentHandRevealed[playerId]) {
    return { type: 'playPermanent', card: eightCard };
  }
  
  // 10. 中程度の点数カードを配置
  if (highPointCard && highPointCard.value >= 4) {
    return { type: 'playPoint', card: highPointCard };
  }
  
  // 11. ドローする
  if (state.deck.length > 0) {
    return { type: 'draw' };
  }
  
  // 12. 低い点数カードでも配置
  if (highPointCard) {
    return { type: 'playPoint', card: highPointCard };
  }
  
  // 13. パス
  return { type: 'pass' };
}

// CPUのアクションを遅延実行（考えてる感を出す）
export function executeCPUTurnWithDelay(
  state: GameState,
  executeAction: (action: AIAction) => void,
  delay: number = 1000
): void {
  setTimeout(() => {
    const action = getCPUAction(state);
    executeAction(action);
  }, delay);
}

