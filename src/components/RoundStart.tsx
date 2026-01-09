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

  // マッチインジケーター（勝敗の色分け）- 3つ
  // 自分勝ち時: 自分=明るい青、敵=暗い赤
  // 自分負け時: 自分=暗い青、敵=明るい赤
  const renderIndicators = (isEnemy: boolean) => {
    const indicators = [];
    for (let i = 0; i < 3; i++) {
      let className = 'round-indicator';
      if (isEnemy) {
        // 敵のバー
        if (i < player2Wins) {
          // 敵が勝ったマッチ = 敵は明るい赤
          className += ' enemy-win-bright';
        } else if (i < player2Wins + player1Wins) {
          // 敵が負けたマッチ = 敵は暗い赤
          className += ' enemy-lose-dark';
        }
      } else {
        // 自分のバー
        if (i < player1Wins) {
          // 自分が勝ったマッチ = 自分は明るい青
          className += ' player-win';
        } else if (i < player1Wins + player2Wins) {
          // 自分が負けたマッチ = 自分は暗い青
          className += ' player-lose';
        }
      }
      indicators.push(<div key={i} className={className} />);
    }
    return <div className="round-indicators">{indicators}</div>;
  };

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
        {renderIndicators(false)}
      </div>
      
      {/* 右上: 敵情報 */}
      <div className="round-player-info enemy">
        <div className="round-icon enemy">👹</div>
        <div className="round-name">{enemyName}</div>
        {renderIndicators(true)}
      </div>
    </div>
  );
};

export default RoundStart;

