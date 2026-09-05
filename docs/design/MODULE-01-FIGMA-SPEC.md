# Module 01 Figma implementation specification

## Grid
- Desktop authenticated shell: 255 px sidebar + fluid content.
- Top utility bar: 64 px.
- Page max width: 1600 px.
- Main content padding: 30–32 px desktop, 16 px mobile.

## Surfaces
- Primary page canvas: `#F7F9FC`.
- Main cards and sidebar: `#FFFFFF`.
- Card border: `#E7EBF2`.
- Primary action: `#155EEF`.
- Card radius: 12–13 px; modal/drawer 14–18 px.
- Shadows are intentionally subtle and secondary to borders.

## Navigation hierarchy
COMMAND → CONTENT OPERATIONS → ADMINISTRATION. Later modules are added to these groups without changing shell structure.

## Form behavior
Input heights 44 px on authentication/settings screens. Focus uses blue border + low-opacity focus ring. Disabled values use light neutral fill.

## Responsive
At ≤760 px the desktop sidebar collapses; page actions stack; statistics and profile forms become single-column; data tables horizontally scroll.
