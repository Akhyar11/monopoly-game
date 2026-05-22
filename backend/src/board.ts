import { Tile } from './types';

export const DEFAULT_BOARD_TEMPLATE: Tile[] = [
    { id: 't0', index: 0, name: 'GO', type: 'go' },
    { id: 't1', index: 1, name: 'Jakarta', type: 'property', price: 60, rent: 10, colorGroup: 'brown', houseCost: 50, buildingLevel: 0, isMortgaged: false },
    { id: 't2', index: 2, name: 'Community Chest', type: 'chest' },
    { id: 't3', index: 3, name: 'Bandung', type: 'property', price: 60, rent: 12, colorGroup: 'brown', houseCost: 50, buildingLevel: 0, isMortgaged: false },
    { id: 't4', index: 4, name: 'Income Tax', type: 'tax', taxAmount: 400 },
    { id: 't5', index: 5, name: 'Gambir Station', type: 'railroad', price: 200, rent: 50, buildingLevel: 0, isMortgaged: false },
    { id: 't6', index: 6, name: 'Surabaya', type: 'property', price: 100, rent: 20, colorGroup: 'lightBlue', houseCost: 50, buildingLevel: 0, isMortgaged: false },
    { id: 't7', index: 7, name: 'Jail (Just Visiting)', type: 'jail' },
    { id: 't8', index: 8, name: 'Semarang', type: 'property', price: 100, rent: 20, colorGroup: 'lightBlue', houseCost: 50, buildingLevel: 0, isMortgaged: false },
    { id: 't9', index: 9, name: 'Chance', type: 'chance' },
    { id: 't10', index: 10, name: 'Yogyakarta', type: 'property', price: 120, rent: 25, colorGroup: 'lightBlue', houseCost: 50, buildingLevel: 0, isMortgaged: false },
    { id: 't11', index: 11, name: 'PLN', type: 'utility', price: 150, rent: 30, buildingLevel: 0, isMortgaged: false },
    { id: 't12', index: 12, name: 'Solo', type: 'property', price: 140, rent: 30, colorGroup: 'pink', houseCost: 100, buildingLevel: 0, isMortgaged: false },
    { id: 't13', index: 13, name: 'Malang', type: 'property', price: 160, rent: 35, colorGroup: 'pink', houseCost: 100, buildingLevel: 0, isMortgaged: false },
    { id: 't14', index: 14, name: 'Free Parking', type: 'parking' },
    { id: 't15', index: 15, name: 'Bali', type: 'property', price: 180, rent: 40, colorGroup: 'orange', houseCost: 100, buildingLevel: 0, isMortgaged: false },
    { id: 't16', index: 16, name: 'Community Chest', type: 'chest' },
    { id: 't17', index: 17, name: 'Lombok', type: 'property', price: 200, rent: 45, colorGroup: 'orange', houseCost: 100, buildingLevel: 0, isMortgaged: false },
    { id: 't18', index: 18, name: 'Pasar Senen Station', type: 'railroad', price: 200, rent: 50, buildingLevel: 0, isMortgaged: false },
    { id: 't19', index: 19, name: 'Makassar', type: 'property', price: 220, rent: 50, colorGroup: 'red', houseCost: 150, buildingLevel: 0, isMortgaged: false },
    { id: 't20', index: 20, name: 'Chance', type: 'chance' },
    { id: 't21', index: 21, name: 'Go To Jail', type: 'gotojail' },
    { id: 't22', index: 22, name: 'Manado', type: 'property', price: 260, rent: 60, colorGroup: 'yellow', houseCost: 150, buildingLevel: 0, isMortgaged: false },
    { id: 't23', index: 23, name: 'Medan', type: 'property', price: 280, rent: 65, colorGroup: 'yellow', houseCost: 150, buildingLevel: 0, isMortgaged: false },
    { id: 't24', index: 24, name: 'PDAM', type: 'utility', price: 150, rent: 30, buildingLevel: 0, isMortgaged: false },
    { id: 't25', index: 25, name: 'Batam', type: 'property', price: 300, rent: 75, colorGroup: 'green', houseCost: 200, buildingLevel: 0, isMortgaged: false },
    { id: 't26', index: 26, name: 'Luxury Tax', type: 'tax', taxAmount: 300 },
    { id: 't27', index: 27, name: 'Papua', type: 'property', price: 400, rent: 100, colorGroup: 'darkBlue', houseCost: 200, buildingLevel: 0, isMortgaged: false },
];

let activeBoardTemplate: Tile[] = DEFAULT_BOARD_TEMPLATE.map((tile) => ({ ...tile }));

export const setBoardTemplate = (template: Tile[]) => {
  activeBoardTemplate = template.map((tile) => ({ ...tile }));
};

export const createBoard = (): Tile[] => {
  return activeBoardTemplate.map((tile) => ({ ...tile }));
};
