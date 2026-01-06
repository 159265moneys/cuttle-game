import { useState, useCallback, useRef, useEffect } from 'react';
import type { GameState, Card as CardType, FieldCard, ActionType } from '../types/game';
import { RACE_EMOJI, RACE_NAME, ROLE_NAME, WINNING_POINTS } from '../types/game';
import { calculatePlayerPoints, hasQueen } from '../utils/gameLogic';

interface GameBoardProps {
  gameState: GameState;
  onCardSelect: (card: CardType) => void;
  onFieldCardSelect: (fieldCard: FieldCard) => void;
  onScrapSelect: (card: CardType) => void;
  onAction: (action: ActionType) => void;
  onCancel: () => void;
  onRestart: () => void;
  isCPUTurn?: boolean;
}

// カードの効果説明
const CARD_EFFECTS: Record<string, { point: string; effect: string; type: string }> = {
  'A': { point: '1点', effect: '相手の点数カード1枚を破壊する', type: 'ワンオフ' },
  '2': { point: '2点', effect: '相手の永続カード(J/Q/K/8)を1枚破壊する', type: 'ワンオフ' },
  '3': { point: '3点', effect: '捨て札から好きなカードを1枚回収する', type: 'ワンオフ' },
  '4': { point: '4点', effect: '相手に手札を2枚捨てさせる', type: 'ワンオフ' },
  '5': { point: '5点', effect: '山札から2枚ドローする', type: 'ワンオフ' },
  '6': { point: '6点', effect: '全ての永続カードを破壊する（自分のも含む）', type: 'ワンオフ' },
  '7': { point: '7点', effect: '山札の1番上を見て、それか手札から1枚プレイする', type: 'ワンオフ' },
  '8': { point: '8点', effect: '相手の手札を常に公開させる', type: '永続' },
  '9': { point: '9点', effect: '相手のカード1枚を手札に戻す', type: 'ワンオフ' },
  '10': { point: '10点', effect: '相手の点数カード1枚を手札に戻す', type: 'ワンオフ' },
  'J': { point: '-', effect: '相手の点数カードを1枚略奪して自分のものにする', type: '永続' },
  'Q': { point: '-', effect: '自分の点数カードを相手の効果から保護する', type: '永続' },
  'K': { point: '-', effect: '勝利に必要な点数を減らす\n0枚:21点→1枚:14点→2枚:10点→3枚:7点→4枚:5点', type: '永続' },
};

export function GameBoard({
  gameState,
  onCardSelect,
  onAction,
  onRestart,
  isCPUTurn = false,
}: GameBoardProps) {
  const player = gameState.player1;
  const cpu = gameState.player2;
  const playerPoints = calculatePlayerPoints(player);
  const cpuPoints = calculatePlayerPoints(cpu);
  const playerTarget = WINNING_POINTS[Math.min(player.kings, 4)];
  const cpuTarget = WINNING_POINTS[Math.min(cpu.kings, 4)];

  // 状態
  const [previewCard, setPreviewCard] = useState<CardType | null>(null); // タッチ中の拡大表示
  const [dragCard, setDragCard] = useState<CardType | null>(null); // ドラッグ中のカード
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [touchStartPos, setTouchStartPos] = useState({ x: 0, y: 0 });
  const [dropTarget, setDropTarget] = useState<'point' | 'effect' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const pointAreaRef = useRef<HTMLDivElement>(null);
  const effectAreaRef = useRef<HTMLDivElement>(null);
  const DRAG_THRESHOLD = 15; // この距離以上動いたらドラッグ開始

  // タッチ開始 = 拡大プレビュー表示
  const handleTouchStart = useCallback((card: CardType, e: React.TouchEvent | React.MouseEvent) => {
    if (isCPUTurn) return;
    e.preventDefault();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    setPreviewCard(card);
    setTouchStartPos({ x: clientX, y: clientY });
    setDragPos({ x: clientX, y: clientY });
    onCardSelect(card);
  }, [isCPUTurn, onCardSelect]);

  // タッチ移動・終了の処理
  useEffect(() => {
    if (!previewCard && !isDragging) return;

    const handleMove = (e: TouchEvent | MouseEvent) => {
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      setDragPos({ x: clientX, y: clientY });

      // まだドラッグ開始してない場合、閾値を超えたらドラッグモードへ
      if (previewCard && !isDragging) {
        const dx = clientX - touchStartPos.x;
        const dy = clientY - touchStartPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > DRAG_THRESHOLD) {
          setDragCard(previewCard);
          setPreviewCard(null);
          setIsDragging(true);
        }
      }

      // ドラッグ中ならドロップエリア判定
      if (isDragging && pointAreaRef.current && effectAreaRef.current) {
        const pointRect = pointAreaRef.current.getBoundingClientRect();
        const effectRect = effectAreaRef.current.getBoundingClientRect();
        
        if (clientX >= pointRect.left && clientX <= pointRect.right && 
            clientY >= pointRect.top && clientY <= pointRect.bottom) {
          setDropTarget('point');
        } else if (clientX >= effectRect.left && clientX <= effectRect.right && 
                   clientY >= effectRect.top && clientY <= effectRect.bottom) {
          setDropTarget('effect');
        } else {
          setDropTarget(null);
        }
      }
    };

    const handleEnd = () => {
      // ドラッグ中にドロップエリアで離したらカードをプレイ
      if (isDragging && dragCard && dropTarget) {
        setTimeout(() => {
          if (dropTarget === 'point' && dragCard.value > 0) {
            onAction('playPoint');
          } else if (dropTarget === 'effect') {
            const isRoyal = ['J', 'Q', 'K'].includes(dragCard.rank);
            const isPermanent = isRoyal || dragCard.rank === '8';
            if (isPermanent) {
              onAction('playPermanent');
            } else {
              onAction('playOneOff');
            }
          }
        }, 10);
      }

      // 全てリセット
      setPreviewCard(null);
      setDragCard(null);
      setDropTarget(null);
      setIsDragging(false);
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
  }, [previewCard, isDragging, dragCard, dropTarget, touchStartPos, onAction]);

  // 手札カード（小）
  const renderHandCard = (card: CardType, index: number, total: number) => {
    const centerIdx = (total - 1) / 2;
    const offset = index - centerIdx;
    const maxAngle = 15;
    const angle = total > 1 ? (offset / Math.max(centerIdx, 1)) * maxAngle : 0;
    const xOffset = offset * 28;
    const yOffset = Math.abs(offset) * 6;
    const isRoyal = ['J', 'Q', 'K'].includes(card.rank);
    const isBeingDragged = dragCard?.id === card.id;

    return (
      <div
        key={card.id}
        className="absolute touch-none select-none"
        style={{
          left: '50%',
          bottom: '8px',
          transform: `translateX(calc(-50% + ${xOffset}px)) translateY(${yOffset}px) rotate(${angle}deg)`,
          zIndex: index + 1,
          opacity: isBeingDragged ? 0.3 : 1,
        }}
        onTouchStart={(e) => handleTouchStart(card, e)}
        onMouseDown={(e) => handleTouchStart(card, e)}
      >
        <div className={`
          w-14 h-20 rounded-lg border-2 flex flex-col items-center justify-between p-1
          shadow-lg transition-transform
          ${card.race === 'elf' ? 'bg-gradient-to-br from-emerald-200 to-emerald-400 border-emerald-500' : ''}
          ${card.race === 'goblin' ? 'bg-gradient-to-br from-amber-200 to-amber-400 border-amber-500' : ''}
          ${card.race === 'human' ? 'bg-gradient-to-br from-blue-200 to-blue-400 border-blue-500' : ''}
          ${card.race === 'demon' ? 'bg-gradient-to-br from-red-200 to-red-400 border-red-500' : ''}
        `}>
          <div className="text-xs font-bold text-white drop-shadow">{card.rank}</div>
          <div className="text-xl">{RACE_EMOJI[card.race]}</div>
          <div className="text-[7px] font-bold text-white drop-shadow">
            {isRoyal ? ROLE_NAME[card.rank] : RACE_NAME[card.race]}
          </div>
        </div>
      </div>
    );
  };

  // フィールドカード
  const renderFieldCard = (fc: FieldCard, isOpponent: boolean) => {
    const isRoyal = ['J', 'Q', 'K'].includes(fc.card.rank);
    const canTarget = gameState.phase === 'selectTarget' && !isCPUTurn && isOpponent;

    return (
      <div
        key={fc.card.id}
        className={`
          w-11 h-16 rounded-md border-2 flex flex-col items-center justify-between p-0.5
          shadow-md transition-all
          ${fc.card.race === 'elf' ? 'bg-gradient-to-br from-emerald-200 to-emerald-400 border-emerald-500' : ''}
          ${fc.card.race === 'goblin' ? 'bg-gradient-to-br from-amber-200 to-amber-400 border-amber-500' : ''}
          ${fc.card.race === 'human' ? 'bg-gradient-to-br from-blue-200 to-blue-400 border-blue-500' : ''}
          ${fc.card.race === 'demon' ? 'bg-gradient-to-br from-red-200 to-red-400 border-red-500' : ''}
          ${canTarget ? 'ring-2 ring-red-500 animate-pulse' : ''}
        `}
      >
        <div className="text-[10px] font-bold text-white drop-shadow">{fc.card.rank}</div>
        <div className="text-base">{RACE_EMOJI[fc.card.race]}</div>
        <div className="text-[6px] font-bold text-white drop-shadow">
          {isRoyal ? ROLE_NAME[fc.card.rank] : `${fc.card.value}点`}
        </div>
      </div>
    );
  };

  // 拡大カードプレビュー（タッチ中に中央表示）
  const renderCardPreview = () => {
    if (!previewCard) return null;
    
    const effect = CARD_EFFECTS[previewCard.rank];
    const isRoyal = ['J', 'Q', 'K'].includes(previewCard.rank);
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        {/* 背景を少し暗く */}
        <div className="absolute inset-0 bg-black/40" />
        
        {/* 拡大カード */}
        <div className={`
          relative w-48 h-72 rounded-2xl border-4 flex flex-col items-center p-4
          shadow-2xl
          ${previewCard.race === 'elf' ? 'bg-gradient-to-br from-emerald-300 to-emerald-500 border-emerald-200' : ''}
          ${previewCard.race === 'goblin' ? 'bg-gradient-to-br from-amber-300 to-amber-500 border-amber-200' : ''}
          ${previewCard.race === 'human' ? 'bg-gradient-to-br from-blue-300 to-blue-500 border-blue-200' : ''}
          ${previewCard.race === 'demon' ? 'bg-gradient-to-br from-red-300 to-red-500 border-red-200' : ''}
        `}>
          {/* ランク */}
          <div className="text-3xl font-black text-white drop-shadow-lg mb-1">
            {previewCard.rank}
          </div>
          
          {/* 種族絵文字 */}
          <div className="text-6xl mb-2">
            {RACE_EMOJI[previewCard.race]}
          </div>
          
          {/* 名前 */}
          <div className="text-lg font-bold text-white drop-shadow mb-2">
            {isRoyal ? ROLE_NAME[previewCard.rank] : RACE_NAME[previewCard.race]}
          </div>
          
          {/* 点数 */}
          {previewCard.value > 0 && (
            <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-bold mb-2">
              💎 {effect.point}
            </div>
          )}
          
          {/* 効果タイプ */}
          <div className={`
            px-3 py-0.5 rounded-full text-xs font-bold mb-2
            ${effect.type === '永続' ? 'bg-purple-500 text-white' : 'bg-orange-500 text-white'}
          `}>
            {effect.type}
          </div>
          
          {/* 効果説明 */}
          <div className="bg-black/30 rounded-lg p-2 w-full">
            <div className="text-white text-xs leading-relaxed text-center whitespace-pre-line">
              {effect.effect}
            </div>
          </div>
        </div>
        
        {/* ドラッグ開始を促すヒント */}
        <div className="absolute bottom-20 text-white/80 text-sm font-bold animate-pulse">
          ドラッグしてエリアへ
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden relative select-none">
      {/* CPUエリア */}
      <div className="flex-shrink-0 p-2 bg-gradient-to-b from-slate-800/60 to-transparent">
        {/* CPU情報 */}
        <div className="flex justify-between items-center mb-1 px-2">
          <div className="text-white font-bold text-sm">🤖 CPU</div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 font-bold">{cpuPoints}/{cpuTarget}点</span>
            {cpu.kings > 0 && <span className="text-purple-300 text-sm">👑×{cpu.kings}</span>}
            {hasQueen(cpu) && <span className="text-pink-300 text-sm">🛡️</span>}
          </div>
        </div>

        {/* CPU手札 */}
        <div className="flex justify-center gap-1 mb-2">
          {cpu.hand.map((card) => (
            <div
              key={card.id}
              className="w-8 h-12 rounded bg-gradient-to-br from-gray-600 to-gray-800 border border-gray-500 flex items-center justify-center shadow"
            >
              <span className="text-lg">🎴</span>
            </div>
          ))}
        </div>

        {/* CPUフィールド */}
        <div className="flex gap-2 px-2">
          <div className="flex-1 min-h-[50px] bg-yellow-500/20 rounded-lg p-1 flex flex-wrap gap-1 justify-center items-center">
            <span className="text-yellow-300/50 text-[10px]">💎</span>
            {cpu.field.filter(fc => fc.card.value > 0 && fc.card.rank !== '8').map(fc => renderFieldCard(fc, true))}
          </div>
          <div className="flex-1 min-h-[50px] bg-purple-500/20 rounded-lg p-1 flex flex-wrap gap-1 justify-center items-center">
            <span className="text-purple-300/50 text-[10px]">✨</span>
            {cpu.field.filter(fc => fc.card.value === 0 || fc.card.rank === '8').map(fc => renderFieldCard(fc, true))}
          </div>
        </div>
      </div>

      {/* 中央エリア（山札・捨て札・アクションボタン） */}
      <div className="flex-1 flex items-center justify-center gap-6">
        <div className="text-center">
          <div className="w-12 h-18 rounded-lg bg-gradient-to-br from-blue-600 to-blue-800 border-2 border-blue-400 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold">{gameState.deck.length}</span>
          </div>
          <div className="text-white/50 text-[10px] mt-1">山札</div>
        </div>
        
        {/* アクションボタン */}
        {!isCPUTurn && gameState.phase === 'selectAction' && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => onAction('draw')}
              className="px-5 py-2 bg-blue-600 active:bg-blue-500 text-white rounded-lg text-sm font-bold shadow-lg"
            >
              📥 ドロー
            </button>
            <button
              onClick={() => onAction('pass')}
              className="px-5 py-2 bg-gray-600 active:bg-gray-500 text-white rounded-lg text-sm font-bold shadow-lg"
            >
              ⏭️ パス
            </button>
          </div>
        )}
        
        <div className="text-center">
          <div className="w-12 h-18 rounded-lg bg-gradient-to-br from-gray-600 to-gray-800 border-2 border-gray-500 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold">{gameState.scrapPile.length}</span>
          </div>
          <div className="text-white/50 text-[10px] mt-1">捨て札</div>
        </div>
      </div>

      {/* プレイヤーフィールド */}
      <div className="flex-shrink-0 px-3">
        <div className="flex gap-2">
          <div
            ref={pointAreaRef}
            className={`
              flex-1 min-h-[60px] rounded-xl p-2 transition-all flex flex-wrap gap-1 justify-center items-center
              ${dropTarget === 'point' ? 'bg-yellow-500/50 ring-4 ring-yellow-400 scale-105' : 'bg-yellow-500/20'}
            `}
          >
            <div className="w-full text-yellow-300/60 text-[10px] font-bold text-center">💎 点数</div>
            {player.field.filter(fc => fc.card.value > 0 && fc.card.rank !== '8').map(fc => renderFieldCard(fc, false))}
          </div>
          
          <div
            ref={effectAreaRef}
            className={`
              flex-1 min-h-[60px] rounded-xl p-2 transition-all flex flex-wrap gap-1 justify-center items-center
              ${dropTarget === 'effect' ? 'bg-purple-500/50 ring-4 ring-purple-400 scale-105' : 'bg-purple-500/20'}
            `}
          >
            <div className="w-full text-purple-300/60 text-[10px] font-bold text-center">✨ 効果</div>
            {player.field.filter(fc => fc.card.value === 0 || fc.card.rank === '8').map(fc => renderFieldCard(fc, false))}
          </div>
        </div>
      </div>

      {/* プレイヤー情報 */}
      <div className="flex-shrink-0 px-3 py-1">
        <div className="flex justify-between items-center">
          <div className="text-white font-bold text-sm">👤 あなた</div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 font-bold">{playerPoints}/{playerTarget}点</span>
            {player.kings > 0 && <span className="text-purple-300 text-sm">👑×{player.kings}</span>}
            {hasQueen(player) && <span className="text-pink-300 text-sm">🛡️</span>}
          </div>
        </div>
      </div>

      {/* プレイヤー手札 */}
      <div className="flex-shrink-0 h-28 relative bg-gradient-to-t from-slate-800/80 to-transparent">
        <div className="absolute inset-0 flex justify-center">
          {player.hand.map((card, i) => renderHandCard(card, i, player.hand.length))}
        </div>
      </div>

      {/* カードプレビュー */}
      {renderCardPreview()}

      {/* ドラッグ中のカード */}
      {isDragging && dragCard && (
        <div
          className="fixed pointer-events-none z-[60]"
          style={{
            left: dragPos.x - 36,
            top: dragPos.y - 54,
          }}
        >
          <div className={`
            w-18 h-24 rounded-xl border-3 flex flex-col items-center justify-center p-1
            shadow-2xl opacity-90
            ${dragCard.race === 'elf' ? 'bg-gradient-to-br from-emerald-300 to-emerald-500 border-emerald-200' : ''}
            ${dragCard.race === 'goblin' ? 'bg-gradient-to-br from-amber-300 to-amber-500 border-amber-200' : ''}
            ${dragCard.race === 'human' ? 'bg-gradient-to-br from-blue-300 to-blue-500 border-blue-200' : ''}
            ${dragCard.race === 'demon' ? 'bg-gradient-to-br from-red-300 to-red-500 border-red-200' : ''}
          `}>
            <div className="text-lg font-bold text-white drop-shadow">{dragCard.rank}</div>
            <div className="text-2xl">{RACE_EMOJI[dragCard.race]}</div>
          </div>
        </div>
      )}

      {/* ゲームオーバー */}
      {gameState.phase === 'gameOver' && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-2xl p-6 text-center max-w-xs mx-4">
            <div className="text-5xl mb-3">
              {gameState.winner === 'player1' ? '🏆' : '💀'}
            </div>
            <h2 className={`text-2xl font-bold mb-2 ${gameState.winner === 'player1' ? 'text-yellow-400' : 'text-red-400'}`}>
              {gameState.winner === 'player1' ? '勝利！' : '敗北...'}
            </h2>
            <p className="text-gray-400 mb-4 text-sm">
              {gameState.winner === 'player1' ? 'おめでとう！' : '次こそは...'}
            </p>
            <button
              onClick={onRestart}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold shadow-lg"
            >
              🔄 もう一度
            </button>
          </div>
        </div>
      )}

      {/* メッセージ */}
      {gameState.message && gameState.phase !== 'gameOver' && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-4 py-2 rounded-lg text-sm font-bold z-40 pointer-events-none">
          {gameState.message}
        </div>
      )}
    </div>
  );
}
