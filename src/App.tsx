import { useState, useCallback, useEffect } from 'react';
import type { GameState, Card as CardType, FieldCard, ActionType } from './types/game';
import { createInitialGameState, drawCard, pass, hasQueen, getOpponent } from './utils/gameLogic';
import { 
  executeOneOff, 
  playKnight, 
  executeScuttle, 
  playAsPoint, 
  playAsPermanent,
  discardCards
} from './utils/cardActions';
import { getCPUAction } from './utils/cpuAI';
import CuttleBattle from './components/CuttleBattle';

function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    const state = createInitialGameState();
    state.player1.name = 'あなた';
    state.player2.name = 'CPU';
    return state;
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // CPUのターンを処理
  useEffect(() => {
    if (
      gameState.currentPlayer === 'player2' && 
      gameState.phase !== 'gameOver' &&
      gameState.phase !== 'opponentDiscard' &&
      !isProcessing
    ) {
      setIsProcessing(true);
      
      const delay = 800 + Math.random() * 700;
      
      setTimeout(() => {
        const action = getCPUAction(gameState);
        
        let newState = gameState;
        
        switch (action.type) {
          case 'draw':
            newState = drawCard(gameState);
            break;
          
          case 'pass':
            newState = pass(gameState);
            break;
          
          case 'playPoint':
            if (action.card) {
              newState = playAsPoint(gameState, action.card);
            }
            break;
          
          case 'playOneOff':
            if (action.card) {
              newState = executeOneOff(gameState, action.card, action.target);
            }
            break;
          
          case 'playPermanent':
            if (action.card) {
              if (action.card.rank === 'J' && action.target && 'card' in action.target) {
                newState = playKnight(gameState, action.card, action.target as FieldCard);
              } else {
                newState = playAsPermanent(gameState, action.card);
              }
            }
            break;
          
          case 'scuttle':
            if (action.card && action.target && 'card' in action.target) {
              newState = executeScuttle(gameState, action.card, action.target as FieldCard);
            }
            break;
        }
        
        setGameState(newState);
        setIsProcessing(false);
      }, delay);
    }
  }, [gameState, isProcessing]);

  // 4の効果で自動的にCPUが手札を捨てる
  useEffect(() => {
    if (
      gameState.phase === 'opponentDiscard' && 
      gameState.currentPlayer === 'player1'
    ) {
      const opponent = gameState.player2;
      const discardCount = Math.min(2, opponent.hand.length);
      
      if (discardCount > 0) {
        setTimeout(() => {
          const sortedHand = [...opponent.hand].sort((a, b) => {
            if (a.value === 0 && b.value > 0) return -1;
            if (b.value === 0 && a.value > 0) return 1;
            return a.value - b.value;
          });
          
          const cardsToDiscard = sortedHand.slice(0, discardCount);
          setGameState(discardCards(gameState, cardsToDiscard));
        }, 500);
      }
    }
  }, [gameState]);

  // カード選択
  const handleCardSelect = useCallback((card: CardType) => {
    if (gameState.currentPlayer === 'player2' || isProcessing) return;

    // 7の効果: 山札トップから選択した場合
    if (gameState.phase === 'sevenChoice' && gameState.sevenChoices) {
      // 選択したカードが sevenChoices にあるか確認
      const isSevenChoice = gameState.sevenChoices.some(c => c.id === card.id);
      if (isSevenChoice) {
        // 選択したカードをデッキから除去してプレイヤーの手札に加える
        const newDeck = gameState.deck.filter(c => c.id !== card.id);
        const player = gameState[gameState.currentPlayer];
        
        setGameState(prev => ({
          ...prev,
          deck: newDeck,
          [prev.currentPlayer]: {
            ...player,
            hand: [...player.hand, card],
          },
          selectedCard: card,
          selectedAction: null,
          phase: 'selectAction',
          sevenChoices: undefined,
          message: `${card.rank}をどう使う？`,
        }));
        return;
      }
    }

    setGameState(prev => ({
      ...prev,
      selectedCard: card,
      selectedAction: null,
    }));
  }, [gameState, isProcessing]);

  // フィールドカード選択（ターゲット選択）
  const handleFieldCardSelect = useCallback((fieldCard: FieldCard) => {
    if (gameState.phase !== 'selectTarget' || !gameState.selectedCard) return;
    if (gameState.currentPlayer === 'player2' || isProcessing) return;

    const action = gameState.selectedAction;
    const selectedCard = gameState.selectedCard;
    const opponentId = getOpponent(gameState.currentPlayer);

    if (action === 'playOneOff') {
      setGameState(executeOneOff(gameState, selectedCard, fieldCard));
    } else if (action === 'playPermanent' && selectedCard.rank === 'J') {
      if (fieldCard.card.value > 0 && fieldCard.owner === opponentId) {
        setGameState(playKnight(gameState, selectedCard, fieldCard));
      }
    } else if (action === 'scuttle') {
      if (fieldCard.card.value > 0 && fieldCard.owner === opponentId) {
        setGameState(executeScuttle(gameState, selectedCard, fieldCard));
      }
    }
  }, [gameState, isProcessing]);

  // 捨て札選択（3の効果）
  const handleScrapSelect = useCallback((card: CardType) => {
    if (gameState.currentPlayer === 'player2' || isProcessing) return;
    if (gameState.selectedCard?.rank === '3') {
      setGameState(executeOneOff(gameState, gameState.selectedCard, card));
    }
  }, [gameState, isProcessing]);

  // 直接アクション実行（カードとターゲットを直接渡す - 状態のクロージャ問題を回避）
  const handleDirectAction = useCallback((action: ActionType, card: CardType, target?: FieldCard) => {
    if (gameState.currentPlayer === 'player2' || isProcessing) return;

    switch (action) {
      case 'playKnight':
        if (target && target.card.value > 0) {
          const opponentId = getOpponent(gameState.currentPlayer);
          const opponent = gameState[opponentId];
          if (!hasQueen(opponent)) {
            setGameState(playKnight(gameState, card, target));
          }
        }
        break;
      
      case 'scuttle':
        if (target && target.card.value > 0) {
          setGameState(executeScuttle(gameState, card, target));
        }
        break;
      
      case 'playOneOff':
        setGameState(executeOneOff(gameState, card, target));
        break;
    }
  }, [gameState, isProcessing]);

  // アクション実行
  const handleAction = useCallback((action: ActionType) => {
    if (gameState.currentPlayer === 'player2' || isProcessing) return;

    switch (action) {
      case 'draw':
        setGameState(drawCard(gameState));
        break;

      case 'pass':
        setGameState(pass(gameState));
        break;

      case 'playPoint':
        if (gameState.selectedCard) {
          setGameState(playAsPoint(gameState, gameState.selectedCard));
        }
        break;

      case 'playOneOff': {
        if (!gameState.selectedCard) break;
        const card = gameState.selectedCard;
        
        const needsTarget = ['A', '2', '9', '10'].includes(card.rank);
        const needsScrapTarget = card.rank === '3';
        
        if (needsTarget || needsScrapTarget) {
          setGameState(prev => ({
            ...prev,
            phase: 'selectTarget',
            selectedAction: 'playOneOff',
            message: needsScrapTarget ? '捨て札を選択' : 'ターゲットを選択',
          }));
        } else {
          setGameState(executeOneOff(gameState, card));
        }
        break;
      }

      case 'playPermanent': {
        if (!gameState.selectedCard) break;
        const card = gameState.selectedCard;
        
        if (card.rank === 'J') {
          const opponentId = getOpponent(gameState.currentPlayer);
          const opponent = gameState[opponentId];
          const validTargets = opponent.field.filter(fc => 
            fc.card.value > 0 && !hasQueen(opponent)
          );
          
          if (validTargets.length === 0) {
            setGameState(prev => ({
              ...prev,
              message: '略奪できるカードがありません',
            }));
          } else {
            setGameState(prev => ({
              ...prev,
              phase: 'selectTarget',
              selectedAction: 'playPermanent',
              message: '略奪する点数カードを選択',
            }));
          }
        } else {
          setGameState(playAsPermanent(gameState, card));
        }
        break;
      }

      case 'scuttle': {
        if (!gameState.selectedCard) break;
        
        setGameState(prev => ({
          ...prev,
          phase: 'selectTarget',
          selectedAction: 'scuttle',
          message: 'スカトルする点数カードを選択',
        }));
        break;
      }
    }
  }, [gameState, isProcessing]);

  // キャンセル
  const handleCancel = useCallback(() => {
    setGameState(prev => ({
      ...prev,
      phase: 'selectAction',
      selectedCard: null,
      selectedAction: null,
      targetCard: null,
      message: `${prev.currentPlayer === 'player1' ? 'あなた' : 'CPU'}のターン`,
    }));
  }, []);

  // リスタート
  const handleRestart = useCallback(() => {
    const state = createInitialGameState();
    state.player1.name = 'あなた';
    state.player2.name = 'CPU';
    setGameState(state);
    setIsProcessing(false);
  }, []);

  return (
    <CuttleBattle
      isOpen={true}
      onClose={() => {}}
      gameState={gameState}
      onCardSelect={handleCardSelect}
      onFieldCardSelect={handleFieldCardSelect}
      onScrapSelect={handleScrapSelect}
      onAction={handleAction}
      onDirectAction={handleDirectAction}
      onCancel={handleCancel}
      onRestart={handleRestart}
      isCPUTurn={gameState.currentPlayer === 'player2'}
    />
  );
}

export default App;
