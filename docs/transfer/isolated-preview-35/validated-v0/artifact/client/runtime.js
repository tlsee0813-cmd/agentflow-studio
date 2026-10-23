import { validateRequest, validateAdvice, validateGuideRequest, validateGuideReply } from '../shared/validation.js';
import { mockAdvice, mockGuidance } from '../shared/mock.js';
import { STATIC_TARGET } from './static-target.js';
// Build-selected adapter. Prefix ALL store keys, including legacy backups/conflict checks.
// The prefix and label come from the build-selected target (browser demo or PREVIEW35 preview).
const prefix = STATIC_TARGET.prefix;
export const runtimeStorage = (storage) => ({
    getItem: key => storage.getItem(prefix + key),
    setItem: (key, value) => storage.setItem(prefix + key, value)
});
export const runtimeFailure = { notice: '브라우저 체험을 시작하지 못했습니다. 입력은 보존하며 다른 정리 방식으로 자동 전환하지 않습니다.', label: '브라우저 체험 확인 불가', description: '원문 보관·직접 편집·백업을 이용할 수 있습니다.' };
export async function loadConfig() {
    return { mode: 'mock', configured: true, paidEnabled: false, consentVisible: false, notice: null,
        label: STATIC_TARGET.label, description: STATIC_TARGET.description };
}
export async function requestAdvice(request, signal) {
    signal.throwIfAborted();
    const checked = validateRequest(request);
    const advice = validateAdvice(mockAdvice(checked), checked.bases.map(b => b.id));
    signal.throwIfAborted();
    return { mode: 'mock', ticket: checked.ticket, advice };
}
/** GUIDE097: the same rules as server MOCK, in the browser. Never presented as AI. */
export async function requestGuidance(request, signal) {
    signal.throwIfAborted();
    const checked = validateGuideRequest(request), reply = validateGuideReply(mockGuidance(checked), checked);
    signal.throwIfAborted();
    return { mode: 'mock', ticket: checked.ticket, reply };
}
