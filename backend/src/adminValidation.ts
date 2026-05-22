import { GameConfig } from './db';
import { Tile } from './types';

const TILE_TYPES: Tile['type'][] = ['go', 'property', 'railroad', 'utility', 'tax', 'chance', 'chest', 'jail', 'gotojail', 'parking'];
const VERSION_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,127}$/;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isNonNegativeInteger = (value: unknown) => Number.isInteger(value) && Number(value) >= 0;
const isPositiveInteger = (value: unknown) => Number.isInteger(value) && Number(value) > 0;

export const validateVersionName = (value: unknown): string | null => {
  if (typeof value !== 'string') return 'Version name must be a string';
  const trimmed = value.trim();
  if (!VERSION_NAME_PATTERN.test(trimmed)) {
    return 'Version name must be 2-128 chars and use only letters, numbers, dot, dash, or underscore';
  }
  return null;
};

export const validateGameConfig = (value: unknown): { valid: true; config: GameConfig } | { valid: false; errors: string[] } => {
  if (!isPlainObject(value)) {
    return { valid: false, errors: ['Game config payload must be an object'] };
  }

  const featureFlags = value.featureFlags;
  const errors: string[] = [];
  if (!isNonNegativeInteger(value.initialBalance)) errors.push('initialBalance must be a non-negative integer');
  if (!isNonNegativeInteger(value.passGoReward)) errors.push('passGoReward must be a non-negative integer');
  if (!isPositiveInteger(value.cooldownMs)) errors.push('cooldownMs must be a positive integer');
  if (!isPositiveInteger(value.propertyDecisionMs)) errors.push('propertyDecisionMs must be a positive integer');
  if (!isPositiveInteger(value.debtDecisionMs)) errors.push('debtDecisionMs must be a positive integer');
  if (!isPositiveInteger(value.tradeExpiryMs)) errors.push('tradeExpiryMs must be a positive integer');
  if (!isNonNegativeInteger(value.jailFee)) errors.push('jailFee must be a non-negative integer');

  if (!isPlainObject(featureFlags)) {
    errors.push('featureFlags must be an object');
  } else {
    if (typeof featureFlags.auction !== 'boolean') errors.push('featureFlags.auction must be a boolean');
    if (typeof featureFlags.trade !== 'boolean') errors.push('featureFlags.trade must be a boolean');
    if (typeof featureFlags.mortgage !== 'boolean') errors.push('featureFlags.mortgage must be a boolean');
    if (typeof featureFlags.housesHotels !== 'boolean') errors.push('featureFlags.housesHotels must be a boolean');
  }

  const sfx = value.sfx as Record<string, unknown> | undefined;
  if (!isPlainObject(sfx)) {
    // Graceful fallback if no sfx object exists
    value.sfx = { rollDice: '', buyProperty: '', payRent: '', bankrupt: '', jail: '', cardDrawn: '', passGo: '' };
  } else {
    if (sfx.rollDice !== undefined && typeof sfx.rollDice !== 'string') errors.push('sfx.rollDice must be a string');
    if (sfx.buyProperty !== undefined && typeof sfx.buyProperty !== 'string') errors.push('sfx.buyProperty must be a string');
    if (sfx.payRent !== undefined && typeof sfx.payRent !== 'string') errors.push('sfx.payRent must be a string');
    if (sfx.bankrupt !== undefined && typeof sfx.bankrupt !== 'string') errors.push('sfx.bankrupt must be a string');
    if (sfx.jail !== undefined && typeof sfx.jail !== 'string') errors.push('sfx.jail must be a string');
    if (sfx.cardDrawn !== undefined && typeof sfx.cardDrawn !== 'string') errors.push('sfx.cardDrawn must be a string');
    if (sfx.passGo !== undefined && typeof sfx.passGo !== 'string') errors.push('sfx.passGo must be a string');
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const safeSfx = isPlainObject(value.sfx) ? value.sfx : {};

  return {
    valid: true,
    config: {
      initialBalance: Number(value.initialBalance),
      passGoReward: Number(value.passGoReward),
      cooldownMs: Number(value.cooldownMs),
      propertyDecisionMs: Number(value.propertyDecisionMs),
      debtDecisionMs: Number(value.debtDecisionMs),
      tradeExpiryMs: Number(value.tradeExpiryMs),
      jailFee: Number(value.jailFee),
      featureFlags: {
        auction: Boolean((featureFlags as Record<string, unknown>).auction),
        trade: Boolean((featureFlags as Record<string, unknown>).trade),
        mortgage: Boolean((featureFlags as Record<string, unknown>).mortgage),
        housesHotels: Boolean((featureFlags as Record<string, unknown>).housesHotels),
      },
      sfx: {
        rollDice: String(safeSfx.rollDice || ''),
        buyProperty: String(safeSfx.buyProperty || ''),
        payRent: String(safeSfx.payRent || ''),
        bankrupt: String(safeSfx.bankrupt || ''),
        jail: String(safeSfx.jail || ''),
        cardDrawn: String(safeSfx.cardDrawn || ''),
        passGo: String(safeSfx.passGo || ''),
      },
    },
  };
};

export const validateBoardTemplate = (value: unknown): { valid: true; board: Tile[] } | { valid: false; errors: string[] } => {
  if (!Array.isArray(value) || value.length === 0) {
    return { valid: false, errors: ['Board payload must be a non-empty array'] };
  }

  const errors: string[] = [];
  const seenIds = new Set<string>();
  const goTiles = new Set<number>();
  const jailTiles = new Set<number>();
  const gotoJailTiles = new Set<number>();

  value.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      errors.push(`Tile ${index} must be an object`);
      return;
    }

    const tile = entry as Record<string, unknown>;
    if (typeof tile.id !== 'string' || !tile.id.trim()) {
      errors.push(`Tile ${index} must have a non-empty id`);
    } else if (seenIds.has(tile.id)) {
      errors.push(`Tile id "${tile.id}" is duplicated`);
    } else {
      seenIds.add(tile.id);
    }

    if (!Number.isInteger(tile.index) || Number(tile.index) !== index) {
      errors.push(`Tile ${index} must keep index ${index}`);
    }

    if (typeof tile.name !== 'string' || !tile.name.trim()) {
      errors.push(`Tile ${index} must have a non-empty name`);
    }

    if (typeof tile.type !== 'string' || !TILE_TYPES.includes(tile.type as Tile['type'])) {
      errors.push(`Tile ${index} has invalid type`);
      return;
    }

    if (tile.type === 'go') goTiles.add(index);
    if (tile.type === 'jail') jailTiles.add(index);
    if (tile.type === 'gotojail') gotoJailTiles.add(index);

    if (tile.ownerPlayerId !== undefined && tile.ownerPlayerId !== null && tile.ownerPlayerId !== '') {
      errors.push(`Tile ${index} cannot have ownerPlayerId in a published board template`);
    }
    if (tile.isMortgaged !== undefined && tile.isMortgaged !== false) {
      errors.push(`Tile ${index} cannot start mortgaged in a published board template`);
    }
    if (tile.buildingLevel !== undefined && Number(tile.buildingLevel) !== 0) {
      errors.push(`Tile ${index} cannot start with buildings in a published board template`);
    }

    if (tile.type === 'property') {
      if (!isPositiveInteger(tile.price)) errors.push(`Property tile ${index} must have a positive price`);
      if (!isPositiveInteger(tile.rent)) errors.push(`Property tile ${index} must have a positive rent`);
      if (typeof tile.colorGroup !== 'string' || !tile.colorGroup.trim()) errors.push(`Property tile ${index} must have a colorGroup`);
      if (!isPositiveInteger(tile.houseCost)) errors.push(`Property tile ${index} must have a positive houseCost`);
      if (tile.hotelCost !== undefined && !isPositiveInteger(tile.hotelCost)) errors.push(`Property tile ${index} must have a positive hotelCost`);
      if (tile.rent1House !== undefined && !isPositiveInteger(tile.rent1House)) errors.push(`Property tile ${index} must have a positive rent1House`);
      if (tile.rent2Houses !== undefined && !isPositiveInteger(tile.rent2Houses)) errors.push(`Property tile ${index} must have a positive rent2Houses`);
      if (tile.rent3Houses !== undefined && !isPositiveInteger(tile.rent3Houses)) errors.push(`Property tile ${index} must have a positive rent3Houses`);
      if (tile.rent4Houses !== undefined && !isPositiveInteger(tile.rent4Houses)) errors.push(`Property tile ${index} must have a positive rent4Houses`);
      if (tile.rentHotel !== undefined && !isPositiveInteger(tile.rentHotel)) errors.push(`Property tile ${index} must have a positive rentHotel`);
    }

    if (tile.type === 'railroad' || tile.type === 'utility') {
      if (!isPositiveInteger(tile.price)) errors.push(`${tile.type} tile ${index} must have a positive price`);
      if (!isPositiveInteger(tile.rent)) errors.push(`${tile.type} tile ${index} must have a positive rent`);
    }

    if (tile.type === 'tax' && !isPositiveInteger(tile.taxAmount)) {
      errors.push(`Tax tile ${index} must have a positive taxAmount`);
    }
  });

  if (goTiles.size !== 1) errors.push('Board must contain exactly one GO tile');
  if (jailTiles.size !== 1) errors.push('Board must contain exactly one jail tile');
  if (gotoJailTiles.size !== 1) errors.push('Board must contain exactly one gotojail tile');
  if (value.length % 4 !== 0) errors.push('Board size must be a multiple of 4');

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, board: value as Tile[] };
};
