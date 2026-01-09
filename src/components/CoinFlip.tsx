import { useState, useCallback, useEffect } from 'react';
import './CoinFlip.css';

const BASE_URL = import.meta.env.BASE_URL || '/';

interface CoinFlipProps {
  onComplete: (playerGoesFirst: boolean) => void;
  player1Wins: number;
  player2Wins: number;
  playerName: string;
  enemyName: string;
}

const CoinFlip: React.FC<CoinFlipProps> = ({ 
  onComplete, 
  player1Wins, 
  player2Wins,
  playerName,
  enemyName,
}) => {
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
  
  // 結果表示後、2秒で自動遷移
  useEffect(() => {
    if (phase === 'result' && result !== null) {
      const timer = setTimeout(() => {
        onComplete(result === 'heads');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase, result, onComplete]);

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

  // マッチインジケーターをレンダリング（3つ）
  const renderMatchIndicators = (wins: number, losses: number, isEnemy: boolean) => {
    const indicators = [];
    for (let i = 0; i < 3; i++) {
      let className = 'match-indicator';
      if (i < wins) {
        className += isEnemy ? ' lose' : ' win'; // 敵の勝ち=自分の負け色、自分の勝ち=勝ち色
      } else if (i < wins + losses) {
        className += isEnemy ? ' win' : ' lose'; // 敵の負け=自分の勝ち色、自分の負け=負け色
      }
      indicators.push(<span key={i} className={className}>●</span>);
    }
    return indicators;
  };

  return (
    <div className="coin-flip-screen">
      <div className="coin-flip-bg" />
      
      {/* 敵情報バー */}
      <div className="coin-flip-enemy-bar">
        <span className="player-name">{enemyName}</span>
        <div className="match-indicators">
          {renderMatchIndicators(player2Wins, player1Wins, true)}
        </div>
      </div>
      
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
        <div className="coin-result">
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
        </div>
      )}
      
      {/* プレイヤー情報バー */}
      <div className="coin-flip-player-bar">
        <span className="player-name">{playerName}</span>
        <div className="match-indicators">
          {renderMatchIndicators(player1Wins, player2Wins, false)}
        </div>
      </div>
    </div>
  );
};

export default CoinFlip;

