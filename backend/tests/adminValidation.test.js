const test = require('node:test');
const assert = require('node:assert/strict');

const { DEFAULT_GAME_CONFIG } = require('../src/db');
const { DEFAULT_BOARD_TEMPLATE } = require('../src/board');
const { validateGameConfig, validateBoardTemplate, validateVersionName } = require('../src/adminValidation');

test('validateGameConfig accepts a valid config payload', () => {
  const result = validateGameConfig(DEFAULT_GAME_CONFIG);
  assert.equal(result.valid, true);
});

test('validateGameConfig rejects invalid numbers and flags', () => {
  const result = validateGameConfig({
    ...DEFAULT_GAME_CONFIG,
    cooldownMs: 0,
    featureFlags: { ...DEFAULT_GAME_CONFIG.featureFlags, trade: 'yes' },
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join(' | '), /cooldownMs/);
  assert.match(result.errors.join(' | '), /featureFlags\.trade/);
});

test('validateBoardTemplate accepts the default board', () => {
  const result = validateBoardTemplate(DEFAULT_BOARD_TEMPLATE);
  assert.equal(result.valid, true);
});

test('validateBoardTemplate rejects invalid published board state', () => {
  const brokenBoard = DEFAULT_BOARD_TEMPLATE.map((tile) => ({ ...tile }));
  brokenBoard[1].ownerPlayerId = 'player-1';
  brokenBoard[2].index = 8;
  brokenBoard[4].taxAmount = 0;

  const result = validateBoardTemplate(brokenBoard);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(' | '), /ownerPlayerId/);
  assert.match(result.errors.join(' | '), /index 2/);
  assert.match(result.errors.join(' | '), /taxAmount/);
});

test('validateVersionName rejects invalid version strings', () => {
  assert.equal(validateVersionName('board-v2'), null);
  assert.match(String(validateVersionName(' bad name ')), /Version name/);
});
