// c:\Users\sakamoto\python\testing_test\test99_etc\11-vr\simple-game.js

// 1. コントローラー入力確認用コンポーネント
// ボタンを押すと、画面上のテキストに「Trigger Pressed」などを表示します
AFRAME.registerComponent('controller-logger', {
    schema: { hand: { type: 'string' } },
    init: function () {
        const logText = document.getElementById('log-text');
        const handName = this.data.hand;

        // ログを表示するヘルパー関数
        const showLog = (eventName) => {
            const msg = `${handName.toUpperCase()}: ${eventName}`;
            console.log(msg);
            if (logText) {
                logText.setAttribute('value', msg);
                // ログを目立たせるために一瞬色を変える
                logText.setAttribute('color', '#FF0');
                setTimeout(() => logText.setAttribute('color', '#AAA'), 200);
            }
        };

        // 各種ボタンイベントをリッスン
        // トリガー（人差し指）
        this.el.addEventListener('triggerdown', () => showLog('Trigger Pressed'));
        this.el.addEventListener('triggerup', () => showLog('Trigger Released'));
        
        // グリップ（中指）
        this.el.addEventListener('gripdown', () => showLog('Grip Pressed'));
        
        // A/B/X/Y ボタン
        this.el.addEventListener('abuttondown', () => showLog('A Button'));
        this.el.addEventListener('bbuttondown', () => showLog('B Button'));
        this.el.addEventListener('xbuttondown', () => showLog('X Button'));
        this.el.addEventListener('ybuttondown', () => showLog('Y Button'));
    }
});

// 2. ゲーム管理コンポーネント（敵の生成とスコア）
AFRAME.registerComponent('game-manager', {
    init: function () {
        this.score = 0;
        this.scoreText = document.getElementById('score-text');
        
        // 1.5秒ごとに敵を生成
        setInterval(() => {
            this.spawnEnemy();
        }, 1500);
    },

    spawnEnemy: function () {
        const scene = this.el.sceneEl;
        
        // 敵（赤い球体）を作成
        const enemy = document.createElement('a-entity');
        
        // 出現位置（前方ランダム）
        const x = (Math.random() - 0.5) * 8;
        const y = 1 + Math.random() * 2;
        const z = -15; // 15メートル先
        
        enemy.setAttribute('geometry', 'primitive: sphere; radius: 0.5');
        enemy.setAttribute('material', 'color: #FF4444; roughness: 0.5');
        enemy.setAttribute('position', `${x} ${y} ${z}`);
        
        // レーザーで撃てるようにクラスを設定
        enemy.classList.add('enemy');

        // アニメーション：手前に向かって飛んでくる（物理演算ではなくアニメーションを使用）
        enemy.setAttribute('animation', {
            property: 'position',
            to: `${x} ${y} 5`, // プレイヤーの後ろまで移動
            dur: 4000,         // 4秒かけて移動
            easing: 'linear'
        });

        // クリック（レーザーヒット）時の処理
        enemy.addEventListener('click', () => {
            this.addScore();
            
            // 爆発エフェクト（拡大して透明になって消える）
            enemy.removeAttribute('animation'); // 移動を止める
            enemy.setAttribute('material', 'color: #FFFF00; opacity: 1');
            
            enemy.setAttribute('animation__die', {
                property: 'scale',
                to: '2 2 2',
                dur: 200
            });
            enemy.setAttribute('animation__fade', {
                property: 'material.opacity',
                to: '0',
                dur: 200
            });

            // アニメーション終了後に削除
            setTimeout(() => {
                if (enemy.parentNode) enemy.parentNode.removeChild(enemy);
            }, 200);
        });

        // 移動が終わったら（プレイヤーを通り過ぎたら）削除してメモリ節約
        enemy.addEventListener('animationcomplete', () => {
            if (enemy.parentNode) enemy.parentNode.removeChild(enemy);
        });

        scene.appendChild(enemy);
    },

    addScore: function () {
        this.score += 100;
        if (this.scoreText) {
            this.scoreText.setAttribute('value', `Score: ${this.score}`);
            
            // スコアテキストを少し跳ねさせる演出
            this.scoreText.setAttribute('animation', {
                property: 'scale',
                from: '2.5 2.5 2.5',
                to: '2 2 2',
                dur: 200,
                easing: 'easeOutQuad'
            });
        }
    }
});
