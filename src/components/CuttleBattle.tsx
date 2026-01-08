import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { GameState, Card, FieldCard, ActionType } from '../types/game';
import { getCardEffect } from '../utils/gameLogic';
import './CuttleBattle.css';

// ========================================
// カトル バトル画面 - 化学式TCG風レイアウト
// ========================================

interface MatchInfo {
  currentMatch: number;
  player1Wins: number;
  player2Wins: number;
}

interface CuttleBattleProps {
  isOpen: boolean;
  gameState: GameState;
  onCardSelect: (card: Card) => void;
  onFieldCardSelect: (fieldCard: FieldCard) => void;
  onScrapSelect: (card: Card) => void;
  onAction: (action: ActionType) => void;
  onDirectAction: (action: ActionType, card: Card, target?: FieldCard) => void;
  onDiscard: (cards: Card[]) => void; // 4の効果で手札を捨てる
  onSevenOptionB: () => void; // 7のオプションB: 山札に戻して手札からプレイ
  onCancel: () => void;
  isCPUTurn: boolean;
  matchInfo?: MatchInfo;
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
  gameState,
  onCardSelect,
  onFieldCardSelect,
  onScrapSelect,
  onAction,
  onDirectAction,
  onDiscard,
  onSevenOptionB,
  isCPUTurn,
  matchInfo,
}) => {
  // UIモード
  const [mode, setMode] = useState<Mode>('default');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [touchCurrent, setTouchCurrent] = useState({ x: 0, y: 0 });
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [showScrapModal, setShowScrapModal] = useState(false);
  
  // 4の効果で手札を捨てる用
  const [discardSelection, setDiscardSelection] = useState<Card[]>([]);
  
  // アクション確認モーダル用
  const [pendingCard, setPendingCard] = useState<Card | null>(null);
  const [pendingTarget, setPendingTarget] = useState<FieldCard | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  
  
  // ログシステム
  const [actionLogs, setActionLogs] = useState<LogEntry[]>([]);
  const logIdRef = useRef(0);
  const logContainerRef = useRef<HTMLDivElement>(null);
  
  // パーティクルエフェクト用
  const [particles, setParticles] = useState<{id: number; target: 'player' | 'enemy'; x: number; y: number}[]>([]);
  const particleIdRef = useRef(0);
  const playerIconRef = useRef<HTMLDivElement>(null);
  const enemyIconRef = useRef<HTMLDivElement>(null);
  
  // refs
  const screenRef = useRef<HTMLDivElement>(null);
  const playerPointsRef = useRef<HTMLDivElement>(null);
  const playerEffectsRef = useRef<HTMLDivElement>(null);
  const enemyPointsRef = useRef<HTMLDivElement>(null);
  const enemyEffectsRef = useRef<HTMLDivElement>(null);
  const lastCardSwitchRef = useRef<number>(0); // カード切り替えのデバウンス用
  
  const player = gameState.player1;
  const enemy = gameState.player2;
  
  // パーティクル生成関数
  type ParticleData = {id: number; target: 'player' | 'enemy'; x: number; y: number};
  const spawnParticles = useCallback((target: 'player' | 'enemy', startX: number, startY: number) => {
    const newParticles: ParticleData[] = [];
    for (let i = 0; i < 8; i++) {
      particleIdRef.current += 1;
      newParticles.push({
        id: particleIdRef.current,
        target,
        x: startX + (Math.random() - 0.5) * 60,
        y: startY + (Math.random() - 0.5) * 40,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
    // 1秒後にパーティクルを削除
    setTimeout(() => {
      setParticles(prev => prev.filter(p => !newParticles.find(np => np.id === p.id)));
    }, 1000);
  }, []);
  
  // HPリングのSVGパスを生成（連続した円弧、上から時計回り）
  const renderHPRing = (filled: number, goldFill: number, isEnemy: boolean, size: number) => {
    const totalSegments = 21;
    const strokeWidth = isEnemy ? 5 : 3; // プレイヤーは細く
    const radius = size / 2 - strokeWidth - 2;
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * radius;
    
    // 塗りつぶし割合を計算
    const filledRatio = filled / totalSegments;
    const goldRatio = goldFill / totalSegments;
    const normalRatio = Math.max(0, filledRatio - goldRatio);
    
    // ダッシュ配列で円弧を描画
    const goldLength = goldRatio * circumference;
    const normalLength = normalRatio * circumference;
    
    return (
      <svg width={size} height={size} className="hp-ring-svg" style={{ transform: 'rotate(-90deg)' }}>
        {/* 背景リング */}
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="rgba(60, 50, 40, 0.4)"
          strokeWidth={strokeWidth}
        />
        {/* 金色部分（Kによる） */}
        {goldLength > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="#c9a227"
            strokeWidth={strokeWidth}
            strokeDasharray={`${goldLength} ${circumference - goldLength}`}
            strokeDashoffset={0}
            strokeLinecap="round"
            className="hp-ring-gold"
          />
        )}
        {/* 点数部分 */}
        {normalLength > 0 && (
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke={isEnemy ? '#f35e5e' : '#5ed3f3'}
            strokeWidth={strokeWidth}
            strokeDasharray={`${normalLength} ${circumference - normalLength}`}
            strokeDashoffset={-goldLength}
            strokeLinecap="round"
            className="hp-ring-filled"
          />
        )}
      </svg>
    );
  };
  
  // ログ追加関数（全ログ保持、最新が下）
  const addLog = useCallback((playerType: 'player1' | 'player2', message: string) => {
    logIdRef.current += 1;
    setActionLogs(prev => [...prev, { id: logIdRef.current, player: playerType, message }]);
  }, []);
  
  // ログ追加時に自動スクロール
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [actionLogs]);
  
  // ゲーム終了時にログクリア
  useEffect(() => {
    if (gameState.phase === 'gameOver') {
      // ゲーム終了時はログをクリアしない（結果確認用）
      // リスタート時にクリアする
    }
  }, [gameState.phase]);
  
  // ゲームリスタート検知（ターン1に戻った時）
  useEffect(() => {
    if (gameState.turnCount === 1 && actionLogs.length > 0) {
      setActionLogs([]);
      logIdRef.current = 0;
    }
  }, [gameState.turnCount]);
  
  // ゲーム状態の変化を監視してログを追加
  const prevPhaseRef = useRef(gameState.phase);
  const prevPlayer1FieldRef = useRef<FieldCard[]>([...player.field]);
  const prevPlayer2FieldRef = useRef<FieldCard[]>([...enemy.field]);
  const prevPlayer1HandRef = useRef(player.hand.length);
  const prevPlayer2HandRef = useRef(enemy.hand.length);
  const prevDeckRef = useRef(gameState.deck.length);
  const prevScrapRef = useRef(gameState.scrapPile.length);
  const prevCurrentPlayerRef = useRef(gameState.currentPlayer);

  useEffect(() => {
    // 変化量を検出
    const p1FieldDiff = player.field.length - prevPlayer1FieldRef.current.length;
    const p2FieldDiff = enemy.field.length - prevPlayer2FieldRef.current.length;
    const p2HandDiff = enemy.hand.length - prevPlayer2HandRef.current;
    const deckDiff = gameState.deck.length - prevDeckRef.current;
    const scrapDiff = gameState.scrapPile.length - prevScrapRef.current;
    const turnChanged = prevCurrentPlayerRef.current !== gameState.currentPlayer;
    const wasEnemyTurn = prevCurrentPlayerRef.current === 'player2';
    
    // CPUがドロー（ターンが変わり、手札が増え、デッキが減った）
    if (turnChanged && wasEnemyTurn && p2HandDiff > 0 && deckDiff < 0 && p2FieldDiff === 0 && p1FieldDiff >= 0) {
      addLog('player2', 'ドローした');
    }
    
    // CPUがカードをプレイ（フィールドが増えた）
    else if (p2FieldDiff > 0 && turnChanged && wasEnemyTurn && p1FieldDiff >= 0) {
      const newCard = enemy.field[enemy.field.length - 1];
      if (newCard) {
        const raceName = RACE_NAMES[newCard.card.race] || newCard.card.race;
        const isPerm = ['J', 'Q', 'K', '8'].includes(newCard.card.rank) && newCard.card.value === 0;
        if (isPerm) {
          addLog('player2', `${raceName}${newCard.card.rank}の永続効果を発動`);
        } else {
          addLog('player2', `${raceName}${newCard.card.rank}を場にセット`);
        }
      }
    }
    
    // CPUがプレイヤーのカードを破壊（自分のフィールドが減り、墓地が増えた）
    else if (turnChanged && wasEnemyTurn && p1FieldDiff < 0 && scrapDiff > 0) {
      // 破壊されたカードを特定
      const currentCardIds = new Set(player.field.map(fc => fc.card.id));
      const destroyedCards = prevPlayer1FieldRef.current.filter(fc => !currentCardIds.has(fc.card.id));
      
      for (const fc of destroyedCards) {
        const raceName = RACE_NAMES[fc.card.race] || fc.card.race;
        if (fc.card.value > 0) {
          // アタックか効果で点数カードが破壊された
          addLog('player2', `${raceName}${fc.card.rank}を破壊した`);
        } else {
          // 永続効果が破壊された
          addLog('player2', `${raceName}${fc.card.rank}の永続効果を破壊`);
        }
      }
    }
    
    // CPUがプレイヤーのカードを手札に戻した（自分のフィールドが減り、手札が増えた）
    else if (turnChanged && wasEnemyTurn && p1FieldDiff < 0 && (player.hand.length - prevPlayer1HandRef.current) > 0) {
      const currentCardIds = new Set(player.field.map(fc => fc.card.id));
      const returnedCards = prevPlayer1FieldRef.current.filter(fc => !currentCardIds.has(fc.card.id));
      
      for (const fc of returnedCards) {
        const raceName = RACE_NAMES[fc.card.race] || fc.card.race;
        addLog('player2', `${raceName}${fc.card.rank}を手札に戻した`);
      }
    }
    
    // CPUがJでプレイヤーのカードを略奪（controllerが変わった）
    else if (turnChanged && wasEnemyTurn && p2FieldDiff === 0 && p1FieldDiff === 0) {
      // controllerの変化をチェック
      for (const fc of player.field) {
        const prevFc = prevPlayer1FieldRef.current.find(pfc => pfc.card.id === fc.card.id);
        if (prevFc && prevFc.controller === 'player1' && fc.controller === 'player2') {
          const raceName = RACE_NAMES[fc.card.race] || fc.card.race;
          addLog('player2', `Jで${raceName}${fc.card.rank}を略奪`);
        }
      }
    }
    
    // ゲームオーバー
    if (gameState.phase === 'gameOver' && prevPhaseRef.current !== 'gameOver') {
      if (gameState.winner) {
        addLog(gameState.winner, '勝利！');
      }
    }
    
    // 状態を更新（ディープコピー）
    prevPhaseRef.current = gameState.phase;
    prevPlayer1FieldRef.current = player.field.map(fc => ({ ...fc, card: { ...fc.card } }));
    prevPlayer2FieldRef.current = enemy.field.map(fc => ({ ...fc, card: { ...fc.card } }));
    prevPlayer1HandRef.current = player.hand.length;
    prevPlayer2HandRef.current = enemy.hand.length;
    prevDeckRef.current = gameState.deck.length;
    prevScrapRef.current = gameState.scrapPile.length;
    prevCurrentPlayerRef.current = gameState.currentPlayer;
  }, [gameState, player.field, enemy.field, player.hand, enemy.hand, addLog]);
  
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
  
  // HPリング用: Kの枚数に応じた金色セグメント数
  const playerKings = player.field.filter(fc => fc.card.rank === 'K').length;
  const enemyKings = enemy.field.filter(fc => fc.card.rank === 'K').length;
  // 金色セグメント = 21 - 必要勝利ポイント
  const playerGoldFill = playerKings > 0 ? 21 - WINNING_POINTS[Math.min(playerKings, 4)] : 0;
  const enemyGoldFill = enemyKings > 0 ? 21 - WINNING_POINTS[Math.min(enemyKings, 4)] : 0;
  
  // HPリング: 点数に応じた塗りつぶしセグメント数（21が最大）
  const playerFilledSegments = Math.min(21, playerPoints + playerGoldFill);
  const enemyFilledSegments = Math.min(21, enemyPoints + enemyGoldFill);
  
  // 永続効果カード（8, J, Q, K）- ドロップ判定用
  const isPermanentEffect = (card: Card) => {
    return ['8', 'J', 'Q', 'K'].includes(card.rank);
  };
  
  // 点数カード（value > 0）
  const isPointCard = (fc: FieldCard) => fc.card.value > 0;
  
  // 永続効果として場に出ているカード（8はvalue=0の時のみ永続）
  const isFieldPermanent = (fc: FieldCard) => {
    // J, Q, K は常に永続効果
    if (['J', 'Q', 'K'].includes(fc.card.rank)) return true;
    // 8 は value=0 の時のみ永続効果（点数として出した場合は value=8）
    if (fc.card.rank === '8' && fc.card.value === 0) return true;
    return false;
  };
  
  // フィールドを分類
  const playerPointCards = player.field.filter(isPointCard);
  const playerEffectCards = player.field.filter(fc => isFieldPermanent(fc));
  const enemyPointCards = enemy.field.filter(isPointCard);
  const enemyEffectCards = enemy.field.filter(fc => isFieldPermanent(fc));
  
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
  
  // アタック実行（直接アクションを使用）
  const executeAttack = useCallback(() => {
    if (!pendingCard || !pendingTarget) return;
    
    // 直接アクション実行（状態のクロージャ問題を回避）
    const attackerRace = RACE_NAMES[pendingCard.race] || pendingCard.race;
    const targetRace = RACE_NAMES[pendingTarget.card.race] || pendingTarget.card.race;
    onDirectAction('scuttle', pendingCard, pendingTarget);
    addLog('player1', `${attackerRace}${pendingCard.rank}で${targetRace}${pendingTarget.card.rank}にアタック`);
    
    closeActionModal();
  }, [pendingCard, pendingTarget, onDirectAction, addLog, closeActionModal]);
  
  // 効果発動実行（直接アクションを使用）
  const executeEffect = useCallback(() => {
    if (!pendingCard || !pendingTarget) return;
    
    // 直接アクション実行（状態のクロージャ問題を回避）
    if (pendingCard.rank === 'J') {
      // J: 略奪（相手の点数カードを自分のものに）
      const jRace = RACE_NAMES[pendingCard.race] || pendingCard.race;
      const jTargetRace = RACE_NAMES[pendingTarget.card.race] || pendingTarget.card.race;
      onDirectAction('playKnight', pendingCard, pendingTarget);
      addLog('player1', `${jRace}Jで${jTargetRace}${pendingTarget.card.rank}を略奪`);
    } else if (['A', '2', '9', '10'].includes(pendingCard.rank)) {
      // ワンオフ効果
      const effRace = RACE_NAMES[pendingCard.race] || pendingCard.race;
      const effTargetRace = RACE_NAMES[pendingTarget.card.race] || pendingTarget.card.race;
      onDirectAction('playOneOff', pendingCard, pendingTarget);
      if (pendingCard.rank === '9' || pendingCard.rank === '10') {
        addLog('player1', `${effRace}${pendingCard.rank}で${effTargetRace}${pendingTarget.card.rank}を手札に戻す`);
      } else if (pendingCard.rank === 'A') {
        addLog('player1', `${effRace}Aで${effTargetRace}${pendingTarget.card.rank}を破壊`);
      } else if (pendingCard.rank === '2') {
        addLog('player1', `${effRace}2で${effTargetRace}${pendingTarget.card.rank}を破壊`);
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
      
      // 横移動 → カード選択切り替え（デバウンス付き）
      const now = Date.now();
      const DEBOUNCE_MS = 80; // 80ms以内の連続切り替えを防止
      
      if (now - lastCardSwitchRef.current < DEBOUNCE_MS) {
        return; // デバウンス中
      }
      
      const browseCards = document.querySelectorAll('.cuttle-browse-card');
      let closestIndex = -1;
      let closestDistance = Infinity;
      
      // 最も近いカードの中心を探す
      browseCards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const distance = Math.abs(current.x - centerX);
        
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = parseInt(card.getAttribute('data-index') || '-1');
        }
      });
      
      // カードの幅の30%以内に入ったら切り替え（境界でのブレを防止）
      if (closestIndex >= 0 && closestIndex !== selectedIndex) {
        const closestCard = document.querySelector(`.cuttle-browse-card[data-index="${closestIndex}"]`);
        if (closestCard) {
          const rect = closestCard.getBoundingClientRect();
          const threshold = rect.width * 0.3;
          if (closestDistance < threshold) {
            lastCardSwitchRef.current = now;
            setSelectedIndex(closestIndex);
          }
        }
      }
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
      
      // 敵の点数エリア（アタック/Jターゲット）
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
      
      // 自分の点数カード個別判定（敵に支配されているカードへのJ使用用）
      const playerPointCardElements = document.querySelectorAll('.cuttle-player-points-area .cuttle-field-card-wrapper');
      playerPointCardElements.forEach((card, i) => {
        const rect = card.getBoundingClientRect();
        if (current.x >= rect.left && current.x <= rect.right &&
            current.y >= rect.top && current.y <= rect.bottom) {
          newTarget = `playerCard:${i}`;
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
            const raceName = RACE_NAMES[card.race] || card.race;
            onCardSelect(card); // カードを選択状態にしてから
            onAction('playPoint');
            addLog('player1', `${raceName}${card.rank}を場にセット`);
            // パーティクルエフェクト
            if (playerPointsRef.current) {
              const rect = playerPointsRef.current.getBoundingClientRect();
              spawnParticles('player', rect.left + rect.width / 2, rect.top + rect.height / 2);
            }
          }
        } else if (dropTarget === 'playerEffects') {
          // 効果として出す
          const raceName = RACE_NAMES[card.race] || card.race;
          if (isPermanentEffect(card)) {
            // J以外の永続効果（Q, K, 8）
            if (card.rank !== 'J') {
              onCardSelect(card); // カードを選択状態にしてから
            onAction('playPermanent');
              addLog('player1', `${raceName}${card.rank}の永続効果を発動`);
            }
          } else if (card.rank === '3') {
            // 3は捨て札選択が必要
            if (gameState.scrapPile.length > 0) {
              onCardSelect(card);
              onAction('playOneOff');
              addLog('player1', `${raceName}3で墓地から回収`);
            }
          } else {
            // ワンオフ効果（ターゲット不要のもの: 4, 5, 6, 7）
            if (!['A', '2', '9', '10'].includes(card.rank)) {
              onCardSelect(card); // カードを選択状態にしてから
            onAction('playOneOff');
              if (card.rank === '4') {
                addLog('player1', `${raceName}4で相手の手札を2枚捨てさせる`);
              } else if (card.rank === '5') {
                addLog('player1', `${raceName}5で2枚ドロー`);
              } else if (card.rank === '6') {
                addLog('player1', `${raceName}6で全永続効果を破壊`);
              } else if (card.rank === '7') {
                addLog('player1', `${raceName}7で山札トップを確認`);
              }
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
        } else if (dropTarget.startsWith('playerCard:')) {
          // 自分の点数カードへのドロップ → J でカウンター略奪
          const targetIndex = parseInt(dropTarget.split(':')[1]);
          const targetFC = playerPointCards[targetIndex];
          
          if (targetFC && card.rank === 'J') {
            // 敵に支配されている自分のカードのみ対象可
            if (targetFC.controller === 'player2') {
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
            <div className="effect-title">- {card.rank}</div>
          </div>
          <div className="effect-text">{getCardEffect(card)}</div>
        </div>
      </div>
    );
  };
  
  // カード数に応じたマージン計算（カツカツになるまで広げる）
  const getCardMargin = (cardCount: number, maxCards: number = 6) => {
    if (cardCount <= 1) return 0;
    if (cardCount <= 3) return 6;  // 広めのギャップ
    if (cardCount <= 4) return 2;  // 少しギャップ
    if (cardCount <= maxCards) return 0;  // ぴったり
    // それ以上は重ねる（負のマージン）
    const overlap = Math.min((cardCount - maxCards) * 8, 30);
    return -overlap;
  };

  // フィールドカードをレンダリング（フルデザイン、エリア縦幅いっぱい）
  const renderFieldCards = (cards: FieldCard[], isEnemy: boolean) => {
    if (cards.length === 0) {
      return <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>空</span>;
    }
    
    const margin = getCardMargin(cards.length, 6);
    
    return (
      <div className="cuttle-field-cards-full">
        {cards.map((fc, i) => {
          const isDropTargetEnemy = dropTarget === `enemyCard:${i}` && isEnemy;
          const isDropTargetPlayer = dropTarget === `playerCard:${i}` && !isEnemy;
          const isDropTarget = isDropTargetEnemy || isDropTargetPlayer;
          const pipLayout = PIP_LAYOUTS[fc.card.rank];
          // 敵に支配されている自分のカード（J counter target）
          const isStolenByEnemy = !isEnemy && fc.controller === 'player2';
          
          return (
            <div
              key={`field-${fc.card.rank}-${fc.card.race}-${i}`}
              className={`cuttle-field-card-wrapper ${getSuitClass(fc.card)}`}
              style={{ zIndex: i + 1, marginLeft: i === 0 ? 0 : margin }}
            >
              {/* カード本体 */}
              <div
                className={`cuttle-field-card-full ${getSuitClass(fc.card)} ${fc.controller !== fc.owner ? 'stolen' : ''} ${isStolenByEnemy ? 'stolen-by-enemy' : ''} ${isDropTarget ? 'drop-target' : ''}`}
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
                
                {/* J略奪オーバーレイ - 敵がプレイヤーのカードを支配中 */}
                {fc.controller !== fc.owner && fc.controller === 'player2' && (
                  <div className="stolen-overlay enemy-control">
                    <span className="stolen-j">J</span>
                  </div>
                )}
                {/* J略奪オーバーレイ - プレイヤーが敵のカードを支配中 */}
                {fc.controller !== fc.owner && fc.controller === 'player1' && (
                  <div className="stolen-overlay player-control">
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
    const permanents = cards.filter(fc => isFieldPermanent(fc));
    
    if (permanents.length === 0) {
      return <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7rem' }}>効果なし</span>;
    }
    
    const margin = getCardMargin(permanents.length, 4); // 効果エリアは狭いので4枚まで
    
    return (
      <div className="cuttle-effect-cards-full">
        {permanents.map((fc, i) => (
          <div
            key={`effect-${fc.card.rank}-${fc.card.race}-${i}`}
            className={`cuttle-field-card-wrapper ${getSuitClass(fc.card)}`}
            style={{ zIndex: i + 1, marginLeft: i === 0 ? 0 : margin }}
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
  const isWin = gameState.winner === 'player1';
  
  return (
    <div ref={screenRef} className={`cuttle-battle ${isOpen ? 'active' : ''}`}>
      {/* 敵情報バー - 右寄せ: 名前 | 点数 | マッチインジケーター */}
      <div className="cuttle-enemy-info">
        <div className="cuttle-player-info-row right-aligned">
          <span className="cuttle-player-name">{enemy.name}</span>
          <span className="cuttle-points-display">{enemyPoints}<span className="points-unit">pt/{enemyWinTarget}</span></span>
          {matchInfo && (
            <div className="match-indicators">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`match-indicator ${
                    i < matchInfo.player2Wins ? 'win' : 
                    i < (matchInfo.player1Wins + matchInfo.player2Wins) && i >= matchInfo.player2Wins ? 'lose' : ''
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* 敵アイコン（高レイヤー、拡大） */}
      <div ref={enemyIconRef} className="cuttle-icon-container enemy">
        {renderHPRing(enemyFilledSegments, enemyGoldFill, true, 64)}
        <div className="cuttle-icon-inner enemy">👹</div>
      </div>
      
      {/* 敵手札（扇状 - 逆向き：敵なので上に開く） */}
      <div className="cuttle-enemy-hand">
        {enemy.hand.map((card, i) => {
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
          
          // 8永続効果で手札公開中かチェック
          const isRevealed = gameState.opponentHandRevealed.player2;
          const pipLayout = PIP_LAYOUTS[card.rank];
          
          // 公開中なら表面を表示
          if (isRevealed) {
            return (
              <div
                key={`enemy-hand-${card.id}`}
                className="cuttle-enemy-card-revealed"
                style={{
                  transform: `translateX(calc(-50% + ${xOffset}px)) translateY(${yOffset}px) rotate(${angle}deg)`,
                  zIndex: i + 1,
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
                    {pipLayout?.map((pip, j) => (
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
                {/* 公開中マーク */}
                <div className="revealed-mark">👁</div>
              </div>
            );
          }
          
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
        {/* 山札 - 裏面カード積み重ね表示 */}
        <div className="cuttle-pile-stack deck-pile">
          {gameState.deck.length === 0 ? (
            <div className="cuttle-deck-card empty">
              <span className="pile-count">0</span>
        </div>
          ) : (
            Array.from({ length: getStackCount(gameState.deck.length) }).map((_, i, arr) => (
              <div
                key={`deck-${i}`}
                className="cuttle-deck-card-back"
                style={{
                  position: i === arr.length - 1 ? 'relative' : 'absolute',
                  top: `${-i * 0.7}px`,
                  left: `${i * 0.35}px`,
                  zIndex: i,
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
                <div className="card-back-suit top-left" style={getMaskStyle(`${BASE_URL}sprite/suit/human.png`)} />
                <div className="card-back-suit top-right" style={getMaskStyle(`${BASE_URL}sprite/suit/elf.png`)} />
                <div className="card-back-suit bottom-left" style={getMaskStyle(`${BASE_URL}sprite/suit/goblin.png`)} />
                <div className="card-back-suit bottom-right" style={getMaskStyle(`${BASE_URL}sprite/suit/demon.png`)} />
                
                {/* 装飾フレーム */}
                <div className="card-back-frame" />
                
                {/* 最上面に枚数表示 */}
                {i === arr.length - 1 && (
                  <span className="pile-count-overlay">{gameState.deck.length}</span>
                )}
              </div>
            ))
          )}
        </div>
        
        {/* アクションログ - スクロール可能、最新が下、色で判別 */}
        <div className="cuttle-action-log" ref={logContainerRef}>
          {actionLogs.length === 0 ? (
            <span className="log-action">ゲーム開始</span>
          ) : (
            <div className="log-entries">
              {actionLogs.map(log => (
                <div key={log.id} className={`log-entry ${log.player}`}>
                  <span className="log-msg">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* 墓地 - 最新カードの表面表示 */}
        <div className="cuttle-pile-stack scrap-pile" onClick={() => setShowScrapModal(true)}>
          {gameState.scrapPile.length === 0 ? (
            <div className="cuttle-scrap-card empty">
              <span className="pile-title">墓地</span>
              <span className="pile-count">0</span>
            </div>
          ) : (
            <>
              {/* 下に重なる裏面カード */}
              {Array.from({ length: Math.max(0, getStackCount(gameState.scrapPile.length) - 1) }).map((_, i) => (
                <div
                  key={`scrap-back-${i}`}
                  className="cuttle-scrap-card-back"
                  style={{
                    position: 'absolute',
                    top: `${-i * 0.7}px`,
                    right: `${i * 0.35}px`,
                    zIndex: i,
                  }}
                >
                  <div className="card-back-parchment" />
                  <div className="card-back-frame" />
        </div>
              ))}
              {/* 最上面に表向きの最新カード */}
              {(() => {
                const topCard = gameState.scrapPile[gameState.scrapPile.length - 1];
                const stackCount = getStackCount(gameState.scrapPile.length);
                const pipLayout = PIP_LAYOUTS[topCard.rank];
                return (
                  <div
                    className={`cuttle-scrap-card-top ${getSuitClass(topCard)}`}
                    style={{
                      position: 'relative',
                      top: `${-(stackCount - 1) * 0.7}px`,
                      right: `${(stackCount - 1) * 0.35}px`,
                      zIndex: stackCount,
                    }}
                  >
                    {/* カード背景 */}
                    <div className="card-parchment" />
                    
                    {/* 絵札イラスト */}
                    {isFaceCard(topCard.rank) && (
                      <div 
                        className="card-face-art pile"
                        style={getFaceMaskStyle(topCard.race, topCard.rank)}
                      />
                    )}
                    
                    {/* ランク表示 */}
                    <div className="card-rank top-left pile">{topCard.rank}</div>
                    <div className="card-rank bottom-right pile">{topCard.rank}</div>
                    
                    {/* 数字カードのスート配置 */}
                    {pipLayout && (
                      <div className="card-pips pile">
                        {pipLayout.map((pip, j) => (
                          <div
                            key={j}
                            className={`card-pip pile ${pip.inverted ? 'inverted' : ''}`}
                            style={{
                              left: `${pip.x}%`,
                              top: `${pip.y}%`,
                              ...getSuitMaskStyle(topCard.race),
                            }}
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* 枚数表示オーバーレイ */}
                    <span className="pile-count-overlay">{gameState.scrapPile.length}</span>
                  </div>
                );
              })()}
            </>
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
      
      {/* プレイヤーアイコン（高レイヤー、拡大） */}
      <div ref={playerIconRef} className="cuttle-icon-container player">
        {renderHPRing(playerFilledSegments, playerGoldFill, false, 80)}
        <div className="cuttle-icon-inner player">⚔️</div>
      </div>
      
      {/* ステータスバー */}
      <div className="cuttle-status-bar">
        {/* 自分情報 - 左寄せ: 名前 | 点数 | マッチインジケーター */}
        <div className="cuttle-player-info-row left-aligned">
          <span className="cuttle-player-name">{player.name}</span>
          <span className="cuttle-points-display">{playerPoints}<span className="points-unit">pt/{playerWinTarget}</span></span>
          {matchInfo && (
            <div className="match-indicators">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className={`match-indicator ${
                    i < matchInfo.player1Wins ? 'win' : 
                    i < (matchInfo.player1Wins + matchInfo.player2Wins) && i >= matchInfo.player1Wins ? 'lose' : ''
                  }`}
                />
              ))}
            </div>
          )}
        </div>
        <div className="cuttle-actions">
          <button
            className="cuttle-btn cuttle-btn-draw"
            onClick={() => onAction('draw')}
            disabled={isCPUTurn || gameState.deck.length === 0}
          >
            ドロー
          </button>
        </div>
      </div>
      
      {/* 手札 */}
      <div className="cuttle-hand">
        {player.hand.map(renderHandCard)}
      </div>
      
      {/* 下部余白 */}
      <div className="cuttle-bottom-spacer" />
      
      {/* パーティクルエフェクト */}
      {particles.map(p => (
        <div
          key={p.id}
          className={`particle ${p.target}`}
          style={{
            left: p.x,
            top: p.y,
            '--target-x': p.target === 'player' 
              ? `${(playerIconRef.current?.offsetLeft || 40) + 40}px`
              : `${(enemyIconRef.current?.offsetLeft || 320) + 32}px`,
            '--target-y': p.target === 'player'
              ? `${(playerIconRef.current?.offsetTop || 640) + 40}px`
              : `${(enemyIconRef.current?.offsetTop || 28) + 32}px`,
          } as React.CSSProperties}
        />
      ))}
      
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
          {matchInfo && (
            <div className="match-result-score">
              {matchInfo.player1Wins + (isWin ? 1 : 0)} - {matchInfo.player2Wins + (isWin ? 0 : 1)}
            </div>
          )}
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
              
              {/* アタックボタン（点数カードで相手の点数カードを破壊 - 両方が点数カードの場合のみ） */}
              {pendingCard.value > 0 && pendingTarget.card.value > 0 && pendingCard.value >= pendingTarget.card.value && (
                <button className="action-btn scuttle" onClick={executeAttack}>
                  アタック
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
      
      
      {/* 7の効果: 山札トップ2枚から選択 */}
      {gameState.phase === 'sevenChoice' && gameState.sevenChoices && (
        <div className="cuttle-action-modal seven-choice-modal">
          <div className="action-modal-content large">
            <div className="action-modal-title">
              7の効果
            </div>
            <div className="action-modal-desc">
              【A】カードをタップして即プレイ<br/>
              【B】山札に戻して手札からプレイ
            </div>
            <div className="seven-choice-cards">
              {gameState.sevenChoices.map((card) => {
                const pipLayout = PIP_LAYOUTS[card.rank];
                return (
                  <div
                    key={`seven-${card.id}`}
                    className={`seven-choice-card-wrapper ${getSuitClass(card)}`}
                    onClick={() => {
                      onCardSelect(card);
                    }}
                  >
                    {/* カード本体 */}
                    <div className={`seven-choice-card ${getSuitClass(card)}`}>
                      <div className="card-parchment" />
                      {isFaceCard(card.rank) ? (
                        <div
                          className="card-face-art"
                          style={getFaceMaskStyle(card.race, card.rank)}
                        />
                      ) : (
                        <div className="card-pips">
                          {pipLayout?.map((pip, j) => (
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
                      <div 
                        className="card-suit-icon corner top-left"
                        style={getSuitMaskStyle(card.race)}
                      />
                      <div 
                        className="card-suit-icon corner bottom-right"
                        style={getSuitMaskStyle(card.race)}
                      />
                      <div className="card-rank top-left">{card.rank}</div>
                      <div className="card-rank bottom-right">{card.rank}</div>
                    </div>
                    {/* 効果説明ボックス */}
                    <div className={`seven-card-effect-box ${getSuitClass(card)}`}>
                      <div className="effect-header">
                        <div 
                          className="effect-icon"
                          style={getSuitMaskStyle(card.race)}
                        />
                        <span className="effect-title">- {card.rank}</span>
                      </div>
                      <div className="effect-text">{getCardEffect(card)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="seven-option-buttons">
              <button 
                className="seven-option-b-btn"
                onClick={onSevenOptionB}
              >
                【B】山札に戻して手札からプレイ
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 4の効果: プレイヤーが手札を捨てる */}
      {gameState.phase === 'opponentDiscard' && gameState.currentPlayer === 'player2' && (
        <div className="cuttle-action-modal discard-modal">
          <div className="action-modal-content">
            <div className="action-modal-title">
              相手の4の効果
            </div>
            <div className="action-modal-desc">
              手札から{Math.min(2, player.hand.length)}枚選んで捨ててください
              <br />
              <span className="discard-count">選択中: {discardSelection.length}/{Math.min(2, player.hand.length)}枚</span>
            </div>
            <div className="discard-choice-cards">
              {player.hand.map((card) => {
                const isSelected = discardSelection.some(c => c.id === card.id);
                const pipLayout = PIP_LAYOUTS[card.rank];
                return (
                  <div
                    key={`discard-${card.id}`}
                    className={`discard-choice-card ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      if (isSelected) {
                        setDiscardSelection(prev => prev.filter(c => c.id !== card.id));
                      } else if (discardSelection.length < Math.min(2, player.hand.length)) {
                        setDiscardSelection(prev => [...prev, card]);
                      }
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
                        {pipLayout?.map((pip, j) => (
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
                    {isSelected && <div className="selected-mark">✓</div>}
                  </div>
                );
              })}
            </div>
            <div className="action-modal-buttons">
              <button 
                className="action-btn effect"
                disabled={discardSelection.length !== Math.min(2, player.hand.length)}
                onClick={() => {
                  onDiscard(discardSelection);
                  setDiscardSelection([]);
                }}
              >
                捨てる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CuttleBattle;

