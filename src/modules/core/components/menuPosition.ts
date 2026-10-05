// Where an OverflowMenu popover opens relative to its anchor button: below it,
// right edges aligned (the button sits on the trailing edge of the top app
// bar), kept inside the screen. Flips above the anchor when there is no room
// below.

export type Rect = { x: number; y: number; width: number; height: number }
export type Size = { width: number; height: number }

const MENU_SCREEN_MARGIN = 8

export const computeMenuPosition = (
    anchor: Rect,
    screen: Size,
    menu: Size,
    margin: number = MENU_SCREEN_MARGIN
): { top: number; left: number } => {
    const maxLeft = screen.width - margin - menu.width
    const left = Math.max(margin, Math.min(anchor.x + anchor.width - menu.width, maxLeft))

    const below = anchor.y + anchor.height
    const fitsBelow = below + menu.height <= screen.height - margin
    const above = anchor.y - menu.height
    const top = fitsBelow || above < margin ? Math.min(below, screen.height - margin - menu.height) : above

    return { top: Math.max(margin, top), left }
}
