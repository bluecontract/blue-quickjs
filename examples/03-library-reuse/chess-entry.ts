import { Chess } from 'chess.js';

const game = new Chess();
game.move('e4');
game.move('e5');

export default game.move('e2e6') !== null;
