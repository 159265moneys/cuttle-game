import type { 
  GameState, 
  Card, 
  FieldCard,
  Player
} from '../types/game';
import { 
  getOpponent, 
  endTurn, 
  playCardToField,
  hasQueen,
  canScuttle,
  checkWinCondition
} from './gameLogic';

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

// ============================================
// ワンオフ効果
// ============================================

export function executeOneOff(
  state: GameState,
  card: Card,
  target?: FieldCard | Card
): GameState {
  let newState = cloneGameState(state);
  const playerId = state.currentPlayer;
  const opponentId = getOpponent(playerId);
  const player = newState[playerId];
  const opponent = newState[opponentId];

  // 手札から削除
  player.hand = player.hand.filter(c => c.id !== card.id);

  switch (card.rank) {
    case 'A': {
      // 相手の点数カード1枚を破壊
      if (target && 'card' in target) {
        const targetField = target as FieldCard;
        if (targetField.card.value > 0 && !hasQueen(opponent)) {
          opponent.field = opponent.field.filter(fc => fc.card.id !== targetField.card.id);
          newState.scrapPile.push({ ...targetField.card });
          newState.message = `${targetField.card.rank}を破壊！`;
        }
      }
      break;
    }

    case '2': {
      // 相手の永続カード1枚を破壊（J, Q, K, 8永続）
      if (target && 'card' in target) {
        const targetField = target as FieldCard;
        const isPermanent = 
          targetField.card.rank === 'J' || 
          targetField.card.rank === 'Q' || 
          targetField.card.rank === 'K' || 
          (targetField.card.rank === '8' && targetField.card.value === 0);
        
        if (isPermanent) {
          opponent.field = opponent.field.filter(fc => fc.card.id !== targetField.card.id);
          newState.scrapPile.push({ ...targetField.card });
          
          if (targetField.card.rank === 'K') {
            opponent.kings--;
          }
          
          newState.message = `${targetField.card.rank}を破壊！`;
        }
      }
      break;
    }

    case '3': {
      // 捨て札から1枚回収
      if (target && !('card' in target)) {
        const targetCard = target as Card;
        newState.scrapPile = newState.scrapPile.filter(c => c.id !== targetCard.id);
        player.hand.push({ ...targetCard });
        newState.message = `${targetCard.rank}を回収！`;
      }
      break;
    }

    case '4': {
      // 相手は手札を2枚捨てる（別フェーズで処理）
      newState.phase = 'opponentDiscard';
      newState.message = `${opponentId === 'player1' ? 'プレイヤー1' : 'プレイヤー2'}は手札を2枚捨ててください`;
      newState.scrapPile.push({ ...card });
      return newState;
    }

    case '5': {
      // 山札から2枚ドロー
      const drawCount = Math.min(2, newState.deck.length);
      for (let i = 0; i < drawCount; i++) {
        const drawnCard = newState.deck.shift()!;
        player.hand.push(drawnCard);
      }
      newState.message = `${drawCount}枚ドロー！`;
      break;
    }

    case '6': {
      // 全ての永続カードを破壊
      const isPermanent = (fc: FieldCard) => 
        fc.card.rank === 'J' || 
        fc.card.rank === 'Q' || 
        fc.card.rank === 'K' || 
        (fc.card.rank === '8' && fc.card.value === 0);
      
      // 両プレイヤーの永続カードを捨て札へ
      for (const fc of player.field) {
        if (isPermanent(fc)) {
          newState.scrapPile.push({ ...fc.card });
          if (fc.card.rank === 'K') player.kings--;
        }
      }
      for (const fc of opponent.field) {
        if (isPermanent(fc)) {
          newState.scrapPile.push({ ...fc.card });
          if (fc.card.rank === 'K') opponent.kings--;
        }
      }
      
      // 永続カードを除去
      player.field = player.field.filter(fc => !isPermanent(fc));
      opponent.field = opponent.field.filter(fc => !isPermanent(fc));
      
      // 騎士を破壊した場合、点数カードは元の持ち主に戻る
      for (const fc of [...player.field, ...opponent.field]) {
        if (fc.attachedKnights.length > 0) {
          for (const knight of fc.attachedKnights) {
            newState.scrapPile.push({ ...knight });
          }
          fc.attachedKnights = [];
          fc.controller = fc.owner;
        }
      }
      
      newState.message = '全ての永続カードを破壊！';
      break;
    }

    case '7': {
      // 山札トップを見てプレイ（別フェーズで処理）
      if (newState.deck.length > 0) {
        newState.phase = 'sevenChoice';
        newState.message = '山札トップをプレイするか、手札からプレイしてください';
        newState.scrapPile.push({ ...card });
        return newState;
      }
      break;
    }

    case '9': {
      // 相手のカード1枚を手札に戻す
      if (target && 'card' in target) {
        const targetField = target as FieldCard;
        
        // 魔術師で保護された点数カードは対象外
        if (targetField.card.value > 0 && hasQueen(opponent)) {
          newState.message = '魔術師に保護されています';
          break;
        }
        
        opponent.field = opponent.field.filter(fc => fc.card.id !== targetField.card.id);
        opponent.hand.push({ ...targetField.card });
        
        if (targetField.card.rank === 'K') {
          opponent.kings--;
        }
        
        // 騎士を戻した場合、付いていたカードの支配者を戻す
        if (targetField.card.rank === 'J') {
          for (const fc of opponent.field) {
            fc.attachedKnights = fc.attachedKnights.filter(k => k.id !== targetField.card.id);
            if (fc.attachedKnights.length === 0) {
              fc.controller = fc.owner;
            }
          }
        }
        
        newState.message = `${targetField.card.rank}を手札に戻した！`;
      }
      break;
    }

    case '10': {
      // 相手の点数カード1枚を手札に戻す
      if (target && 'card' in target) {
        const targetField = target as FieldCard;
        
        if (targetField.card.value > 0 && !hasQueen(opponent)) {
          opponent.field = opponent.field.filter(fc => fc.card.id !== targetField.card.id);
          opponent.hand.push({ ...targetField.card });
          newState.message = `${targetField.card.rank}を手札に戻した！`;
        }
      }
      break;
    }
  }

  newState.scrapPile.push({ ...card });
  newState.consecutivePasses = 0;

  // 勝利条件チェック
  const winner = checkWinCondition(newState);
  if (winner) {
    newState.winner = winner;
    newState.phase = 'gameOver';
    newState.message = `${winner === 'player1' ? 'プレイヤー1' : 'プレイヤー2'}の勝利！`;
    return newState;
  }

  return endTurn(newState);
}

// ============================================
// 騎士（J）
// ============================================

export function playKnight(
  state: GameState,
  knightCard: Card,
  targetField: FieldCard
): GameState {
  const newState = cloneGameState(state);
  const playerId = state.currentPlayer;
  const opponentId = getOpponent(playerId);
  const player = newState[playerId];
  const opponent = newState[opponentId];

  // 魔術師で保護されている場合は使用不可
  if (hasQueen(opponent)) {
    return { ...state, message: '魔術師に保護されています' };
  }

  // 手札から削除
  player.hand = player.hand.filter(c => c.id !== knightCard.id);

  // 対象のカードに騎士を付けて支配者を変更
  const targetIndex = opponent.field.findIndex(fc => fc.card.id === targetField.card.id);
  if (targetIndex !== -1) {
    opponent.field[targetIndex].attachedKnights.push({ ...knightCard });
    opponent.field[targetIndex].controller = playerId;
  }

  newState.message = `${targetField.card.rank}を略奪！`;
  newState.consecutivePasses = 0;

  // 勝利条件チェック
  const winner = checkWinCondition(newState);
  if (winner) {
    newState.winner = winner;
    newState.phase = 'gameOver';
    newState.message = `${winner === 'player1' ? 'プレイヤー1' : 'プレイヤー2'}の勝利！`;
    return newState;
  }

  return endTurn(newState);
}

// ============================================
// スカトル
// ============================================

export function executeScuttle(
  state: GameState,
  attackerCard: Card,
  defenderField: FieldCard
): GameState {
  const newState = cloneGameState(state);
  const playerId = state.currentPlayer;
  const opponentId = getOpponent(playerId);
  const player = newState[playerId];
  const opponent = newState[opponentId];

  const scuttleResult = canScuttle(attackerCard, defenderField, hasQueen(opponent));

  if (!scuttleResult.canScuttle) {
    return { ...state, message: 'スカトルできません' };
  }

  // 手札から削除
  player.hand = player.hand.filter(c => c.id !== attackerCard.id);

  switch (scuttleResult.result) {
    case 'success':
      // 相手のカードを破壊、自分のも捨て札へ
      opponent.field = opponent.field.filter(fc => fc.card.id !== defenderField.card.id);
      newState.scrapPile.push({ ...defenderField.card });
      newState.scrapPile.push({ ...attackerCard });
      newState.message = 'スカトル成功！';
      break;
    
    case 'fail':
      // 自分のカードのみ捨て札
      newState.scrapPile.push({ ...attackerCard });
      newState.message = 'スカトル失敗...（種族相性で敗北）';
      break;
    
    case 'mutual':
      // 両方捨て札
      opponent.field = opponent.field.filter(fc => fc.card.id !== defenderField.card.id);
      newState.scrapPile.push({ ...defenderField.card });
      newState.scrapPile.push({ ...attackerCard });
      newState.message = '相打ち！';
      break;
  }

  newState.consecutivePasses = 0;

  return endTurn(newState);
}

// ============================================
// 点数カードとして配置
// ============================================

export function playAsPoint(state: GameState, card: Card): GameState {
  let newState = playCardToField(state, state.currentPlayer, card, false);
  newState.message = `${card.rank}を配置！`;
  newState.consecutivePasses = 0;

  // 勝利条件チェック
  const winner = checkWinCondition(newState);
  if (winner) {
    newState.winner = winner;
    newState.phase = 'gameOver';
    newState.message = `${winner === 'player1' ? 'プレイヤー1' : 'プレイヤー2'}の勝利！`;
    return newState;
  }

  return endTurn(newState);
}

// ============================================
// 永続効果として配置（Q, K, 8）
// ============================================

export function playAsPermanent(state: GameState, card: Card): GameState {
  let newState = playCardToField(state, state.currentPlayer, card, true);
  
  // 8の場合は相手の手札を公開
  if (card.rank === '8') {
    const opponentId = getOpponent(state.currentPlayer);
    newState.opponentHandRevealed[opponentId] = true;
    newState.message = '密偵配置！相手の手札が見える！';
  } else if (card.rank === 'Q') {
    newState.message = '魔術師配置！結界展開！';
  } else if (card.rank === 'K') {
    newState.message = '王配置！勅令発動！';
  }
  
  newState.consecutivePasses = 0;

  // 勝利条件チェック
  const winner = checkWinCondition(newState);
  if (winner) {
    newState.winner = winner;
    newState.phase = 'gameOver';
    newState.message = `${winner === 'player1' ? 'プレイヤー1' : 'プレイヤー2'}の勝利！`;
    return newState;
  }

  return endTurn(newState);
}

// ============================================
// 4の効果で相手が手札を捨てる
// ============================================

export function discardCards(state: GameState, cards: Card[]): GameState {
  const newState = cloneGameState(state);
  const opponentId = getOpponent(state.currentPlayer);
  const opponent = newState[opponentId];

  for (const card of cards) {
    opponent.hand = opponent.hand.filter(c => c.id !== card.id);
    newState.scrapPile.push({ ...card });
  }

  newState.message = `${cards.length}枚捨てた`;
  return endTurn(newState);
}
