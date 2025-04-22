class Game2048 {
    constructor() {
        this.gridSize = 4;
        this.startTiles = 2;
        this.grid = new Grid(this.gridSize);
        this.score = 0;
        this.bestScore = parseInt(localStorage.getItem('bestScore')) || 0;
        this.over = false;
        this.won = false;
        this.keepPlaying = false;

        // DOM elements
        this.scoreContainer = document.querySelector('.score-container');
        this.bestContainer = document.querySelector('.best-container');
        this.messageContainer = document.querySelector('.game-message');
        this.tileContainer = document.querySelector('.tile-container');

        // Initialize
        this.inputManager = new InputManager();
        this.setup();

        // Event listeners
        this.inputManager.on('move', this.move.bind(this));
        this.inputManager.on('restart', this.restart.bind(this));
        this.inputManager.on('keepPlaying', this.continueGame.bind(this));
    }

    // Initialize game
    setup() {
        this.grid = new Grid(this.gridSize);
        this.score = 0;
        this.over = false;
        this.won = false;
        this.keepPlaying = false;
        this.updateScore();
        this.clearMessage();
        this.clearTiles();
        this.addStartTiles();
    }

    // Add initial tiles
    addStartTiles() {
        for (let i = 0; i < this.startTiles; i++) {
            this.addRandomTile();
        }
    }

    // Add random tile
    addRandomTile() {
        if (this.grid.cellsAvailable()) {
            const value = Math.random() < 0.9 ? 2 : 4;
            const tile = new Tile(this.grid.randomAvailableCell(), value);
            this.grid.insertTile(tile);
            this.addTileElement(tile);
        }
    }

    // Add tile DOM element
    addTileElement(tile) {
        const element = document.createElement('div');
        const position = tile.previousPosition || tile.position;
        element.classList.add('tile', `tile-${tile.value}`);
        element.textContent = tile.value;
        
        // Define constants
        const cellSize = 100; // Cell size
        const cellGap = 15;   // Cell gap
        
        // Calculate x coordinate: 
        const x = position.x * (cellSize + cellGap);
        // Calculate y coordinate:
        const y = position.y * (cellSize + cellGap);
        
        // Set position
        element.style.left = x + 'px';
        element.style.top = y + 'px';
        
        this.tileContainer.appendChild(element);
        tile.element = element;

        if (tile.previousPosition) {
            window.requestAnimationFrame(() => {
                const newX = tile.position.x * (cellSize + cellGap);
                const newY = tile.position.y * (cellSize + cellGap);
                element.style.left = newX + 'px';
                element.style.top = newY + 'px';
            });
        }
    }

    // Move tiles
    move(direction) {
        if (this.over || (this.won && !this.keepPlaying)) return;

        const vector = this.getVector(direction);
        const traversals = this.buildTraversals(vector);
        let moved = false;

        this.prepareTiles();

        traversals.x.forEach(x => {
            traversals.y.forEach(y => {
                const cell = { x, y };
                const tile = this.grid.cellContent(cell);

                if (tile) {
                    const positions = this.findFarthestPosition(cell, vector);
                    const next = this.grid.cellContent(positions.next);

                    if (next && next.value === tile.value && !next.merged) {
                        const merged = new Tile(positions.next, tile.value * 2);
                        merged.merged = [tile, next];

                        this.grid.removeTile(tile);
                        this.grid.removeTile(next);
                        this.grid.insertTile(merged);

                        tile.updatePosition(positions.next);

                        this.score += merged.value;
                        if (merged.value === 2048) this.won = true;
                    } else {
                        this.moveTile(tile, positions.farthest);
                    }

                    if (!this.positionsEqual(cell, tile.position)) {
                        moved = true;
                    }
                }
            });
        });

        if (moved) {
            this.addRandomTile();
            if (!this.movesAvailable()) {
                this.over = true;
            }
            this.updateScore();
            this.updateDOM();
        }
    }

    // Prepare tiles for movement
    prepareTiles() {
        this.grid.eachCell((x, y, tile) => {
            if (tile) {
                tile.merged = null;
                tile.savePosition();
            }
        });
    }

    // Move single tile
    moveTile(tile, cell) {
        this.grid.cells[tile.position.x][tile.position.y] = null;
        this.grid.cells[cell.x][cell.y] = tile;
        tile.updatePosition(cell);
    }

    // Get movement direction vector
    getVector(direction) {
        const map = {
            0: { x: 0, y: -1 },  // Up
            1: { x: 1, y: 0 },   // Right
            2: { x: 0, y: 1 },   // Down
            3: { x: -1, y: 0 }   // Left
        };
        return map[direction];
    }

    // Build traversal sequence
    buildTraversals(vector) {
        const traversals = { x: [], y: [] };
        for (let i = 0; i < this.gridSize; i++) {
            traversals.x.push(i);
            traversals.y.push(i);
        }
        if (vector.x === 1) traversals.x = traversals.x.reverse();
        if (vector.y === 1) traversals.y = traversals.y.reverse();
        return traversals;
    }

    // Find farthest movable position
    findFarthestPosition(cell, vector) {
        let previous;
        do {
            previous = cell;
            cell = {
                x: previous.x + vector.x,
                y: previous.y + vector.y
            };
        } while (this.grid.withinBounds(cell) && this.grid.cellAvailable(cell));

        return {
            farthest: previous,
            next: cell
        };
    }

    // Compare positions
    positionsEqual(first, second) {
        return first.x === second.x && first.y === second.y;
    }

    // Update score
    updateScore() {
        this.scoreContainer.textContent = this.score;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            localStorage.setItem('bestScore', this.bestScore);
            this.bestContainer.textContent = this.bestScore;
        }
    }

    // Check if there are available moves
    movesAvailable() {
        return this.grid.cellsAvailable() || this.tileMatchesAvailable();
    }

    // Check if there are tile matches
    tileMatchesAvailable() {
        for (let x = 0; x < this.gridSize; x++) {
            for (let y = 0; y < this.gridSize; y++) {
                const tile = this.grid.cellContent({ x, y });

                if (tile) {
                    for (let direction = 0; direction < 4; direction++) {
                        const vector = this.getVector(direction);
                        const cell = { x: x + vector.x, y: y + vector.y };
                        const other = this.grid.cellContent(cell);

                        if (other && other.value === tile.value) {
                            return true;
                        }
                    }
                }
            }
        }
        return false;
    }

    // Clear tiles
    clearTiles() {
        this.tileContainer.innerHTML = '';
    }

    // Clear message
    clearMessage() {
        this.messageContainer.style.display = 'none';
    }

    // Show message
    message(won) {
        this.messageContainer.style.display = 'flex';
        this.messageContainer.querySelector('p').textContent = won ? 'You Win!' : 'Game Over!';
    }

    // Restart game
    restart() {
        this.updateScore();
        this.setup();
    }

    // Continue game
    continueGame() {
        this.keepPlaying = true;
        this.clearMessage();
    }

    // Update game state
    updateDOM() {
        requestAnimationFrame(() => {
            this.clearTiles();
            this.grid.cells.forEach((column, x) => {
                column.forEach((tile, y) => {
                    if (tile) {
                        this.addTileElement(tile);
                    }
                });
            });

            if (this.over) {
                this.updateScore();
                this.message(false);
            } else if (this.won && !this.keepPlaying) {
                this.updateScore();
                this.message(true);
            }
        });
    }
}

// Grid class
class Grid {
    constructor(size) {
        this.size = size;
        this.cells = this.empty();
    }

    // Create empty grid
    empty() {
        const cells = [];
        for (let x = 0; x < this.size; x++) {
            const row = cells[x] = [];
            for (let y = 0; y < this.size; y++) {
                row.push(null);
            }
        }
        return cells;
    }

    // Return available cell list
    availableCells() {
        const cells = [];
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                if (!this.cells[x][y]) {
                    cells.push({x, y});
                }
            }
        }
        return cells;
    }

    // Check if there are available cells
    cellsAvailable() {
        return !!this.availableCells().length;
    }

    // Randomly return an available cell
    randomAvailableCell() {
        const cells = this.availableCells();
        if (cells.length) {
            return cells[Math.floor(Math.random() * cells.length)];
        }
    }

    // Check if position is within grid
    withinBounds(position) {
        return position.x >= 0 && position.x < this.size &&
               position.y >= 0 && position.y < this.size;
    }

    // Insert tile into cell
    insertTile(tile) {
        this.cells[tile.position.x][tile.position.y] = tile;
    }

    // Remove tile from cell
    removeTile(tile) {
        this.cells[tile.position.x][tile.position.y] = null;
    }

    eachCell(callback) {
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                callback(x, y, this.cells[x][y]);
            }
        }
    }

    cellAvailable(cell) {
        return !this.cellContent(cell);
    }

    cellContent(cell) {
        if (this.withinBounds(cell)) {
            return this.cells[cell.x][cell.y];
        }
        return null;
    }
}

// Tile class
class Tile {
    constructor(position, value) {
        this.position = position;
        this.value = value;
        this.previousPosition = null;
        this.merged = null;
    }

    // Save current position
    savePosition() {
        this.previousPosition = {x: this.position.x, y: this.position.y};
    }

    // Update position
    updatePosition(position) {
        this.position = {x: position.x, y: position.y};
    }
}

// InputManager class
class InputManager {
    constructor() {
        this.events = {};
        this.listen();
    }

    on(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    }

    emit(event, data) {
        const callbacks = this.events[event];
        if (callbacks) {
            callbacks.forEach(callback => callback(data));
        }
    }

    listen() {
        const map = {
            'ArrowUp': 0,
            'ArrowRight': 1,
            'ArrowDown': 2,
            'ArrowLeft': 3,
            'w': 0,
            'd': 1,
            's': 2,
            'a': 3,
            'W': 0,
            'D': 1,
            'S': 2,
            'A': 3
        };

        document.addEventListener('keydown', event => {
            const mapped = map[event.key];
            if (mapped !== undefined) {
                event.preventDefault();
                this.emit('move', mapped);
            }
        });

        // 为所有retry-button添加事件监听
        const retryButtons = document.querySelectorAll('.retry-button');
        retryButtons.forEach(button => {
            button.addEventListener('click', () => {
                this.emit('restart');
            });
        });

        // Add continue game button event
        const keepPlaying = document.querySelector('.keep-playing-button');
        if (keepPlaying) {
            keepPlaying.addEventListener('click', () => {
                this.emit('keepPlaying');
            });
        }
    }
}

// Launch game
window.requestAnimationFrame(() => {
    new Game2048();
}); 