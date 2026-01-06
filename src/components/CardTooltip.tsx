import type { Card as CardType } from '../types/game';
import { RACE_EMOJI, RACE_NAME, ROLE_NAME } from '../types/game';

interface CardTooltipProps {
  card: CardType;
  position: { x: number; y: number };
}

// カード効果の説明
const CARD_EFFECTS: Record<string, { name: string; point: string; effect: string }> = {
  'A': {
    name: 'エース',
    point: '1点',
    effect: '【ワンオフ】相手の点数カード1枚を破壊する',
  },
  '2': {
    name: '2',
    point: '2点',
    effect: '【ワンオフ】相手の永続カード（J,Q,K,8）を1枚破壊する',
  },
  '3': {
    name: '3',
    point: '3点',
    effect: '【ワンオフ】捨て札から1枚を手札に回収する',
  },
  '4': {
    name: '4',
    point: '4点',
    effect: '【ワンオフ】相手に手札を2枚捨てさせる',
  },
  '5': {
    name: '5',
    point: '5点',
    effect: '【ワンオフ】山札から2枚ドローする',
  },
  '6': {
    name: '6',
    point: '6点',
    effect: '【ワンオフ】場の全ての永続カードを破壊する（自分のも含む）',
  },
  '7': {
    name: '7',
    point: '7点',
    effect: '【ワンオフ】山札の1番上を見て、それか手札から1枚プレイする',
  },
  '8': {
    name: '8',
    point: '8点',
    effect: '【永続】相手の手札を公開させる（密偵）',
  },
  '9': {
    name: '9',
    point: '9点',
    effect: '【ワンオフ】相手のカード1枚を手札に戻す',
  },
  '10': {
    name: '10',
    point: '10点',
    effect: '【ワンオフ】相手の点数カード1枚を手札に戻す',
  },
  'J': {
    name: '騎士',
    point: '-',
    effect: '【永続】相手の点数カードを1枚略奪する',
  },
  'Q': {
    name: '魔術師',
    point: '-',
    effect: '【永続】自分の点数カードを保護する（結界）',
  },
  'K': {
    name: '王',
    point: '-',
    effect: '【永続】勝利に必要な点数を減らす（勅令）\n0枚:21点 → 1枚:14点 → 2枚:10点 → 3枚:7点 → 4枚:5点',
  },
};

// 種族の強さ説明
const RACE_STRENGTH: Record<string, string> = {
  elf: '最弱（デーモンにのみ勝てる）',
  goblin: 'エルフに勝つ',
  human: 'エルフ・ゴブリンに勝つ',
  demon: '最強（エルフに負ける）',
};

export function CardTooltip({ card, position }: CardTooltipProps) {
  const effect = CARD_EFFECTS[card.rank];
  const isRoyal = card.rank === 'J' || card.rank === 'Q' || card.rank === 'K';

  // 画面端での位置調整
  const adjustedX = Math.min(position.x, window.innerWidth - 320);
  const adjustedY = Math.min(position.y, window.innerHeight - 400);

  return (
    <div 
      className="fixed z-50 pointer-events-none"
      style={{ 
        left: adjustedX + 20, 
        top: adjustedY - 100,
      }}
    >
      <div className="flex gap-4 bg-gray-900/95 rounded-2xl p-4 shadow-2xl border border-gray-700 backdrop-blur-sm max-w-[300px]">
        {/* カードプレビュー */}
        <div className={`
          w-24 h-36 rounded-xl border-3 flex-shrink-0
          bg-gradient-to-br flex flex-col items-center justify-between p-2
          ${card.race === 'elf' ? 'from-emerald-400 to-emerald-600 border-emerald-300' : ''}
          ${card.race === 'goblin' ? 'from-amber-400 to-amber-600 border-amber-300' : ''}
          ${card.race === 'human' ? 'from-blue-400 to-blue-600 border-blue-300' : ''}
          ${card.race === 'demon' ? 'from-red-400 to-red-600 border-red-300' : ''}
        `}>
          <div className="text-white font-bold text-xl drop-shadow-lg">
            {card.rank}
          </div>
          <div className="text-5xl">
            {RACE_EMOJI[card.race]}
          </div>
          <div className="text-white font-bold text-sm bg-black/30 rounded px-2">
            {isRoyal ? ROLE_NAME[card.rank] : RACE_NAME[card.race]}
          </div>
        </div>

        {/* 効果説明 */}
        <div className="flex flex-col gap-2 text-white min-w-[160px]">
          <div className="font-bold text-lg border-b border-gray-600 pb-1">
            {isRoyal ? ROLE_NAME[card.rank] : effect.name}
          </div>
          
          {/* 点数 */}
          {!isRoyal && (
            <div className="flex items-center gap-2">
              <span className="text-yellow-400">💎</span>
              <span className="text-yellow-300 font-bold">{effect.point}</span>
            </div>
          )}
          
          {/* 効果 */}
          <div className="text-sm text-gray-300 whitespace-pre-line">
            {effect.effect}
          </div>
          
          {/* 種族情報 */}
          <div className="mt-2 pt-2 border-t border-gray-700">
            <div className="text-xs text-gray-400">
              {RACE_EMOJI[card.race]} {RACE_NAME[card.race]}
            </div>
            <div className="text-xs text-gray-500">
              {RACE_STRENGTH[card.race]}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

