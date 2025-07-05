// --- テトリミノ定義（SRS準拠・略） ---
const TETROMINO_TYPES = ['I', 'O', 'S', 'Z', 'J', 'L', 'T'];
const TETROMINOS = { /* ...（省略：元のまま）... */ };

// --- SRSキックテーブル（省略：元のまま） ---
const SRS_KICK = { /* ...（省略：元のまま）... */ };

// --- 七種一巡バッグ ---
function generateBag() { /* ... */ }
let queue = [];
function refillQueue() { /* ... */ }
function getNextTetromino() { /* ... */ }

// --- ゲーム設定 ---
const COLS = 10;
const ROWS = 22;
const BLOCK_SIZE = 20;
const GRAVITY_NORM = 1 / 60 * 1.5;
const GRAVITY_SOFT = 1 / 60 * 16;
const DAS = 100; // 0.1秒
const ARR = 10;  // 0.01秒、10msごと

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

// --- ロックディレイ制御 ---
let lockDelay = 0;
let lockDelayTime = 3000; // 3秒
let lockActive = false;
let lastMoveTime = 0;
let lastDropWasHard = false;

// --- DAS/ARR制御 ---
let moveDir = 0; // -1=左, 1=右, 0=なし
let dasTimer = null;
let arrTimer = null;

// --- テトリミノ生成・セット ---
function spawnTetromino() {
    current = getNextTetromino();
    pos = {x: 3, y: 0, r: 0};
    canHold = true;
    lockDelay = 0;
    lockActive = false;
    lastDropWasHard = false;
    if (!isValid(pos.x, pos.y, pos.r)) {
        gameOverFlag = true;
        setTimeout(()=>alert('Game Over'), 150);
    }
}
function isValid(x, y, r, type=current) { /* ...（元のまま）... */ }

// --- 回転処理（SRS） ---
function rotate(dir) {
    if (gameOverFlag) return;
    let oldR = pos.r;
    let newR = (oldR + dir + 4) % 4;
    const shapeType = current === 'I' ? 'I' : 'normal';
    const kickTable = SRS_KICK[shapeType];
    let idx = (dir === 1)
        ? (oldR * 2) % 8
        : ((oldR * 2 + 7) % 8);
    for (let [kx, ky] of kickTable[idx]) {
        if (isValid(pos.x + kx, pos.y + ky, newR)) {
            pos.x += kx;
            pos.y += ky;
            pos.r = newR;
            resetLockDelay();
            return;
        }
    }
}

// --- 移動 ---
function tryMove(dx, dy) {
    if (gameOverFlag) return false;
    if (isValid(pos.x + dx, pos.y + dy, pos.r)) {
        pos.x += dx;
        pos.y += dy;
        resetLockDelay();
        return true;
    }
    return false;
}
// DAS/ARRハンドラ
function startMove(dir) {
    moveDir = dir;
    if (tryMove(dir, 0)) draw();
    if (dasTimer) clearTimeout(dasTimer);
    if (arrTimer) clearInterval(arrTimer);
    dasTimer = setTimeout(() => {
        arrTimer = setInterval(() => {
            if (tryMove(dir, 0)) draw();
        }, ARR);
    }, DAS);
}
function stopMove(dir) {
    if (moveDir === dir) {
        moveDir = 0;
        if (dasTimer) clearTimeout(dasTimer);
        if (arrTimer) clearInterval(arrTimer);
    }
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
function place(force=false) {
    if (gameOverFlag) return;
    for (let [dx, dy] of TETROMINOS[current][pos.r]) {
        let nx = pos.x + dx, ny = pos.y + dy;
        if (ny >= 0 && ny < ROWS) board[ny][nx] = current;
    }
    let [cleared, tspin] = clearLines();
    const atk = calcGarbage(cleared, tspin);
    garbage += atk;
    spawnTetromino();
}

// --- ロックディレイ関連 ---
function checkLanding() {
    if (!isValid(pos.x, pos.y + 1, pos.r)) {
        if (!lockActive) {
            lockActive = true;
            lockDelay = 0;
        }
        if (lastDropWasHard) {
            place();
            lockActive = false;
            return;
        }
        lockDelay += deltaTime();
        if (lockDelay >= lockDelayTime) {
            place();
            lockActive = false;
        }
    } else {
        lockActive = false;
        lockDelay = 0;
    }
}
function resetLockDelay() {
    if (lockActive && !lastDropWasHard) {
        lockDelay = 0;
    }
    lastDropWasHard = false;
}
function deltaTime() {
    const now = performance.now();
    const dt = now - lastMoveTime;
    lastMoveTime = now;
    return dt;
}

// --- 行消し・Tスピン判定・火力計算・HOLD・描画（元のまま） ---
/* ...（省略：元のコードのclearLines, calcGarbage, holdTetromino, getColor, drawBlock, draw）... */

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
        case 'ArrowUp': // ハードドロップ
            hardDrop(); break;
        case 'KeyZ':
            rotate(-1); draw(); break;
        case 'KeyX':
            rotate(1); draw(); break;
        case 'KeyC':
            holdTetromino(); draw(); break;
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
function update() {
    if (gameOverFlag) return;
    if (!lastMoveTime) lastMoveTime = performance.now();
    dropCounter += softDrop ? GRAVITY_SOFT : GRAVITY_NORM;
    if (dropCounter >= 1) {
        if (!tryMove(0, 1)) {
            checkLanding();
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
}
init();
update();

/*
--- 省略部分 ---
TETROMINOS/SRS_KICK/clearLines/calcGarbage/holdTetromino/getColor/drawBlock/draw
これらは元のコードをそのまま使ってください（修正不要です）。
*/