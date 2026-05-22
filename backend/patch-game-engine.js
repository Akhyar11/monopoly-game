const fs = require('fs');
let code = fs.readFileSync('src/gameEngine.ts', 'utf8');

if (!code.includes("import { getDbPool } from './db';")) {
  code = code.replace("import { getGameConfig } from './configStore';", "import { getGameConfig } from './configStore';\nimport { getDbPool } from './db';\nimport { RowDataPacket } from 'mysql2/promise';\nimport { CardAction } from './types';");
}

code = code.replace(
  "rollDice(code: string, playerId: string): { room?: Room; success: boolean; dice1?: number; dice2?: number; message?: string; tile?: Tile; cardDrawn?: { title: string; message: string } } {",
  "async rollDice(code: string, playerId: string): Promise<{ room?: Room; success: boolean; dice1?: number; dice2?: number; message?: string; tile?: Tile; cardDrawn?: { title: string; message: string } }> {"
);

code = code.replace(
  "const { cardDrawn } = this.resolveTileAction(room, player, currentTile, roll);",
  "const { cardDrawn } = await this.resolveTileAction(room, player, currentTile, roll);"
);

const resolveTileActionRegex = /private resolveTileAction\(room: Room, player: Player, tile: Tile, rollTotal: number\): \{ cardDrawn\?: \{ title: string; message: string \} \} \{/;
code = code.replace(
  resolveTileActionRegex,
  "private async resolveTileAction(room: Room, player: Player, tile: Tile, rollTotal: number): Promise<{ cardDrawn?: { title: string; message: string } }> {"
);

const chanceLogicRegex = /case 'chance':\s*case 'chest': \{\s*const gain = Math\.random\(\) < 0\.5;\s*const amount = 50;\s*if \(gain\) \{\s*player\.balance \+= amount;\s*cardDrawn = \{ title: tile\.name, message: 'You found \$50!' \};\s*this\.addEventLog\(room, `\$\{player\.name\} found 50 in \$\{tile\.name\}`\);\s*\} else \{\s*player\.balance -= amount;\s*cardDrawn = \{ title: tile\.name, message: 'You lost \$50!' \};\s*this\.addEventLog\(room, `\$\{player\.name\} lost 50 in \$\{tile\.name\}`\);\s*this\.evaluateSolvency\(room, player\);\s*\}\s*break;\s*\}/s;

const newChanceLogic = `case 'chance':
      case 'chest': {
        const type = tile.type === 'chest' ? 'community_chest' : 'chance';
        try {
          const db = getDbPool();
          const [rows] = await db.query<RowDataPacket[]>(\`
            SELECT title, message, action_json 
            FROM game_cards 
            WHERE type = ? 
            ORDER BY RAND() 
            LIMIT 1
          \`, [type]);

          if (rows.length > 0) {
            const card = rows[0];
            const action = JSON.parse(card.action_json) as CardAction;
            cardDrawn = { title: card.title, message: card.message };
            
            if (action.type === 'money') {
              player.balance += action.amount || 0;
              this.addEventLog(room, \`\${player.name} drew a card: \${card.title}. (Money change: \$\${action.amount})\`);
              if ((action.amount || 0) < 0) {
                 this.evaluateSolvency(room, player);
              }
            } else if (action.type === 'move') {
              if (action.position !== undefined) {
                 player.position = action.position;
              } else if (action.relativePosition !== undefined) {
                 player.position = (player.position + action.relativePosition + room.board.length) % room.board.length;
              }
              this.addEventLog(room, \`\${player.name} drew a card: \${card.title}. Moved to tile \${player.position}\`);
              const newTile = room.board[player.position];
              if (newTile.type !== 'chance' && newTile.type !== 'chest') {
                 await this.resolveTileAction(room, player, newTile, rollTotal);
              }
            } else if (action.type === 'jail') {
               player.position = room.board.findIndex((boardTile) => boardTile.type === 'jail');
               player.status = 'jailed';
               this.addEventLog(room, \`\${player.name} drew a card: \${card.title}. Went to jail!\`);
            }
          } else {
             // Fallback
             const gain = Math.random() < 0.5;
             const amount = 50;
             if (gain) {
               player.balance += amount;
               cardDrawn = { title: tile.name, message: 'You found $50!' };
               this.addEventLog(room, \`\${player.name} found 50 in \${tile.name}\`);
             } else {
               player.balance -= amount;
               cardDrawn = { title: tile.name, message: 'You lost $50!' };
               this.addEventLog(room, \`\${player.name} lost 50 in \${tile.name}\`);
               this.evaluateSolvency(room, player);
             }
          }
        } catch (e) {
          console.error('Failed to draw card:', e);
        }
        break;
      }`;

code = code.replace(chanceLogicRegex, newChanceLogic);
fs.writeFileSync('src/gameEngine.ts', code);
