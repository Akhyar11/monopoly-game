# Admin Panel UI Structure

## Routing

- `/admin/login`
- `/admin`
- `/admin/rooms`
- `/admin/rooms/:code`
- `/admin/players`
- `/admin/players/:id`
- `/admin/economy`
- `/admin/board`
- `/admin/audit-logs`
- `/admin/analytics`

## Shell Layout

### Sidebar

- logo
- Dashboard
- Rooms
- Players
- Economy
- Board
- Audit Logs
- Analytics

### Topbar

- global search
- environment badge
- websocket status
- admin profile menu

### Main Region

- page header
- filters/actions row
- content grid

## Page Breakdown

### `/admin`

#### Header

- title: `Operations Dashboard`
- subtitle: ringkasan sistem live

#### KPI Grid

- active rooms
- online players
- live matches
- active debt cases
- active trades
- active auctions

#### Secondary Panels

- live events
- newest critical rooms
- player connection issues
- quick actions

### `/admin/rooms`

#### Filters

- status
- player count
- search room code

#### Table

- room code
- host
- status
- players
- started at
- duration
- actions

#### Actions Per Row

- inspect
- end
- freeze

### `/admin/rooms/:code`

#### Summary Bar

- room code
- status
- host
- total players
- started at

#### Grid

- left: player cards + tile ownership
- center: board snapshot
- right: trade / debt / auction widgets

#### Lower Section

- live event log
- admin action panel

### `/admin/players`

#### Filters

- search name
- room
- status
- connection state

#### Table

- name
- id
- room
- balance
- properties
- status
- connected
- actions

### `/admin/players/:id`

#### Panels

- identity panel
- current game state
- assets
- admin actions
- action history

### `/admin/economy`

#### Sections

- global config form
- feature toggles
- save/revert controls

### `/admin/board`

#### Layout

- left: tile list
- center: board preview
- right: tile editor

### `/admin/audit-logs`

#### Filters

- admin
- action type
- target type
- date range

#### Table

- timestamp
- actor
- action
- target
- details

### `/admin/analytics`

#### Panels

- game economy charts
- room duration chart
- most profitable properties
- bankruptcy rate
- trade frequency

## Core Components

- `AdminLayout`
- `AdminSidebar`
- `AdminTopbar`
- `KpiCard`
- `StatusBadge`
- `RoomTable`
- `PlayerTable`
- `LiveEventFeed`
- `BoardSnapshot`
- `TradeOfferWidget`
- `DebtStatusWidget`
- `AuctionWidget`
- `AuditTable`
- `ConfigForm`
- `TileEditorPanel`

## State Strategy

- auth state
- admin websocket status
- filters per page
- room detail live state
- player detail state
- optimistic UI hanya untuk aksi non-destruktif

## Visual Notes

- gunakan data-dense cards
- hindari spacing terlalu longgar
- status harus langsung terbaca
- action kritis selalu merah dan butuh konfirmasi
