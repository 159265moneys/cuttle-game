import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { GameState, Card, FieldCard, ActionType } from '../types/game';
import { getCardEffect } from '../utils/gameLogic';
import './CuttleBattle.css';

// ========================================
// カトル バトル画面 - 化学式TCG風レイアウト
// ========================================

interface CuttleBattleProps {
  isOpen: boolean;
  onClose: () => void;
  gameState: GameState;
  onCardSelect: (card: Card) => void;
  onFieldCardSelect: (fieldCard: FieldCard) => void;
  onScrapSelect: (card: Card) => void;
  onAction: (action: ActionType) => void;
  onDirectAction: (action: ActionType, card: Card, target?: FieldCard) => void;
  onCancel: () => void;
  onRestart: () => void;
  isCPUTurn: boolean;
}

type Mode = 'default' | 'browsing' | 'dragging';

// 種族名を日本語に
const RACE_NAMES: Record<string, string> = {
  Elf: 'エルフ',
  Goblin: 'ゴブリン',
  Human: 'ニンゲン',
  Demon: 'デーモン',
};

// 種族コード（スプライト用）- 小文字で統一
const RACE_CODES: Record<string, string> = {
  elf: 'e',
  Elf: 'e',
  goblin: 'g',
  Goblin: 'g',
  human: 'h',
  Human: 'h',
  demon: 'd',
  Demon: 'd',
};

// 絵札かどうか判定
const isFaceCard = (rank: string): boolean => {
  return ['A', 'J', 'Q', 'K'].includes(rank);
};

// 数字カードのスート配置（トランプ準拠）
// x: 0=左, 50=中央, 100=右 (%)
// y: 0=上, 25=上中, 50=中央, 75=下中, 100=下 (%)
// inverted: true=180度回転
interface PipPosition {
  x: number;
  y: number;
  inverted?: boolean;
}

const PIP_LAYOUTS: Record<string, PipPosition[]> = {
  '2': [
    { x: 50, y: 15 },
    { x: 50, y: 85, inverted: true },
  ],
  '3': [
    { x: 50, y: 15 },
    { x: 50, y: 50 },
    { x: 50, y: 85, inverted: true },
  ],
  '4': [
    { x: 25, y: 15 },
    { x: 75, y: 15 },
    { x: 25, y: 85, inverted: true },
    { x: 75, y: 85, inverted: true },
  ],
  '5': [
    { x: 25, y: 15 },
    { x: 75, y: 15 },
    { x: 50, y: 50 },
    { x: 25, y: 85, inverted: true },
    { x: 75, y: 85, inverted: true },
  ],
  '6': [
    { x: 25, y: 15 },
    { x: 75, y: 15 },
    { x: 25, y: 50 },
    { x: 75, y: 50 },
    { x: 25, y: 85, inverted: true },
    { x: 75, y: 85, inverted: true },
  ],
  '7': [
    { x: 25, y: 15 },
    { x: 75, y: 15 },
    { x: 50, y: 32 },
    { x: 25, y: 50 },
    { x: 75, y: 50 },
    { x: 25, y: 85, inverted: true },
    { x: 75, y: 85, inverted: true },
  ],
  '8': [
    { x: 25, y: 15 },
    { x: 75, y: 15 },
    { x: 50, y: 32 },
    { x: 25, y: 50 },
    { x: 75, y: 50 },
    { x: 50, y: 68, inverted: true },
    { x: 25, y: 85, inverted: true },
    { x: 75, y: 85, inverted: true },
  ],
  '9': [
    { x: 25, y: 12 },
    { x: 75, y: 12 },
    { x: 25, y: 36 },
    { x: 75, y: 36 },
    { x: 50, y: 50 },
    { x: 25, y: 64, inverted: true },
    { x: 75, y: 64, inverted: true },
    { x: 25, y: 88, inverted: true },
    { x: 75, y: 88, inverted: true },
  ],
  '10': [
    { x: 25, y: 12 },
    { x: 75, y: 12 },
    { x: 50, y: 24 },
    { x: 25, y: 36 },
    { x: 75, y: 36 },
    { x: 25, y: 64, inverted: true },
    { x: 75, y: 64, inverted: true },
    { x: 50, y: 76, inverted: true },
    { x: 25, y: 88, inverted: true },
    { x: 75, y: 88, inverted: true },
  ],
};

// ベースURL（GitHub Pages対応）
const BASE_URL = import.meta.env.BASE_URL || '/';

// スプライトパス生成
const getSuitSpritePath = (race: string): string => {
  return `${BASE_URL}sprite/suit/${race.toLowerCase()}.png`;
};

const getFaceSpritePath = (race: string, rank: string): string => {
  const raceCode = RACE_CODES[race] || RACE_CODES[race.toLowerCase()] || 'h';
  const rankCode = rank.toLowerCase();
  return `${BASE_URL}sprite/ajqk/${raceCode}${rankCode}.png`;
};

// CSS mask用のスタイルオブジェクト生成（webkit対応）
const getMaskStyle = (url: string): React.CSSProperties => ({
  WebkitMaskImage: `url(${url})`,
  maskImage: `url(${url})`,
});

// スートアイコン用のmaskスタイル
const getSuitMaskStyle = (race: string): React.CSSProperties => 
  getMaskStyle(getSuitSpritePath(race));

// 絵札イラスト用のmaskスタイル
const getFaceMaskStyle = (race: string, rank: string): React.CSSProperties => 
  getMaskStyle(getFaceSpritePath(race, rank));

// カード枚数から表示する重なり枚数を計算
function getStackCount(count: number): number {
  if (count <= 1) return count;
  if (count <= 5) return count;
  if (count <= 10) return 6;
  if (count <= 15) return 7;
  if (count <= 20) return 8;
  if (count <= 25) return 9;
  if (count <= 30) return 10;
  if (count <= 35) return 11;
  return 12;
}

// ログエントリ
interface LogEntry {
  id: number;
  player: 'player1' | 'player2';
  message: string;
}

const CuttleBattle: React.FC<CuttleBattleProps> = ({
  isOpen,
  onClose,
  gameState,
  onCardSelect,
  onFieldCardSelect,
  onScrapSelect,
  onAction,
  onDirectAction,
  onRestart,
  isCPUTurn,
}) => {
  // UIモード
  const [mode, setMode] = useState<Mode>('default');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [touchCurrent, setTouchCurrent] = useState({ x: 0, y: 0 });
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [showScrapModal, setShowScrapModal] = useState(false);
  
  // アクション確認モーダル用
  const [pendingCard, setPendingCard] = useState<Card | null>(null);
  const [pendingTarget, setPendingTarget] = useState<FieldCard | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  
  // 8の選択モーダル用
  const [show8ChoiceModal, setShow8ChoiceModal] = useState(false);
  const [pending8Card, setPending8Card] = useState<Card | null>(null);
  
  // ログシステム
  const [actionLogs, setActionLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  
  // refs
  const screenRef = useRef<HTMLDivElement>(null);
  const playerPointsRef = useRef<HTMLDivElement>(null);
  const playerEffectsRef = useRef<HTMLDivElement>(null);
  const enemyPointsRef = useRef<HTMLDivElement>(null);
  const enemyEffectsRef = useRef<HTMLDivElement>(null);
  
  const player = gameState.player1;
  const enemy = gameState.player2;
  
  // ログ追加関数
  const addLog = useCallback((playerType: 'player1' | 'player2', message: string) => {
    logIdRef.current += 1;
    setActionLogs(prev => {
      const newLogs = [...prev, { id: logIdRef.current, player: playerType, message }];
      return newLogs.slice(-5); // 最新5件のみ
    });
  }, []);
  
  // ゲーム状態の変化を監視してログを追加
  const prevPhaseRef = useRef(gameState.phase);
  const prevPlayer1FieldRef = useRef(player.field.length);
  const prevPlayer2FieldRef = useRef(enemy.field.length);
  const prevScrapRef = useRef(gameState.scrapPile.length);
  
  useEffect(() => {
    // フィールドカード数の変化を検出
    const p1FieldDiff = player.field.length - prevPlayer1FieldRef.current;
    const p2FieldDiff = enemy.field.length - prevPlayer2FieldRef.current;
    const scrapDiff = gameState.scrapPile.length - prevScrapRef.current;
    
    // プレイヤーがカードをプレイ
    if (p1FieldDiff > 0 && gameState.currentPlayer === 'player2') {
      const newCard = player.field[player.field.length - 1];
      if (newCard) {
        addLog('player1', `${newCard.card.rank}をプレイ`);
      }
    }
    
    // CPUがカードをプレイ
    if (p2FieldDiff > 0 && gameState.currentPlayer === 'player1') {
      const newCard = enemy.field[enemy.field.length - 1];
      if (newCard) {
        addLog('player2', `${newCard.card.rank}をプレイ`);
      }
    }
    
    // カードが墓地に送られた
    if (scrapDiff > 0) {
      const lastScrap = gameState.scrapPile[gameState.scrapPile.length - 1];
      if (lastScrap && prevPhaseRef.current !== 'gameOver') {
        // 詳細なログは難しいのでシンプルに
      }
    }
    
    // ゲームオーバー
    if (gameState.phase === 'gameOver' && prevPhaseRef.current !== 'gameOver') {
      const winner = player.field.reduce((sum, fc) => sum + fc.card.value, 0) >= 21 ? 'player1' : 'player2';
      addLog(winner, '勝利！');
    }
    
    prevPhaseRef.current = gameState.phase;
    prevPlayer1FieldRef.current = player.field.length;
    prevPlayer2FieldRef.current = enemy.field.length;
    prevScrapRef.current = gameState.scrapPile.length;
  }, [gameState, player.field, enemy.field, addLog]);
  
  // 3の効果: 捨て札選択フェーズで自動的にモーダルを開く
  useEffect(() => {
    if (gameState.phase === 'selectTarget' && 
        gameState.selectedCard?.rank === '3' &&
        gameState.scrapPile.length > 0) {
      setShowScrapModal(true);
    }
  }, [gameState.phase, gameState.selectedCard, gameState.scrapPile.length]);
  
  // 点数計算（controller を考慮 - Jで略奪したカードの点数も正しく計算）
  const calculatePoints = (playerId: 'player1' | 'player2') => {
    let points = 0;
    // 両プレイヤーのフィールドを確認し、controllerが自分のカードの点数を合計
    for (const fc of player.field) {
      if (fc.controller === playerId && fc.card.value > 0) {
        points += fc.card.value;
      }
    }
    for (const fc of enemy.field) {
      if (fc.controller === playerId && fc.card.value > 0) {
        points += fc.card.value;
      }
    }
    return points;
  };
  
  const playerPoints = calculatePoints('player1');
  const enemyPoints = calculatePoints('player2');
  
  // 勝利点数（Kの枚数で変動）
  const WINNING_POINTS: Record<number, number> = { 0: 21, 1: 14, 2: 10, 3: 7, 4: 5 };
  const playerWinTarget = WINNING_POINTS[Math.min(player.kings, 4)];
  const enemyWinTarget = WINNING_POINTS[Math.min(enemy.kings, 4)];
  
  // 永続効果カード（8, J, Q, K）
  const isPermanentEffect = (card: Card) => {
    return ['8', 'J', 'Q', 'K'].includes(card.rank);
  };
  
  // 点数カード
  const isPointCard = (fc: FieldCard) => fc.card.value > 0;
  
  // フィールドを分類
  const playerPointCards = player.field.filter(isPointCard);
  const playerEffectCards = player.field.filter(fc => !isPointCard(fc) || isPermanentEffect(fc.card));
  const enemyPointCards = enemy.field.filter(isPointCard);
  const enemyEffectCards = enemy.field.filter(fc => !isPointCard(fc) || isPermanentEffect(fc.card));
  
  // 閲覧モード終了
  const hideBrowsing = useCallback(() => {
    setMode('default');
    setSelectedIndex(-1);
    setDropTarget(null);
  }, []);
  
  // アクション確認モーダルを閉じる
  const closeActionModal = useCallback(() => {
    setShowActionModal(false);
    setPendingCard(null);
    setPendingTarget(null);
  }, []);
  
  // スカトル実行（直接アクションを使用）
  const executeScuttle = useCallback(() => {
    if (!pendingCard || !pendingTarget) return;
    
    // 直接アクション実行（状態のクロージャ問題を回避）
    onDirectAction('scuttle', pendingCard, pendingTarget);
    addLog('player1', `${pendingCard.rank}で${pendingTarget.card.rank}を破壊`);
    
    closeActionModal();
  }, [pendingCard, pendingTarget, onDirectAction, addLog, closeActionModal]);
  
  // 効果発動実行（直接アクションを使用）
  const executeEffect = useCallback(() => {
    if (!pendingCard || !pendingTarget) return;
    
    // 直接アクション実行（状態のクロージャ問題を回避）
    if (pendingCard.rank === 'J') {
      // J: 略奪（相手の点数カードを自分のものに）
      onDirectAction('playKnight', pendingCard, pendingTarget);
      addLog('player1', `Jで${pendingTarget.card.rank}を略奪`);
    } else if (['A', '2', '9', '10'].includes(pendingCard.rank)) {
      // ワンオフ効果
      onDirectAction('playOneOff', pendingCard, pendingTarget);
      if (pendingCard.rank === '9' || pendingCard.rank === '10') {
        addLog('player1', `${pendingCard.rank}で${pendingTarget.card.rank}を手札に戻した`);
      } else if (pendingCard.rank === 'A') {
        addLog('player1', `Aで${pendingTarget.card.rank}の点数カードを破壊`);
      } else if (pendingCard.rank === '2') {
        addLog('player1', `2で${pendingTarget.card.rank}の永続効果を破壊`);
      }
    }
    
    closeActionModal();
  }, [pendingCard, pendingTarget, onDirectAction, addLog, closeActionModal]);
  
  // タッチ開始
  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent, index: number) => {
    if (isCPUTurn || gameState.phase === 'gameOver') return;
    
    // ReactのイベントはpassiveではないのでpreventDefaultは使用可能
    // ただしスクロール防止のみ必要な場合は後で行う
    e.stopPropagation();
    
    const touch = 'touches' in e ? e.touches[0] : e;
    const startPos = { x: touch.clientX, y: touch.clientY };
    
    // カードを選択状態にする（これがないとplayAsPoint等が動かない）
    const card = player.hand[index];
    if (card) {
      onCardSelect(card);
    }
    
    setTouchStart(startPos);
    setTouchCurrent(startPos);
    setSelectedIndex(index);
    setMode('browsing');
  }, [isCPUTurn, gameState.phase, player.hand, onCardSelect]);
  
  // タッチ移動
  const handleTouchMove = useCallback((e: TouchEvent | MouseEvent) => {
    if (mode === 'default') return;
    
    const touch = 'touches' in e ? e.touches[0] : e;
    const current = { x: touch.clientX, y: touch.clientY };
    setTouchCurrent(current);
    
    if (mode === 'browsing') {
      // 上に50px以上 → ドラッグモード
      if (touchStart.y - current.y > 50) {
        setMode('dragging');
        return;
      }
      
      // 横移動 → カード選択切り替え
      const browseCards = document.querySelectorAll('.cuttle-browse-card');
      browseCards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        if (current.x >= rect.left && current.x <= rect.right) {
          const newIndex = parseInt(card.getAttribute('data-index') || '-1');
          if (newIndex !== selectedIndex && newIndex >= 0) {
            setSelectedIndex(newIndex);
          }
        }
      });
    } else if (mode === 'dragging') {
      // ドロップターゲット判定
      let newTarget: string | null = null;
      
      // 自分の点数エリア
      if (playerPointsRef.current) {
        const rect = playerPointsRef.current.getBoundingClientRect();
        if (current.x >= rect.left && current.x <= rect.right &&
            current.y >= rect.top && current.y <= rect.bottom) {
          newTarget = 'playerPoints';
        }
      }
      
      // 自分の効果エリア
      if (playerEffectsRef.current) {
        const rect = playerEffectsRef.current.getBoundingClientRect();
        if (current.x >= rect.left && current.x <= rect.right &&
            current.y >= rect.top && current.y <= rect.bottom) {
          newTarget = 'playerEffects';
        }
      }
      
      // 敵の点数エリア（スカトル/Jターゲット）
      if (enemyPointsRef.current) {
        const rect = enemyPointsRef.current.getBoundingClientRect();
        if (current.x >= rect.left && current.x <= rect.right &&
            current.y >= rect.top && current.y <= rect.bottom) {
          newTarget = 'enemyPoints';
        }
      }
      
      // 敵の効果エリア（2で永続破壊）
      if (enemyEffectsRef.current) {
        const rect = enemyEffectsRef.current.getBoundingClientRect();
        if (current.x >= rect.left && current.x <= rect.right &&
            current.y >= rect.top && current.y <= rect.bottom) {
          newTarget = 'enemyEffects';
        }
      }
      
      // 敵の点数カード個別判定
      const enemyPointCardElements = document.querySelectorAll('.cuttle-enemy-points-area .cuttle-field-card-wrapper');
      enemyPointCardElements.forEach((card, i) => {
        const rect = card.getBoundingClientRect();
        if (current.x >= rect.left && current.x <= rect.right &&
            current.y >= rect.top && current.y <= rect.bottom) {
          newTarget = `enemyCard:${i}`;
        }
      });
      
      // 敵の効果カード個別判定
      const enemyEffectCardElements = document.querySelectorAll('.cuttle-enemy-effects .cuttle-field-card-wrapper');
      enemyEffectCardElements.forEach((card, i) => {
        const rect = card.getBoundingClientRect();
        if (current.x >= rect.left && current.x <= rect.right &&
            current.y >= rect.top && current.y <= rect.bottom) {
          newTarget = `enemyEffect:${i}`;
        }
      });
      
      setDropTarget(newTarget);
    }
  }, [mode, touchStart, selectedIndex]);
  
  // タッチ終了
  const handleTouchEnd = useCallback(() => {
    if (mode === 'browsing') {
      hideBrowsing();
    } else if (mode === 'dragging') {
      // ドロップ処理
      const card = player.hand[selectedIndex];
      
      if (card && dropTarget) {
        if (dropTarget === 'playerPoints') {
          // 点数として出す
          if (card.value > 0) {
            onAction('playPoint');
            addLog('player1', `${card.rank}を点数としてプレイ`);
          }
        } else if (dropTarget === 'playerEffects') {
          // 効果として出す
          if (card.rank === '8') {
            // 8は点数か永続か選択させる
            setPending8Card(card);
            setShow8ChoiceModal(true);
          } else if (isPermanentEffect(card)) {
            // J以外の永続効果（Q, K）
            if (card.rank !== 'J') {
            onAction('playPermanent');
              addLog('player1', `${card.rank}の効果を発動`);
            }
          } else if (card.rank === '3') {
            // 3は捨て札選択が必要
            if (gameState.scrapPile.length > 0) {
              onCardSelect(card);
              onAction('playOneOff');
              // モーダルはuseEffectで自動的に開く
            }
          } else {
            // ワンオフ効果（ターゲット不要のもの: 4, 5, 6, 7）
            if (!['A', '2', '9', '10'].includes(card.rank)) {
            onAction('playOneOff');
              addLog('player1', `${card.rank}の効果を発動`);
            }
          }
        } else if (dropTarget.startsWith('enemyCard:')) {
          // 敵の点数カードへのドロップ → アクション確認モーダル表示
          const targetIndex = parseInt(dropTarget.split(':')[1]);
          const targetFC = enemyPointCards[targetIndex];
          
          if (targetFC) {
            // 有効なアクションがあるかチェック
            const canScuttle = card.value > 0 && card.value >= targetFC.card.value;
            const canUseEffect = ['A', '9', '10', 'J'].includes(card.rank);
            
            if (canScuttle || canUseEffect) {
              setPendingCard(card);
              setPendingTarget(targetFC);
              setShowActionModal(true);
            }
          }
        } else if (dropTarget.startsWith('enemyEffect:')) {
          // 敵の永続効果カードへのドロップ → 2カードで破壊
          const targetIndex = parseInt(dropTarget.split(':')[1]);
          const targetFC = enemyEffectCards[targetIndex];
          
          if (targetFC) {
            // 2カードで永続効果を破壊、または9で手札に戻す
            const canUseEffect = ['2', '9'].includes(card.rank);
            
            if (canUseEffect) {
              setPendingCard(card);
              setPendingTarget(targetFC);
              setShowActionModal(true);
            }
          }
        }
      }
      
      hideBrowsing();
    }
    
    setMode('default');
    setSelectedIndex(-1);
    setDropTarget(null);
  }, [mode, selectedIndex, dropTarget, player.hand, enemyPointCards, enemyEffectCards, onAction, hideBrowsing, addLog]);
  
  // グローバルイベント
  useEffect(() => {
    if (!isOpen) return;
    
    const handleMove = (e: TouchEvent | MouseEvent) => {
      if (mode !== 'default') {
        e.preventDefault();
        handleTouchMove(e);
      }
    };
    
    const handleEnd = () => {
      if (mode !== 'default') {
        handleTouchEnd();
      }
    };
    
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('mouseup', handleEnd);
    
    return () => {
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('mouseup', handleEnd);
    };
  }, [isOpen, mode, handleTouchMove, handleTouchEnd]);
  
  // カードのスートクラス
  const getSuitClass = (card: Card) => {
    return `suit-${card.race.toLowerCase()}`;
  };
  
  // 手札カードをレンダリング（元サイズ、動的重なり計算）
  const renderHandCard = (card: Card, index: number) => {
    const count = player.hand.length;
    const cardWidth = 64;
    const screenWidth = 380;
    
    const maxSpacing = 48;
    const minSpacing = 25;
    
    let spacing: number;
    if (count <= 1) {
      spacing = 0;
    } else {
      const fitSpacing = (screenWidth - cardWidth) / (count - 1);
      spacing = Math.min(maxSpacing, Math.max(minSpacing, fitSpacing));
    }
    
    const maxAngle = 15;
    const centerIdx = (count - 1) / 2;
    const offset = index - centerIdx;
    const angle = count <= 1 ? 0 : (offset / Math.max(centerIdx, 0.5)) * maxAngle;
    const xOffset = offset * spacing;
    const yOffset = Math.abs(offset) * 5;
    
    const pipLayout = PIP_LAYOUTS[card.rank];
    
    return (
      <div
        key={`${card.rank}-${card.race}-${index}`}
        className={`cuttle-hand-card ${getSuitClass(card)} playable`}
        data-index={index}
        style={{
          '--angle': `${angle}deg`,
          '--x-offset': `${xOffset}px`,
          '--y-offset': `${yOffset}px`,
          zIndex: 51 + index,
        } as React.CSSProperties}
        onTouchStart={(e) => handleTouchStart(e, index)}
        onMouseDown={(e) => handleTouchStart(e, index)}
      >
        {/* カード背景 - 羊皮紙テクスチャ */}
        <div className="card-parchment" />
        
        {/* 絵札イラスト（A,J,Q,K） */}
        {isFaceCard(card.rank) && (
          <div 
            className="card-face-art"
            style={getFaceMaskStyle(card.race, card.rank)}
          />
        )}
        
        {/* ランク表示 - 左上 */}
        <div className="card-rank top-left">{card.rank}</div>
        
        {/* ランク表示 - 右下（反転） */}
        <div className="card-rank bottom-right">{card.rank}</div>
        
        {/* 数字カードのスート配置（トランプ準拠） */}
        {pipLayout && (
          <div className="card-pips">
            {pipLayout.map((pip, i) => (
              <div
                key={i}
                className={`card-pip ${pip.inverted ? 'inverted' : ''}`}
                style={{
                  left: `${pip.x}%`,
                  top: `${pip.y}%`,
                  ...getSuitMaskStyle(card.race),
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };
  
  // 閲覧モード手札カードをレンダリング
  const renderBrowseCard = (card: Card, index: number) => {
    const count = player.hand.length;
    const maxWidth = 320;
    const maxSpacing = 65;
    const minSpacing = 35;
    
    // 動的spacing計算
    let spacing: number;
    if (count <= 1) {
      spacing = 0;
    } else {
      const neededWidth = (count - 1) * maxSpacing;
      if (neededWidth <= maxWidth) {
        spacing = maxSpacing;
      } else {
        spacing = Math.max(minSpacing, maxWidth / (count - 1));
      }
    }
    
    const maxAngle = 10;
    const centerIdx = (count - 1) / 2;
    const offset = index - centerIdx;
    const angle = count <= 1 ? 0 : (offset / Math.max(centerIdx, 0.5)) * maxAngle;
    const xOffset = offset * spacing;
    const yOffset = Math.abs(offset) * 5;
    
    const isSelected = index === selectedIndex;
    
    const pipLayout = PIP_LAYOUTS[card.rank];
    
    return (
      <div
        key={`browse-${card.rank}-${card.race}-${index}`}
        className={`cuttle-browse-card ${getSuitClass(card)} ${isSelected ? 'selected' : ''}`}
        data-index={index}
        style={{
          left: `calc(50% + ${xOffset}px)`,
          transform: `translateX(-50%) translateY(${yOffset}px) rotate(${angle}deg)`,
          zIndex: isSelected ? 100 : index + 1,
        }}
      >
        <div className="card-parchment" />
        {isFaceCard(card.rank) && (
          <div 
            className="card-face-art"
            style={getFaceMaskStyle(card.race, card.rank)}
          />
        )}
        <div className="card-rank top-left">{card.rank}</div>
        <div className="card-rank bottom-right">{card.rank}</div>
        {pipLayout && (
          <div className="card-pips">
            {pipLayout.map((pip, i) => (
              <div
                key={i}
                className={`card-pip ${pip.inverted ? 'inverted' : ''}`}
                style={{
                  left: `${pip.x}%`,
                  top: `${pip.y}%`,
                  ...getSuitMaskStyle(card.race),
                }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };
  
  // プレビューカード
  const renderPreviewCard = () => {
    if (selectedIndex < 0 || !player.hand[selectedIndex]) return null;
    
    const card = player.hand[selectedIndex];
    const pipLayout = PIP_LAYOUTS[card.rank];
    
    return (
      <div className="cuttle-preview-container">
        {/* カード本体 */}
      <div className={`cuttle-preview-card ${getSuitClass(card)}`}>
          <div className="card-parchment" />
          {isFaceCard(card.rank) && (
            <div 
              className="card-face-art large"
              style={getFaceMaskStyle(card.race, card.rank)}
            />
          )}
          <div 
            className="card-suit-icon corner top-left large"
            style={getSuitMaskStyle(card.race)}
          />
          <div 
            className="card-suit-icon corner bottom-right large"
            style={getSuitMaskStyle(card.race)}
          />
          <div className="card-rank top-left">{card.rank}</div>
          <div className="card-rank bottom-right">{card.rank}</div>
          {pipLayout && (
            <div className="card-pips large">
              {pipLayout.map((pip, i) => (
                <div
                  key={i}
                  className={`card-pip large ${pip.inverted ? 'inverted' : ''}`}
                  style={{
                    left: `${pip.x}%`,
                    top: `${pip.y}%`,
                    ...getSuitMaskStyle(card.race),
                  }}
                />
              ))}
            </div>
          )}
        </div>
        
        {/* 効果テキストボックス（カードの下） */}
        <div className={`preview-effect-box ${getSuitClass(card)}`}>
          <div className="effect-header">
            <div 
              className="effect-icon"
              style={getSuitMaskStyle(card.race)}
            />
            <div className="effect-title">{card.rank} - {RACE_NAMES[card.race]}</div>
          </div>
          <div className="effect-text">{getCardEffect(card)}</div>
        </div>
      </div>
    );
  };
  
  // フィールドカードをレンダリング（フルデザイン、エリア縦幅いっぱい）
  const renderFieldCards = (cards: FieldCard[], isEnemy: boolean) => {
    if (cards.length === 0) {
      return <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>空</span>;
    }
    
    return (
      <div className="cuttle-field-cards-full">
        {cards.map((fc, i) => {
          const isDropTarget = dropTarget === `enemyCard:${i}` && isEnemy;
          const pipLayout = PIP_LAYOUTS[fc.card.rank];
          
          return (
            <div
              key={`field-${fc.card.rank}-${fc.card.race}-${i}`}
              className={`cuttle-field-card-wrapper ${getSuitClass(fc.card)}`}
              style={{ zIndex: i + 1 }}
            >
              {/* カード本体 */}
              <div
                className={`cuttle-field-card-full ${getSuitClass(fc.card)} ${fc.controller !== fc.owner ? 'stolen' : ''} ${isDropTarget ? 'drop-target' : ''}`}
              onClick={() => {
                if (gameState.phase === 'selectTarget' && isEnemy) {
                  onFieldCardSelect(fc);
                }
              }}
            >
                {/* カード背景 */}
                <div className="card-parchment" />
                
                {/* 絵札イラスト */}
                {isFaceCard(fc.card.rank) && (
                  <div 
                    className="card-face-art field"
                    style={getFaceMaskStyle(fc.card.race, fc.card.rank)}
                  />
                )}
                
                {/* ランク表示 */}
                <div className="card-rank top-left field">{fc.card.rank}</div>
                <div className="card-rank bottom-right field">{fc.card.rank}</div>
                
                {/* 数字カードのスート配置 */}
                {pipLayout && (
                  <div className="card-pips field">
                    {pipLayout.map((pip, j) => (
                      <div
                        key={j}
                        className={`card-pip field ${pip.inverted ? 'inverted' : ''}`}
                        style={{
                          left: `${pip.x}%`,
                          top: `${pip.y}%`,
                          ...getSuitMaskStyle(fc.card.race),
                        }}
                      />
                    ))}
                  </div>
                )}
                
                {/* J略奪オーバーレイ */}
                {fc.controller !== fc.owner && (
                  <div className="stolen-overlay">
                    <span className="stolen-j">J</span>
                  </div>
                )}
              </div>
              
              {/* 下部情報ボックス（カード外） */}
              <div className="field-card-info">
                <div 
                  className="field-card-info-icon"
                  style={getSuitMaskStyle(fc.card.race)}
                />
                <span className="field-card-info-rank">{fc.card.rank}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  
  // 効果カードをレンダリング（フルデザイン）
  const renderEffectCards = (cards: FieldCard[]) => {
    const permanents = cards.filter(fc => isPermanentEffect(fc.card));
    
    if (permanents.length === 0) {
      return <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>効果なし</span>;
    }
    
    return (
      <div className="cuttle-effect-cards-full">
        {permanents.map((fc, i) => (
          <div
            key={`effect-${fc.card.rank}-${fc.card.race}-${i}`}
            className={`cuttle-field-card-wrapper ${getSuitClass(fc.card)}`}
            style={{ zIndex: i + 1 }}
          >
            {/* カード本体 */}
            <div className={`cuttle-field-card-full effect ${getSuitClass(fc.card)}`}>
              {/* カード背景 */}
              <div className="card-parchment" />
              
              {/* 絵札イラスト（8, J, Q, K） */}
              <div 
                className="card-face-art field"
                style={getFaceMaskStyle(fc.card.race, fc.card.rank)}
              />
              
              {/* ランク表示 */}
              <div className="card-rank top-left field">{fc.card.rank}</div>
              <div className="card-rank bottom-right field">{fc.card.rank}</div>
            </div>
            
            {/* 下部情報ボックス（カード外） */}
            <div className="field-card-info">
              <div 
                className="field-card-info-icon"
                style={getSuitMaskStyle(fc.card.race)}
              />
              <span className="field-card-info-rank">{fc.card.rank}</span>
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  if (!isOpen) return null;
  
  const isGameOver = gameState.phase === 'gameOver';
  const isWin = playerPoints >= 21;
  
  return (
    <div ref={screenRef} className={`cuttle-battle ${isOpen ? 'active' : ''}`}>
      {/* 敵情報バー - 右寄せ: アイコン | 名前 | 点数 */}
      <div className="cuttle-enemy-info">
        <div className="cuttle-player-info-row right-aligned">
          <div className="cuttle-player-icon enemy">👹</div>
          <span className="cuttle-player-name">{enemy.name}</span>
          <span className="cuttle-points-display">{enemyPoints}<span className="points-unit">pt/{enemyWinTarget}</span></span>
        </div>
      </div>
      
      {/* 敵手札（扇状 - 逆向き：敵なので上に開く） */}
      <div className="cuttle-enemy-hand">
        {enemy.hand.map((_, i) => {
          const count = enemy.hand.length;
          const maxAngle = 12;
          const maxSpacing = 40;
          const minSpacing = 22;
          const cardWidth = 48;
          const screenWidth = 360;
          
          let spacing: number;
          if (count <= 1) {
            spacing = 0;
          } else {
            const fitSpacing = (screenWidth - cardWidth) / (count - 1);
            spacing = Math.min(maxSpacing, Math.max(minSpacing, fitSpacing));
          }
          
          const centerIdx = (count - 1) / 2;
          const offset = i - centerIdx;
          // 敵の手札は逆向きなので角度を反転
          const angle = count <= 1 ? 0 : (offset / Math.max(centerIdx, 0.5)) * -maxAngle;
          const xOffset = offset * spacing;
          // 端が上に上がるようにマイナス
          const yOffset = -Math.abs(offset) * 3;
          
          return (
            <div
              key={i}
              className="cuttle-enemy-card-back"
              style={{
                transform: `translateX(calc(-50% + ${xOffset}px)) translateY(${yOffset}px) rotate(${angle}deg)`,
                zIndex: i + 1,
              }}
            >
              {/* 羊皮紙背景 */}
              <div className="card-back-parchment" />
              
              {/* 中央メインイラスト */}
              <div 
                className="card-back-main"
                style={getMaskStyle(`${BASE_URL}sprite/back/backmain.png`)}
              />
              
              {/* 四隅のスートアイコン（向かい合わせ） */}
              <div 
                className="card-back-suit top-left"
                style={getMaskStyle(`${BASE_URL}sprite/suit/human.png`)}
              />
              <div 
                className="card-back-suit top-right"
                style={getMaskStyle(`${BASE_URL}sprite/suit/elf.png`)}
              />
              <div 
                className="card-back-suit bottom-left"
                style={getMaskStyle(`${BASE_URL}sprite/suit/goblin.png`)}
              />
              <div 
                className="card-back-suit bottom-right"
                style={getMaskStyle(`${BASE_URL}sprite/suit/demon.png`)}
              />
              
              {/* 装飾フレーム */}
              <div className="card-back-frame" />
            </div>
          );
        })}
      </div>
      
      {/* 敵 効果エリア */}
      <div 
        ref={enemyEffectsRef}
        className={`cuttle-enemy-effects ${dropTarget === 'enemyEffects' ? 'drop-highlight' : ''}`}
      >
        {renderEffectCards(enemyEffectCards)}
      </div>
      
      {/* 敵 点数エリア */}
      <div 
        ref={enemyPointsRef}
        className={`cuttle-enemy-points-area ${dropTarget?.startsWith('enemy') ? 'drop-highlight' : ''}`}
      >
        {renderFieldCards(enemyPointCards, true)}
      </div>
      
      {/* 山札・メッセージ・墓地 */}
      <div className="cuttle-deck-area">
        {/* 山札 - 重なり表現 */}
        <div className="cuttle-pile-stack">
          {Array.from({ length: getStackCount(gameState.deck.length) }).map((_, i, arr) => (
            <div
              key={`deck-${i}`}
              className="cuttle-deck-card"
              style={{
                position: i === arr.length - 1 ? 'relative' : 'absolute',
                top: `${-i * 0.7}px`,
                left: `${i * 0.35}px`,
                zIndex: i,
              }}
            >
              {i === arr.length - 1 && (
                <>
          <span className="pile-title">山札</span>
                  <span className="pile-count">{gameState.deck.length}</span>
                </>
              )}
            </div>
          ))}
          {gameState.deck.length === 0 && (
            <div className="cuttle-deck-card empty">
              <span className="pile-title">山札</span>
              <span className="pile-count">0</span>
            </div>
          )}
        </div>
        
        {/* アクションログ - 最新5件表示 */}
        <div className="cuttle-action-log">
          {actionLogs.length === 0 ? (
            <span className="log-action">ゲーム開始</span>
          ) : (
            <div className="log-entries">
              {actionLogs.map(log => (
                <div key={log.id} className={`log-entry ${log.player}`}>
                  <span className="log-name">{log.player === 'player1' ? player.name : enemy.name}</span>
                  <span className="log-msg">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* 墓地 - 重なり表現 */}
        <div className="cuttle-pile-stack" onClick={() => setShowScrapModal(true)}>
          {Array.from({ length: getStackCount(gameState.scrapPile.length) }).map((_, i, arr) => (
        <div 
              key={`scrap-${i}`}
          className="cuttle-scrap-card"
              style={{
                position: i === arr.length - 1 ? 'relative' : 'absolute',
                top: `${-i * 0.7}px`,
                right: `${i * 0.35}px`,
                zIndex: i,
              }}
            >
              {i === arr.length - 1 && (
                <>
          <span className="pile-title">墓地</span>
                  <span className="pile-count">{gameState.scrapPile.length}</span>
                </>
              )}
            </div>
          ))}
          {gameState.scrapPile.length === 0 && (
            <div className="cuttle-scrap-card empty">
              <span className="pile-title">墓地</span>
              <span className="pile-count">0</span>
            </div>
          )}
        </div>
      </div>
      
      {/* 自分 点数エリア */}
      <div 
        ref={playerPointsRef}
        className={`cuttle-player-points-area ${dropTarget === 'playerPoints' ? 'drop-highlight' : ''}`}
      >
        {renderFieldCards(playerPointCards, false)}
      </div>
      
      {/* 自分 効果エリア */}
      <div 
        ref={playerEffectsRef}
        className={`cuttle-player-effects ${dropTarget === 'playerEffects' ? 'drop-highlight' : ''}`}
      >
        {renderEffectCards(playerEffectCards)}
      </div>
      
      {/* ステータスバー */}
      <div className="cuttle-status-bar">
        {/* 自分情報 - 左寄せ: アイコン | 名前 | 点数 */}
        <div className="cuttle-player-info-row left-aligned">
          <div className="cuttle-player-icon player">⚔️</div>
          <span className="cuttle-player-name">{player.name}</span>
          <span className="cuttle-points-display">{playerPoints}<span className="points-unit">pt/{playerWinTarget}</span></span>
        </div>
        <div className="cuttle-actions">
          <button
            className="cuttle-btn cuttle-btn-draw"
            onClick={() => onAction('draw')}
            disabled={isCPUTurn || gameState.deck.length === 0}
          >
            ドロー
          </button>
          <button
            className="cuttle-btn cuttle-btn-pass"
            onClick={() => onAction('pass')}
            disabled={isCPUTurn}
          >
            パス
          </button>
          <button
            className="cuttle-btn cuttle-btn-pass"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </div>
      
      {/* 手札 */}
      <div className="cuttle-hand">
        {player.hand.map(renderHandCard)}
      </div>
      
      {/* 下部余白 */}
      <div className="cuttle-bottom-spacer" />
      
      {/* 閲覧モード オーバーレイ */}
      <div className={`cuttle-overlay ${mode === 'browsing' ? 'active' : ''}`} />
      
      {/* 閲覧モード 拡大カード */}
      <div className={`cuttle-preview ${mode === 'browsing' ? 'active' : ''}`}>
        {renderPreviewCard()}
      </div>
      
      {/* 閲覧モード 手札 */}
      <div className={`cuttle-browse-hand ${mode === 'browsing' ? 'active' : ''}`}>
        {player.hand.map(renderBrowseCard)}
      </div>
      
      {/* ドラッグカード */}
      {mode === 'dragging' && selectedIndex >= 0 && player.hand[selectedIndex] && (() => {
        const dragCard = player.hand[selectedIndex];
        const pipLayout = PIP_LAYOUTS[dragCard.rank];
        return (
        <div
            className={`cuttle-drag ${getSuitClass(dragCard)}`}
          style={{
              left: touchCurrent.x - 50,
              top: touchCurrent.y - 70,
            }}
          >
            <div className="card-parchment" />
            {isFaceCard(dragCard.rank) && (
              <div 
                className="card-face-art"
                style={getFaceMaskStyle(dragCard.race, dragCard.rank)}
              />
            )}
            <div className="card-rank top-left">{dragCard.rank}</div>
            <div className="card-rank bottom-right">{dragCard.rank}</div>
            {pipLayout && (
              <div className="card-pips">
                {pipLayout.map((pip, i) => (
                  <div
                    key={i}
                    className={`card-pip ${pip.inverted ? 'inverted' : ''}`}
                    style={{
                      left: `${pip.x}%`,
                      top: `${pip.y}%`,
                      ...getSuitMaskStyle(dragCard.race),
                    }}
                  />
                ))}
        </div>
      )}
          </div>
        );
      })()}
      
      {/* ゲームオーバー */}
      {isGameOver && (
        <div className="cuttle-game-over">
          <div className="result-icon">{isWin ? '🏆' : '💀'}</div>
          <div className={`result-text ${isWin ? 'win' : 'lose'}`}>
            {isWin ? '勝利！' : '敗北...'}
          </div>
          <button className="btn-restart" onClick={onRestart}>
            もう一度
          </button>
        </div>
      )}
      
      {/* 墓地モーダル */}
      <div className={`cuttle-scrap-modal ${showScrapModal ? 'active' : ''}`}>
        <div className="modal-title">墓地 ({gameState.scrapPile.length}枚)</div>
        <div className="modal-cards">
          {gameState.scrapPile.map((card, i) => {
            const isSelectable = gameState.phase === 'selectTarget' && 
                                 gameState.selectedCard?.rank === '3';
            return (
              <div
                key={`scrap-${card.rank}-${card.race}-${i}`}
                className={`modal-card ${isSelectable ? 'selectable' : ''}`}
                onClick={() => {
                  if (isSelectable) {
                    onScrapSelect(card);
                    setShowScrapModal(false);
                  }
                }}
              >
                <div style={{ fontSize: '1rem', fontWeight: 'bold', color: '#333' }}>{card.rank}</div>
                <div style={{ fontSize: '0.55rem', color: '#666' }}>{RACE_NAMES[card.race]}</div>
              </div>
            );
          })}
        </div>
        <button className="btn-close" onClick={() => setShowScrapModal(false)}>
          閉じる
        </button>
      </div>
      
      {/* アクション確認モーダル */}
      {showActionModal && pendingCard && pendingTarget && (
        <div className="cuttle-action-modal">
          <div className="action-modal-content">
            <div className="action-modal-title">
              {pendingCard.rank} → {pendingTarget.card.rank}
            </div>
            <div className="action-modal-desc">
              どのアクションを実行しますか？
            </div>
            <div className="action-modal-buttons">
              {/* 効果発動ボタン（A, 2, 9, J） */}
              {pendingCard.rank === 'J' && (
                <button className="action-btn effect" onClick={executeEffect}>
                  略奪する
                </button>
              )}
              {['A', '2'].includes(pendingCard.rank) && (
                <button className="action-btn effect" onClick={executeEffect}>
                  {pendingCard.rank}の効果で破壊
                </button>
              )}
              {['9', '10'].includes(pendingCard.rank) && pendingTarget.card.value > 0 && (
                <button className="action-btn effect" onClick={executeEffect}>
                  手札に戻す
                </button>
              )}
              {pendingCard.rank === '9' && pendingTarget.card.value === 0 && (
                <button className="action-btn effect" onClick={executeEffect}>
                  手札に戻す
                </button>
              )}
              
              {/* スカトルボタン（点数カードで相手の点数カードを破壊） */}
              {pendingCard.value > 0 && pendingCard.value >= pendingTarget.card.value && (
                <button className="action-btn scuttle" onClick={executeScuttle}>
                  スカトル（破壊）
                </button>
              )}
              
              {/* 戻るボタン */}
              <button className="action-btn cancel" onClick={closeActionModal}>
                戻る
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 8の選択モーダル */}
      {show8ChoiceModal && pending8Card && (
        <div className="cuttle-action-modal">
          <div className="action-modal-content">
            <div className="action-modal-title">
              8の使い方を選択
            </div>
            <div className="action-modal-desc">
              点数として出すか、永続効果として出すか選んでください
            </div>
            <div className="action-modal-buttons">
              <button 
                className="action-btn effect"
                onClick={() => {
                  onCardSelect(pending8Card);
                  setTimeout(() => {
                    onAction('playPoint');
                    addLog('player1', '8を点数（8pt）としてプレイ');
                  }, 50);
                  setShow8ChoiceModal(false);
                  setPending8Card(null);
                }}
              >
                点数（8pt）として出す
              </button>
              <button 
                className="action-btn effect"
                onClick={() => {
                  onCardSelect(pending8Card);
                  setTimeout(() => {
                    onAction('playPermanent');
                    addLog('player1', '8を永続効果としてプレイ');
                  }, 50);
                  setShow8ChoiceModal(false);
                  setPending8Card(null);
                }}
              >
                永続効果として出す
              </button>
              <button 
                className="action-btn cancel"
                onClick={() => {
                  setShow8ChoiceModal(false);
                  setPending8Card(null);
                }}
              >
                戻る
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 7の効果: 山札トップ2枚から選択 */}
      {gameState.phase === 'sevenChoice' && gameState.sevenChoices && (
        <div className="cuttle-action-modal seven-choice-modal">
          <div className="action-modal-content">
            <div className="action-modal-title">
              7の効果
            </div>
            <div className="action-modal-desc">
              山札の上から2枚のうち1枚を選んでプレイ
            </div>
            <div className="seven-choice-cards">
              {gameState.sevenChoices.map((card) => (
                <div
                  key={`seven-${card.id}`}
                  className="seven-choice-card"
                  onClick={() => {
                    onCardSelect(card);
                    // 選択後の処理はApp.tsx側で
                  }}
                >
                  <div className="card-parchment" />
                  {isFaceCard(card.rank) ? (
                    <div
                      className="card-face-art"
                      style={getFaceMaskStyle(card.race, card.rank)}
                    />
                  ) : (
                    <div className="card-pips">
                      {PIP_LAYOUTS[card.rank]?.map((pip, j) => (
                        <div
                          key={j}
                          className={`card-pip ${pip.inverted ? 'inverted' : ''}`}
                          style={{
                            left: `${pip.x}%`,
                            top: `${pip.y}%`,
                            ...getSuitMaskStyle(card.race),
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <div className="card-rank top-left">{card.rank}</div>
                  <div className="card-rank bottom-right">{card.rank}</div>
                  <div className="seven-card-info">
                    <span>{card.rank}</span>
                    <span className="seven-card-race">{RACE_NAMES[card.race]}</span>
                    <span className="seven-card-effect">{getCardEffect(card)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CuttleBattle;

