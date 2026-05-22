const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env' });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'monopoly_admin'
  });

  try {
    await connection.query('ALTER TABLE board_versions ADD COLUMN skin_id BIGINT UNSIGNED NULL');
    console.log('Column skin_id added.');
  } catch(e) {
    console.log('Error or already exists:', e.message);
  }
  
  await connection.end();
}
run();
