const test = require('node:test');
const assert = require('node:assert/strict');

const { GameEngine } = require('../src/gameEngine');

const createStartedRoom = () => {
  const engine = new GameEngine();
  const host = engine.createRoom('p1', 'Host', '🚗');
  const roomCode = host.code;

  engine.joinRoom(roomCode, 'p2', 'Guest', '🎩');
  const started = engine.startGame(roomCode, 'p1');
  assert.equal(started, true);

  const room = engine.getRoom(roomCode);
  assert.ok(room);
  return { engine, room, roomCode };
};

const getPlayer = (room, playerId) => {
  const player = room.players.find((entry) => entry.id === playerId);
  assert.ok(player);
  return player;
};

const getTile = (room, tileId) => {
  const tile = room.board.find((entry) => entry.id === tileId);
  assert.ok(tile);
  return tile;
};

test('property rent doubles when owner has full color set', () => {
  const { engine, room } = createStartedRoom();
  const owner = getPlayer(room, 'p1');

  const jakarta = getTile(room, 't1');
  const bandung = getTile(room, 't3');
  jakarta.ownerPlayerId = owner.id;
  bandung.ownerPlayerId = owner.id;
  owner.properties.push(jakarta.id, bandung.id);

  const rent = engine.calculateRent(room, jakarta);
  assert.equal(rent, 20);
});

test('build and sell must stay even across a color group', () => {
  const { engine, room, roomCode } = createStartedRoom();
  const owner = getPlayer(room, 'p1');
  owner.balance = 5000;

  const surabaya = getTile(room, 't6');
  const semarang = getTile(room, 't8');
  const yogya = getTile(room, 't10');

  for (const tile of [surabaya, semarang, yogya]) {
    tile.ownerPlayerId = owner.id;
    owner.properties.push(tile.id);
  }

  let result = engine.buildProperty(roomCode, owner.id, surabaya.id);
  assert.equal(result.success, true);

  result = engine.buildProperty(roomCode, owner.id, surabaya.id);
  assert.equal(result.success, false);
  assert.match(result.message, /Build evenly/);

  assert.equal(engine.buildProperty(roomCode, owner.id, semarang.id).success, true);
  assert.equal(engine.buildProperty(roomCode, owner.id, yogya.id).success, true);
  assert.equal(engine.buildProperty(roomCode, owner.id, surabaya.id).success, true);

  result = engine.sellBuilding(roomCode, owner.id, semarang.id);
  assert.equal(result.success, false);
  assert.match(result.message, /Sell evenly/);
});

test('railroad rent scales with owned stations', () => {
  const { engine, room } = createStartedRoom();
  const owner = getPlayer(room, 'p1');

  const gambir = getTile(room, 't5');
  const pasarSenen = getTile(room, 't18');
  gambir.ownerPlayerId = owner.id;
  pasarSenen.ownerPlayerId = owner.id;
  owner.properties.push(gambir.id, pasarSenen.id);

  const rent = engine.calculateRent(room, gambir);
  assert.equal(rent, 100);
});

test('utility rent depends on dice roll and utility count', () => {
  const { engine, room } = createStartedRoom();
  const owner = getPlayer(room, 'p1');

  const pln = getTile(room, 't11');
  const pdam = getTile(room, 't24');
  pln.ownerPlayerId = owner.id;
  pdam.ownerPlayerId = owner.id;
  owner.properties.push(pln.id, pdam.id);

  const rent = engine.calculateRent(room, pln, 8);
  assert.equal(rent, 80);
});

test('mortgage can rescue a player from debt', () => {
  const { engine, room, roomCode } = createStartedRoom();
  const owner = getPlayer(room, 'p1');
  const jakarta = getTile(room, 't1');

  jakarta.ownerPlayerId = owner.id;
  owner.properties.push(jakarta.id);
  owner.balance = -10;

  engine.enterDebtState(room, owner);
  assert.equal(owner.status, 'in_debt');

  const result = engine.mortgageProperty(roomCode, owner.id, jakarta.id);
  assert.equal(result.success, true);
  assert.equal(owner.balance, 20);
  assert.equal(owner.status, 'cooldown');
});

test('trade moves properties and cash on accept', () => {
  const { engine, room, roomCode } = createStartedRoom();
  const playerOne = getPlayer(room, 'p1');
  const playerTwo = getPlayer(room, 'p2');
  playerOne.balance = 1000;
  playerTwo.balance = 1000;

  const jakarta = getTile(room, 't1');
  const bandung = getTile(room, 't3');
  jakarta.ownerPlayerId = playerOne.id;
  bandung.ownerPlayerId = playerTwo.id;
  playerOne.properties.push(jakarta.id);
  playerTwo.properties.push(bandung.id);

  const sent = engine.sendTradeOffer(roomCode, playerOne.id, {
    toPlayerId: playerTwo.id,
    offeredPropertyIds: [jakarta.id],
    requestedPropertyIds: [bandung.id],
    offeredCash: 100,
    requestedCash: 50,
  });

  assert.equal(sent.success, true);
  assert.ok(sent.offer);

  const accepted = engine.respondTradeOffer(roomCode, playerTwo.id, sent.offer.id, 'accept');
  assert.equal(accepted.success, true);
  assert.equal(jakarta.ownerPlayerId, playerTwo.id);
  assert.equal(bandung.ownerPlayerId, playerOne.id);
  assert.equal(playerOne.balance, 950);
  assert.equal(playerTwo.balance, 1050);
});

  test('rolling doubles gives another roll', () => {
    const { engine, room, roomCode } = createStartedRoom();
    const player = getPlayer(room, 'p1');
  
    assert.ok(player.rollsLeft > 0);
    assert.equal(player.consecutiveDoubles, 0);

    let result = engine.rollDice(roomCode, player.id);
    assert.equal(result.success, true);
  
    const isDoubles = result.dice1 === result.dice2;
  
    if (isDoubles) {
      assert.equal(player.consecutiveDoubles, 1);
      assert.ok(player.cooldownUntil === null, 'Should not have cooldown with doubles');
      assert.ok(player.rollsLeft >= 0, 'Should retain rolls for next roll');
    }
  });

  test('rolling 3 doubles in a row sends player to jail', () => {
    const { engine, room, roomCode } = createStartedRoom();
    const player = getPlayer(room, 'p1');
  
    player.consecutiveDoubles = 2;

    const jailTilePosition = 10;
  
    let rolls = 0;
    let result = null;

    while (rolls < 200) {
      if (player.rollsLeft <= 0) {
        engine.checkRoundReset(room);
      }
    
      result = engine.rollDice(roomCode, player.id);
      rolls++;
    
      if (result.dice1 === result.dice2) {
        if (player.consecutiveDoubles === 3) {
          assert.equal(player.status, 'jailed');
          assert.equal(player.position, jailTilePosition);
          assert.equal(player.consecutiveDoubles, 0);
          return;
        }
      } else {
        assert.equal(player.consecutiveDoubles, 0);
      }
    }

    assert.fail('Should have rolled 3 doubles within 200 attempts');
  });

  test('non-doubles reset consecutive doubles counter', () => {
    const { engine, room, roomCode } = createStartedRoom();
    const player = getPlayer(room, 'p1');
  
    player.consecutiveDoubles = 2;

    let rolls = 0;

    while (rolls < 200) {
      if (player.rollsLeft <= 0) {
        engine.checkRoundReset(room);
      }

      result = engine.rollDice(roomCode, player.id);
      rolls++;
    
      if (result.dice1 !== result.dice2) {
        assert.equal(player.consecutiveDoubles, 0);
        return;
      }
    }

    assert.fail('Should have rolled non-doubles within 200 attempts');
  });
