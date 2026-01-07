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
const CARD_EFFECTS: Record<string, { point: string; effect: string; type: string; needsTarget?: 'point' | 'permanent' | 'any' | 'scrap' }> = {
  'A': { point: '1点', effect: '相手の点数カード1枚を破壊する', type: 'ワンオフ', needsTarget: 'point' },
  '2': { point: '2点', effect: '相手の永続カード(J/Q/K/8)を1枚破壊する', type: 'ワンオフ', needsTarget: 'permanent' },
  '3': { point: '3点', effect: '捨て札から好きなカードを1枚回収する', type: 'ワンオフ', needsTarget: 'scrap' },
  '4': { point: '4点', effect: '相手に手札を2枚捨てさせる', type: 'ワンオフ' },
  '5': { point: '5点', effect: '山札から2枚ドローする', type: 'ワンオフ' },
  '6': { point: '6点', effect: '全ての永続カードを破壊する（自分のも含む）', type: 'ワンオフ' },
  '7': { point: '7点', effect: '山札の1番上を見て、それか手札から1枚プレイする', type: 'ワンオフ' },
  '8': { point: '8点', effect: '相手の手札を常に公開させる', type: '永続' },
  '9': { point: '9点', effect: '相手のカード1枚を手札に戻す', type: 'ワンオフ', needsTarget: 'any' },
  '10': { point: '10点', effect: '相手の点数カード1枚を手札に戻す', type: 'ワンオフ', needsTarget: 'point' },
  'J': { point: '-', effect: '相手の点数カードを1枚略奪して自分のものにする', type: '永続', needsTarget: 'point' },
  'Q': { point: '-', effect: '自分の点数カードを相手の効果から保護する', type: '永続' },
  'K': { point: '-', effect: '勝利に必要な点数を減らす\n0枚:21点→1枚:14点→2枚:10点→3枚:7点→4枚:5点', type: '永続' },
};

// ターゲットが必要なカード
const NEEDS_TARGET = ['A', '2', '9', '10', 'J'];

export function GameBoard({
  gameState,
  onCardSelect,
  onFieldCardSelect,
  onScrapSelect,
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
  const [previewCard, setPreviewCard] = useState<CardType | null>(null);
  const [dragCard, setDragCard] = useState<CardType | null>(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const [touchStartPos, setTouchStartPos] = useState({ x: 0, y: 0 });
  const [dropTarget, setDropTarget] = useState<'point' | 'effect' | FieldCard | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showScrapModal, setShowScrapModal] = useState(false);
  
  const pointAreaRef = useRef<HTMLDivElement>(null);
  const effectAreaRef = useRef<HTMLDivElement>(null);
  const cpuFieldRef = useRef<HTMLDivElement>(null);
  
  // 縦方向に50px以上動いたらドラッグ開始（化学式ゲーム準拠）
  const DRAG_THRESHOLD_Y = 50;

  // 山札タップでドロー
  const handleDeckTap = useCallback(() => {
    if (isCPUTurn || gameState.phase !== 'selectAction') return;
    onAction('draw');
  }, [isCPUTurn, gameState.phase, onAction]);

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

      // ★化学式ゲーム準拠: 上に50px以上動いたらドラッグモード
      if (previewCard && !isDragging) {
        const movedUp = touchStartPos.y - clientY > DRAG_THRESHOLD_Y;
        if (movedUp) {
          setDragCard(previewCard);
          setPreviewCard(null);
          setIsDragging(true);
        }
        // 横移動はカード切り替え（今は実装しない、単にプレビュー維持）
        return;
      }

      // ドラッグ中ならドロップエリア判定
      if (isDragging && dragCard) {
        const needsTarget = NEEDS_TARGET.includes(dragCard.rank);
        
        // ターゲット必要なカード → CPUフィールドカードを判定
        if (needsTarget && cpuFieldRef.current) {
          const cpuCards = cpuFieldRef.current.querySelectorAll('[data-field-card]');
          let foundTarget: FieldCard | null = null;
          
          cpuCards.forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (clientX >= rect.left && clientX <= rect.right &&
                clientY >= rect.top && clientY <= rect.bottom) {
              const cardId = el.getAttribute('data-card-id');
              const fc = cpu.field.find(f => f.card.id === cardId);
              if (fc) {
                // ターゲット条件チェック
                const effect = CARD_EFFECTS[dragCard.rank];
                if (effect.needsTarget === 'point' && fc.card.value > 0) {
                  foundTarget = fc;
                } else if (effect.needsTarget === 'permanent' && 
                  (fc.card.rank === 'J' || fc.card.rank === 'Q' || fc.card.rank === 'K' || 
                   (fc.card.rank === '8' && fc.card.value === 0))) {
                  foundTarget = fc;
                } else if (effect.needsTarget === 'any') {
                  foundTarget = fc;
                }
              }
            }
          });
          
          if (foundTarget) {
            setDropTarget(foundTarget);
            return;
          }
        }
        
        // 通常のエリア判定
        if (pointAreaRef.current && effectAreaRef.current) {
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
      }
    };

    const handleEnd = () => {
      if (isDragging && dragCard && dropTarget) {
        setTimeout(() => {
          // ターゲットがフィールドカードの場合
          if (typeof dropTarget === 'object' && 'card' in dropTarget) {
            onFieldCardSelect(dropTarget);
            // ターゲット選択後のアクション
            if (dragCard.rank === 'J') {
              onAction('playPermanent');
            } else {
              onAction('playOneOff');
            }
          }
          // 点数エリア
          else if (dropTarget === 'point' && dragCard.value > 0) {
            onAction('playPoint');
          }
          // 効果エリア
          else if (dropTarget === 'effect') {
            // 3の効果（墓地から回収）はモーダルを表示
            if (dragCard.rank === '3') {
              setShowScrapModal(true);
              setDragCard(null);
              setDropTarget(null);
              setIsDragging(false);
              return;
            }
            
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
  }, [previewCard, isDragging, dragCard, dropTarget, touchStartPos, onAction, onFieldCardSelect, cpu.field]);

  // 墓地カード選択
  const handleScrapCardSelect = useCallback((card: CardType) => {
    setShowScrapModal(false);
    onScrapSelect(card);
    onAction('playOneOff');
  }, [onScrapSelect, onAction]);

  // 手札カード
  const renderHandCard = (card: CardType, index: number, total: number) => {
    const centerIdx = (total - 1) / 2;
    const offset = index - centerIdx;
    const maxAngle = 12;
    const angle = total > 1 ? (offset / Math.max(centerIdx, 1)) * maxAngle : 0;
    const xOffset = offset * 50;
    const yOffset = Math.abs(offset) * 8;
    const isRoyal = ['J', 'Q', 'K'].includes(card.rank);
    const isBeingDragged = dragCard?.id === card.id;

    return (
      <div
        key={card.id}
        className="absolute touch-none select-none"
        style={{
          left: '50%',
          bottom: '4px',
          transform: `translateX(calc(-50% + ${xOffset}px)) translateY(${yOffset}px) rotate(${angle}deg)`,
          zIndex: index + 1,
          opacity: isBeingDragged ? 0.3 : 1,
        }}
        onTouchStart={(e) => handleTouchStart(card, e)}
        onMouseDown={(e) => handleTouchStart(card, e)}
      >
        <div 
          className={`
            rounded-xl border-3 flex flex-col items-center justify-between p-2
            shadow-xl transition-transform
            ${card.race === 'elf' ? 'bg-gradient-to-br from-emerald-200 to-emerald-400 border-emerald-500' : ''}
            ${card.race === 'goblin' ? 'bg-gradient-to-br from-amber-200 to-amber-400 border-amber-500' : ''}
            ${card.race === 'human' ? 'bg-gradient-to-br from-blue-200 to-blue-400 border-blue-500' : ''}
            ${card.race === 'demon' ? 'bg-gradient-to-br from-red-200 to-red-400 border-red-500' : ''}
          `}
          style={{ width: '72px', height: '100px' }}
        >
          <div className="text-base font-bold text-white drop-shadow">{card.rank}</div>
          <div className="text-3xl">{RACE_EMOJI[card.race]}</div>
          <div className="text-[9px] font-bold text-white drop-shadow">
            {isRoyal ? ROLE_NAME[card.rank] : RACE_NAME[card.race]}
          </div>
        </div>
      </div>
    );
  };

  // フィールドカード（2倍サイズ）
  const renderFieldCard = (fc: FieldCard, isOpponent: boolean) => {
    const isRoyal = ['J', 'Q', 'K'].includes(fc.card.rank);
    const isDropTarget = typeof dropTarget === 'object' && dropTarget?.card?.id === fc.card.id;
    const needsTarget = dragCard && NEEDS_TARGET.includes(dragCard.rank);

    return (
      <div
        key={fc.card.id}
        data-field-card
        data-card-id={fc.card.id}
        className={`
          rounded-lg border-3 flex flex-col items-center justify-between p-1
          shadow-lg transition-all
          ${fc.card.race === 'elf' ? 'bg-gradient-to-br from-emerald-200 to-emerald-400 border-emerald-500' : ''}
          ${fc.card.race === 'goblin' ? 'bg-gradient-to-br from-amber-200 to-amber-400 border-amber-500' : ''}
          ${fc.card.race === 'human' ? 'bg-gradient-to-br from-blue-200 to-blue-400 border-blue-500' : ''}
          ${fc.card.race === 'demon' ? 'bg-gradient-to-br from-red-200 to-red-400 border-red-500' : ''}
          ${isDropTarget ? 'ring-4 ring-red-500 scale-110' : ''}
          ${isOpponent && needsTarget && isDragging ? 'ring-2 ring-yellow-400' : ''}
        `}
        style={{ width: '56px', height: '80px' }}
      >
        <div className="text-sm font-bold text-white drop-shadow">{fc.card.rank}</div>
        <div className="text-2xl">{RACE_EMOJI[fc.card.race]}</div>
        <div className="text-[8px] font-bold text-white drop-shadow">
          {isRoyal ? ROLE_NAME[fc.card.rank] : `${fc.card.value}点`}
        </div>
      </div>
    );
  };

  // 拡大カードプレビュー
  const renderCardPreview = () => {
    if (!previewCard) return null;
    
    const effect = CARD_EFFECTS[previewCard.rank];
    const isRoyal = ['J', 'Q', 'K'].includes(previewCard.rank);
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="absolute inset-0 bg-black/40" />
        
        <div className={`
          relative w-48 h-72 rounded-2xl border-4 flex flex-col items-center p-4
          shadow-2xl
          ${previewCard.race === 'elf' ? 'bg-gradient-to-br from-emerald-300 to-emerald-500 border-emerald-200' : ''}
          ${previewCard.race === 'goblin' ? 'bg-gradient-to-br from-amber-300 to-amber-500 border-amber-200' : ''}
          ${previewCard.race === 'human' ? 'bg-gradient-to-br from-blue-300 to-blue-500 border-blue-200' : ''}
          ${previewCard.race === 'demon' ? 'bg-gradient-to-br from-red-300 to-red-500 border-red-200' : ''}
        `}>
          <div className="text-3xl font-black text-white drop-shadow-lg mb-1">
            {previewCard.rank}
          </div>
          
          <div className="text-6xl mb-2">
            {RACE_EMOJI[previewCard.race]}
          </div>
          
          <div className="text-lg font-bold text-white drop-shadow mb-2">
            {isRoyal ? ROLE_NAME[previewCard.rank] : RACE_NAME[previewCard.race]}
          </div>
          
          {previewCard.value > 0 && (
            <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-sm font-bold mb-2">
              💎 {effect.point}
            </div>
          )}
          
          <div className={`
            px-3 py-0.5 rounded-full text-xs font-bold mb-2
            ${effect.type === '永続' ? 'bg-purple-500 text-white' : 'bg-orange-500 text-white'}
          `}>
            {effect.type}
          </div>
          
          <div className="bg-black/30 rounded-lg p-2 w-full">
            <div className="text-white text-xs leading-relaxed text-center whitespace-pre-line">
              {effect.effect}
            </div>
          </div>
        </div>
        
        <div className="absolute bottom-24 text-white/80 text-sm font-bold animate-pulse">
          ↑ 上にドラッグ
        </div>
      </div>
    );
  };

  // 墓地選択モーダル
  const renderScrapModal = () => {
    if (!showScrapModal) return null;
    
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80">
        <div className="bg-gray-800 rounded-2xl p-4 max-w-sm mx-4 max-h-[70vh] overflow-auto">
          <h3 className="text-white font-bold text-lg mb-3 text-center">
            🗑️ 捨て札から回収
          </h3>
          
          {gameState.scrapPile.length === 0 ? (
            <p className="text-gray-400 text-center py-8">捨て札がありません</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {gameState.scrapPile.map((card, index) => {
                const isRoyal = ['J', 'Q', 'K'].includes(card.rank);
                return (
                  <div
                    key={`${card.id}-${index}`}
                    className={`
                      rounded-lg border-2 p-2 flex flex-col items-center cursor-pointer
                      active:scale-95 transition-transform
                      ${card.race === 'elf' ? 'bg-gradient-to-br from-emerald-200 to-emerald-400 border-emerald-500' : ''}
                      ${card.race === 'goblin' ? 'bg-gradient-to-br from-amber-200 to-amber-400 border-amber-500' : ''}
                      ${card.race === 'human' ? 'bg-gradient-to-br from-blue-200 to-blue-400 border-blue-500' : ''}
                      ${card.race === 'demon' ? 'bg-gradient-to-br from-red-200 to-red-400 border-red-500' : ''}
                    `}
                    onClick={() => handleScrapCardSelect(card)}
                  >
                    <div className="text-sm font-bold text-white drop-shadow">{card.rank}</div>
                    <div className="text-xl">{RACE_EMOJI[card.race]}</div>
                    <div className="text-[8px] font-bold text-white drop-shadow">
                      {isRoyal ? ROLE_NAME[card.rank] : `${card.value}点`}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          <button
            onClick={() => setShowScrapModal(false)}
            className="w-full mt-4 py-2 bg-gray-600 active:bg-gray-500 text-white rounded-lg font-bold"
          >
            キャンセル
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden relative select-none">
      {/* CPUエリア */}
      <div className="flex-shrink-0 p-2 bg-gradient-to-b from-slate-800/60 to-transparent">
        <div className="flex justify-between items-center mb-1 px-2">
          <div className="text-white font-bold text-sm">🤖 CPU</div>
          <div className="flex items-center gap-2">
            <span className="text-yellow-400 font-bold">{cpuPoints}/{cpuTarget}点</span>
            {cpu.kings > 0 && <span className="text-purple-300 text-sm">👑×{cpu.kings}</span>}
            {hasQueen(cpu) && <span className="text-pink-300 text-sm">🛡️</span>}
          </div>
        </div>

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

        {/* CPUフィールド（2倍サイズ、ドロップターゲット可能） */}
        <div ref={cpuFieldRef} className="flex gap-3 px-2">
          <div className="flex-1 min-h-[90px] bg-yellow-500/20 rounded-xl p-2 flex flex-wrap gap-2 justify-center items-center">
            <div className="w-full text-yellow-300/50 text-[10px] font-bold text-center">💎</div>
            {cpu.field.filter(fc => fc.card.value > 0 && fc.card.rank !== '8').map(fc => renderFieldCard(fc, true))}
          </div>
          <div className="flex-1 min-h-[90px] bg-purple-500/20 rounded-xl p-2 flex flex-wrap gap-2 justify-center items-center">
            <div className="w-full text-purple-300/50 text-[10px] font-bold text-center">✨</div>
            {cpu.field.filter(fc => fc.card.value === 0 || fc.card.rank === '8').map(fc => renderFieldCard(fc, true))}
          </div>
        </div>
      </div>

      {/* 中央エリア（山札タップでドロー、パスボタンのみ） */}
      <div className="flex-1 flex items-center justify-center gap-8">
        {/* 山札（タップでドロー） */}
        <div 
          className="text-center cursor-pointer active:scale-95 transition-transform"
          onClick={handleDeckTap}
        >
          <div className={`
            w-16 h-24 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 border-3 border-blue-300 
            flex flex-col items-center justify-center shadow-xl
            ${!isCPUTurn && gameState.phase === 'selectAction' ? 'ring-2 ring-yellow-400 animate-pulse' : ''}
          `}>
            <span className="text-white font-bold text-xl">{gameState.deck.length}</span>
            <span className="text-blue-200 text-[10px]">TAP</span>
          </div>
          <div className="text-white/60 text-xs mt-1">山札</div>
        </div>
        
        {/* パスボタン（山札が0の時のみ） */}
        {!isCPUTurn && gameState.phase === 'selectAction' && gameState.deck.length === 0 && (
          <button
            onClick={() => onAction('pass')}
            className="px-6 py-3 bg-gray-600 active:bg-gray-500 text-white rounded-xl text-base font-bold shadow-lg"
          >
            ⏭️ パス
          </button>
        )}
        
        {/* 捨て札 */}
        <div className="text-center">
          <div className="w-16 h-24 rounded-xl bg-gradient-to-br from-gray-600 to-gray-800 border-3 border-gray-500 flex flex-col items-center justify-center shadow-xl">
            <span className="text-white font-bold text-xl">{gameState.scrapPile.length}</span>
            <span className="text-gray-400 text-[10px]">捨て札</span>
          </div>
          <div className="text-white/60 text-xs mt-1">墓地</div>
        </div>
      </div>

      {/* プレイヤーフィールド（2倍サイズ） */}
      <div className="flex-shrink-0 px-3">
        <div className="flex gap-3">
          <div
            ref={pointAreaRef}
            className={`
              flex-1 min-h-[90px] rounded-xl p-2 transition-all flex flex-wrap gap-2 justify-center items-center
              ${dropTarget === 'point' ? 'bg-yellow-500/50 ring-4 ring-yellow-400 scale-105' : 'bg-yellow-500/20'}
            `}
          >
            <div className="w-full text-yellow-300/60 text-xs font-bold text-center">💎 点数</div>
            {player.field.filter(fc => fc.card.value > 0 && fc.card.rank !== '8').map(fc => renderFieldCard(fc, false))}
          </div>
          
          <div
            ref={effectAreaRef}
            className={`
              flex-1 min-h-[90px] rounded-xl p-2 transition-all flex flex-wrap gap-2 justify-center items-center
              ${dropTarget === 'effect' ? 'bg-purple-500/50 ring-4 ring-purple-400 scale-105' : 'bg-purple-500/20'}
            `}
          >
            <div className="w-full text-purple-300/60 text-xs font-bold text-center">✨ 効果</div>
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
      <div className="flex-shrink-0 h-32 relative bg-gradient-to-t from-slate-800/80 to-transparent">
        <div className="absolute inset-0 flex justify-center">
          {player.hand.map((card, i) => renderHandCard(card, i, player.hand.length))}
        </div>
      </div>

      {/* カードプレビュー */}
      {renderCardPreview()}

      {/* 墓地選択モーダル */}
      {renderScrapModal()}

      {/* ドラッグ中のカード */}
      {isDragging && dragCard && (
        <div
          className="fixed pointer-events-none z-[60]"
          style={{
            left: dragPos.x - 36,
            top: dragPos.y - 50,
          }}
        >
          <div 
            className={`
              rounded-xl border-4 flex flex-col items-center justify-center
              shadow-2xl opacity-95
              ${dragCard.race === 'elf' ? 'bg-gradient-to-br from-emerald-300 to-emerald-500 border-emerald-200' : ''}
              ${dragCard.race === 'goblin' ? 'bg-gradient-to-br from-amber-300 to-amber-500 border-amber-200' : ''}
              ${dragCard.race === 'human' ? 'bg-gradient-to-br from-blue-300 to-blue-500 border-blue-200' : ''}
              ${dragCard.race === 'demon' ? 'bg-gradient-to-br from-red-300 to-red-500 border-red-200' : ''}
            `}
            style={{ width: '72px', height: '100px' }}
          >
            <div className="text-xl font-bold text-white drop-shadow">{dragCard.rank}</div>
            <div className="text-3xl">{RACE_EMOJI[dragCard.race]}</div>
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
