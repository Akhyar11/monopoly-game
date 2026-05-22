import { DEFAULT_GAME_CONFIG, GameConfig, getStoredGameConfig } from './db';

let gameConfigCache: GameConfig = DEFAULT_GAME_CONFIG;

export const loadGameConfigCache = async () => {
  gameConfigCache = await getStoredGameConfig();
  return gameConfigCache;
};

export const getGameConfig = () => gameConfigCache;

export const setGameConfigCache = (config: GameConfig) => {
  gameConfigCache = config;
};
