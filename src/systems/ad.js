// ============================================================
//  src/systems/ad.js
//  广告占位接口（先不接入真实 SDK）
//
//  使用方：shop.js / challenge.js 通过 watchAd(() => { ... }) 调用
//  真实 SDK 接入时（穿山甲 / 优量汇等）只需替换 setTimeout 处
// ============================================================

import { showToast } from '../ui/ui.js';

/**
 * 看广告回调
 * @param {Function} onComplete 广告播放完成回调（解锁奖励）
 * @param {Function} onSkip     用户取消回调（默认不奖励）
 */
export function watchAd(onComplete, onSkip) {
    showToast('📺 广告 SDK 未接入（占位回调，0.8s 后模拟完成）', 'info');
    // 这里将来替换为：穿山甲.createRewardAd({ ... }).then(onComplete)
    setTimeout(() => {
        try {
            if (typeof onComplete === 'function') onComplete();
        } catch (e) {
            console.warn('[ad] onComplete error:', e);
        }
    }, 800);
}

window.watchAd = watchAd;
