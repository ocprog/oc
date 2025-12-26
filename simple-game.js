// c:\Users\sakamoto\python\testing_test\test99_etc\11-vr\simple-game.js

// 1. コントローラー操作用コンポーネント
// 各種ボタン入力を検知してゲームマネージャーに伝えます
AFRAME.registerComponent('game-controls', {
    schema: { hand: { type: 'string' } },
    init: function () {
        this.thumbstick = { x: 0, y: 0 }; // サムスティックの状態保存用

        // ゲームマネージャーを遅延取得するためのヘルパー（読み込み順序エラーの回避）
        this.getGameManager = () => {
            const el = document.querySelector('[game-manager]');
            return el ? el.components['game-manager'] : null;
        };

        // ログ表示用（ボタンが効いているか画面で確認できるようにする）
        const logText = document.getElementById('log-text');
        const showLog = (msg) => {
            if (logText) {
                logText.setAttribute('value', msg);
                logText.setAttribute('color', '#FFF'); // 白く光らせる
                setTimeout(() => logText.setAttribute('color', '#AAA'), 500);
            }
        };
        
        // --- トリガー（ミサイル発射） ---
        this.el.addEventListener('triggerdown', () => {
            if (this.data.hand === 'right') {
                const gm = this.getGameManager();
                if (gm) gm.fireMissile();
            }
        });

        // --- サムスティック（移動） ---
        // thumbstickmovedイベントは x, y の値を持っています
        this.el.addEventListener('thumbstickmoved', (evt) => {
            // 左手のみ移動に使う（右手は回転などに使うことが多いが今回は左手移動のみ実装）
            if (this.data.hand === 'left') {
                // 値を保存してtickで処理する（スムーズな移動のため）
                this.thumbstick.x = evt.detail.x;
                this.thumbstick.y = evt.detail.y;
            }
        });
    },
    
    tick: function (time, timeDelta) {
        // 左手のサムスティック入力がある場合、移動処理を行う
        if (this.data.hand === 'left' && (Math.abs(this.thumbstick.x) > 0.1 || Math.abs(this.thumbstick.y) > 0.1)) {
            const gm = this.getGameManager();
            if (gm) {
                // フレームレートに合わせて移動量を調整
                const factor = timeDelta / 16; 
                gm.movePlayer(this.thumbstick.x * factor, this.thumbstick.y * factor);
            }
        }
    }
});

// 2. ゲーム管理コンポーネント（敵の生成とスコア）
AFRAME.registerComponent('game-manager', {
    init: function () {
        // ゲームの状態変数
        this.score = 0;
        this.hp = 3;
        this.missileCount = 0;
        this.isGameOver = false;
        this.canRestart = false; // リスタート可能フラグ
        
        // ボール設定
        this.ballSpeed = 5.0; // 初速
        this.ballVelocity = { x: 0, z: 0 };

        // プレイヤーリグ（移動用）
        this.rig = document.getElementById('rig');
        this.paddle = document.getElementById('paddle');

        // UI要素の取得
        this.scoreText = document.getElementById('score-text');
        this.hpText = document.getElementById('hp-text');
        this.missileText = document.getElementById('missile-text');
        this.restartBtn = document.getElementById('restart-button');
        this.restartTarget = document.getElementById('restart-click-target');
        
        // ブロック管理用配列
        this.blocks = [];
        this.items = [];
        this.missiles = [];
        
        // リスタートボタンにクリックイベントを追加
        if (this.restartTarget) {
            this.restartTarget.addEventListener('click', () => {
                if (!this.isGameOver || !this.canRestart) return; // ゲームオーバーかつリスタート許可時のみ
                console.log("Restart button clicked!"); // デバッグ用ログ
                this.restartGame();
            });
        }

        // ボールの生成
        this.ball = document.createElement('a-entity');
        this.ball.setAttribute('geometry', 'primitive: sphere; radius: 0.4');
        this.ball.setAttribute('material', 'color: #FF4444; roughness: 0.2');
        this.ball.setAttribute('position', '0 1.0 -5');
        // バウンド音
        this.ball.setAttribute('sound', 'src: #bounce-sound; poolSize: 5; volume: 1.0');
        this.el.sceneEl.appendChild(this.ball);

        // ゲーム開始
        this.setupLevel();
    },

    // ブロックの配置とボールのリセット
    setupLevel: function () {
        // 既存のブロックを削除
        this.blocks.forEach(b => {
            if (b.el.parentNode) b.el.parentNode.removeChild(b.el);
        });
        this.blocks = [];
        
        // アイテムとミサイルもリセット
        this.items.forEach(i => { if (i.el.parentNode) i.el.parentNode.removeChild(i.el); });
        this.items = [];
        this.missiles.forEach(m => { if (m.el.parentNode) m.el.parentNode.removeChild(m.el); });
        this.missiles = [];
        
        this.missileCount = 0;
        if (this.missileText) this.missileText.setAttribute('value', 'MISSILE: 0');

        // ブロック生成 (5行 x 6列)
        const rows = 5;
        const cols = 6;
        const startZ = -10; // 10m先から配置
        const spacingX = 1.5;
        const spacingZ = 1.0;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const blockEl = document.createElement('a-box');
                const bx = (c - (cols - 1) / 2) * spacingX;
                const bz = startZ - (r * spacingZ);
                
                blockEl.setAttribute('position', `${bx} 1.0 ${bz}`);
                blockEl.setAttribute('width', '1.3');
                blockEl.setAttribute('height', '0.5');
                blockEl.setAttribute('depth', '0.5');
                // 色をランダムに
                const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#00FFFF', '#FF00FF'];
                blockEl.setAttribute('color', colors[Math.floor(Math.random() * colors.length)]);
                
                this.el.sceneEl.appendChild(blockEl);

                // 当たり判定用にデータを保存
                this.blocks.push({
                    el: blockEl,
                    x: bx,
                    z: bz,
                    width: 1.3,
                    depth: 0.5,
                    active: true
                });
            }
        }

        this.resetBall();
    },

    resetBall: function () {
        // ボールを初期位置へ
        this.ball.setAttribute('position', '0 1.0 -5');
        
        // プレイヤーに向かって飛んでくるように速度設定
        // Z軸プラス方向がプレイヤー方向
        this.ballVelocity.z = this.ballSpeed;
        // X軸はランダムに少し振る
        this.ballVelocity.x = (Math.random() - 0.5) * 2.0;
    },

    // 毎フレームの更新処理（物理演算）
    tick: function (time, timeDelta) {
        if (this.isGameOver) return;

        const dt = timeDelta / 1000; // 秒単位
        const ballPos = this.ball.getAttribute('position');

        // 位置更新
        ballPos.x += this.ballVelocity.x * dt;
        ballPos.z += this.ballVelocity.z * dt;

        // 壁の反射 (X軸)
        if (ballPos.x > 5 || ballPos.x < -5) {
            this.ballVelocity.x *= -1;
            ballPos.x = ballPos.x > 5 ? 5 : -5; // めり込み補正
            this.ball.components.sound.playSound();
        }

        // 奥の壁反射 (Z軸)
        if (ballPos.z < -20) {
            this.ballVelocity.z *= -1;
            ballPos.z = -20;
            this.ball.components.sound.playSound();
        }

        // プレイヤー（バー）との当たり判定
        // バーはリグの子要素なので、リグの位置を基準に計算
        const rigPos = this.rig.getAttribute('position');
        const paddleZ = rigPos.z - 1; // バーのZ位置
        const paddleX = rigPos.x;     // バーのX位置
        const paddleWidth = 2.5;
        const ballRadius = 0.4;

        // Z軸でバーの近くにいるか
        if (ballPos.z + ballRadius >= paddleZ - 0.1 && ballPos.z - ballRadius <= paddleZ + 0.1) {
            // X軸でバーの範囲内にいるか
            if (ballPos.x >= paddleX - paddleWidth / 2 - ballRadius && 
                ballPos.x <= paddleX + paddleWidth / 2 + ballRadius) {
                
                // プレイヤーに向かってきている時だけ跳ね返す
                if (this.ballVelocity.z > 0) {
                    this.ballVelocity.z *= -1;
                    
                    // バーのどこに当たったかでX方向の反射角度を変える（ブロック崩しの醍醐味）
                    const hitOffset = ballPos.x - paddleX;
                    this.ballVelocity.x = hitOffset * 3.0;

                    // 少し加速
                    this.ballVelocity.z *= 1.05;
                    this.ball.components.sound.playSound();
                }
            }
        }

        // プレイヤーの後ろに逸らした場合 (ミス)
        if (ballPos.z > rigPos.z + 1.5) {
            this.takeDamage();
            if (!this.isGameOver) {
                this.resetBall();
            }
            return;
        }

        // ブロックとの当たり判定
        for (let i = 0; i < this.blocks.length; i++) {
            const b = this.blocks[i];
            if (!b.active) continue;

            // 簡易的なAABB衝突判定
            const bMinX = b.x - b.width / 2 - ballRadius;
            const bMaxX = b.x + b.width / 2 + ballRadius;
            const bMinZ = b.z - b.depth / 2 - ballRadius;
            const bMaxZ = b.z + b.depth / 2 + ballRadius;

            if (ballPos.x >= bMinX && ballPos.x <= bMaxX &&
                ballPos.z >= bMinZ && ballPos.z <= bMaxZ) {
                
                // ブロック破壊
                b.active = false;
                b.el.parentNode.removeChild(b.el);
                this.addScore();
                this.ball.components.sound.playSound();

                // アイテム出現判定 (30%の確率)
                if (Math.random() < 0.3) {
                    this.spawnItem(b.x, b.z);
                }

                // 反射（基本はZ反転）
                this.ballVelocity.z *= -1;
                break; // 1フレームに1個だけ壊す
            }
        }

        // アイテムとミサイルの更新処理
        this.updateItems(dt);
        this.updateMissiles(dt);

        // 画面上のボール位置を更新
        this.ball.setAttribute('position', ballPos);
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
            
            // 5秒間のクールダウン処理
            this.canRestart = false;
            const plane = document.getElementById('restart-click-target');
            const text = this.restartBtn.querySelector('a-text');
            
            if (plane) plane.setAttribute('color', '#555555'); // 押せない色はグレー
            let countdown = 5;
            if (text) text.setAttribute('value', `Wait ${countdown}...`);

            const timer = setInterval(() => {
                countdown--;
                if (text) text.setAttribute('value', `Wait ${countdown}...`);
                
                if (countdown <= 0) {
                    clearInterval(timer);
                    this.canRestart = true;
                    if (plane) plane.setAttribute('color', '#228822'); // 押せるようになったら緑
                    if (text) text.setAttribute('value', 'RESTART');
                }
            }, 1000);
        }
    },

    restartGame: function () {
        // 変数リセット
        this.score = 0;
        this.hp = 3;
        this.missileCount = 0;
        this.isGameOver = false;
        this.canRestart = false;

        // UIリセット
        if (this.scoreText) this.scoreText.setAttribute('value', 'Score: 0');
        if (this.hpText) this.hpText.setAttribute('value', 'HP: 3');
        if (this.missileText) this.missileText.setAttribute('value', 'MISSILE: 0');
        if (this.restartBtn) this.restartBtn.setAttribute('visible', 'false');

        // レベル再構築
        this.setupLevel();
    },

    // --- 新機能 ---

    // プレイヤー移動 (x: 左右, y: 前後)
    movePlayer: function (x, y) {
        if (this.isGameOver) return;
        
        const currentPos = this.rig.getAttribute('position');
        // 移動速度調整
        const speed = 0.05;
        
        // X軸（左右）のみ移動可能にする（前後はゲームバランス崩れるため制限）
        // 範囲制限 (-4 ~ 4)
        let newX = currentPos.x + (x * speed);
        if (newX > 4) newX = 4;
        if (newX < -4) newX = -4;

        this.rig.setAttribute('position', `${newX} ${currentPos.y} ${currentPos.z}`);
    },

    // アイテム生成
    spawnItem: function (x, z) {
        const itemEl = document.createElement('a-box');
        itemEl.setAttribute('width', '0.5');
        itemEl.setAttribute('height', '0.5');
        itemEl.setAttribute('depth', '0.5');
        itemEl.setAttribute('color', '#FFFF00'); // 黄色
        itemEl.setAttribute('position', `${x} 1.0 ${z}`);
        // 回転アニメーション
        itemEl.setAttribute('animation', 'property: rotation; to: 0 360 0; loop: true; dur: 2000; easing: linear');
        
        this.el.sceneEl.appendChild(itemEl);
        this.items.push({ el: itemEl, x: x, z: z });
    },

    // アイテム更新（移動と取得判定）
    updateItems: function (dt) {
        const rigPos = this.rig.getAttribute('position');
        const paddleX = rigPos.x;
        const paddleZ = rigPos.z - 1;
        const speed = 2.0; // アイテムの移動速度

        for (let i = this.items.length - 1; i >= 0; i--) {
            const item = this.items[i];
            item.z += speed * dt; // プレイヤーに向かってくる
            item.el.setAttribute('position', `${item.x} 1.0 ${item.z}`);

            // プレイヤー（バー）との当たり判定
            if (Math.abs(item.z - paddleZ) < 0.5 && Math.abs(item.x - paddleX) < 1.5) {
                // 取得！
                this.missileCount += 3;
                if (this.missileText) this.missileText.setAttribute('value', `MISSILE: ${this.missileCount}`);
                
                // 取得音（既存の音を流用）
                this.ball.components.sound.playSound();

                // 削除
                item.el.parentNode.removeChild(item.el);
                this.items.splice(i, 1);
                continue;
            }

            // 通り過ぎたら削除
            if (item.z > rigPos.z + 2) {
                item.el.parentNode.removeChild(item.el);
                this.items.splice(i, 1);
            }
        }
    },

    // ミサイル発射
    fireMissile: function () {
        if (this.isGameOver || this.missileCount <= 0) return;

        this.missileCount--;
        if (this.missileText) this.missileText.setAttribute('value', `MISSILE: ${this.missileCount}`);

        const rigPos = this.rig.getAttribute('position');
        // 右手の位置（おおよそ）から発射
        const x = rigPos.x + 0.2; 
        const z = rigPos.z - 0.5;

        const missileEl = document.createElement('a-cylinder');
        missileEl.setAttribute('radius', '0.05');
        missileEl.setAttribute('height', '0.5');
        missileEl.setAttribute('color', '#FFA500'); // オレンジ
        missileEl.setAttribute('rotation', '90 0 0');
        missileEl.setAttribute('position', `${x} 1.0 ${z}`);
        
        this.el.sceneEl.appendChild(missileEl);
        this.missiles.push({ el: missileEl, x: x, z: z });
        
        // 発射音（ボム音流用）
        const bombSound = document.getElementById('bomb-sound');
        if (bombSound) {
            bombSound.currentTime = 0;
            bombSound.play();
        }
    },

    // ミサイル更新（移動と破壊判定）
    updateMissiles: function (dt) {
        const speed = 10.0; // ミサイル速度

        for (let i = this.missiles.length - 1; i >= 0; i--) {
            const m = this.missiles[i];
            m.z -= speed * dt; // 奥へ飛んでいく
            m.el.setAttribute('position', `${m.x} 1.0 ${m.z}`);

            // ブロックとの当たり判定
            let hit = false;
            for (let j = 0; j < this.blocks.length; j++) {
                const b = this.blocks[j];
                if (!b.active) continue;

                if (Math.abs(m.x - b.x) < 0.8 && Math.abs(m.z - b.z) < 0.5) {
                    // 命中！
                    b.active = false;
                    b.el.parentNode.removeChild(b.el);
                    this.addScore();
                    this.ball.components.sound.playSound();
                    hit = true;
                    break;
                }
            }

            // 命中するか、遠くへ行ったら削除
            if (hit || m.z < -25) {
                m.el.parentNode.removeChild(m.el);
                this.missiles.splice(i, 1);
            }
        }
    }
});
