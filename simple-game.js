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
        
        // --- グリップボタン（シールド） ---
        this.el.addEventListener('gripdown', () => {
            const gm = this.getGameManager();
            if (gm) gm.setShield(true);
            showLog('Grip: Shield ON');
        });
        this.el.addEventListener('gripup', () => {
            const gm = this.getGameManager();
            if (gm) gm.setShield(false);
            showLog('Grip: Shield OFF');
        });

        // --- B / Y ボタン（ボム） ---
        const onBomb = () => {
            const gm = this.getGameManager();
            if (gm) gm.useBomb();
            showLog('Bomb Button!');
        };
        this.el.addEventListener('bbuttondown', onBomb);
        this.el.addEventListener('ybuttondown', onBomb);

        // --- A / X ボタン（武器切り替え） ---
        const onSwitch = () => {
            const gm = this.getGameManager();
            if (gm) gm.switchWeapon();
            showLog('Switch Weapon');
        };
        this.el.addEventListener('abuttondown', onSwitch);
        this.el.addEventListener('xbuttondown', onSwitch);

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
        this.bombCount = 3;
        this.isGameOver = false;
        this.canRestart = false; // リスタート可能フラグ
        this.isShielding = false; // シールド展開中か
        this.weaponMode = 0; // 0: Cyan, 1: Magenta
        this.startTime = Date.now();

        // プレイヤーリグ（移動用）
        this.rig = document.getElementById('rig');

        // UI要素の取得
        this.scoreText = document.getElementById('score-text');
        this.hpText = document.getElementById('hp-text');
        this.bombText = document.getElementById('bomb-text');
        this.restartBtn = document.getElementById('restart-button');
        this.restartTarget = document.getElementById('restart-click-target');
        this.shieldEntity = document.getElementById('player-shield');
        
        // リスタートボタンにクリックイベントを追加
        if (this.restartTarget) {
            this.restartTarget.addEventListener('click', () => {
                if (!this.isGameOver || !this.canRestart) return; // ゲームオーバーかつリスタート許可時のみ
                console.log("Restart button clicked!"); // デバッグ用ログ
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
        const y = 0.5 + Math.random() * 1.5; // UIと被らないよう少し低めに出現
        const z = -15; // 15メートル先
        
        enemy.setAttribute('geometry', 'primitive: sphere; radius: 0.5');
        enemy.setAttribute('material', 'color: #FF4444; roughness: 0.5');
        enemy.setAttribute('position', `${x} ${y} ${z}`);
        
        // 効果音設定 (poolSize: 同時に複数の音が鳴っても大丈夫なように数を確保)
        enemy.setAttribute('sound', 'src: #explode-sound; poolSize: 10; volume: 1.0');

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
            if (this.isShielding) return; // シールド中は攻撃できない（防御専念）
            if (enemy.classList.contains('dead')) return; // すでに倒されている場合は無視

            enemy.components.sound.playSound(); // 効果音再生
            enemy.classList.add('dead'); // 倒されたフラグ
            this.addScore();
            
            // クリックされたらアニメーションを止める
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
        enemy.addEventListener('animationcomplete', (e) => {
            // 倒された後や、移動以外のアニメーション完了は無視
            if (enemy.classList.contains('dead')) return;
            if (e.detail.name !== 'animation') return;

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
        if (this.isShielding) return; // シールド中はダメージを受けない！

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
        this.bombCount = 3;
        this.isGameOver = false;
        this.canRestart = false;
        this.startTime = Date.now();

        // UIリセット
        if (this.scoreText) this.scoreText.setAttribute('value', 'Score: 0');
        if (this.hpText) this.hpText.setAttribute('value', 'HP: 3');
        if (this.bombText) this.bombText.setAttribute('value', 'BOMB: 3');
        if (this.restartBtn) this.restartBtn.setAttribute('visible', 'false');

        // 画面に残っている敵をすべて消す
        const enemies = document.querySelectorAll('.clickable');
        enemies.forEach(el => {
            // リスタートボタンのパーツは消さないようにIDチェックを強化
            if (el.id !== 'restart-click-target' && el.id !== 'restart-button') { 
                if (el.parentNode) el.parentNode.removeChild(el);
            }
        });

        // 生成ループ再開
        this.scheduleNextSpawn();
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

    // シールド展開
    setShield: function (active) {
        this.isShielding = active;
        if (this.shieldEntity) {
            this.shieldEntity.setAttribute('visible', active);
        }
        // シールド中はレーザーを消すなどの処理も可能だが、今回は「攻撃無効」判定のみ
    },

    // ボム使用
    useBomb: function () {
        if (this.isGameOver || this.bombCount <= 0) return;

        this.bombCount--;
        if (this.bombText) this.bombText.setAttribute('value', `BOMB: ${this.bombCount}`);

        // 画面内の敵を全て倒す
        const enemies = document.querySelectorAll('.clickable');
        enemies.forEach(enemy => {
            if (enemy.id !== 'restart-click-target' && !enemy.classList.contains('dead')) {
                // クリックイベントを発火させて倒したことにする
                enemy.emit('click');
            }
        });

        // ボム音再生（簡易的にHTMLに追加したaudioタグを再生）
        const bombSound = document.getElementById('bomb-sound'); // index.htmlに追加が必要
        if (bombSound) bombSound.play();
    },

    // 武器切り替え
    switchWeapon: function () {
        this.weaponMode = (this.weaponMode + 1) % 2;
        const rightHand = document.getElementById('rightHand');
        
        if (this.weaponMode === 0) {
            // 通常モード (Cyan)
            rightHand.setAttribute('line', 'color: cyan; opacity: 0.75');
        } else {
            // パワーモード (Magenta) - 今回は見た目だけ変更
            rightHand.setAttribute('line', 'color: magenta; opacity: 0.75');
        }
    }
});
