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
        // ゲームの状態変数
        this.score = 0;
        this.hp = 3;
        this.isGameOver = false;
        this.startTime = Date.now();

        // UI要素の取得
        this.scoreText = document.getElementById('score-text');
        this.hpText = document.getElementById('hp-text');
        this.restartBtn = document.getElementById('restart-button');
        
        // リスタートボタンにクリックイベントを追加
        if (this.restartBtn) {
            this.restartBtn.addEventListener('click', () => {
                this.restartGame();
            });
        }

        // ゲーム開始
        this.scheduleNextSpawn();
    },

    // 次の敵の出現をスケジュールする（難易度調整付き）
    scheduleNextSpawn: function () {
        if (this.isGameOver) return;

        // 経過時間（秒）を計算
        const elapsedSeconds = (Date.now() - this.startTime) / 1000;

        // 出現間隔の計算: 初期1500ms -> 時間経過で最短400msまで短くなる
        // 難易度上昇速度アップ（以前の5倍の速さで間隔が短くなります）
        let interval = 1500 - (elapsedSeconds * 50);
        if (interval < 400) interval = 400;

        setTimeout(() => {
            this.spawnEnemy();
            this.scheduleNextSpawn(); // 再帰的に呼び出し
        }, interval);
    },

    spawnEnemy: function () {
        if (this.isGameOver) return;

        const scene = this.el.sceneEl;
        
        // 敵（赤い球体）を作成
        const enemy = document.createElement('a-entity');

        // 難易度調整：移動速度
        const elapsedSeconds = (Date.now() - this.startTime) / 1000;
        // 移動時間: 初期4000ms -> 時間経過で最短1000msまで速くなる
        // 難易度上昇速度アップ（以前の2倍の速さで敵が速くなります）
        let duration = 4000 - (elapsedSeconds * 100);
        if (duration < 1000) duration = 1000;
        
        // 出現位置（前方ランダム）
        const x = (Math.random() - 0.5) * 8;
        const y = 1 + Math.random() * 2;
        const z = -15; // 15メートル先
        
        enemy.setAttribute('geometry', 'primitive: sphere; radius: 0.5');
        enemy.setAttribute('material', 'color: #FF4444; roughness: 0.5');
        enemy.setAttribute('position', `${x} ${y} ${z}`);
        
        // レーザーで撃てるようにクラスを設定
        enemy.classList.add('clickable');

        // アニメーション：手前に向かって飛んでくる（物理演算ではなくアニメーションを使用）
        enemy.setAttribute('animation', {
            property: 'position',
            to: `${x} ${y} 2`, // プレイヤーの後ろ（Z=2）まで移動
            dur: duration,     // 計算した速度
            easing: 'linear'
        });

        // クリック（レーザーヒット）時の処理
        enemy.addEventListener('click', () => {
            if (this.isGameOver) return;
            this.addScore();
            
            // クリックされたらアニメーションを止める（HP減少を防ぐため）
            enemy.removeAttribute('animation');

            // 爆発エフェクト（拡大して透明になって消える）
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

        // 移動が終わったら（プレイヤーに到達したら）
        enemy.addEventListener('animationcomplete', () => {
            if (enemy.parentNode) {
                // ダメージ処理
                this.takeDamage();
                // 敵を削除
                enemy.parentNode.removeChild(enemy);
            }
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
    },

    takeDamage: function () {
        if (this.isGameOver) return;

        this.hp -= 1;
        if (this.hpText) {
            this.hpText.setAttribute('value', `HP: ${this.hp}`);
            // HPが減った演出（赤く点滅などさせてもよい）
        }

        if (this.hp <= 0) {
            this.gameOver();
        }
    },

    gameOver: function () {
        this.isGameOver = true;
        if (this.hpText) this.hpText.setAttribute('value', 'GAME OVER');
        
        // リスタートボタンを表示
        if (this.restartBtn) {
            this.restartBtn.setAttribute('visible', 'true');
        }
    },

    restartGame: function () {
        // 変数リセット
        this.score = 0;
        this.hp = 3;
        this.isGameOver = false;
        this.startTime = Date.now();

        // UIリセット
        if (this.scoreText) this.scoreText.setAttribute('value', 'Score: 0');
        if (this.hpText) this.hpText.setAttribute('value', 'HP: 3');
        if (this.restartBtn) this.restartBtn.setAttribute('visible', 'false');

        // 画面に残っている敵をすべて消す
        const enemies = document.querySelectorAll('.clickable');
        enemies.forEach(el => {
            if (el.id !== 'restart-click-target') { // リスタートボタン以外を消す
                if (el.parentNode) el.parentNode.removeChild(el);
            }
        });

        // 生成ループ再開
        this.scheduleNextSpawn();
    }
});
