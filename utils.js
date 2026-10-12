// Helper murni (tanpa import GNOME) supaya bisa dipakai extension.js dan prefs.js.

/** "bbca" -> "BBCA.JK", "ihsg" -> "^JKSE", "^GSPC"/"BBCA.JK" dibiarkan. */
export function normalize(raw) {
    const s = String(raw ?? '').trim().toUpperCase();
    if (!s)
        return null;
    if (s === 'IHSG' || s === 'JCI')
        return '^JKSE';
    if (/[\^.=]/.test(s))
        return s;
    return `${s}.JK`;
}

export function displayName(sym) {
    if (sym === '^JKSE')
        return 'IHSG';
    return sym.endsWith('.JK') ? sym.slice(0, -3) : sym;
}

export const digitsFor = sym => (sym.startsWith('^') ? 2 : 0);

export function fmt(n, digits = 2) {
    return n.toLocaleString('id-ID', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

export function timeWIB(unixSeconds) {
    return new Date(unixSeconds * 1000).toLocaleTimeString('en-GB', {timeZone: 'Asia/Jakarta'});
}
