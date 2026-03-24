import { Chess } from 'chess.js';

const chess = new Chess();
const legalMoves = chess.moves({ verbose: true });

export default legalMoves.some(
  (move) => move.from === 'e2' && move.to === 'e6',
);
