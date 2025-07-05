// --- テトリミノ定義 ---
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
const GRAVITY_NORM = 1/60;
const GRAVITY_SOFT = 1/4;
const DAS = 167;
const ARR = 0;
const lockDelayTime = 500;
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

// --- シンプルな回転とTスピン判定（DT砲/TDどちらも通る超ゆる回転！） ---
let lastTSpin = false;
let lastRotated = false;

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

function rotate(dir) {
    if (gameOverFlag) return;
    let oldR = pos.r;
    let newR = (oldR + dir + 4) % 4;
    // 超広範囲キック: ±2横, ±3縦を許容
    let rotated = false;
    for (let kx = -2; kx <= 2; kx++) {
        for (let ky = -3; ky <= 3; ky++) {
            let nx = pos.x + kx;
            let ny = pos.y + ky;
            if (isValid(nx, ny, newR)) {
                pos.x = nx;
                pos.y = ny;
                pos.r = newR;
                rotated = true;
                resetLockDelay();
                draw();
                // --- Tスピン判定：角3つ以上埋まってたらTスピン ---
                if (current === 'T') {
                    let corners = [[0,0],[2,0],[0,2],[2,2]].filter(([dx,dy])=>{
                        let cx = pos.x + dx - 1, cy = pos.y + dy - 1;
                        return (cy < 0 || cx < 0 || cx >= COLS || cy >= ROWS || board[cy][cx]);
                    }).length;
                    lastTSpin = (corners >= 3);
                    lastRotated = true;
                } else {
                    lastTSpin = false;
                    lastRotated = false;
                }
                return;
            }
        }
    }
    // 回転できなかった場合フラグリセット
    lastTSpin = false;
    lastRotated = false;
}

// --- DAS/ARR制御 ---
let moveDir = 0;
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
    lastTSpin = false;
    lastRotated = false;
    if (!isValid(pos.x, pos.y, pos.r)) {
        gameOverFlag = true;
        setTimeout(()=>alert('Game Over'), 150);
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
    let [cleared, tspin] = clearLines();
    // ...火力計算等は現状通り...
    spawnTetromino();
    lastTSpin = false;
    lastRotated = false;
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
    // 設置直前に回転したかどうかだけでTスピン判定
    let tspin = false;
    if (current === 'T' && lastRotated && lastTSpin && cleared > 0) tspin = true;
    // ...ren, b2b処理等は従来通り...
    if (cleared) {
        lines += cleared;
        ren = (ren === -1) ? 1 : ren+1;
        if ((cleared === 4 || tspin) && b2b) b2b = true;
        else if (tspin || cleared === 4) b2b = true;
        else b2b = false;
    } else {
        ren = -1;
    }
    return [cleared, tspin];
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