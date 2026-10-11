// Rates are a reviewable snapshot, not an assertion about the account bill.
// Official retrieved pricing snapshot and mandatory pre-run recheck are documented in COST_AND_NETWORK.md.
// Current rates have <=3 decimals: compute integer nano-USD before division.
export const PRICING = Object.freeze({currency:'USD',model:'deepseek-flash',date:'2026-10-10',
  verification:'OFFICIAL_SEARCH_CONTENT_CHECKED',peak:{inputMiss:0.30,inputHit:0.006,output:1.20},
  offPeak:{inputMiss:0.15,inputHit:0.003,output:0.60}});
export const LIMITS = Object.freeze({calls:6,maxInputBytes:32768,inputReservationTokens:40000,maxOutputTokens:4096,
  timeoutMs:15000,budgetUsd:0.12,parallelism:1,retries:0});
export function costUsd(input,output,rate=PRICING.peak) { return (input*Math.round(rate.inputMiss*1000)+output*Math.round(rate.output*1000))/1000000000; }
export function reservation(body) {
  const bytes=Buffer.byteLength(JSON.stringify(body),'utf8');
  if (bytes>LIMITS.maxInputBytes) throw new Error('INPUT_TOO_LARGE');
  return {requestBytes:bytes,inputReservationTokens:LIMITS.inputReservationTokens,
    reservedUsd:costUsd(LIMITS.inputReservationTokens,LIMITS.maxOutputTokens),
    note:'40,000-token engineering reserve for <=32KiB UTF-8 body; not a provider-tokenizer proof or hard account billing cap.'};
}
export function usageCost(usage) {
  if (!Number.isSafeInteger(usage?.prompt_tokens)||!Number.isSafeInteger(usage?.completion_tokens)) return null;
  return {peakNoCacheUsd:costUsd(usage.prompt_tokens,usage.completion_tokens),
    offPeakNoCacheUsd:costUsd(usage.prompt_tokens,usage.completion_tokens,PRICING.offPeak),
    basis:'Returned token counts x rate snapshot, no caching discount; NOT actual charge/invoice.'};
}
