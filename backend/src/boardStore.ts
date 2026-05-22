import { DEFAULT_BOARD_TEMPLATE, setBoardTemplate } from './board';
import { getStoredPublishedBoard } from './db';
import { Tile } from './types';

let boardTemplateCache: Tile[] = DEFAULT_BOARD_TEMPLATE.map((tile) => ({ ...tile }));

export const loadBoardTemplateCache = async () => {
  boardTemplateCache = await getStoredPublishedBoard();
  setBoardTemplate(boardTemplateCache);
  return boardTemplateCache;
};

export const getBoardTemplate = () => boardTemplateCache.map((tile) => ({ ...tile }));

export const setBoardTemplateCache = (board: Tile[]) => {
  boardTemplateCache = board.map((tile) => ({ ...tile }));
  setBoardTemplate(boardTemplateCache);
};
