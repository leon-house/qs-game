/**
 * 水晶系统
 */
import { GameData } from '../data/gameData.js';

export function openCrystal() {
    // 简单信息弹窗（小游戏环境可用 Canvas 重写）
    alert(`💎 水晶系统\n\n当前水晶: ${GameData.player.crystals || 0}\n\n水晶用途:\n- 购买稀有装备\n- 兑换珍贵道具\n- 开启宝箱\n\n获取途径:\n- 通关副本\n- 击败Boss\n- 随机事件`);
}

window.openCrystal = openCrystal;
