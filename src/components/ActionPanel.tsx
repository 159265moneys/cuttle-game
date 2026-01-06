import type { Card as CardType, ActionType, GameState } from '../types/game';

interface ActionPanelProps {
  selectedCard: CardType | null;
  gameState: GameState;
  onAction: (action: ActionType) => void;
  onCancel: () => void;
}

export function ActionPanel({ 
  selectedCard, 
  gameState,
  onAction, 
  onCancel 
}: ActionPanelProps) {
  if (!selectedCard) {
    return (
      <div className="bg-gray-800/80 rounded-xl p-4 backdrop-blur">
        <p className="text-gray-400 text-center">カードを選択してください</p>
        <div className="flex gap-2 mt-4 justify-center">
          {gameState.deck.length > 0 ? (
            <button
              onClick={() => onAction('draw')}
              className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-white transition-colors"
            >
              🃏 ドロー
            </button>
          ) : (
            <button
              onClick={() => onAction('pass')}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg font-bold text-white transition-colors"
            >
              ⏭️ パス
            </button>
          )}
        </div>
      </div>
    );
  }

  const isRoyal = selectedCard.rank === 'J' || selectedCard.rank === 'Q' || selectedCard.rank === 'K';
  const isNumber = !isRoyal;
  const canPlayAsPoint = isNumber;
  const canPlayOneOff = isNumber && selectedCard.rank !== '8';
  const canPlayPermanent = selectedCard.rank === 'Q' || selectedCard.rank === 'K' || selectedCard.rank === '8';
  const canPlayKnight = selectedCard.rank === 'J';
  const canScuttle = isNumber && selectedCard.value > 0;

  // ワンオフ効果の説明
  const oneOffDescription: Record<string, string> = {
    'A': '相手の点数カードを1枚破壊',
    '2': '相手の永続カードを1枚破壊',
    '3': '捨て札から1枚回収',
    '4': '相手に手札を2枚捨てさせる',
    '5': '山札から2枚ドロー',
    '6': '全ての永続カードを破壊',
    '7': '山札トップを見てプレイ',
    '9': '相手のカードを1枚手札に戻す',
    '10': '相手の点数カードを手札に戻す',
  };

  return (
    <div className="bg-gray-800/80 rounded-xl p-4 backdrop-blur min-w-[280px]">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-white font-bold">
          {selectedCard.rank} を使う
        </h3>
        <button
          onClick={onCancel}
          className="text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {/* 点数カードとして配置 */}
        {canPlayAsPoint && (
          <button
            onClick={() => onAction('playPoint')}
            className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-white transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">📍</span>
              <div>
                <div>点数カードとして配置</div>
                <div className="text-sm text-blue-200">+{selectedCard.value}点</div>
              </div>
            </div>
          </button>
        )}

        {/* ワンオフ効果 */}
        {canPlayOneOff && (
          <button
            onClick={() => onAction('playOneOff')}
            className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold text-white transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">✨</span>
              <div>
                <div>ワンオフ効果</div>
                <div className="text-sm text-purple-200">
                  {oneOffDescription[selectedCard.rank] || '効果を発動'}
                </div>
              </div>
            </div>
          </button>
        )}

        {/* 永続効果として配置 */}
        {canPlayPermanent && (
          <button
            onClick={() => onAction('playPermanent')}
            className="w-full px-4 py-3 bg-amber-600 hover:bg-amber-500 rounded-lg font-bold text-white transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {selectedCard.rank === 'Q' ? '🛡️' : selectedCard.rank === 'K' ? '👑' : '👁️'}
              </span>
              <div>
                <div>永続効果として配置</div>
                <div className="text-sm text-amber-200">
                  {selectedCard.rank === 'Q' && '結界：点数カードを保護'}
                  {selectedCard.rank === 'K' && '勅令：勝利条件を緩和'}
                  {selectedCard.rank === '8' && '監視：相手の手札を公開'}
                </div>
              </div>
            </div>
          </button>
        )}

        {/* 騎士として使用 */}
        {canPlayKnight && (
          <button
            onClick={() => onAction('playPermanent')}
            className="w-full px-4 py-3 bg-pink-600 hover:bg-pink-500 rounded-lg font-bold text-white transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">⚔️</span>
              <div>
                <div>騎士：カードを略奪</div>
                <div className="text-sm text-pink-200">相手の点数カードを奪う</div>
              </div>
            </div>
          </button>
        )}

        {/* スカトル */}
        {canScuttle && (
          <button
            onClick={() => onAction('scuttle')}
            className="w-full px-4 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-bold text-white transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">💥</span>
              <div>
                <div>スカトル</div>
                <div className="text-sm text-red-200">
                  {selectedCard.value}以下の点数カードを破壊
                </div>
              </div>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}

