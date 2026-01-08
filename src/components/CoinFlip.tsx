import { useState, useCallback } from 'react';
import './CoinFlip.css';

const BASE_URL = import.meta.env.BASE_URL || '/';

interface CoinFlipProps {
  onComplete: (playerGoesFirst: boolean) => void;
}

const CoinFlip: React.FC<CoinFlipProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<'ready' | 'flipping' | 'result'>('ready');
  const [result, setResult] = useState<'heads' | 'tails' | null>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const flipCoin = useCallback(() => {
    if (phase !== 'ready') return;
    
    setPhase('flipping');
    
    // 50%の確率
    const isHeads = Math.random() < 0.5;
    setResult(isHeads ? 'heads' : 'tails');
    
    // アニメーション完了後に結果表示
    setTimeout(() => {
      setPhase('result');
    }, 2000);
  }, [phase]);

  const handleTouchStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (phase !== 'ready') return;
    const y = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setTouchStart(y);
  }, [phase]);

  const handleTouchEnd = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (phase !== 'ready' || touchStart === null) return;
    const y = 'changedTouches' in e ? e.changedTouches[0].clientY : e.clientY;
    
    // 上にスワイプ（50px以上）でフリップ
    if (touchStart - y > 50) {
      flipCoin();
    }
    setTouchStart(null);
  }, [phase, touchStart, flipCoin]);

  const handleResultClick = useCallback(() => {
    if (phase === 'result' && result !== null) {
      onComplete(result === 'heads');
    }
  }, [phase, result, onComplete]);

  // スートアイコンのマスクスタイル
  const getSuitMaskStyle = (suit: string) => ({
    WebkitMaskImage: `url(${BASE_URL}sprite/suit/${suit}.png)`,
    maskImage: `url(${BASE_URL}sprite/suit/${suit}.png)`,
  });

  // backmainのマスクスタイル
  const getBackMainMaskStyle = () => ({
    WebkitMaskImage: `url(${BASE_URL}sprite/back/backmain.png)`,
    maskImage: `url(${BASE_URL}sprite/back/backmain.png)`,
  });

  return (
    <div className="coin-flip-screen">
      <div className="coin-flip-bg" />
      
      {phase === 'ready' && (
        <div className="coin-instruction">
          <p>コインを上にスワイプして投げろ！</p>
        </div>
      )}

      <div 
        className={`coin-container ${phase}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
      >
        <div className={`coin ${phase} ${result || ''}`}>
          {/* 表面: 4つのスートアイコン */}
          <div className="coin-face coin-heads">
            <div className="coin-inner">
              <div 
                className="coin-suit-icon human"
                style={getSuitMaskStyle('human')}
              />
              <div 
                className="coin-suit-icon elf"
                style={getSuitMaskStyle('elf')}
              />
              <div 
                className="coin-suit-icon goblin"
                style={getSuitMaskStyle('goblin')}
              />
              <div 
                className="coin-suit-icon demon"
                style={getSuitMaskStyle('demon')}
              />
            </div>
          </div>
          
          {/* 裏面: backmain */}
          <div className="coin-face coin-tails">
            <div className="coin-inner">
              <div 
                className="coin-back-main"
                style={getBackMainMaskStyle()}
              />
            </div>
          </div>
        </div>
      </div>

      {phase === 'result' && (
        <div className="coin-result" onClick={handleResultClick}>
          <div className={`result-text ${result}`}>
            {result === 'heads' ? (
              <>
                <span className="result-side">オモテ</span>
                <span className="result-meaning">：先攻</span>
              </>
            ) : (
              <>
                <span className="result-side">ウラ</span>
                <span className="result-meaning">：後攻</span>
              </>
            )}
          </div>
          <div className="tap-to-start">タップしてバトル開始</div>
        </div>
      )}
    </div>
  );
};

export default CoinFlip;

