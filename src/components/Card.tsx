import { useState, useCallback } from 'react';
import type { Card as CardType } from '../types/game';
import { RACE_EMOJI, RACE_NAME, ROLE_NAME } from '../types/game';
import { CardTooltip } from './CardTooltip';

interface CardProps {
  card: CardType;
  onClick?: () => void;
  selected?: boolean;
  selectable?: boolean;
  faceDown?: boolean;
  small?: boolean;
  revealed?: boolean;
  showTooltip?: boolean;
}

export function Card({ 
  card, 
  onClick, 
  selected = false, 
  selectable = false,
  faceDown = false,
  small = false,
  revealed = false,
  showTooltip = true
}: CardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    if (!faceDown || revealed) {
      setIsHovered(true);
      setMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [faceDown, revealed]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
  }, []);

  const raceColors = {
    elf: 'from-emerald-400 to-emerald-600 border-emerald-300',
    goblin: 'from-amber-400 to-amber-600 border-amber-300',
    human: 'from-blue-400 to-blue-600 border-blue-300',
    demon: 'from-red-400 to-red-600 border-red-300',
  };

  const raceBgColors = {
    elf: 'bg-emerald-900/50',
    goblin: 'bg-amber-900/50',
    human: 'bg-blue-900/50',
    demon: 'bg-red-900/50',
  };

  if (faceDown && !revealed) {
    return (
      <div 
        className={`
          ${small ? 'w-12 h-16' : 'w-20 h-28'} 
          rounded-lg border-2 border-gray-500
          bg-gradient-to-br from-gray-700 to-gray-900
          flex items-center justify-center
          shadow-lg
          ${selectable ? 'cursor-pointer hover:scale-105 transition-transform' : ''}
        `}
        onClick={onClick}
      >
        <div className="text-2xl">🎴</div>
      </div>
    );
  }

  const isRoyal = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';
  const displayRank = isRoyal ? ROLE_NAME[card.rank] : card.rank;

  return (
    <>
      <div 
        className={`
          ${small ? 'w-12 h-16' : 'w-20 h-28'} 
          rounded-lg border-2 
          bg-gradient-to-br ${raceColors[card.race]}
          flex flex-col items-center justify-between
          p-1
          shadow-lg
          transition-all duration-200
          ${selectable ? 'cursor-pointer card-selectable' : ''}
          ${selected ? 'ring-4 ring-yellow-400 -translate-y-3 scale-105' : ''}
          ${onClick && selectable ? 'hover:-translate-y-2 hover:shadow-xl' : ''}
        `}
        onClick={selectable ? onClick : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* 上部：ランク */}
        <div className={`
          w-full text-left font-bold text-white drop-shadow-md
          ${small ? 'text-xs' : 'text-lg'}
        `}>
          {card.rank}
        </div>

        {/* 中央：種族絵文字 */}
        <div className={`
          ${small ? 'text-lg' : 'text-3xl'}
        `}>
          {RACE_EMOJI[card.race]}
        </div>

        {/* 下部：種族名または役職名 */}
        <div className={`
          w-full ${raceBgColors[card.race]} rounded px-1
          text-center text-white font-bold
          ${small ? 'text-[8px]' : 'text-xs'}
        `}>
          {isRoyal ? displayRank : RACE_NAME[card.race]}
        </div>
      </div>

      {/* ツールチップ */}
      {showTooltip && isHovered && !small && (
        <CardTooltip card={card} position={mousePos} />
      )}
    </>
  );
}

// 空のカードスロット
export function EmptySlot({ onClick, label }: { onClick?: () => void; label?: string }) {
  return (
    <div 
      className={`
        w-20 h-28 rounded-lg border-2 border-dashed border-gray-600
        flex items-center justify-center
        bg-gray-800/30
        ${onClick ? 'cursor-pointer hover:bg-gray-700/30 transition-colors' : ''}
      `}
      onClick={onClick}
    >
      {label && <span className="text-gray-500 text-xs">{label}</span>}
    </div>
  );
}
