const fs = require('fs');

// Fix AdminPanel.tsx
let adminContent = fs.readFileSync('frontend/src/components/admin/AdminPanel.tsx', 'utf-8');
adminContent = adminContent.replace(/import \{ AdminRoute, DashboardSummary, RoomSummary, PlayerSummary, PlayerDetail, AuditLog, Notice, NoticeTone, AdminUser, GameConfigValue, GameConfigResponse, PublishedBoardResponse, BoardVersionSummary, BoardTile, BoardSkin \} from '\.\/types';/, `import type { AdminRoute, DashboardSummary, RoomSummary, PlayerSummary, PlayerDetail, AuditLog, Notice, NoticeTone, AdminUser, GameConfigValue, GameConfigResponse, PublishedBoardResponse, BoardVersionSummary, BoardTile, BoardSkin } from './types';`);
adminContent = adminContent.replace(/const getTileGridStyle = \([\s\S]*?};\n/, '');
fs.writeFileSync('frontend/src/components/admin/AdminPanel.tsx', adminContent, 'utf-8');

// Fix other files
const filesToFix = [
  'frontend/src/components/admin/constants.ts',
  'frontend/src/components/admin/utils.ts',
  'frontend/src/components/admin/views/AuditLogsView.tsx',
  'frontend/src/components/admin/views/BoardView.tsx',
  'frontend/src/components/admin/views/DashboardView.tsx',
  'frontend/src/components/admin/views/EconomyView.tsx',
  'frontend/src/components/admin/views/PlayersView.tsx',
  'frontend/src/components/admin/views/RoomsView.tsx',
  'frontend/src/components/admin/views/SkinsView.tsx'
];

for (const file of filesToFix) {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/import \{ (.*?) \} from '(.*?)types';/g, "import type { $1 } from '$2types';");
  
  if (file.includes('BoardView.tsx')) {
    content = content.replace(/updateBoardTile: \(key: keyof BoardTile, value: string \| number\) => void;/, 'updateBoardTile: (key: keyof BoardTile, value: string | boolean) => void;');
  }
  
  fs.writeFileSync(file, content, 'utf-8');
}
console.log('Imports and types fixed');
