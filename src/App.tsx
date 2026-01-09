import { useState, useCallback, useEffect, useRef } from 'react';
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
import CoinFlip from './components/CoinFlip';
import RoundStart from './components/RoundStart';

// マッチ状態の型
interface MatchState {
  player1Wins: number;
  player2Wins: number;
  currentMatch: number;
  playerStartsFirst: boolean; // プレイヤーが先攻かどうか
}

function App() {
  // ゲーム画面の状態
  const [screen, setScreen] = useState<'coinFlip' | 'roundStart' | 'battle' | 'finalResult'>('coinFlip');
  
  // マッチ状態
  const [matchState, setMatchState] = useState<MatchState>({
    player1Wins: 0,
    player2Wins: 0,
    currentMatch: 1,
    playerStartsFirst: true,
  });

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // カード配り演出中かどうか
  const [isDealing, setIsDealing] = useState(false);
  
  // ゲームオーバー処理済みフラグ（重複実行を防止）
  const gameOverProcessedRef = useRef(false);

  // 新しいゲームを開始
  const startNewGame = useCallback((playerFirst: boolean) => {
    // 先攻後攻に応じて手札枚数が決まる（先攻5枚、後攻6枚）
    const state = createInitialGameState(playerFirst);
    state.player1.name = 'あなた';
    state.player2.name = 'CPU';
    
    // 新しいゲーム開始時にフラグをリセット
    gameOverProcessedRef.current = false;
    
    // カード配り演出を開始
    setIsDealing(true);
    
    setGameState(state);
    setScreen('battle');
  }, []);
  
  // カード配り演出完了
  const handleDealingComplete = useCallback(() => {
    setIsDealing(false);
  }, []);

  // コイントス完了 → ROUND 1 START演出へ
  const handleCoinFlipComplete = useCallback((playerGoesFirst: boolean) => {
    setMatchState(prev => ({
      ...prev,
      playerStartsFirst: playerGoesFirst,
    }));
    setScreen('roundStart');
  }, []);

  // ROUND START演出完了 → バトル開始
  const handleRoundStartComplete = useCallback(() => {
    startNewGame(matchState.playerStartsFirst);
  }, [startNewGame, matchState.playerStartsFirst]);

  // ゲーム終了時の処理 → 2秒後に自動で次へ
  useEffect(() => {
    // 既に処理済みの場合は何もしない（重複実行防止）
    if (gameOverProcessedRef.current) return;
    
    if (gameState?.phase === 'gameOver' && gameState.winner) {
      // 処理済みフラグを立てる
      gameOverProcessedRef.current = true;
      
      const isPlayerWin = gameState.winner === 'player1';
      
      // 2秒後に結果処理と自動遷移
      const timer = setTimeout(() => {
        setMatchState(prev => {
          const newPlayer1Wins = prev.player1Wins + (isPlayerWin ? 1 : 0);
          const newPlayer2Wins = prev.player2Wins + (isPlayerWin ? 0 : 1);
          
          // 2勝したら最終結果
          if (newPlayer1Wins >= 2 || newPlayer2Wins >= 2) {
            setScreen('finalResult');
            return {
              ...prev,
              player1Wins: newPlayer1Wins,
              player2Wins: newPlayer2Wins,
            };
          } else {
            // 次のラウンドへ自動遷移
            setScreen('roundStart');
            return {
              ...prev,
              player1Wins: newPlayer1Wins,
              player2Wins: newPlayer2Wins,
              currentMatch: prev.currentMatch + 1,
              playerStartsFirst: !prev.playerStartsFirst, // 先攻後攻を交代
            };
          }
        });
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [gameState?.phase, gameState?.winner]);

  // 全体リスタート（最初から）
  const handleFullRestart = useCallback(() => {
    // フラグをリセット
    gameOverProcessedRef.current = false;
    
    setMatchState({
      player1Wins: 0,
      player2Wins: 0,
      currentMatch: 1,
      playerStartsFirst: true,
    });
    setGameState(null);
    setScreen('coinFlip');
    setIsProcessing(false);
  }, []);

  // CPUのターンを処理
  useEffect(() => {
    if (
      gameState &&
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

  // 4の効果で自動的にCPUが手札を捨てる（プレイヤーが4を使った場合）
  useEffect(() => {
    if (
      gameState &&
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
  
  // プレイヤーが手札を捨てる（CPUが4を使った場合）
  const handleDiscard = useCallback((cards: CardType[]) => {
    if (!gameState || gameState.phase !== 'opponentDiscard' || gameState.currentPlayer !== 'player2') return;
    setGameState(discardCards(gameState, cards));
  }, [gameState]);

  // 7のオプションB: 山札に戻して手札からプレイ
  const handleSevenOptionB = useCallback(() => {
    if (!gameState || gameState.phase !== 'sevenChoice' || !gameState.sevenChoices) return;
    
    // sevenChoices のカードを山札の一番下に戻す
    const newDeck = [...gameState.deck.filter(c => !gameState.sevenChoices!.some(sc => sc.id === c.id))];
    // 山札の一番下に追加
    newDeck.push(...gameState.sevenChoices);
    
    setGameState(prev => prev ? ({
      ...prev,
      deck: newDeck,
      phase: 'sevenOptionB', // 特殊フェーズ: 手札からプレイ
      sevenChoices: undefined,
      message: '手札から1枚プレイしてください',
    }) : null);
  }, [gameState]);

  // カード選択
  const handleCardSelect = useCallback((card: CardType) => {
    if (!gameState || gameState.currentPlayer === 'player2' || isProcessing) return;

    // 7の効果: 山札トップから選択した場合（オプションA）
    if (gameState.phase === 'sevenChoice' && gameState.sevenChoices) {
      // 選択したカードが sevenChoices にあるか確認
      const isSevenChoice = gameState.sevenChoices.some(c => c.id === card.id);
      if (isSevenChoice) {
        // 選択したカードをデッキから除去してプレイヤーの手札に加える
        const newDeck = gameState.deck.filter(c => c.id !== card.id);
        const player = gameState[gameState.currentPlayer];
        
        setGameState(prev => prev ? ({
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
        }) : null);
        return;
      }
    }

    setGameState(prev => prev ? ({
      ...prev,
      selectedCard: card,
      selectedAction: null,
    }) : null);
  }, [gameState, isProcessing]);

  // フィールドカード選択（ターゲット選択）
  const handleFieldCardSelect = useCallback((fieldCard: FieldCard) => {
    if (!gameState || gameState.phase !== 'selectTarget' || !gameState.selectedCard) return;
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
    if (!gameState || gameState.currentPlayer === 'player2' || isProcessing) return;
    if (gameState.selectedCard?.rank === '3') {
      setGameState(executeOneOff(gameState, gameState.selectedCard, card));
    }
  }, [gameState, isProcessing]);

  // 直接アクション実行（カードとターゲットを直接渡す - 状態のクロージャ問題を回避）
  const handleDirectAction = useCallback((action: ActionType, card: CardType, target?: FieldCard) => {
    if (!gameState || gameState.currentPlayer === 'player2' || isProcessing) return;

    switch (action) {
      case 'playKnight':
        // playKnight内で正しくhasQueenチェックを行うのでここでは省略
        // （自分の奪われたカードを取り返す場合はQがあっても可能）
        if (target && target.card.value > 0) {
          setGameState(playKnight(gameState, card, target));
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
    if (!gameState || gameState.currentPlayer === 'player2' || isProcessing) return;

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
          setGameState(prev => prev ? ({
            ...prev,
            phase: 'selectTarget',
            selectedAction: 'playOneOff',
            message: needsScrapTarget ? '捨て札を選択' : 'ターゲットを選択',
          }) : null);
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
            setGameState(prev => prev ? ({
              ...prev,
              message: '略奪できるカードがありません',
            }) : null);
          } else {
            setGameState(prev => prev ? ({
              ...prev,
              phase: 'selectTarget',
              selectedAction: 'playPermanent',
              message: '略奪する点数カードを選択',
            }) : null);
          }
        } else {
          setGameState(playAsPermanent(gameState, card));
        }
        break;
      }

      case 'scuttle': {
        if (!gameState.selectedCard) break;
        
        setGameState(prev => prev ? ({
          ...prev,
          phase: 'selectTarget',
          selectedAction: 'scuttle',
          message: 'アタックする点数カードを選択',
        }) : null);
        break;
      }
    }
  }, [gameState, isProcessing]);

  // キャンセル
  const handleCancel = useCallback(() => {
    setGameState(prev => prev ? ({
      ...prev,
      phase: 'selectAction',
      selectedCard: null,
      selectedAction: null,
      targetCard: null,
      message: `${prev.currentPlayer === 'player1' ? 'あなた' : 'CPU'}のターン`,
    }) : null);
  }, []);

  // 画面に応じた表示
  if (screen === 'coinFlip') {
    return (
      <CoinFlip 
        onComplete={handleCoinFlipComplete}
        player1Wins={matchState.player1Wins}
        player2Wins={matchState.player2Wins}
        playerName="あなた"
        enemyName="CPU"
      />
    );
  }

  if (screen === 'roundStart') {
    return (
      <RoundStart
        roundNumber={matchState.currentMatch}
        player1Wins={matchState.player1Wins}
        player2Wins={matchState.player2Wins}
        playerName="あなた"
        enemyName="CPU"
        onComplete={handleRoundStartComplete}
      />
    );
  }

  if (screen === 'finalResult') {
    const isPlayerWin = matchState.player1Wins >= 2;
    return (
      <div className="final-result-screen">
        <div className="final-result-bg" />
        <div className="final-result-content">
          <div className={`final-result-title ${isPlayerWin ? 'win' : 'lose'}`}>
            {isPlayerWin ? '勝利！' : '敗北...'}
          </div>
          <div className="final-result-score">
            {matchState.player1Wins} - {matchState.player2Wins}
          </div>
          <button className="final-result-button" onClick={handleFullRestart}>
            もう一度
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return <div>Loading...</div>;
  }

  return (
    <CuttleBattle
      isOpen={true}
      gameState={gameState}
      onCardSelect={handleCardSelect}
      onFieldCardSelect={handleFieldCardSelect}
      onScrapSelect={handleScrapSelect}
      onAction={handleAction}
      onDirectAction={handleDirectAction}
      onDiscard={handleDiscard}
      onSevenOptionB={handleSevenOptionB}
      onCancel={handleCancel}
      isCPUTurn={gameState.currentPlayer === 'player2'}
      matchInfo={{
        currentMatch: matchState.currentMatch,
        player1Wins: matchState.player1Wins,
        player2Wins: matchState.player2Wins,
      }}
      isDealing={isDealing}
      onDealingComplete={handleDealingComplete}
      playerGoesFirst={matchState.playerStartsFirst}
    />
  );
}

export default App;
