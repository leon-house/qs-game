/**
 * 每日签到系统
 */
import { GameData, saveData } from '../data/gameData.js?v=quick-actions-20260725k';
import { Renderer } from '../core/renderer.js?v=quick-actions-20260725k';
import { showToast, updateUI } from '../ui/ui.js?v=quick-actions-20260725k';

const CHECKIN_REWARDS = [
    { day: 1, gold: 100, diamond: 0 },
    { day: 2, gold: 150, diamond: 1 },
    { day: 3, gold: 200, diamond: 2 },
    { day: 4, gold: 300, diamond: 2 },
    { day: 5, gold: 400, diamond: 3 },
    { day: 6, gold: 500, diamond: 5 },
    { day: 7, gold: 1000, diamond: 10 }
];

export function openCheckIn() {
    renderCheckIn();
    Renderer.showModal('checkin-modal');
}

export function closeCheckIn() {
    Renderer.hideModal('checkin-modal');
}

function renderCheckIn() {
    const checkIn = GameData.player.checkIn;
    const today = new Date().toDateString();
    const lastCheckIn = checkIn.lastCheckIn;
    const streak = checkIn.streak || 0;

    Renderer.setText('streak-count', streak);

    const daysHtml = CHECKIN_REWARDS.map((r, i) => {
        const dayNum = i + 1;
        const isChecked = streak >= dayNum;
        const isToday = dayNum === (streak % 7 || 7) && lastCheckIn !== today;
        const canCheck = dayNum === (streak % 7 || 7) && lastCheckIn !== today;
        return `<div class="checkin-day ${isChecked ? 'checked' : ''} ${isToday ? 'today' : ''}" ${canCheck ? `onclick="doCheckIn()"` : ''}>
            <span class="day-num">Day${dayNum}</span>
            <span class="day-reward">${r.gold}💰</span>
        </div>`;
    }).join('');

    Renderer.setHTML('checkin-days', daysHtml);

    const btn = Renderer.$('checkin-btn');
    if (lastCheckIn === today) {
        btn.textContent = '已签到';
        btn.disabled = true;
        btn.classList.remove('btn-primary');
    } else {
        btn.textContent = '签到';
        btn.disabled = false;
        btn.classList.add('btn-primary');
    }
}

export function doCheckIn() {
    const checkIn = GameData.player.checkIn;
    const today = new Date().toDateString();

    if (checkIn.lastCheckIn === today) {
        showToast('今天已经签到过了', 'warning');
        return;
    }

    const dayIndex = (checkIn.streak || 0) % 7;
    const reward = CHECKIN_REWARDS[dayIndex];

    GameData.player.gold += reward.gold;
    GameData.player.diamond += reward.diamond;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (checkIn.lastCheckIn === yesterday.toDateString()) {
        checkIn.streak = (checkIn.streak || 0) + 1;
    } else {
        checkIn.streak = 1;
    }

    checkIn.lastCheckIn = today;
    checkIn.totalDays = (checkIn.totalDays || 0) + 1;

    saveData();
    renderCheckIn();
    updateUI();
    showToast(`签到成功！获得 ${reward.gold}金币 ${reward.diamond}钻石`, 'success');
}

window.openCheckIn = openCheckIn;
window.closeCheckIn = closeCheckIn;
window.doCheckIn = doCheckIn;
