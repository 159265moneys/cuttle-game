import type { FieldCard, Player } from '../types/game';
import { WINNING_POINTS } from '../types/game';
import { Card, EmptySlot } from './Card';
import { calculatePlayerPoints } from '../utils/gameLogic';

interface FieldProps {
  player: Player;
  onCardClick?: (fieldCard: FieldCard) => void;
  selectedCard?: FieldCard | null;
  selectable?: boolean;
  isOpponent?: boolean;
}

export function Field({ 
  player, 
  onCardClick, 
  selectedCard,
  selectable = false,
  isOpponent = false
}: FieldProps) {
  const points = calculatePlayerPoints(player);
  const targetPoints = WINNING_POINTS[Math.min(player.kings, 4)];
  
  // 点数カードと永続カードを分ける
  const pointCards = player.field.filter(fc => fc.card.value > 0);
  const permanentCards = player.field.filter(fc => 
    fc.card.rank === 'J' || fc.card.rank === 'Q' || fc.card.rank === 'K' ||
    (fc.card.rank === '8' && fc.card.value === 0)
  );

  return (
    <div className={`
      flex flex-col gap-3 p-4 rounded-xl
      ${isOpponent ? 'bg-red-900/20 border border-red-500/30' : 'bg-blue-900/20 border border-blue-500/30'}
      min-w-[300px]
    `}>
      {/* ヘッダー：プレイヤー名と点数 */}
      <div className="flex justify-between items-center">
        <span className={`font-bold ${isOpponent ? 'text-red-400' : 'text-blue-400'}`}>
          {player.name}
        </span>
        <div className="flex items-center gap-2">
          <span className={`
            text-2xl font-bold
            ${points >= targetPoints ? 'text-yellow-400 animate-pulse' : 'text-white'}
          `}>
            {points}
          </span>
          <span className="text-gray-400">/ {targetPoints}点</span>
        </div>
      </div>

      {/* 永続カードエリア */}
      {permanentCards.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <span className="text-xs text-gray-400 w-full">永続効果</span>
          {permanentCards.map(fc => (
            <div key={fc.card.id} className="relative">
              <Card
                card={fc.card}
                onClick={() => onCardClick?.(fc)}
                selected={selectedCard?.card.id === fc.card.id}
                selectable={selectable}
                small
              />
              {/* 王の場合は勝利条件を表示 */}
              {fc.card.rank === 'K' && (
                <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {WINNING_POINTS[Math.min(player.kings, 4)]}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 点数カードエリア */}
      <div className="flex gap-2 flex-wrap min-h-[120px] items-start">
        {pointCards.length === 0 ? (
          <EmptySlot label="点数カード" />
        ) : (
          pointCards.map(fc => (
            <div key={fc.card.id} className="relative">
              <Card
                card={fc.card}
                onClick={() => onCardClick?.(fc)}
                selected={selectedCard?.card.id === fc.card.id}
                selectable={selectable}
              />
              {/* 騎士が付いている場合 */}
              {fc.attachedKnights.length > 0 && (
                <div className="absolute -top-3 -right-3">
                  {fc.attachedKnights.map((knight, i) => (
                    <div 
                      key={knight.id}
                      className="bg-purple-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white shadow-lg"
                      style={{ marginTop: i > 0 ? '-12px' : '0' }}
                    >
                      J
                    </div>
                  ))}
                </div>
              )}
              {/* 支配者が変わっている場合の表示 */}
              {fc.controller !== fc.owner && (
                <div className="absolute bottom-0 left-0 right-0 bg-purple-600/80 text-white text-xs text-center rounded-b">
                  略奪中
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

