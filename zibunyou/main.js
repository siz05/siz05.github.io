// --- テトリミノ定義（SRS準拠） ---
const TETROMINO_TYPES = ['I', 'O', 'S', 'Z', 'J', 'L', 'T'];
const TETROMINOS = {
    I: [
        [[0,1],[1,1],[2,1],[3,1]],
        [[2,0],[2,1],[2,2],[2,3]],
        [[0,2],[1,2],[2,2],[3,2]],
        [[1,0],[1,1],[1,2],[1,3]],
    ],
    O: [
        [[1,0],[2,0],[1,1],[2,1]],
        [[1,0],[2,0],[1,1],[2,1]],
        [[1,0],[2,0],[1,1],[2,1]],
        [[1,0],[2,0],[1,1],[2,1]],
    ],
    S: [
        [[1,0],[2,0],[0,1],[1,1]],
        [[1,0],[1,1],[2,1],[2,2]],
        [[1,1],[2,1],[0,2],[1,2]],
        [[0,0],[0,1],[1,1],[1,2]],
    ],
    Z: [
        [[0,0],[1,0],[1,1],[2,1]],
        [[2,0],[1,1],[2,1],[1,2]],
        [[0,1],[1,1],[1,2],[2,2]],
        [[1,0],[0,1],[1,1],[0,2]],
    ],
    J: [
        [[0,0],[0,1],[1,1],[2,1]],
        [[1,0],[2,0],[1,1],[1,2]],
        [[0,1],[1,1],[2,1],[2,2]],
        [[1,0],[1,1],[0,2],[1,2]],
    ],
    L: [
        [[2,0],[0,1],[1,1],[2,1]],
        [[1,0],[1,1],[1,2],[2,2]],
        [[0,1],[1,1],[2,1],[0,2]],
        [[0,0],[1,0],[1,1],[1,2]],
    ],
    T: [
        [[1,0],[0,1],[1,1],[2,1]],
        [[1,0],[1,1],[2,1],[1,2]],
        [[0,1],[1,1],[2,1],[1,2]],
        [[1,0],[0,1],[1,1],[1,2]],
    ],
};
// --- SRSキックテーブル（公式通り） ---
const SRS_KICK = {
    normal: [
        [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]], // 0>R
        [[0,0],[1,0],[1,-1],[0,2],[1,2]],     // R>0
        [[0,0],[1,0],[1,1],[0,-2],[1,-2]],    // R>2
        [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],  // 2>R
        [[0,0],[1,0],[1,1],[0,-2],[1,-2]],    // 2>L
        [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],  // L>2
        [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]], // L>0
        [[0,0],[1,0],[1,-1],[0,2],[1,2]],     // 0>L
    ],
    I: [
        [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],   // 0>R
        [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],   // R>0
        [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],   // R>2
        [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],   // 2>R
        [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],   // 2>L
        [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],   // L>2
        [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],   // L>0
        [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],   // 0>L
    ]
};
// --- 七種一巡バッグ ---
function generateBag() {
    const bag = [...TETROMINO_TYPES];
    for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
}
let queue = [];
function refillQueue() {
    while (queue.length < 7) {
        queue.push(...generateBag());
    }
}
function getNextTetromino() {
    if (queue.length < 7) refillQueue();
    return queue.shift();
}
// --- ゲーム設定 ---
const COLS = 10;
const ROWS = 22;
const BLOCK_SIZE = 20;
const GRAVITY_NORM = 1/60;    // 1ライン/秒（1G: 60Fで1落下, 0.0167...）
const GRAVITY_SOFT = 1/4;     // 0.25ライン/秒（4Fで1落下, 0.25）
const DAS = 167;  // ms
const ARR = 0;    // ms
const lockDelayTime = 500; // ms
let lockDelay = 0;
let lockActive = false;
let lockStartTime = null;
let lockResets = 0;
const MAX_LOCK_RESETS = 15;

// --- キャンバス/ボード ---
const mainCanvas = document.getElementById('tetris');
const mainCtx = mainCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold');
const holdCtx = holdCanvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nextCtx = nextCanvas.getContext('2d');
let board = Array.from({length: ROWS}, () => Array(COLS).fill(0));

// --- テトリミノ状態 ---
let current = null;
let hold = null;
let canHold = true;
let pos = {x: 3, y: 0, r: 0};
let score = 0, lines = 0, ren = -1, b2b = false, garbage = 0;
let gameOverFlag = false;
let lastDropWasHard = false;

// --- DAS/ARR制御 ---
let moveDir = 0; // -1=左, 1=右, 0=なし
let dasTimer = null;
let arrTimer = null;
function startMove(dir) {
    moveDir = dir;
    if (tryMove(dir, 0)) draw();
    if (dasTimer) clearTimeout(dasTimer);
    if (arrTimer) clearInterval(arrTimer);
    dasTimer = setTimeout(() => {
        arrTimer = setInterval(() => {
            if (ARR === 0) {
                while (tryMove(dir, 0)) {}
            } else {
                tryMove(dir, 0);
            }
            draw();
        }, ARR === 0 ? 16 : ARR);
    }, DAS);
}
function stopMove(dir) {
    if (moveDir === dir) {
        moveDir = 0;
        if (dasTimer) clearTimeout(dasTimer);
        if (arrTimer) clearInterval(arrTimer);
    }
}

// --- テトリミノ生成・セット ---
function spawnTetromino() {
    current = getNextTetromino();
    pos = {x: 3, y: 0, r: 0};
    canHold = true;
    lockDelay = 0;
    lockActive = false;
    lockStartTime = null;
    lockResets = 0;
    lastDropWasHard = false;
    lastSpinType = 0;
    if (!isValid(pos.x, pos.y, pos.r)) {
        gameOverFlag = true;
        setTimeout(()=>alert('Game Over'), 150);
    }
}
function isValid(x, y, r, type=current) {
    const shape = TETROMINOS[type][r];
    for (let [dx, dy] of shape) {
        let nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return false;
        if (board[ny][nx]) return false;
    }
    return true;
}
function tryMove(dx, dy) {
    if (gameOverFlag) return false;
    if (isValid(pos.x + dx, pos.y + dy, pos.r)) {
        pos.x += dx;
        pos.y += dy;
        resetLockDelay();
        draw();
        return true;
    }
    return false;
}

// --- SRS回転インデックス ---
function srsIndex(from, to) {
    if (from === 0 && to === 1) return 0; // 0->R
    if (from === 1 && to === 0) return 1; // R->0
    if (from === 1 && to === 2) return 2; // R->2
    if (from === 2 && to === 1) return 3; // 2->R
    if (from === 2 && to === 3) return 4; // 2->L
    if (from === 3 && to === 2) return 5; // L->2
    if (from === 3 && to === 0) return 6; // L->0
    if (from === 0 && to === 3) return 7; // 0->L
    return 0;
}

// --- Tスピン種別管理 ---
let lastSpinType = 0; // 0=none, 1=mini, 2=normal

// --- SRS回転/キック完全対応（Tスピン種別判定付き） ---
function rotate(dir) {
    if (gameOverFlag) return;
    let oldR = pos.r;
    let newR = (oldR + dir + 4) % 4;
    const shapeType = current === 'I' ? 'I' : 'normal';
    const kickTable = SRS_KICK[shapeType];
    const idx = srsIndex(oldR, newR);
    let kicked = false;
    let kickIndex = 0;
    for (let i = 0; i < kickTable[idx].length; i++) {
        let [kx, ky] = kickTable[idx][i];
        let nx = pos.x + kx;
        let ny = pos.y + ky;
        if (isValid(nx, ny, newR)) {
            pos.x = nx;
            pos.y = ny;
            pos.r = newR;
            kicked = (kx !== 0 || ky !== 0);
            kickIndex = i;
            resetLockDelay();
            draw();
            break;
        }
    }
    // Tスピン種別判定
    if (current === 'T') {
        // 角3つ以上
        let corners = [[0,0],[2,0],[0,2],[2,2]].filter(([dx,dy])=>{
            let nx = pos.x + dx - 1, ny = pos.y + dy - 1;
            return (ny < 0 || nx < 0 || nx >= COLS || ny >= ROWS || board[ny][nx]);
        }).length;
        // MINI条件: kickedかつ、上2つ角のうち床側に面している数が2未満
        // SRSでは回転方向によってMINIが無効になるパターンもあるが、ぷよテトではkickedならMINI
        if (corners >= 3) {
            if (kicked && (kickIndex > 0)) {
                lastSpinType = 1; // MINI
            } else {
                lastSpinType = 2; // normal
            }
        } else {
            lastSpinType = 0;
        }
    } else {
        lastSpinType = 0;
    }
}

// --- ロックディレイ判定 ---
function checkLanding() {
    if (!isValid(pos.x, pos.y + 1, pos.r)) {
        if (!lockActive) {
            lockActive = true;
            lockStartTime = performance.now();
            lockDelay = 0;
            lockResets = 0;
        }
        if (lastDropWasHard) {
            place();
            lockActive = false;
            return;
        }
        lockDelay = performance.now() - lockStartTime;
        if (lockDelay >= lockDelayTime) {
            place();
            lockActive = false;
        }
    } else {
        lockActive = false;
        lockDelay = 0;
        lockStartTime = null;
        lockResets = 0;
    }
}
function resetLockDelay() {
    if (lockActive && !lastDropWasHard) {
        if (lockResets < MAX_LOCK_RESETS) {
            lockDelay = 0;
            lockStartTime = performance.now();
            lockResets++;
        }
    }
    lastDropWasHard = false;
}

// --- ソフト/ハードドロップ ---
let softDrop = false;
function handleSoftDrop(down) {
    softDrop = down;
    if (down) {
        resetLockDelay();
    }
}
function hardDrop() {
    if (gameOverFlag) return;
    while (tryMove(0, 1));
    lastDropWasHard = true;
    place();
}

// --- ミノ設置 ---
function place() {
    if (gameOverFlag) return;
    for (let [dx, dy] of TETROMINOS[current][pos.r]) {
        let nx = pos.x + dx, ny = pos.y + dy;
        if (ny >= 0 && ny < ROWS) board[ny][nx] = current;
    }
    let [cleared, tspin, tspinMini] = clearLines();
    const atk = calcGarbage(cleared, tspin, tspinMini);
    garbage += atk;
    spawnTetromino();
}

// --- 行消し & Tスピン種別返却 ---
function clearLines() {
    let cleared = 0;
    for (let y = ROWS-1; y >= 0; y--) {
        if (board[y].every(v => v)) {
            board.splice(y,1);
            board.unshift(Array(COLS).fill(0));
            cleared++;
            y++;
        }
    }
    // Tスピン種別返却
    let tspin = false, tspinMini = false;
    if (current === 'T') {
        if (lastSpinType === 2 && cleared > 0) tspin = true;
        if (lastSpinType === 1 && cleared > 0) tspinMini = true;
    }
    if (cleared) {
        lines += cleared;
        ren = (ren === -1) ? 1 : ren+1;
        if ((cleared === 4 || tspin || tspinMini) && b2b) b2b = true;
        else if (tspin || tspinMini || cleared === 4) b2b = true;
        else b2b = false;
    } else {
        ren = -1;
    }
    return [cleared, tspin, tspinMini];
}

// --- 火力計算（TスピンMINI対応） ---
function calcGarbage(cleared, tspin, tspinMini) {
    let atk = 0;
    if (tspin || tspinMini) {
        if (tspinMini && cleared === 1) atk = 0; // MINIは0火力
        if (tspin && cleared === 1) atk = 2;
        if (tspin && cleared === 2) atk = 4;
        if (tspin && cleared === 3) atk = 6;
    }
    if (!tspin && !tspinMini) {
        if (cleared === 2) atk = 1;
        if (cleared === 3) atk = 2;
        if (cleared === 4) atk = 4;
    }
    if (b2b && (cleared === 4 || tspin)) atk += 1;
    if (ren >= 2) atk += Math.floor((ren-1)/2);
    return atk;
}

// --- ホールド機能 ---
function holdTetromino() {
    if (!canHold || gameOverFlag) return;
    canHold = false;
    if (!hold) {
        hold = current;
        spawnTetromino();
    } else {
        [current, hold] = [hold, current];
        pos = {x:3, y:0, r:0};
        if (!isValid(pos.x, pos.y, pos.r)) {
            gameOverFlag = true;
            setTimeout(()=>alert('Game Over'), 150);
        }
    }
    resetLockDelay();
    draw();
}

// --- 描画 ---
function getColor(type) {
    return {
        I:'#0ff', O:'#ff0', S:'#0f0', Z:'#f00',
        J:'#00f', L:'#fa0', T:'#a0f'
    }[type] || '#222';
}
function drawBlock(ctx, x, y, type, size=BLOCK_SIZE) {
    ctx.fillStyle = getColor(type);
    ctx.fillRect(x*size, y*size, size, size);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(x*size, y*size, size, size);
}
function draw() {
    mainCtx.clearRect(0,0,mainCanvas.width,mainCanvas.height);
    for (let y=2; y<ROWS; y++) for (let x=0; x<COLS; x++) {
        if (board[y][x]) drawBlock(mainCtx, x, y-2, board[y][x]);
    }
    if (current) {
        let ghostY = pos.y;
        while (isValid(pos.x, ghostY+1, pos.r)) ghostY++;
        mainCtx.globalAlpha = 0.3;
        for (let [dx, dy] of TETROMINOS[current][pos.r]) {
            let nx = pos.x + dx, ny = ghostY + dy - 2;
            if (ny >= 0) drawBlock(mainCtx, nx, ny, current);
        }
        mainCtx.globalAlpha = 1.0;
        for (let [dx, dy] of TETROMINOS[current][pos.r]) {
            let nx = pos.x + dx, ny = pos.y + dy - 2;
            if (ny >= 0) drawBlock(mainCtx, nx, ny, current);
        }
    }
    // HOLD欄（1マス余白で中央寄せ）
    holdCtx.clearRect(0,0,holdCanvas.width,holdCanvas.height);
    if (hold) {
        const shape = TETROMINOS[hold][0];
        let minX = Math.min(...shape.map(([x])=>x));
        let minY = Math.min(...shape.map(([_,y])=>y));
        let maxX = Math.max(...shape.map(([x])=>x));
        let maxY = Math.max(...shape.map(([_,y])=>y));
        let offsetX = Math.floor((4 - (maxX-minX+1))/2) + 1;
        let offsetY = Math.floor((4 - (maxY-minY+1))/2) + 1;
        for (let [dx, dy] of shape) {
            drawBlock(holdCtx, dx-minX+offsetX, dy-minY+offsetY, hold, 16);
        }
    }
    // NEXT欄（1マス余白＋縦余白）
    nextCtx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
    for (let i=0; i<4; i++) {
        const nextType = queue[i];
        if (!nextType) continue;
        const shape = TETROMINOS[nextType][0];
        let minX = Math.min(...shape.map(([x])=>x));
        let minY = Math.min(...shape.map(([_,y])=>y));
        let maxX = Math.max(...shape.map(([x])=>x));
        let maxY = Math.max(...shape.map(([_,y])=>y));
        let offsetX = Math.floor((4 - (maxX-minX+1))/2) + 1;
        let offsetY = Math.floor((4 - (maxY-minY+1))/2) + 1 + i*5;
        for (let [dx, dy] of shape) {
            drawBlock(nextCtx, dx-minX+offsetX, dy-minY+offsetY, nextType, 16);
        }
    }
    document.getElementById('score').textContent = "SCORE: " + score;
    document.getElementById('lines').textContent = "LINES: " + lines;
    document.getElementById('ren').textContent = "REN: " + (ren>=0?ren:0);
    document.getElementById('garbage').textContent = "GARBAGE: " + garbage;
}

// --- 入力 ---
document.addEventListener('keydown', (e)=>{
    if (gameOverFlag) return;
    switch(e.code) {
        case 'ArrowLeft':
            startMove(-1); break;
        case 'ArrowRight':
            startMove(1); break;
        case 'ArrowDown':
            handleSoftDrop(true); break;
        case 'ArrowUp':
            hardDrop(); break;
        case 'KeyZ':
            rotate(-1); break;
        case 'KeyX':
            rotate(1); break;
        case 'KeyC':
            holdTetromino(); break;
    }
});
document.addEventListener('keyup', (e)=>{
    switch(e.code) {
        case 'ArrowLeft':
            stopMove(-1); break;
        case 'ArrowRight':
            stopMove(1); break;
        case 'ArrowDown':
            handleSoftDrop(false); break;
    }
});

// --- ゲームループ ---
let dropCounter = 0;
let lastTime = null;
function update(now) {
    if (gameOverFlag) return;
    if (!lastTime) lastTime = now;
    let delta = now - lastTime;
    lastTime = now;
    dropCounter += (softDrop ? GRAVITY_SOFT : GRAVITY_NORM) * delta;
    if (dropCounter >= 1) {
        if (!tryMove(0, 1)) {
            checkLanding();
        } else {
            lockActive = false;
            lockDelay = 0;
            lockStartTime = null;
            lockResets = 0;
        }
        dropCounter = 0;
    } else {
        if (lockActive) checkLanding();
    }
    draw();
    requestAnimationFrame(update);
}

// --- 初期化 ---
function init() {
    board = Array.from({length: ROWS}, () => Array(COLS).fill(0));
    hold = null;
    canHold = true;
    lines = 0;
    ren = -1;
    b2b = false;
    garbage = 0;
    score = 0;
    gameOverFlag = false;
    queue = [];
    refillQueue();
    spawnTetromino();
    draw();
    lastTime = null;
    requestAnimationFrame(update);
}
init();