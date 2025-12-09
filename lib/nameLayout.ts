export function computeDisplayName(
    firstName: string,
    lastName: string,
    nameAllCaps: boolean,
) {
    const rawFirst = (firstName || '').trim() || 'First'
    const rawLast = (lastName || '').trim() || 'Last'

    const displayFirst = nameAllCaps ? rawFirst.toUpperCase() : rawFirst
    const displayLast = nameAllCaps ? rawLast.toUpperCase() : rawLast

    const maxLineLength = Math.max(displayFirst.length, displayLast.length)

    // Map length to font size – tweak numbers to taste
    let fontSize: number
    if (nameAllCaps) {
        if (maxLineLength <= 12) {

            fontSize = 68
        } else if (maxLineLength <= 18) {
            fontSize = 58
        } else if (maxLineLength <= 24) {
            fontSize = 48
        } else {
            fontSize = 48
        }
    } else {
        if (maxLineLength <= 12) {

            fontSize = 78
        } else if (maxLineLength <= 18) {
            fontSize = 68
        } else if (maxLineLength <= 24) {
            fontSize = 58
        } else {
            fontSize = 48
        }
    }

    return {
        displayFirst,
        displayLast,
        fontSize,
    }
}
