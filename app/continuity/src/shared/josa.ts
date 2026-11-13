/* Korean particles after a word (이/가, 을/를, 은/는, 과/와, 으로/로), chosen by the word's final syllable: shared by the growth view's
 * sentences and the rows it shows (a record's row ID read as the part's name takes the particle that name needs). */
/** Whether a word ends in a closed syllable for a particle (그 받침이 있는가): a Hangul syllable by its final; a digit or Latin letter as it is
 * read aloud. For 으로/로 a final ㄹ (or l) reads as open. */
function closed(word: string, ro = false): boolean {
  // A bracketed part after the word is read past (「운영자(설치·관리)」 takes 운영자's particle).
  const t = word.replace(/[\s'"’‘」』.,…]+$/u, '').replace(/\s*[(（][^()（）]*[)）]$/u, '').replace(/[\s'"’‘」』)\]）.,…]+$/u, ''), ch = t.at(-1) ?? '';
  const c = ch.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) { const j = (c - 0xac00) % 28; return ro ? j !== 0 && j !== 8 : j !== 0; }
  if (/\d/.test(ch)) return ro ? '0368'.includes(ch) : '013678'.includes(ch);
  if (/[A-Za-z]/.test(ch)) return ro ? 'bcdgkmnpqt'.includes(ch.toLowerCase()) : 'bcdgklmnpqt'.includes(ch.toLowerCase());
  return false;
}
export type JosaPair = '이/가' | '을/를' | '은/는' | '과/와' | '으로/로';
/** The particle after a word: josa('cronjob', '을/를') → '을'. */
export function josa(word: string, pair: JosaPair): string {
  const [a, b] = pair.split('/') as [string, string];
  return closed(word, pair === '으로/로') ? a : b;
}
/** The pair a particle as written belongs to (「이」 and 「가」 → 이/가, 「와」 → 과/와, …), null for any other ending. */
export function josaPair(particle: string): JosaPair | null {
  switch (particle) {
    case '이': case '가': return '이/가';
    case '을': case '를': return '을/를';
    case '은': case '는': return '은/는';
    case '과': case '와': return '과/와';
    case '으로': case '로': return '으로/로';
    default: return null;
  }
}
