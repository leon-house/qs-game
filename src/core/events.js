/**
 * 事件管理器
 * 当前：addEventListener
 * 微信/抖音小游戏：Canvas触摸事件
 *
 * 统一事件绑定和移除，避免内存泄漏
 */

const listeners = [];

export const Events = {
    /**
     * 绑定事件
     * @param {HTMLElement} el
     * @param {string} type
     * @param {Function} handler
     */
    on(el, type, handler) {
        if (!el) return;
        el.addEventListener(type, handler);
        listeners.push({ el, type, handler });
    },

    /**
     * 解绑事件
     * @param {HTMLElement} el
     * @param {string} type
     * @param {Function} handler
     */
    off(el, type, handler) {
        if (!el) return;
        el.removeEventListener(type, handler);
        const idx = listeners.findIndex(l => l.el === el && l.type === type && l.handler === handler);
        if (idx > -1) listeners.splice(idx, 1);
    },

    /**
     * 通过ID绑定事件
     * @param {string} id
     * @param {string} type
     * @param {Function} handler
     */
    onById(id, type, handler) {
        const el = document.getElementById(id);
        this.on(el, type, handler);
    },

    /**
     * 清除所有事件监听（页面切换时调用）
     */
    clearAll() {
        listeners.forEach(({ el, type, handler }) => {
            if (el) el.removeEventListener(type, handler);
        });
        listeners.length = 0;
    }
};

/**
 * 定时器管理器
 * 统一管理所有setInterval，页面切换时统一清除
 */
const timers = [];

export const Timers = {
    /**
     * 设置定时器
     * @param {Function} callback
     * @param {number} delay
     * @returns {number}
     */
    set(callback, delay) {
        const id = setInterval(callback, delay);
        timers.push(id);
        return id;
    },

    /**
     * 清除指定定时器
     * @param {number} id
     */
    clear(id) {
        clearInterval(id);
        const idx = timers.indexOf(id);
        if (idx > -1) timers.splice(idx, 1);
    },

    /**
     * 清除所有定时器
     */
    clearAll() {
        timers.forEach(id => clearInterval(id));
        timers.length = 0;
    }
};
