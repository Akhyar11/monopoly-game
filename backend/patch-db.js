const fs = require('fs');
let code = fs.readFileSync('src/db.ts', 'utf8');

const tableSql = `
  await db.query(\`
    CREATE TABLE IF NOT EXISTS game_cards (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      type ENUM('chance', 'community_chest') NOT NULL,
      title VARCHAR(128) NOT NULL,
      message TEXT NOT NULL,
      action_json JSON NOT NULL,
      created_by VARCHAR(64) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  \`);
`;

code = code.replace("const [rows] = await db.query<RowDataPacket[]>('SELECT username FROM admin_users');", tableSql + "\n  const [rows] = await db.query<RowDataPacket[]>('SELECT username FROM admin_users');");

fs.writeFileSync('src/db.ts', code);
