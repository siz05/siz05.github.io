// --- テトリミノ定義（SRS準拠） ---
const TETROMINO_TYPES = ['I', 'O', 'S', 'Z', 'J', 'L', 'T'];

// SRS用のミノの形（回転: 0, R, 2, L）
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

// --- SRSキックテーブル（Iミノと他ミノで異なる） ---
const SRS_KICK = {
    normal: [
        [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]], // 0->R
        [[0,0],[1,0],[1,-1],[0,2],[1,2]],     // R->0
        [[0,0],[1,0],[1,1],[0,-2],[1,-2]],    // R->2
        [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],  // 2->R
        [[0,0],[1,0],[1,1],[0,-2],[1,-2]],    // 2->L
        [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],  // L->2
        [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]], // L->0
        [[0,0],[1,0],[1,-1],[0,2],[1,2]],     // 0->L
    ],
    I: [
        [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],   // 0->R
        [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],   // R->0
        [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],   // R->2
        [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],   // 2->R
        [[0,0],[2,0],[-1,0],[2,1],[-1,-2]],   // 2->L
        [[0,0],[-2,0],[1,0],[-2,-1],[1,2]],   // L->2
        [[0,0],[1,0],[-2,0],[1,-2],[-2,1]],   // L->0
        [[0,0],[-1,0],[2,0],[-1,2],[2,-1]],   // 0->L
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
const ROWS = 22; // 表示は20、2は隠し
const BLOCK_SIZE = 20;
const GRAVITY_NORM = 1 / 60 * 1.5;
const GRAVITY_SOFT = 1 / 60 * 16;

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
let nextQueue = [];
let pos = {x: 3, y: 0, r: 0};
let score = 0, lines = 0, ren = -1, b2b = false, garbage = 0;
let gameOverFlag = false;

// --- テトリミノ生成・セット ---
function spawnTetromino() {
    current = getNextTetromino();
    pos = {x: 3, y: 0, r: 0};
    canHold = true;
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
            return;
        }
    }
}

// --- ミノ設置 ---
function hardDrop() {
    if (gameOverFlag) return;
    while (move(0, 1));
    place();
}
function move(dx, dy) {
    if (gameOverFlag) return false;
    if (isValid(pos.x + dx, pos.y + dy, pos.r)) {
        pos.x += dx;
        pos.y += dy;
        return true;
    }
    return false;
}
function place() {
    if (gameOverFlag) return;
    for (let [dx, dy] of TETROMINOS[current][pos.r]) {
        let nx = pos.x + dx, ny = pos.y + dy;
        if (ny >= 0 && ny < ROWS) board[ny][nx] = current;
    }
    let [cleared, tspin] = clearLines();
    // 火力計算
    const atk = calcGarbage(cleared, tspin);
    garbage += atk;
    spawnTetromino();
}

// --- 行消し・Tスピン判定 ---
function clearLines() {
    let cleared = 0;
    let tspin = false;
    if (current === 'T') {
        // Tスピン判定（簡易）
        let corners = [[0,0],[2,0],[0,2],[2,2]].filter(([dx,dy])=>{
            let nx = pos.x + dx - 1, ny = pos.y + dy - 1;
            return (ny < 0 || nx < 0 || nx >= COLS || ny >= ROWS || board[ny][nx]);
        }).length;
        if (corners >= 3) tspin = true;
    }
    for (let y = ROWS-1; y >= 0; y--) {
        if (board[y].every(v => v)) {
            board.splice(y,1);
            board.unshift(Array(COLS).fill(0));
            cleared++;
            y++;
        }
    }
    if (cleared) {
        lines += cleared;
        ren = (ren === -1) ? 1 : ren+1;
        if (cleared === 4 || tspin) b2b = true;
        else b2b = false;
    } else {
        ren = -1;
    }
    return [cleared, tspin];
}

// --- 火力計算（ぷよテト風、概略） ---
function calcGarbage(cleared, tspin) {
    // サンプル: ぷよテト風（Tスピン/REN/B2B簡易対応）
    let atk = 0;
    if (tspin && cleared === 1) atk = 2;
    if (tspin && cleared === 2) atk = 4;
    if (tspin && cleared === 3) atk = 6;
    if (!tspin) {
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
    // メインフィールド
    mainCtx.clearRect(0,0,mainCanvas.width,mainCanvas.height);
    for (let y=2; y<ROWS; y++) for (let x=0; x<COLS; x++) {
        if (board[y][x]) drawBlock(mainCtx, x, y-2, board[y][x]);
    }
    // ゴースト
    let ghostY = pos.y;
    while (isValid(pos.x, ghostY+1, pos.r)) ghostY++;
    mainCtx.globalAlpha = 0.3;
    for (let [dx, dy] of TETROMINOS[current][pos.r]) {
        let nx = pos.x + dx, ny = ghostY + dy - 2;
        if (ny >= 0) drawBlock(mainCtx, nx, ny, current);
    }
    mainCtx.globalAlpha = 1.0;
    // current
    for (let [dx, dy] of TETROMINOS[current][pos.r]) {
        let nx = pos.x + dx, ny = pos.y + dy - 2;
        if (ny >= 0) drawBlock(mainCtx, nx, ny, current);
    }
    // HOLD
    holdCtx.clearRect(0,0,holdCanvas.width,holdCanvas.height);
    if (hold) {
        const shape = TETROMINOS[hold][0];
        let mx = Math.min(...shape.map(([x])=>x));
        let my = Math.min(...shape.map(([_,y])=>y));
        for (let [dx, dy] of shape) {
            drawBlock(holdCtx, dx-mx, dy-my, hold, 20);
        }
    }
    // NEXT
    nextCtx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
    for (let i=0; i<4; i++) {
        const nextType = queue[i];
        if (!nextType) continue;
        const shape = TETROMINOS[nextType][0];
        let mx = Math.min(...shape.map(([x])=>x));
        let my = Math.min(...shape.map(([_,y])=>y));
        for (let [dx, dy] of shape) {
            drawBlock(nextCtx, dx-mx, dy-my+i*2.1, nextType, 20);
        }
    }
    // INFO
    document.getElementById('score').textContent = "SCORE: " + score;
    document.getElementById('lines').textContent = "LINES: " + lines;
    document.getElementById('ren').textContent = "REN: " + (ren>=0?ren:0);
    document.getElementById('garbage').textContent = "GARBAGE: " + garbage;
}

// --- 入力 ---
let softDrop = false;
document.addEventListener('keydown', (e)=>{
    if (gameOverFlag) return;
    switch(e.code) {
        case 'ArrowLeft': move(-1,0); break;
        case 'ArrowRight': move(1,0); break;
        case 'ArrowDown': softDrop = true; break;
        case 'Space': hardDrop(); break;
        case 'ArrowUp': rotate(1); break;
        case 'KeyZ': rotate(-1); break;
        case 'KeyC': holdTetromino(); break;
    }
    draw();
});
document.addEventListener('keyup', (e)=>{
    if (e.code === 'ArrowDown') softDrop = false;
});

// --- ゲームループ ---
let dropCounter = 0;
function update() {
    if (gameOverFlag) return;
    dropCounter += softDrop ? GRAVITY_SOFT : GRAVITY_NORM;
    if (dropCounter >= 1) {
        if (!move(0, 1)) place();
        dropCounter = 0;
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