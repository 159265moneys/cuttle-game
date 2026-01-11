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

// 拡張カード型（Jの所有者追跡用）
interface AttachedKnight extends Card {
  playedBy: 'player1' | 'player2';
}

// Jターゲット情報（attachedKnightsから見つけた場合）
interface KnightTarget {
  knight: Card;
  attachedTo: FieldCard;
  owner: 'player1' | 'player2'; // どのプレイヤーのフィールドにあるか
}

// 深いコピーでプレイヤーを複製
function clonePlayer(player: Player): Player {
  return {
    ...player,
    hand: [...player.hand],
    field: player.field.map(fc => ({
      ...fc,
      card: { ...fc.card },
      attachedKnights: fc.attachedKnights.map(k => ({ ...k })),
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
// ヘルパー関数
// ============================================

// 8永続効果の公開フラグをリセット
function resetGlassesEffect(state: GameState, destroyedCard: Card, cardOwner: 'player1' | 'player2'): void {
  if (destroyedCard.rank === '8' && destroyedCard.value === 0) {
    const opponentOfOwner = getOpponent(cardOwner);
    state.opponentHandRevealed[opponentOfOwner] = false;
  }
}

// 付属Jを捨て札に送る
function sendAttachedKnightsToScrap(state: GameState, fieldCard: FieldCard): void {
  if (fieldCard.attachedKnights.length > 0) {
    for (const knight of fieldCard.attachedKnights) {
      state.scrapPile.push({ ...knight });
    }
  }
}

// 点数カードからJが除去された時のcontroller再計算
function recalculateControllerAfterKnightRemoval(fieldCard: FieldCard): void {
  if (fieldCard.attachedKnights.length === 0) {
    fieldCard.controller = fieldCard.owner;
  } else {
    const lastKnight = fieldCard.attachedKnights[fieldCard.attachedKnights.length - 1] as AttachedKnight;
    if (lastKnight.playedBy) {
      fieldCard.controller = lastKnight.playedBy;
    }
  }
}

// attachedKnightsからJを検索（2や9でターゲットする用）
function findKnightInAttachedKnights(
  state: GameState, 
  knightId: string, 
  searchPlayerId: 'player1' | 'player2'
): KnightTarget | null {
  // 両方のフィールドを検索
  for (const playerId of ['player1', 'player2'] as const) {
    const playerData = state[playerId];
    for (const fc of playerData.field) {
      const knight = fc.attachedKnights.find(k => k.id === knightId);
      if (knight) {
        // このJが相手プレイヤーに属しているかチェック
        const knightWithOwner = knight as AttachedKnight;
        if (knightWithOwner.playedBy === searchPlayerId) {
          return { knight, attachedTo: fc, owner: playerId };
        }
      }
    }
  }
  return null;
}

// Jをattached Knightsから削除して捨て札/手札へ
function removeKnightFromAttached(
  state: GameState,
  knightId: string
): { found: boolean; attachedTo?: FieldCard } {
  for (const playerId of ['player1', 'player2'] as const) {
    const playerData = state[playerId];
    for (const fc of playerData.field) {
      const knightIndex = fc.attachedKnights.findIndex(k => k.id === knightId);
      if (knightIndex !== -1) {
        fc.attachedKnights.splice(knightIndex, 1);
        recalculateControllerAfterKnightRemoval(fc);
        return { found: true, attachedTo: fc };
      }
    }
  }
  return { found: false };
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
          const actualTarget = opponent.field.find(fc => fc.card.id === targetField.card.id);
          if (actualTarget) {
            sendAttachedKnightsToScrap(newState, actualTarget);
          }
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
        
        // Jの場合、attachedKnightsをチェック
        if (targetField.card.rank === 'J') {
          // attachedKnightsからJを検索
          const knightTarget = findKnightInAttachedKnights(newState, targetField.card.id, opponentId);
          if (knightTarget) {
            // Jを削除して捨て札へ
            removeKnightFromAttached(newState, targetField.card.id);
            newState.scrapPile.push({ ...targetField.card });
            newState.message = `${targetField.card.rank}を破壊！`;
            break;
          }
        }
        
        // 通常の永続カード（Q, K, 8永続）
        const isPermanent = 
          targetField.card.rank === 'Q' || 
          targetField.card.rank === 'K' || 
          (targetField.card.rank === '8' && targetField.card.value === 0);
        
        if (isPermanent) {
          opponent.field = opponent.field.filter(fc => fc.card.id !== targetField.card.id);
          newState.scrapPile.push({ ...targetField.card });
          
          if (targetField.card.rank === 'K') {
            opponent.kings--;
          }
          
          resetGlassesEffect(newState, targetField.card, opponentId);
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
      // 相手は手札を2枚捨てる
      newState.phase = 'opponentDiscard';
      newState.message = `${opponentId === 'player1' ? 'プレイヤー1' : 'プレイヤー2'}は手札を2枚捨ててください`;
      newState.scrapPile.push({ ...card });
      return newState;
    }

    case '5': {
      // 山札から3枚ドロー
      const drawCount = Math.min(3, newState.deck.length);
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
        fc.card.rank === 'Q' || 
        fc.card.rank === 'K' || 
        (fc.card.rank === '8' && fc.card.value === 0);
      
      // Q, K, 8永続を捨て札へ
      for (const fc of player.field) {
        if (isPermanent(fc)) {
          newState.scrapPile.push({ ...fc.card });
          if (fc.card.rank === 'K') player.kings--;
          resetGlassesEffect(newState, fc.card, playerId);
        }
      }
      for (const fc of opponent.field) {
        if (isPermanent(fc)) {
          newState.scrapPile.push({ ...fc.card });
          if (fc.card.rank === 'K') opponent.kings--;
          resetGlassesEffect(newState, fc.card, opponentId);
        }
      }
      
      // 永続カードを除去
      player.field = player.field.filter(fc => !isPermanent(fc));
      opponent.field = opponent.field.filter(fc => !isPermanent(fc));
      
      // 全てのattachedKnightsを破壊してcontrollerを戻す
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
      // 山札トップを見てプレイまたは戻す
      if (newState.deck.length > 0) {
        const topCards = newState.deck.slice(0, Math.min(2, newState.deck.length));
        newState.phase = 'sevenChoice';
        newState.sevenChoices = topCards;
        newState.message = '山札トップから選択';
        newState.scrapPile.push({ ...card });
        return newState;
      }
      break;
    }

    case '9': {
      // 相手のカード1枚を手札に戻す（永続効果 or 点数カード、Jも可）
      if (target && 'card' in target) {
        const targetField = target as FieldCard;
        
        // Jの場合、attachedKnightsをチェック
        if (targetField.card.rank === 'J') {
          const knightTarget = findKnightInAttachedKnights(newState, targetField.card.id, opponentId);
          if (knightTarget) {
            // Jを削除して相手の手札へ
            removeKnightFromAttached(newState, targetField.card.id);
            opponent.hand.push({ ...targetField.card });
            newState.message = `${targetField.card.rank}を手札に戻した！`;
            break;
          }
        }
        
        // 魔術師で保護された点数カードは対象外
        if (targetField.card.value > 0 && hasQueen(opponent)) {
          newState.message = '魔術師に保護されています';
          break;
        }
        
        // フィールドから削除
        const actualTarget = opponent.field.find(fc => fc.card.id === targetField.card.id);
        if (actualTarget) {
          sendAttachedKnightsToScrap(newState, actualTarget);
        }
        
        opponent.field = opponent.field.filter(fc => fc.card.id !== targetField.card.id);
        opponent.hand.push({ ...targetField.card });
        
        if (targetField.card.rank === 'K') {
          opponent.kings--;
        }
        
        resetGlassesEffect(newState, targetField.card, opponentId);
        newState.message = `${targetField.card.rank}を手札に戻した！`;
      }
      break;
    }

    case '10': {
      // 相手の点数カード1枚を手札に戻す
      if (target && 'card' in target) {
        const targetField = target as FieldCard;
        
        if (targetField.card.value > 0 && !hasQueen(opponent)) {
          const actualTarget = opponent.field.find(fc => fc.card.id === targetField.card.id);
          if (actualTarget) {
            sendAttachedKnightsToScrap(newState, actualTarget);
          }
          
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

  if (targetField.controller !== opponentId || targetField.card.value <= 0) {
    return { ...state, message: '対象は相手が支配する点数カードである必要があります' };
  }

  if (targetField.owner === opponentId && hasQueen(opponent)) {
    return { ...state, message: '魔術師に保護されています' };
  }

  player.hand = player.hand.filter(c => c.id !== knightCard.id);

  const foundInPlayer = player.field.findIndex(fc => fc.card.id === targetField.card.id);
  const foundInOpponent = opponent.field.findIndex(fc => fc.card.id === targetField.card.id);

  const knightWithOwner: AttachedKnight = { ...knightCard, playedBy: playerId };
  
  if (foundInPlayer !== -1) {
    player.field[foundInPlayer].attachedKnights.push(knightWithOwner);
    player.field[foundInPlayer].controller = playerId;
  } else if (foundInOpponent !== -1) {
    opponent.field[foundInOpponent].attachedKnights.push(knightWithOwner);
    opponent.field[foundInOpponent].controller = playerId;
  }

  newState.message = `${targetField.card.rank}を略奪！`;
  newState.consecutivePasses = 0;

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
// アタック（スカトル）
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

  // 完全にブロック（魔術師保護、数字が小さい等）
  if (scuttleResult.result === 'blocked') {
    return { ...state, message: 'アタックできません' };
  }

  // 手札から削除
  player.hand = player.hand.filter(c => c.id !== attackerCard.id);

  // 種族不利で失敗: 自分のカードのみ捨て札
  if (scuttleResult.result === 'lose') {
    newState.scrapPile.push({ ...attackerCard });
    newState.message = 'アタック失敗！（種族不利）';
    newState.consecutivePasses = 0;
    return endTurn(newState);
  }

  // 成功ケース: 相手のカードを破壊（付属Jも捨て札へ）
  const actualDefender = opponent.field.find(fc => fc.card.id === defenderField.card.id);
  if (actualDefender) {
    sendAttachedKnightsToScrap(newState, actualDefender);
  }
  opponent.field = opponent.field.filter(fc => fc.card.id !== defenderField.card.id);
  newState.scrapPile.push({ ...defenderField.card });

  // 種族有利: 相手のみ捨て札
  if (scuttleResult.result === 'win') {
    newState.message = 'アタック成功！（種族有利）';
  } else {
    // 相打ち: 両方捨て札
    newState.scrapPile.push({ ...attackerCard });
    newState.message = 'アタック成功！';
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
