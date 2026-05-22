const fs = require('fs');
let content = fs.readFileSync('frontend/src/components/admin/AdminPanel.tsx', 'utf-8');

// 1. Remove types and constants (lines 17 to 251 aprox)
// We will look for `type AdminRoute =` and `const getChangedFields =`
const startTypesIndex = content.indexOf('type AdminRoute =');
const endUtilsIndex = content.indexOf('export const AdminPanel: React.FC = () => {');

const importsToAdd = `import { AdminRoute, DashboardSummary, RoomSummary, PlayerSummary, PlayerDetail, AuditLog, Notice, NoticeTone, AdminUser, GameConfigValue, GameConfigResponse, PublishedBoardResponse, BoardVersionSummary, BoardTile, BoardSkin } from './types';
import { ADMIN_API_URL, ADMIN_STORAGE_KEY, navItems, routeTitle } from './constants';
import { toAdminRoute, navigate, statusTone, formatCountdown, formatDateTime, formatDuration, formatJsonValue, getChangedFields } from './utils';
import { fetchAdmin } from './api';
import { DashboardView } from './views/DashboardView';
import { RoomsView } from './views/RoomsView';
import { PlayersView } from './views/PlayersView';
import { EconomyView } from './views/EconomyView';
import { BoardView } from './views/BoardView';
import { SkinsView } from './views/SkinsView';
import { AuditLogsView } from './views/AuditLogsView';
`;

content = content.slice(0, startTypesIndex) + importsToAdd + '\n' + content.slice(endUtilsIndex);

// 2. Replace render functions with View components inside renderContent
content = content.replace(/const renderDashboard = \(\) => {[\s\S]*?return \([\s\S]*?\);\n  };\n/g, '');
content = content.replace(/const renderRooms = \(\) => \([\s\S]*? \);\n/g, '');
content = content.replace(/const renderPlayers = \(\) => \([\s\S]*? \);\n/g, '');
content = content.replace(/const renderAuditLogs = \(\) => {[\s\S]*?return \([\s\S]*?\);\n  };\n/g, '');
content = content.replace(/const renderEconomy = \(\) => {[\s\S]*?return \([\s\S]*?\);\n  };\n/g, '');
content = content.replace(/const renderBoard = \(\) => {[\s\S]*?return \([\s\S]*?\);\n  };\n/g, '');
content = content.replace(/const renderSkins = \(\) => {[\s\S]*?return \([\s\S]*?\);\n  };\n/g, '');

content = content.replace(/return renderDashboard\(\);/g, `return <DashboardView summary={summary} rooms={rooms} auditLogs={auditLogs} setPath={setPath} />;`);
content = content.replace(/return renderRooms\(\);/g, `return <RoomsView rooms={rooms} selectedRoomSummary={selectedRoomSummary} setSelectedRoomSummary={setSelectedRoomSummary} selectedRoom={selectedRoom} canManageRooms={canManageRooms} handleBroadcast={handleBroadcast} handleForceEnd={handleForceEnd} />;`);
content = content.replace(/return renderPlayers\(\);/g, `return <PlayersView players={players} selectedPlayerId={selectedPlayerId} setSelectedPlayerId={setSelectedPlayerId} selectedPlayer={selectedPlayer} canManageBalances={canManageBalances} canManageCooldowns={canManageCooldowns} canKickPlayers={canKickPlayers} runPlayerAction={runPlayerAction} />;`);
content = content.replace(/return renderEconomy\(\);/g, `return <EconomyView configData={configData} configDraft={configDraft} canManageBalances={canManageBalances} updateConfigNumber={updateConfigNumber} updateConfigFlag={updateConfigFlag} handleSaveConfig={handleSaveConfig} refreshConfig={refreshConfig} renderLoading={renderLoading} />;`);
content = content.replace(/return renderBoard\(\);/g, `return <BoardView boardData={boardData} boardVersions={boardVersions} boardVersionName={boardVersionName} setBoardVersionName={setBoardVersionName} selectedBoardTileId={selectedBoardTileId} setSelectedBoardTileId={setSelectedBoardTileId} selectedBoardTile={selectedBoardTile} canManageBalances={canManageBalances} draggedTileIndex={draggedTileIndex} handleDragStart={handleDragStart} handleDragOver={handleDragOver} handleDrop={handleDrop} handleAddTile={handleAddTile} updateBoardTile={updateBoardTile} handleRemoveTile={handleRemoveTile} handlePublishBoard={handlePublishBoard} handleResetBoardDraft={handleResetBoardDraft} handleClearBoard={handleClearBoard} handleLoadVersion={handleLoadVersion} renderLoading={renderLoading} />;`);
content = content.replace(/return renderSkins\(\);/g, `return <SkinsView boardSkins={boardSkins} handleCreateSkin={handleCreateSkin} handleDeleteSkin={handleDeleteSkin} />;`);
content = content.replace(/return renderAuditLogs\(\);/g, `return <AuditLogsView auditLogs={auditLogs} />;`);

fs.writeFileSync('frontend/src/components/admin/AdminPanel.tsx', content, 'utf-8');
console.log('Refactoring applied');
