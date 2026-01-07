import React, { useState, useRef, useEffect, useCallback } from 'react';
import './BattleDemo.css';

// ========================================
// 化学式TCGバトルUI 完全再現デモ
// ========================================

interface DemoCard {
  id: string;
  formula: string;
  name: string;
  rarity: 'n' | 'r' | 'sr' | 'ssr' | 'ur';
  atk: number;
  hp: number;
  isSkill?: boolean;
}

interface FieldCard extends DemoCard {
  currentHp: number;
  maxHp: number;
  skillCt?: number;
  skillReady?: boolean;
}

// デモ用カードデータ
const DEMO_CARDS: DemoCard[] = [
  { id: '1', formula: 'H₂O', name: '水', rarity: 'r', atk: 30, hp: 50 },
  { id: '2', formula: 'NaCl', name: '塩化ナトリウム', rarity: 'n', atk: 20, hp: 40 },
  { id: '3', formula: 'H₂SO₄', name: '硫酸', rarity: 'sr', atk: 60, hp: 30 },
  { id: '4', formula: 'C₆H₁₂O₆', name: 'ブドウ糖', rarity: 'ssr', atk: 40, hp: 80 },
  { id: '5', formula: 'TNT', name: 'トリニトロトルエン', rarity: 'ur', atk: 100, hp: 20 },
];

const DEMO_SKILL: DemoCard = {
  id: 'skill1',
  formula: '回復',
  name: 'HP+50',
  rarity: 'r',
  atk: 0,
  hp: 0,
  isSkill: true,
};

interface BattleDemoProps {
  isOpen: boolean;
  onClose: () => void;
}

type Mode = 'default' | 'browsing' | 'dragging';

const BattleDemo: React.FC<BattleDemoProps> = ({ isOpen, onClose }) => {
  // ゲーム状態
  const [turn, setTurn] = useState(1);
  const [wave] = useState(1);
  const [enemyHp, setEnemyHp] = useState(130);
  const [enemyMaxHp] = useState(130);
  const [enemyCt, setEnemyCt] = useState(5);
  const [playerHp] = useState(100);
  const [playerMaxHp] = useState(100);
  
  // 手札
  const [hand, setHand] = useState<DemoCard[]>([...DEMO_CARDS, DEMO_SKILL]);
  
  // 場のカード
  const [field, setField] = useState<(FieldCard | null)[]>([null, null, null]);
  
  // 元素プール
  const [elements] = useState({ H: 3, O: 2, C: 1 });
  
  // UIモード
  const [mode, setMode] = useState<Mode>('default');
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [touchStart, setTouchStart] = useState({ x: 0, y: 0 });
  const [touchCurrent, setTouchCurrent] = useState({ x: 0, y: 0 });
  
  // refs
  const screenRef = useRef<HTMLDivElement>(null);
  
  // 閲覧モード開始
  const showBrowsing = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);
  
  // 閲覧モード終了
  const hideBrowsing = useCallback(() => {
    setMode('default');
    setSelectedIndex(-1);
  }, []);
  
  // タッチ開始
  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    const touch = 'touches' in e ? e.touches[0] : e;
    const startPos = { x: touch.clientX, y: touch.clientY };
    
    setTouchStart(startPos);
    setTouchCurrent(startPos);
    setSelectedIndex(index);
    setMode('browsing');
    showBrowsing(index);
  }, [showBrowsing]);
  
  // タッチ移動
  const handleTouchMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
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
      const browseCards = document.querySelectorAll('.poke-browse-card');
      browseCards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        if (current.x >= rect.left && current.x <= rect.right) {
          const newIndex = parseInt(card.getAttribute('data-index') || '-1');
          if (newIndex !== selectedIndex && newIndex >= 0) {
            setSelectedIndex(newIndex);
          }
        }
      });
    }
  }, [mode, touchStart, selectedIndex]);
  
  // タッチ終了
  const handleTouchEnd = useCallback(() => {
    if (mode === 'browsing') {
      hideBrowsing();
    } else if (mode === 'dragging') {
      // ドロップ処理
      const fieldArea = document.querySelector('.pokepoke-slots');
      if (fieldArea && selectedIndex >= 0) {
        const rect = fieldArea.getBoundingClientRect();
        if (
          touchCurrent.x >= rect.left && touchCurrent.x <= rect.right &&
          touchCurrent.y >= rect.top && touchCurrent.y <= rect.bottom
        ) {
          // どのスロットか判定
          const slots = document.querySelectorAll('.poke-slot');
          slots.forEach((slot, i) => {
            const slotRect = slot.getBoundingClientRect();
            if (
              touchCurrent.x >= slotRect.left && touchCurrent.x <= slotRect.right &&
              touchCurrent.y >= slotRect.top && touchCurrent.y <= slotRect.bottom
            ) {
              // カードを配置
              if (!field[i] && hand[selectedIndex]) {
                const card = hand[selectedIndex];
                if (!card.isSkill) {
                  const newField = [...field];
                  newField[i] = {
                    ...card,
                    currentHp: card.hp,
                    maxHp: card.hp,
                    skillCt: 3,
                    skillReady: false,
                  };
                  setField(newField);
                  
                  const newHand = [...hand];
                  newHand.splice(selectedIndex, 1);
                  setHand(newHand);
                }
              }
            }
          });
        }
      }
      
      hideBrowsing();
    }
    
    setMode('default');
    setSelectedIndex(-1);
  }, [mode, selectedIndex, touchCurrent, field, hand, hideBrowsing]);
  
  // アクションボタン
  const handleAction = useCallback(() => {
    const hasFieldCard = field.some(c => c !== null);
    
    if (hasFieldCard) {
      // 攻撃
      const totalAtk = field.reduce((sum, c) => sum + (c?.atk || 0), 0);
      setEnemyHp(prev => Math.max(0, prev - totalAtk));
      setTurn(prev => prev + 1);
      setEnemyCt(prev => Math.max(1, prev - 1));
    } else {
      // ターン終了
      setTurn(prev => prev + 1);
    }
  }, [field]);
  
  // 手札カードをレンダリング
  const renderHandCard = (card: DemoCard, index: number) => {
    const count = hand.length;
    const maxAngle = 18;
    const spacing = Math.min(42, 260 / Math.max(count, 1));
    
    const centerIdx = (count - 1) / 2;
    const offset = index - centerIdx;
    const angle = (offset / Math.max(centerIdx, 1)) * maxAngle;
    const xOffset = offset * spacing;
    const yOffset = Math.abs(offset) * 6;
    
    const rarityClass = card.isSkill ? 'skill' : `rarity-${card.rarity}`;
    
    return (
      <div
        key={card.id}
        className={`poke-card ${rarityClass} playable`}
        data-index={index}
        style={{
          '--angle': `${angle}deg`,
          '--x-offset': `${xOffset}px`,
          '--y-offset': `${yOffset}px`,
          zIndex: index + 1,
        } as React.CSSProperties}
        onTouchStart={(e) => handleTouchStart(e, index)}
        onMouseDown={(e) => handleTouchStart(e, index)}
      >
        <div className="poke-formula">{card.formula}</div>
        <div className="poke-name">{card.name}</div>
        {!card.isSkill && (
          <div className="poke-stats">⚔️{card.atk} ❤️{card.hp}</div>
        )}
      </div>
    );
  };
  
  // 閲覧モード手札カードをレンダリング
  const renderBrowseCard = (card: DemoCard, index: number) => {
    const count = hand.length;
    const maxAngle = 15;
    const spacing = Math.min(55, 320 / Math.max(count, 1));
    
    const centerIdx = (count - 1) / 2;
    const offset = index - centerIdx;
    const angle = (offset / Math.max(centerIdx, 1)) * maxAngle;
    const xOffset = offset * spacing;
    const yOffset = Math.abs(offset) * 5;
    
    const rarityClass = card.isSkill ? 'skill' : `rarity-${card.rarity}`;
    const isSelected = index === selectedIndex;
    
    return (
      <div
        key={card.id}
        className={`poke-browse-card ${rarityClass} ${isSelected ? 'selected' : ''}`}
        data-index={index}
        style={{
          left: `calc(50% + ${xOffset}px)`,
          transform: `translateX(-50%) translateY(${yOffset}px) rotate(${angle}deg)`,
          zIndex: isSelected ? 100 : index + 1,
        }}
      >
        <div className="browse-formula">{card.formula}</div>
        <div className="browse-name">{card.name}</div>
      </div>
    );
  };
  
  // プレビューカードをレンダリング
  const renderPreviewCard = () => {
    if (selectedIndex < 0 || !hand[selectedIndex]) return null;
    
    const card = hand[selectedIndex];
    const rarityClass = card.isSkill ? 'skill' : `rarity-${card.rarity}`;
    
    return (
      <div className={`preview-card ${rarityClass}`}>
        <div className="preview-formula">{card.formula}</div>
        <div className="preview-name">{card.name}</div>
        {!card.isSkill && (
          <>
            <div className="preview-stats">
              <span>⚔️ {card.atk}</span>
              <span>❤️ {card.hp}</span>
            </div>
            <div className="preview-cost">コスト: H₂ O₁</div>
          </>
        )}
      </div>
    );
  };
  
  // 場のスロットをレンダリング
  const renderFieldSlot = (index: number) => {
    const fc = field[index];
    const isHighlight = mode === 'dragging' && hand[selectedIndex] && !hand[selectedIndex].isSkill;
    
    return (
      <div
        key={index}
        className={`poke-slot ${fc ? 'filled' : 'empty'} ${isHighlight && !fc ? 'highlight' : ''}`}
        data-slot-index={index}
      >
        {fc ? (
          <div className="poke-field-card">
            <div className="field-formula">{fc.formula}</div>
            <div className="field-hp-bar">
              <div
                className="hp-fill"
                style={{ width: `${(fc.currentHp / fc.maxHp) * 100}%` }}
              />
            </div>
            <div className="field-stats">⚔{fc.atk} ♥{Math.floor(fc.currentHp)}</div>
            {fc.skillCt !== undefined && (
              <div className={`field-ct ${fc.skillCt === 0 ? 'ready' : ''}`}>
                {fc.skillCt === 0 ? '⚡' : `CT${fc.skillCt}`}
              </div>
            )}
          </div>
        ) : (
          <span>空</span>
        )}
      </div>
    );
  };
  
  // グローバルイベント
  useEffect(() => {
    const handleGlobalMove = (e: TouchEvent | MouseEvent) => {
      if (mode !== 'default') {
        handleTouchMove(e as unknown as React.TouchEvent);
      }
    };
    
    const handleGlobalEnd = () => {
      if (mode !== 'default') {
        handleTouchEnd();
      }
    };
    
    if (isOpen) {
      document.addEventListener('touchmove', handleGlobalMove, { passive: false });
      document.addEventListener('mousemove', handleGlobalMove);
      document.addEventListener('touchend', handleGlobalEnd);
      document.addEventListener('mouseup', handleGlobalEnd);
    }
    
    return () => {
      document.removeEventListener('touchmove', handleGlobalMove);
      document.removeEventListener('mousemove', handleGlobalMove);
      document.removeEventListener('touchend', handleGlobalEnd);
      document.removeEventListener('mouseup', handleGlobalEnd);
    };
  }, [isOpen, mode, handleTouchMove, handleTouchEnd]);
  
  if (!isOpen) return null;
  
  const hasFieldCard = field.some(c => c !== null);
  
  return (
    <div
      ref={screenRef}
      className={`pokepoke-test-screen ${isOpen ? 'active' : ''}`}
    >
      {/* ヘッダー */}
      <div className="pokepoke-header">
        <span>Stage 1</span>
        <span className="poke-wave">Wave {wave}/7</span>
        <span className="poke-turn">Turn {turn}</span>
        <button className="poke-flee-btn" onClick={onClose}>🚪 離脱</button>
      </div>
      
      {/* バトルフィールド */}
      <div className="pokepoke-field">
        {/* 敵エリア */}
        <div className="pokepoke-enemy">
          <div className="poke-enemy-info">
            <span className="poke-enemy-name">👹 ボス Lv.5</span>
            <div className="poke-enemy-hp-section">
              <div className="poke-enemy-hp-bar">
                <div
                  className="hp-fill"
                  style={{ width: `${(enemyHp / enemyMaxHp) * 100}%` }}
                />
              </div>
              <div className="poke-enemy-hp-text">{enemyHp}/{enemyMaxHp}</div>
            </div>
            <span className="poke-enemy-ct">⚡{enemyCt}</span>
          </div>
          <div className="enemy-sprite">👹</div>
        </div>
        
        {/* 場のスロット */}
        <div className="pokepoke-slots">
          {[0, 1, 2].map(renderFieldSlot)}
        </div>
      </div>
      
      {/* ステータスバー */}
      <div className="pokepoke-status">
        <div className="poke-player-hp">
          <span className="hp-label">HP</span>
          <div className="poke-hp-bar">
            <div
              className="hp-fill"
              style={{ width: `${(playerHp / playerMaxHp) * 100}%` }}
            />
          </div>
          <span className="hp-value">{playerHp}</span>
        </div>
        <div className="poke-element-pool">
          {Object.entries(elements).map(([el, count]) => (
            <div key={el} className="poke-element-orb">
              <span className="symbol">{el}</span>
              <span className="count">{count}</span>
            </div>
          ))}
        </div>
        <button
          className={`poke-btn-action ${hasFieldCard ? '' : 'end-turn'}`}
          onClick={handleAction}
        >
          {hasFieldCard ? '⚔️ 攻撃' : '⏭️ 終了'}
        </button>
      </div>
      
      {/* 手札エリア */}
      <div className="pokepoke-hand">
        {hand.map(renderHandCard)}
      </div>
      
      {/* 閲覧モード オーバーレイ */}
      <div className={`pokepoke-overlay ${mode === 'browsing' ? 'active' : ''}`} />
      
      {/* 閲覧モード 拡大カード */}
      <div className={`pokepoke-preview ${mode === 'browsing' ? 'active' : ''}`}>
        {renderPreviewCard()}
      </div>
      
      {/* 閲覧モード 手札 */}
      <div className={`pokepoke-browse-hand ${mode === 'browsing' ? 'active' : ''}`}>
        {hand.map(renderBrowseCard)}
      </div>
      
      {/* ドラッグカード */}
      {mode === 'dragging' && selectedIndex >= 0 && hand[selectedIndex] && (
        <div
          className={`poke-drag ${hand[selectedIndex].isSkill ? 'skill' : `rarity-${hand[selectedIndex].rarity}`}`}
          style={{
            left: touchCurrent.x - 45,
            top: touchCurrent.y - 60,
          }}
        >
          <div className="drag-formula">{hand[selectedIndex].formula}</div>
          <div className="drag-name">{hand[selectedIndex].name}</div>
        </div>
      )}
    </div>
  );
};

export default BattleDemo;

