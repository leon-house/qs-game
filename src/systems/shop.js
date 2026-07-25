/**
 * 商店系统
 */
import { GameData, saveData } from '../data/gameData.js?v=equip-select-redesign-20260725m';
import { Renderer } from '../core/renderer.js?v=equip-select-redesign-20260725m';

let shopItems = [];

export function getRefreshCost() {
    return Math.floor(50 * Math.pow(GameData.player.refreshCount || 0, 1.2));
}

export function openShop() {
    if (!GameData.player.shopItems || GameData.player.shopItems.length === 0) {
        generateShopItems();
    }
    renderShop();
    Renderer.showModal('shop-modal');
}

export function closeShop() {
    Renderer.hideModal('shop-modal');
}

export function generateShopItems() {
    shopItems = [];
    const types = ['material', 'material', 'material', 'equipment'];
    for (let i = 0; i < 6; i++) {
        const type = types[Math.floor(Math.random() * types.length)];
        if (type === 'material') {
            const mats = [
                { id: 'm1', name: '废铁', icon: '🔩', price: 20 },
                { id: 'm2', name: '零件', icon: '⚙️', price: 50 },
                { id: 'enhance_stone', name: '强化石', icon: '🪨', price: 100 }
            ];
            const mat = mats[Math.floor(Math.random() * mats.length)];
            shopItems.push({ ...mat, type: 'material', count: Math.floor(1 + Math.random() * 5) });
        }
    }
    GameData.player.shopItems = shopItems;
    saveData();
}

export function renderShop() {
    const items = GameData.player.shopItems || shopItems;
    if (!items || items.length === 0) {
        Renderer.setHTML('shop-grid', '<div class="empty-bag"><div class="empty-bag-icon">🛒</div><div>商品已售罄</div></div>');
        return;
    }
    let html = items.map((item, i) => {
        return '<div class="shop-item">' +
            '<div class="shop-item-icon">' + item.icon + '</div>' +
            '<div class="shop-item-name">' + item.name + (item.count ? ' x' + item.count : '') + '</div>' +
            '<div class="shop-item-price">💰 ' + item.price + '</div>' +
            '<button class="shop-item-btn" onclick="buyItem(' + i + ')">购买</button>' +
            '</div>';
    }).join('');
    Renderer.setHTML('shop-grid', html);
    Renderer.setText('refresh-count', '∞');
    Renderer.setText('refresh-cost', getRefreshCost());
    const goldBtn = Renderer.$('refresh-gold-btn');
    if (goldBtn) goldBtn.disabled = GameData.player.gold < getRefreshCost();
}

export function refreshShop() {
    const cost = getRefreshCost();
    if (GameData.player.gold < cost) return;
    GameData.player.gold -= cost;
    generateShopItems();
    renderShop();
    saveData();
}

export function buyItem(index) {
    const items = GameData.player.shopItems || shopItems;
    const item = items[index];
    if (!item || GameData.player.gold < item.price) return;
    GameData.player.gold -= item.price;
    if (item.type === 'material') {
        const existing = GameData.player.bag.material.find(m => m.id === item.id);
        if (existing) existing.count += item.count;
        else GameData.player.bag.material.push({ id: item.id, name: item.name, icon: item.icon, count: item.count });
    }
    items.splice(index, 1);
    renderShop();
    saveData();
}

// 全局暴露（兼容HTML onclick）
window.openShop = openShop;
window.closeShop = closeShop;
window.refreshShop = refreshShop;
window.buyItem = buyItem;
