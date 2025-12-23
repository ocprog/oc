// game-components.js

// 1. ゲームの状態管理 (game-state)
AFRAME.registerComponent('game-state', {
    init: function () {
        this.score = 0;
        this.hp = 3;
        this.scoreText = document.getElementById('score-text');
        this.hpText = document.getElementById('hp-text');
        this.restartBtn = document.getElementById('restart-button');
        
        // 再挑戦ボタンのクリック処理
        document.getElementById('restart-plane').addEventListener('click', () => {
            this.resetGame();
        });

        this.updateHUD();
    },
    updateHUD: function () {
        this.hpText.setAttribute('text', 'value', 'HP: ' + this.hp);
        this.scoreText.setAttribute('text', 'value', 'SCORE: ' + this.score);
    },
    updateScore: function (points) {
        if (this.hp <= 0) return;
        this.score += points;
        this.updateHUD();
    },
    takeDamage: function () {
        if (this.hp <= 0) return; 
        this.hp--;
        this.updateHUD();
        
        const sky = document.querySelector('a-sky');
        const originalColor = sky.getAttribute('color');
        sky.setAttribute('color', 'red');
        setTimeout(() => sky.setAttribute('color', originalColor), 150);

        if (this.hp <= 0) {
            this.hpText.setAttribute('text', 'value', 'GAME OVER!');
            this.restartBtn.setAttribute('visible', 'true');
            
            const generator = this.el.querySelector('[slime-generator]');
            if (generator) generator.components['slime-generator'].stopGenerating();
        }
    },
    resetGame: function () {
        this.hp = 3;
        this.score = 0;
        this.updateHUD();
        this.restartBtn.setAttribute('visible', 'false');

        // 残っているスライムを消去
        const slimes = document.querySelectorAll('[slime]');
        slimes.forEach(s => {
            if (s.parentNode) s.parentNode.removeChild(s);
        });

        // スライム生成を再開
        const generator = this.el.querySelector('[slime-generator]');
        if (generator) generator.components['slime-generator'].startGame();
    }
});

// 2. スライム生成機 (アップロードされたソースを維持)
AFRAME.registerComponent('slime-generator', {
    init: function () {
        this.spawnInterval = 800;
        this.startGame();
    },
    startGame: function () {
        this.stopGenerating(); // 二重起動防止
        this.interval = setInterval(this.spawnSlime.bind(this), this.spawnInterval);
    },
    stopGenerating: function () {
        if (this.interval) clearInterval(this.interval);
    },
    spawnSlime: function () {
        const scene = this.el.sceneEl;
        const slimeSize = 0.3;
        
        const x = (Math.random() - 0.5) * 15;
        const y = 0.5; 
        const z = -(5 + Math.random() * 10); 

        const slime = document.createElement('a-entity');
        slime.setAttribute('position', { x: x, y: y, z: z });
        slime.setAttribute('geometry', `primitive: sphere; radius: ${slimeSize}`); 
        slime.setAttribute('material', 'color', '#00ff00; opacity: 0.9');
        
        slime.setAttribute('dynamic-body', `shape: sphere; mass: 2; linearDamping: 0; angularDamping: 0;`); 
        slime.setAttribute('slime', ''); 
        scene.appendChild(slime);

        setTimeout(() => {
            if (slime.parentNode) slime.parentNode.removeChild(slime);
        }, 30000); 
    }
});

// 3. スライムの挙動 (body.velocity.set 版を維持)
AFRAME.registerComponent('slime', {
    init: function () {
        this.gameState = this.el.sceneEl.components['game-state'];
        this.playerEl = this.el.sceneEl.querySelector('#player-camera');
        this.thrustStrength = 8;
        this.hitProcessed = false; 
    },

    tick: function () {
        const body = this.el.body;
        if (!body || !this.playerEl || this.hitProcessed) return; 

        const currentPos = this.el.object3D.position;
        const playerPos = this.playerEl.object3D.position;

        // 距離判定
        const dist = currentPos.distanceTo(playerPos);
        if (dist < 0.7) {
            this.hitProcessed = true;
            this.gameState.takeDamage();
            this.el.parentNode.removeChild(this.el);
            return;
        }

        const direction = new THREE.Vector3(
            playerPos.x - currentPos.x, 
            0, 
            playerPos.z - currentPos.z
        ).normalize().multiplyScalar(this.thrustStrength);
        
        body.velocity.set(direction.x, body.velocity.y, direction.z);
    }
});

// 4. 剣 (維持)
AFRAME.registerComponent('sword', {
    init: function () {
        this.el.addEventListener('collide', (e) => {
            const otherEl = e.detail.body.el;
            if (otherEl && otherEl.hasAttribute('slime')) {
                this.el.sceneEl.components['game-state'].updateScore(100);
                if (otherEl.parentNode) otherEl.parentNode.removeChild(otherEl);
            }
        });
    }
});

// 5. 盾 (維持)
AFRAME.registerComponent('shield', {
    init: function () {
        this.el.addEventListener('collide', (e) => {
            const otherEl = e.detail.body.el;
            if (otherEl && otherEl.hasAttribute('slime')) {
                const slimeBody = otherEl.body;
                const velocity = slimeBody.velocity;
                slimeBody.velocity.set(-velocity.x * 2, 2, -velocity.z * 2);
            }
        });
    }
});