/**
 * 渲染适配层
 * 当前：DOM操作
 * 微信/抖音小游戏：Canvas 2D渲染
 *
 * 通过统一接口隔离渲染逻辑，未来切换Canvas只需替换本文件
 */

// 元素缓存，避免重复查询DOM
const elementCache = new Map();

// 2026-10-28：受保护弹窗 —— 持有「活的游戏状态」，别的弹窗打开时不能顶掉它们
//   dungeon-battle-modal  : 副本战斗，currentWave / currentEnemy / isDungeonBattle 都在模块作用域，
//                           被隐藏等于丢掉战斗进度（closeDungeonBattle 还会额外重置血量）
//   challenge-battle-modal: 挑战战斗（当前 src 内已无引用，保留语义占位）
//   challenge-loot-modal  : 挑战战利品确认，被顶掉玩家就看不到战利品
// 二级弹窗（buy-confirm / equip-detail / challenge-loot）不在名单里 —— 它们本来就该叠在父弹窗之上
const PROTECTED_MODAL_IDS = new Set([
    'dungeon-battle-modal',
    'challenge-battle-modal',
    'challenge-loot-modal',
]);

export const Renderer = {
    /**
     * 获取元素（带缓存）
     * @param {string} id
     * @returns {HTMLElement|null}
     */
    $(id) {
        if (elementCache.has(id)) {
            const cached = elementCache.get(id);
            // ★ 缓存验证：如果节点已脱离 DOM（被 removeChild），重新查询
            if (cached && cached.parentNode) {
                return cached;
            }
            elementCache.delete(id);
        }
        const el = document.getElementById(id);
        if (el) elementCache.set(id, el);
        return el;
    },

    /**
     * 通过选择器获取元素
     * @param {string} selector
     * @returns {Element|null}
     */
    $q(selector) {
        return document.querySelector(selector);
    },

    /**
     * 设置元素文本
     * @param {string} id
     * @param {string} text
     */
    setText(id, text) {
        const el = this.$(id);
        if (el) el.textContent = text;
    },

    /**
     * 设置元素HTML
     * @param {string} id
     * @param {string} html
     */
    setHTML(id, html) {
        const el = this.$(id);
        if (el) el.innerHTML = html;
    },

    /**
     * 设置样式
     * @param {string} id
     * @param {string} prop
     * @param {string} value
     */
    setStyle(id, prop, value) {
        const el = this.$(id);
        if (el) el.style[prop] = value;
    },

    /**
     * 添加CSS类
     * @param {string} id
     * @param {string} cls
     */
    addClass(id, cls) {
        const el = this.$(id);
        if (el) el.classList.add(cls);
    },

    /**
     * 移除CSS类
     * @param {string} id
     * @param {string} cls
     */
    removeClass(id, cls) {
        const el = this.$(id);
        if (el) el.classList.remove(cls);
    },

    /**
     * 切换CSS类
     * @param {string} id
     * @param {string} cls
     * @param {boolean} force
     */
    toggleClass(id, cls, force) {
        const el = this.$(id);
        if (el) el.classList.toggle(cls, force);
    },

    /**
     * 创建元素
     * @param {string} tag
     * @param {object} props
     * @returns {HTMLElement}
     */
    create(tag, props = {}) {
        const el = document.createElement(tag);
        if (props.id) el.id = props.id;
        if (props.className) el.className = props.className;
        if (props.text) el.textContent = props.text;
        if (props.html) el.innerHTML = props.html;
        if (props.style) el.style.cssText = props.style;
        if (props.onclick) el.onclick = props.onclick;
        return el;
    },

    /**
     * 显示弹窗
     * 自动关闭其他 active 弹窗（互斥）+ 注册遮罩点击关闭
     *
     * 2026-10-28：互斥改成「非对称」——
     *   · 普通弹窗打开：关掉其它所有普通弹窗（含自动剧情卡片 story-modal），
     *                  但不碰受保护弹窗（战斗态 / 战利品确认），否则会丢进度或丢奖励；
     *   · 受保护弹窗打开：要接管整个画面，允许关掉任何其它弹窗。
     * @param {string} modalId
     */
    showModal(modalId) {
        const takingOver = PROTECTED_MODAL_IDS.has(modalId);
        // 互斥：先关闭所有其他 active 弹窗
        const overlays = document.querySelectorAll('.modal-overlay.active');
        overlays.forEach(m => {
            if (m.id === modalId) return;
            if (!takingOver && PROTECTED_MODAL_IDS.has(m.id)) return;
            m.classList.remove('active');
        });

        this.addClass(modalId, 'active');

        // 点击空白处关闭由 main.js bindModalOverlayClose() 一次性绑定
        // （此处不再重复绑定，避免 init 时已绑的 listener 被重复触发）
    },

    /**
     * 隐藏弹窗
     * @param {string} modalId
     */
    hideModal(modalId) {
        this.removeClass(modalId, 'active');
    },

    /**
     * 关闭所有弹窗
     */
    hideAllModals() {
        document.querySelectorAll('.modal-overlay.active').forEach(m => {
            m.classList.remove('active');
        });
    },

    /**
     * 清除元素缓存
     */
    clearCache() {
        elementCache.clear();
    }
};

// 桥接（保护 Node 环境）
if (typeof window !== 'undefined') {
    window.Renderer = Renderer;
}
