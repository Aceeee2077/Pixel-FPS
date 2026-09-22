import './style.css';
import { Game } from './core/Game';
const game = new Game();
if (import.meta.env.DEV)
    (window as unknown as {
        __game: Game;
    }).__game = game;
