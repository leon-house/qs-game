/**
 * 渲染适配层
 * 当前：DOM操作
 * 微信/抖音小游戏：Canvas 2D渲染
 *
 * 通过统一接口隔离渲染逻辑，未来切换Canvas只需替换本文件
 */

// 元素缓存，避免重复查询DOM
const elementCache = new Map();

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
     * @param {string} modalId
     */
    showModal(modalId) {
        // 互斥：先关闭所有其他 active 弹窗
        const overlays = document.querySelectorAll('.modal-overlay.active');
        overlays.forEach(m => {
            if (m.id !== modalId) m.classList.remove('active');
        });

        this.addClass(modalId, 'active');

        // 绑定点击遮罩关闭（仅绑定一次）
        const el = this.$(modalId);
        if (el && !el._backdropBound) {
            el.addEventListener('click', (e) => {
                // 仅当点击的是遮罩本身（不是内部 modal 内容）才关闭
                if (e.target === el) {
                    this.hideModal(modalId);
                }
            });
            el._backdropBound = true;
        }
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
