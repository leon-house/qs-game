// ============================================================
//  src/core/ui-utils.js
//  从 game.js B 区块拆出的 UI 辅助函数（toast 队列 + 浮动文字）
//  拆分原则：DOM 相关辅助逻辑，与 GameData 解耦
//  链入方式：index.html 用 <script type="module" src="src/core/ui-utils.js"></script>
//  依赖：config.js, gamedata.js 之前已加载（不直接使用，但确保加载顺序稳定）
// ============================================================

        // Toast队列，避免弹窗过多
        export let toastQueue = [];
        export let isToastShowing = false;

        export function showToast(message, type = '') {
            // 相同消息只保留最新的
            const existing = toastQueue.find(t => t.message === message);
            if (existing) {
                existing.count = (existing.count || 1) + 1;
                return;
            }
            toastQueue.push({ message, type, count: 1 });
            processToastQueue();
        }

        export function processToastQueue() {
            if (isToastShowing || toastQueue.length === 0) return;

            isToastShowing = true;
            const { message, type, count } = toastQueue.shift();
            const container = document.getElementById('toast-container');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            toast.textContent = count > 1 ? `${message} (x${count})` : message;
            container.appendChild(toast);

            // 减少显示时间到1.5秒
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateY(-10px)';
                setTimeout(() => {
                    toast.remove();
                    isToastShowing = false;
                    processToastQueue();
                }, 200);
            }, 1500);
        }

        export function showFloatText(element, text, type) {
            const rect = element.getBoundingClientRect();
            const float = document.createElement('div');
            float.className = `float-text ${type}`;
            float.textContent = text;
            float.style.left = (rect.left + rect.width / 2 - 30) + 'px';
            float.style.top = rect.top + 'px';
            document.body.appendChild(float);
            setTimeout(() => float.remove(), 1200);
        }
// 桥接：把模块内 export 暴露到 window 全局
if (typeof window !== 'undefined') {
    window.toastQueue = toastQueue;
    window.isToastShowing = isToastShowing;
    window.showToast = showToast;
    window.processToastQueue = processToastQueue;
    window.showFloatText = showFloatText;
}
