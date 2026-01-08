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

// CPUのターンを実行（強化版AI）
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
  
  // 相手の高得点カード（点数エリア）
  const playerHighValueCards = player.field
    .filter(fc => fc.card.value > 0 && fc.controller === playerId)
    .sort((a, b) => b.card.value - a.card.value);
  
  // 相手の永続効果カード
  const playerPermanents = player.field.filter(fc => 
    fc.card.rank === 'Q' || 
    fc.card.rank === 'K' || 
    (fc.card.rank === '8' && fc.card.value === 0)
  );
  
  // ============================================
  // 1. 勝てるなら点数カードを出す
  // ============================================
  for (const card of pointCards.sort((a, b) => b.value - a.value)) {
    if (cpuPoints + card.value >= cpuTarget) {
      return { type: 'playPoint', card };
    }
  }
  
  // ============================================
  // 2. 相手が勝ちそうなら妨害（緊急度高）
  // ============================================
  const playerNearWin = playerPoints >= playerTarget - 5;
  
  if (playerNearWin) {
    // 2a. Aで相手の高得点カードを破壊（最優先）
    const aceCard = cpu.hand.find(c => c.rank === 'A');
    if (aceCard && !hasQueen(player) && playerHighValueCards.length > 0) {
      return { type: 'playOneOff', card: aceCard, target: playerHighValueCards[0] };
    }
    
    // 2b. 9で相手のカードを手札に戻す（永続効果も対象可）
    const nineCard = cpu.hand.find(c => c.rank === '9');
    if (nineCard) {
      // 魔術師がない or 永続効果を狙う
      if (!hasQueen(player) && playerHighValueCards.length > 0) {
        return { type: 'playOneOff', card: nineCard, target: playerHighValueCards[0] };
      }
      // 魔術師がある場合は魔術師を戻す
      const queenTarget = playerPermanents.find(fc => fc.card.rank === 'Q');
      if (queenTarget) {
        return { type: 'playOneOff', card: nineCard, target: queenTarget };
      }
    }
    
    // 2c. 10で相手の高得点カードを戻す
    const tenCard = cpu.hand.find(c => c.rank === '10');
    if (tenCard && !hasQueen(player) && playerHighValueCards.length > 0) {
      return { type: 'playOneOff', card: tenCard, target: playerHighValueCards[0] };
    }
    
    // 2d. アタックで妨害
    for (const card of pointCards.sort((a, b) => b.value - a.value)) {
      const targets = playerHighValueCards.filter(fc => 
        canScuttle(card, fc, hasQueen(player)).canScuttle
      );
      if (targets.length > 0) {
        // 効率的なアタック：低いカードで高いカードを倒す
        const bestTarget = targets[0];
        return { type: 'scuttle', card, target: bestTarget };
      }
    }
  }
  
  // ============================================
  // 3. 相手の魔術師を先に破壊（2カード）
  // ============================================
  const twoCard = cpu.hand.find(c => c.rank === '2');
  if (twoCard && playerPermanents.length > 0) {
    // 優先順位: Q > K > 8
    const queenTarget = playerPermanents.find(fc => fc.card.rank === 'Q');
    const kingTarget = playerPermanents.find(fc => fc.card.rank === 'K');
    const target = queenTarget || kingTarget || playerPermanents[0];
    if (target) {
      return { type: 'playOneOff', card: twoCard, target };
    }
  }
  
  // ============================================
  // 4. 王を出す（勝利条件緩和）
  // ============================================
  const kingCard = royalCards.find(c => c.rank === 'K');
  if (kingCard && cpu.kings < 2) {
    return { type: 'playPermanent', card: kingCard };
  }
  
  // ============================================
  // 5. 魔術師を出す（防御）
  // ============================================
  const queenCard = royalCards.find(c => c.rank === 'Q');
  const cpuHasValueCards = cpu.field.some(fc => fc.card.value > 0 && fc.controller === cpuId);
  if (queenCard && !hasQueen(cpu) && cpuHasValueCards) {
    return { type: 'playPermanent', card: queenCard };
  }
  
  // ============================================
  // 6. 手札が少ない時、3で墓地から5を回収
  // ============================================
  const threeCard = cpu.hand.find(c => c.rank === '3');
  if (threeCard && cpu.hand.length <= 3 && state.scrapPile.length > 0) {
    // 優先順位: 5(ドロー) > A(妨害) > 高得点カード
    const fiveInScrap = state.scrapPile.find(c => c.rank === '5');
    const aceInScrap = state.scrapPile.find(c => c.rank === 'A');
    const highValueInScrap = state.scrapPile
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value)[0];
    
    const recoverTarget = fiveInScrap || aceInScrap || highValueInScrap;
    if (recoverTarget) {
      return { type: 'playOneOff', card: threeCard, target: recoverTarget };
    }
  }
  
  // ============================================
  // 7. 高得点カードを配置
  // ============================================
  const highPointCard = pointCards.sort((a, b) => b.value - a.value)[0];
  if (highPointCard && highPointCard.value >= 7) {
    return { type: 'playPoint', card: highPointCard };
  }
  
  // ============================================
  // 8. 5を使ってドロー
  // ============================================
  const fiveCard = cpu.hand.find(c => c.rank === '5');
  if (fiveCard && state.deck.length >= 2) {
    return { type: 'playOneOff', card: fiveCard };
  }
  
  // ============================================
  // 9. 騎士で相手のカードを奪う
  // ============================================
  const jackCard = royalCards.find(c => c.rank === 'J');
  if (jackCard && !hasQueen(player) && playerHighValueCards.length > 0) {
    return { type: 'playPermanent', card: jackCard, target: playerHighValueCards[0] };
  }
  
  // ============================================
  // 10. 8を永続効果として配置（相手の手札を見る）
  // ============================================
  const eightCard = eightCards[0];
  if (eightCard && !state.opponentHandRevealed[playerId]) {
    return { type: 'playPermanent', card: eightCard };
  }
  
  // ============================================
  // 11. 中程度の点数カードを配置
  // ============================================
  if (highPointCard && highPointCard.value >= 4) {
    return { type: 'playPoint', card: highPointCard };
  }
  
  // ============================================
  // 12. 4で相手の手札を減らす
  // ============================================
  const fourCard = cpu.hand.find(c => c.rank === '4');
  if (fourCard && player.hand.length >= 3) {
    return { type: 'playOneOff', card: fourCard };
  }
  
  // ============================================
  // 13. ドローする
  // ============================================
  if (state.deck.length > 0) {
    return { type: 'draw' };
  }
  
  // ============================================
  // 14. 低い点数カードでも配置
  // ============================================
  if (highPointCard) {
    return { type: 'playPoint', card: highPointCard };
  }
  
  // ============================================
  // 15. パス
  // ============================================
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
