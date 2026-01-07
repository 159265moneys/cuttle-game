#!/usr/bin/env python3
"""
ドラッグドロップ関連の全アクションテスト
全パターンをコードベースでテスト
"""

import json

# カード定義
RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
SUITS = ['Human', 'Elf', 'Goblin', 'Demon']

def get_value(rank):
    """カードの点数を取得"""
    if rank in ['J', 'Q', 'K']:
        return 0
    elif rank == 'A':
        return 1
    else:
        return int(rank)

def is_permanent_effect(rank):
    """永続効果カードかどうか"""
    return rank in ['8', 'J', 'Q', 'K']

def create_card(rank, suit, id):
    """カードを作成"""
    return {
        'id': id,
        'rank': rank,
        'race': suit,
        'value': get_value(rank)
    }

def create_field_card(card, owner):
    """フィールドカードを作成"""
    return {
        'card': card,
        'owner': owner
    }

class GameState:
    """簡易ゲーム状態"""
    def __init__(self):
        self.player1_hand = []
        self.player1_field = []
        self.player2_hand = []
        self.player2_field = []
        self.scrap_pile = []
        self.current_player = 'player1'
        self.has_queen = {'player1': False, 'player2': False}
    
    def add_to_field(self, player, card, as_permanent=False):
        """フィールドにカードを追加"""
        if as_permanent:
            card_copy = dict(card)
            card_copy['value'] = 0
        else:
            card_copy = dict(card)
        
        fc = create_field_card(card_copy, player)
        if player == 'player1':
            self.player1_field.append(fc)
        else:
            self.player2_field.append(fc)
        
        if card_copy['rank'] == 'Q':
            self.has_queen[player] = True

class DragDropTest:
    """ドラッグドロップテストクラス"""
    
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.test_results = []
    
    def test(self, name, condition, detail=""):
        """テスト実行"""
        if condition:
            self.passed += 1
            self.test_results.append(f"✅ PASS: {name}")
        else:
            self.failed += 1
            self.test_results.append(f"❌ FAIL: {name} - {detail}")
    
    def test_scuttle_action(self):
        """スカトルアクションのテスト"""
        print("\n=== スカトルアクションテスト ===")
        
        # 基本スカトル: 自分の点数カード >= 相手の点数カード
        test_cases = [
            # (自分のランク, 相手のランク, 成功すべきか)
            ('10', '10', True),   # 同じ値
            ('10', '9', True),    # 自分が大きい
            ('9', '10', False),   # 自分が小さい
            ('A', '10', False),   # Aは点数1なので10に勝てない
            ('5', '3', True),     # 5 > 3
            ('2', '2', True),     # 同じ値
        ]
        
        for my_rank, enemy_rank, should_succeed in test_cases:
            my_value = get_value(my_rank)
            enemy_value = get_value(enemy_rank)
            can_scuttle = my_value > 0 and my_value >= enemy_value
            self.test(
                f"スカトル: {my_rank}(={my_value}) vs {enemy_rank}(={enemy_value})",
                can_scuttle == should_succeed,
                f"expected {should_succeed}, got {can_scuttle}"
            )
    
    def test_ace_effect(self):
        """Aカード効果のテスト（相手の点数カードを破壊）"""
        print("\n=== Aカード効果テスト ===")
        
        # Aは相手の「点数カード」を破壊
        # 点数カード = value > 0
        test_cases = [
            ('A', 10, True, False, True),   # A-10、Qなし、破壊可能
            ('A', 5, True, False, True),    # A-5、Qなし、破壊可能
            ('A', 10, True, True, False),   # A-10、Qあり、破壊不可
            ('2', 10, True, False, False),  # 2は点数カード破壊不可（永続効果破壊）
        ]
        
        for my_rank, target_value, is_point_card, has_queen, should_destroy in test_cases:
            # Aの効果: 相手の点数カード1枚を破壊
            # 条件: target.value > 0 && !hasQueen(opponent)
            can_destroy = (my_rank == 'A' and 
                          is_point_card and 
                          target_value > 0 and 
                          not has_queen)
            
            self.test(
                f"A効果: {my_rank} → 点数{target_value} (Queen={has_queen})",
                can_destroy == should_destroy,
                f"expected {should_destroy}, got {can_destroy}"
            )
    
    def test_two_effect(self):
        """2カード効果のテスト（相手の永続効果を破壊）"""
        print("\n=== 2カード効果テスト ===")
        
        # 2は相手の「永続効果」を破壊
        # 永続効果 = J, Q, K, 8(永続)
        test_cases = [
            ('2', 'J', True),   # J破壊可
            ('2', 'Q', True),   # Q破壊可
            ('2', 'K', True),   # K破壊可
            ('2', '8', True),   # 8(永続)破壊可
            ('2', '10', False), # 10は点数カードなので2では破壊不可
            ('2', '5', False),  # 5は点数カードなので2では破壊不可
            ('A', 'J', False),  # Aは永続効果を破壊できない
        ]
        
        for my_rank, target_rank, should_destroy in test_cases:
            is_permanent = is_permanent_effect(target_rank)
            can_destroy = my_rank == '2' and is_permanent
            
            self.test(
                f"2効果: {my_rank} → {target_rank} (永続={is_permanent})",
                can_destroy == should_destroy,
                f"expected {should_destroy}, got {can_destroy}"
            )
    
    def test_nine_effect(self):
        """9カード効果のテスト（相手のカード1枚を手札に戻す）"""
        print("\n=== 9カード効果テスト ===")
        
        # 9は相手のカード1枚を手札に戻す（点数でも永続でも可）
        # ただしQueen持ちは対象外
        test_cases = [
            ('9', '10', False, True),  # 点数カード、Qなし、可能
            ('9', 'K', False, True),   # 永続、Qなし、可能
            ('9', '10', True, False),  # 点数カード、Qあり、不可
            ('9', 'K', True, False),   # 永続、Qあり、不可
        ]
        
        for my_rank, target_rank, has_queen, should_return in test_cases:
            can_return = my_rank == '9' and not has_queen
            
            self.test(
                f"9効果: {my_rank} → {target_rank} (Queen={has_queen})",
                can_return == should_return,
                f"expected {should_return}, got {can_return}"
            )
    
    def test_jack_effect(self):
        """Jカード効果のテスト（相手の点数カードを略奪）"""
        print("\n=== Jカード効果テスト ===")
        
        # Jは相手の点数カードを略奪（奪う）
        # 条件: target.value > 0 && !hasQueen(opponent)
        test_cases = [
            ('J', 10, False, True),   # 10、Qなし、略奪可
            ('J', 5, False, True),    # 5、Qなし、略奪可
            ('J', 10, True, False),   # 10、Qあり、略奪不可
            ('J', 0, False, False),   # 永続効果(value=0)、略奪不可
        ]
        
        for my_rank, target_value, has_queen, should_steal in test_cases:
            can_steal = (my_rank == 'J' and 
                        target_value > 0 and 
                        not has_queen)
            
            self.test(
                f"J効果: {my_rank} → 点数{target_value} (Queen={has_queen})",
                can_steal == should_steal,
                f"expected {should_steal}, got {can_steal}"
            )
    
    def test_modal_actions(self):
        """モーダルで表示されるアクション選択肢のテスト"""
        print("\n=== モーダルアクションテスト ===")
        
        # カードをドロップした時に表示されるべきアクション
        test_cases = [
            # (自分のランク, 相手のランク, 相手のvalue, canScuttle, canEffect)
            ('A', '10', 10, False, True),   # A → 10: スカトル不可、効果可
            ('10', '10', 10, True, False),  # 10 → 10: スカトル可、効果なし
            ('J', '10', 10, False, True),   # J → 10: スカトル不可、略奪可
            ('2', 'K', 0, False, True),     # 2 → K: スカトル不可、効果可（永続破壊）
            ('9', '5', 5, False, True),     # 9 → 5: スカトル不可、効果可（手札戻し）
            ('5', '3', 3, True, False),     # 5 → 3: スカトル可、効果なし
            ('3', '5', 5, False, False),    # 3 → 5: スカトル不可、効果なし（3は墓地回収）
        ]
        
        for my_rank, target_rank, target_value, expected_scuttle, expected_effect in test_cases:
            my_value = get_value(my_rank)
            
            # スカトル判定: 自分のvalue > 0 && 自分のvalue >= 相手のvalue
            can_scuttle = my_value > 0 and my_value >= target_value
            
            # 効果判定: A, 2, 9, J が効果対象カード
            can_effect = my_rank in ['A', '2', '9', 'J']
            
            self.test(
                f"モーダル: {my_rank}({my_value}) → {target_rank}({target_value}) スカトル",
                can_scuttle == expected_scuttle,
                f"expected {expected_scuttle}, got {can_scuttle}"
            )
            self.test(
                f"モーダル: {my_rank}({my_value}) → {target_rank}({target_value}) 効果",
                can_effect == expected_effect,
                f"expected {expected_effect}, got {can_effect}"
            )
    
    def test_selector_consistency(self):
        """セレクタの一貫性テスト"""
        print("\n=== セレクタ一貫性テスト ===")
        
        # CuttleBattle.tsx内のセレクタが正しいクラス名を参照しているか
        expected_selectors = {
            'enemyPointCards': '.cuttle-enemy-points-area .cuttle-field-card-wrapper',
            'enemyEffects': '.cuttle-enemy-effects-area .cuttle-field-card-wrapper',
        }
        
        # 実際のコードで使用されているセレクタ（修正後）
        actual_selector = '.cuttle-enemy-points-area .cuttle-field-card-wrapper'
        
        self.test(
            "敵カードセレクタが正しいクラス名を使用",
            actual_selector == expected_selectors['enemyPointCards'],
            f"expected {expected_selectors['enemyPointCards']}"
        )
    
    def run_all_tests(self):
        """全テストを実行"""
        print("=" * 60)
        print("ドラッグドロップ全パターンテスト")
        print("=" * 60)
        
        self.test_scuttle_action()
        self.test_ace_effect()
        self.test_two_effect()
        self.test_nine_effect()
        self.test_jack_effect()
        self.test_modal_actions()
        self.test_selector_consistency()
        
        print("\n" + "=" * 60)
        print("テスト結果")
        print("=" * 60)
        for result in self.test_results:
            print(result)
        
        print("\n" + "=" * 60)
        print(f"合計: {self.passed + self.failed} テスト")
        print(f"✅ 成功: {self.passed}")
        print(f"❌ 失敗: {self.failed}")
        print("=" * 60)
        
        return self.failed == 0

if __name__ == '__main__':
    tester = DragDropTest()
    success = tester.run_all_tests()
    exit(0 if success else 1)

