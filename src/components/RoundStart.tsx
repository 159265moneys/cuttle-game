import { useEffect, useState } from 'react';
import './RoundStart.css';

interface RoundStartProps {
  roundNumber: number;
  player1Wins: number;
  player2Wins: number;
  playerName: string;
  enemyName: string;
  onComplete: () => void;
}

const RoundStart: React.FC<RoundStartProps> = ({
  roundNumber,
  player1Wins,
  player2Wins,
  playerName,
  enemyName,
  onComplete,
}) => {
  const [phase, setPhase] = useState<'enter' | 'show' | 'exit'>('enter');

  useEffect(() => {
    // 入場アニメーション後
    const enterTimer = setTimeout(() => {
      setPhase('show');
    }, 500);

    // 3秒後に退場
    const exitTimer = setTimeout(() => {
      setPhase('exit');
    }, 2500);

    // 完了
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  // マッチインジケーター
  const renderIndicators = (wins: number, isEnemy: boolean) => (
    <div className="round-indicators">
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className={`round-indicator ${
            i < wins ? (isEnemy ? 'enemy-win' : 'player-win') : ''
          }`}
        />
      ))}
    </div>
  );

  return (
    <div className={`round-start-screen ${phase}`}>
      <div className="round-start-bg" />
      
      {/* 中央テキスト */}
      <div className="round-start-center">
        <div className="round-number">ROUND {roundNumber}</div>
        <div className="round-start-text">START</div>
      </div>
      
      {/* 左下: プレイヤー情報 */}
      <div className="round-player-info player">
        <div className="round-icon player">⚔️</div>
        <div className="round-name">{playerName}</div>
        {renderIndicators(player1Wins, false)}
      </div>
      
      {/* 右上: 敵情報 */}
      <div className="round-player-info enemy">
        <div className="round-icon enemy">👹</div>
        <div className="round-name">{enemyName}</div>
        {renderIndicators(player2Wins, true)}
      </div>
    </div>
  );
};

export default RoundStart;

