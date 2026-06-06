export function sanitizeText(text) {
    if (text === null || text === undefined) return '';
    try {
        let s = String(text);
        // remove HTML tags
        s = s.replace(/<[^>]*>/g, '');
        // remove any sequence of hashes used by markdown headings
        s = s.replace(/#+/g, ' ');
        // remove common markdown emphasis markers
        s = s.replace(/\*\*|__|\*|_/g, '');
        // convert markdown links [text](url) -> text
        s = s.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
        // remove stray backticks and code fences
        s = s.replace(/`+/g, '');
        // collapse whitespace
        s = s.replace(/\s+/g, ' ');
        return s.trim();
    } catch (e) {
        return String(text);
    }
}
