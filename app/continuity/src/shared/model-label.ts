/** The AI models a reading names, in words a reader knows. A pipeline reading's `model` joins the ids of the models that took
 * part with '_' ('deepseek-flash_gpt-6.1-sol_gpt-6.1-terra'); shown raw it reads as an error. Each id becomes its family and
 * its name ('DeepSeek Flash', 'GPT Sol'), joined with ' · '; an id of an unknown shape stays as written. */
export function modelLabel(model: string | null | undefined): string {
  if (!model) return 'AI';
  return model.split('_').filter(Boolean).map(one).join(' · ');
}
function one(id: string): string {
  const m = /^(deepseek|gpt|claude|gemini|o\d)[-_]?(.*)$/i.exec(id.trim());
  if (!m) return id;
  const family = ({ deepseek: 'DeepSeek', gpt: 'GPT', claude: 'Claude', gemini: 'Gemini' } as Record<string, string>)[m[1]!.toLowerCase()] ?? m[1]!.toUpperCase();
  const rest = m[2]!.split(/[-_]/).filter(s => s && !/^\d+(\.\d+)?$/.test(s)).map(s => s[0]!.toUpperCase() + s.slice(1)).join(' ');
  return rest ? `${family} ${rest}` : family;
}
