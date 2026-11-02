/** The AI models a reading names, in words a reader knows. A pipeline reading's `model` joins the ids of the models that took
 * part with '_' ('deepseek-flash_gpt-6.1-sol_gpt-6.1-terra'); shown raw it reads as an error. Each id becomes its family and
 * its name ('DeepSeek Flash', 'GPT Sol'), joined with ' · '; an id of an unknown shape stays as written. */
export function modelLabel(model: string | null | undefined): string {
  if (!model) return 'AI';
  const parts = model.split('_').filter(Boolean).map(one);
  // An id of another shape leaves the whole label as written: half-read names mislead more than raw ids.
  return parts.some(p => p === null) ? model : parts.join(' · ');
}
function one(id: string): string | null {
  const m = /^(deepseek|gpt|claude|gemini|o\d+)(?:[-_](.*))?$/i.exec(id.trim());
  if (!m) return null;
  const family = ({ deepseek: 'DeepSeek', gpt: 'GPT', claude: 'Claude', gemini: 'Gemini' } as Record<string, string>)[m[1]!.toLowerCase()] ?? m[1]!.toUpperCase();
  const tokens = (m[2] ?? '').split(/[-_]/).filter(Boolean), named = tokens.filter(s => !/^\d+(\.\d+)?$/.test(s));
  // The model's name when it has one ('Sol', 'Flash'); its version when the number is all that names it ('GPT 5').
  const rest = (named.length ? named : tokens).map(s => (/^\d/.test(s) ? s : s[0]!.toUpperCase() + s.slice(1))).join(' ');
  return rest ? `${family} ${rest}` : family;
}
