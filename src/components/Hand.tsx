import type { Card as CardType } from '../types/game';
import { Card } from './Card';

interface HandProps {
  cards: CardType[];
  onCardClick?: (card: CardType) => void;
  selectedCard?: CardType | null;
  selectable?: boolean;
  hidden?: boolean;
  revealed?: boolean;
  isCurrentPlayer?: boolean;
}

export function Hand({ 
  cards, 
  onCardClick, 
  selectedCard, 
  selectable = false,
  hidden = false,
  revealed = false,
  isCurrentPlayer = false
}: HandProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div 
        className={`
          flex gap-2 p-3 rounded-xl
          ${isCurrentPlayer ? 'bg-yellow-500/20 border-2 border-yellow-500/50' : 'bg-gray-800/50'}
          min-h-[140px] items-center
        `}
        style={{
          // カードが重なるように配置
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {cards.length === 0 ? (
          <span className="text-gray-500 text-sm">手札なし</span>
        ) : (
          cards.map((card, index) => (
            <div 
              key={card.id}
              className="card-enter"
              style={{
                marginLeft: index > 0 ? '-20px' : '0',
                zIndex: index,
              }}
            >
              <Card
                card={card}
                onClick={() => onCardClick?.(card)}
                selected={selectedCard?.id === card.id}
                selectable={selectable}
                faceDown={hidden}
                revealed={revealed}
              />
            </div>
          ))
        )}
      </div>
      <span className="text-gray-400 text-sm">
        {cards.length}枚
        {revealed && hidden && ' (公開中)'}
      </span>
    </div>
  );
}

