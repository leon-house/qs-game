// ============================================================
//  src/data/config.js
//  从 game.js 拆出的静态配置常量（纯数据，无逻辑依赖）
//  拆分原则：A1 区块内全部 const 定义，不依赖 GameData/任何函数
//  链入方式：index.html 用 <script type="module" src="src/data/config.js"></script>
// ============================================================

        export const SURVIVOR_TYPES = {
            'warrior': {
                name: '战士',
                icon: '⚔️',
                desc: '擅长近战，攻击加成+15%',
                bonus: { attack: 0.15 }
            },
            'guardian': {
                name: '守卫',
                icon: '🛡️',
                desc: '防御专精，生命+20%',
                bonus: { hp: 0.20 }
            },
            'scavenger': {
                name: '拾荒者',
                icon: '🎒',
                desc: '资源富集，金币掉落+20%',
                bonus: { goldBonus: 0.20 }
            },
            'medic': {
                name: '医护',
                icon: '💉',
                desc: '生存专家，暴击率+10%',
                bonus: { critRate: 10 }
            }
        };

        // 剧情文本
        export const STORY_INTRO = `2077年，核战争爆发...
的世界陷入火海文明崩塌
幸存者们躲进地下庇护所
等待着重见天日的那一天
如今，辐射减弱你需要武装自己
探索废墟，寻找资源
在这个残酷的末世中生存下去！`;

        export const CHAPTER_STORIES = [
            { chapter: 1, title: '第一章：废墟之城', story: '离开庇护所，你踏入这片辐射遍布的废墟。曾经繁华的城市如今只剩断壁残垣。空气中弥漫着腐烂的气息...小心，变异生物正在暗中窥视。' },
            { chapter: 2, title: '第二章：变异森林', story: '穿越城市废墟，你来到了这片被辐射污染的森林。树木扭曲变形，动物们发生了恐怖的变化。这里隐藏着更强大的变异体...' },
            { chapter: 3, title: '第三章：辐射沙漠', story: '一片荒芜的沙漠出现在面前。黄沙漫天，水源稀少。在这里你会遇到沙漠盗匪，他们可不会跟你讲道理...' },
            { chapter: 4, title: '第四章：沦陷基地', story: '一个废弃的军事基地。门上的血迹暗示着这里发生过惨剧。深入地下，你发现这里已经被某种恐怖生物占据...' },
            { chapter: 5, title: '第五章：感染者巢穴', story: '最黑暗的区域。感染者的巢穴充满了腐臭和尖叫。这里是地狱，也是你必须跨越的坎...' },
            { chapter: 6, title: '第六章：地下研究所', story: '在巢穴深处你发现了一个隐秘的入口——某个失踪的病毒研究所。实验记录暗示着这场末世的真正起源就在这里...' },
            { chapter: 7, title: '第七章：变异海滩', story: '海洋被辐射污染后诞生了新的生态。沿海城市的废墟下，变异鲨鱼和触手怪盘踞着海岸线。你必须穿过这里才能继续前进...' },
            { chapter: 8, title: '第八章：钢铁工厂', story: '一个仍在运作的自动化工厂，机器在无人状态下循环运作了数十年。但现在的工人们不再是人类——而是半机械的改造体...' },
            { chapter: 9, title: '第九章：最终防线', story: '军方在末日前修建的最后一道防线。这里曾经是秩序的象征，如今却成了末世之主的宫殿。每一个角落都潜伏着致命的威胁...' },
            { chapter: 10, title: '第十章：新世界', story: '打败末世之主后，你站在了曾经是城市最高点的废墟上。太阳从辐射云层中穿透出来——你意识到，活下来本身就是一种胜利。新的旅程即将开始...' }
        ];

        // 装备品质颜色
        export const QUALITY_COLORS = {
            white: 'white', green: 'green', blue: 'blue',
            purple: 'purple', orange: 'orange', red: 'red'
        };

        // 套装系统
        export const SETS = {
            'warrior': { name: '战士套装', icon: '⚔️', bonus: { 2: { attack: 15 }, 3: { attack: 30, critRate: 5 } } },
            'guardian': { name: '守护套装', icon: '🛡️', bonus: { 2: { defense: 15 }, 3: { defense: 30, hp: 100 } } },
            'hunter': { name: '猎人套装', icon: '🎯', bonus: { 2: { critRate: 8 }, 3: { critRate: 15, attack: 20 } } }
        };

        // 宝石系统
        export const GEMS = {
            'ruby': { id: 'ruby', name: '红宝石', icon: '🔴', attack: 5, price: 100 },
            'sapphire': { id: 'sapphire', name: '蓝宝石', icon: '🔵', defense: 5, price: 100 },
            'emerald': { id: 'emerald', name: '绿宝石', icon: '🟢', hp: 30, price: 80 },
            'topaz': { id: 'topaz', name: '黄宝石', icon: '🟡', critRate: 2, price: 150 }
        };

        export const EQUIPMENT_TEMPLATES = {
            weapon: [
                { id: 'w1', name: '棒球棍', icon: '🏏', baseAttack: 5, quality: 'white', setId: null, levelReq: 1, desc: '一根从废墟中捡来的棒球棍，满是干涸的血迹。虽不起眼，但在末世中它救过不少人的命。' },
                { id: 'w2', name: '消防斧', icon: '🪓', baseAttack: 10, quality: 'green', setId: 'warrior', levelReq: 3, desc: '消防员遗留下的战斧，斧刃依然锋利。据说它的主人曾凭它从火海中救出十七个幸存者。' },
                { id: 'w3', name: '霰弹枪', icon: '🔫', baseAttack: 20, quality: 'blue', setId: 'hunter', levelReq: 8, desc: '一把经过改装的霰弹枪，弹仓加大了三倍。枪托上刻着一行小字：「直到弹尽粮绝」' },
                { id: 'w4', name: '激光剑', icon: '⚔️', baseAttack: 35, quality: 'purple', setId: 'warrior', levelReq: 15, desc: '从军事基地废墟中发掘的高科技武器，等离子刀刃能切割一切已知金属。启动时发出低沉的嗡鸣。' },
                { id: 'w5', name: '等离子炮', icon: '🔮', baseAttack: 60, quality: 'orange', setId: 'hunter', levelReq: 25, desc: '外星科技与人类工艺的结晶，每一发都蕴含着恒星级能量。使用者必须穿戴全套防护装备，否则会被自己的武器灼伤。' },
                { id: 'w6', name: '反物质枪', icon: '🔱', baseAttack: 100, quality: 'red', setId: 'warrior', levelReq: 40, desc: '传说中的终极武器，能湮灭一切物质。它的每一次射击都在扭曲现实法则，有传闻说它的弹药来自另一个维度的深渊。' }
            ],
            armor: [
                { id: 'a1', name: '皮甲', icon: '🦺', baseDefense: 3, baseHp: 20, quality: 'white', setId: null, levelReq: 1, desc: '用变异兽皮革缝制的简易护甲，散发着淡淡的腥味。虽然粗糙，但总比裸奔强。' },
                { id: 'a2', name: '防弹衣', icon: '🛡️', baseDefense: 8, baseHp: 50, quality: 'green', setId: 'guardian', levelReq: 5, desc: '警察的旧防弹衣，凯夫拉纤维已经老化，但依然能挡住变异犬的撕咬。内衬缝着一个名字标签。' },
                { id: 'a3', name: '外骨骼', icon: '🦾', baseDefense: 15, baseHp: 100, quality: 'blue', setId: 'guardian', levelReq: 12, desc: '军方研发的动力外骨骼，能放大穿戴者三倍的力量。电池只能维持两小时，但那两小时里你就是不可阻挡的。' },
                { id: 'a4', name: '能量护甲', icon: '⚡', baseDefense: 25, baseHp: 180, quality: 'purple', setId: 'guardian', levelReq: 20, desc: '覆盖全身的能量护盾发生器，能在毫秒间生成偏导力场。据说是从一个坠毁的不明飞行物中逆向工程而来。' },
                { id: 'a5', name: '纳米战甲', icon: '🧬', baseDefense: 40, baseHp: 300, quality: 'orange', setId: 'warrior', levelReq: 30, desc: '由万亿个纳米机器人组成，能根据威胁自动调整密度和形态。穿戴者形容它像是「第二层皮肤在呼吸」。' },
                { id: 'a6', name: 'T-1000战甲', icon: '🤖', baseDefense: 70, baseHp: 500, quality: 'red', setId: 'guardian', levelReq: 45, desc: '液态金属智能装甲，能在任何形态间自由切换。它的AI核心据说保留了原主人的部分记忆，偶尔会在梦中低语。' }
            ],
            accessory: [
                { id: 'c1', name: '幸运符', icon: '🍀', baseCritRate: 2, quality: 'white', setId: null, levelReq: 1, desc: '一个被摩挲得发亮的四叶草挂件，主人已不知去向。也许它真的能带来好运——在末世中，信念也是一种武器。' },
                { id: 'c2', name: '瞄准镜', icon: '🎯', baseCritRate: 5, quality: 'green', setId: 'hunter', levelReq: 5, desc: '狙击手的瞄准镜，镜片依然通透。透过它看到的不是目标，而是活下来的希望。' },
                { id: 'c3', name: '暴击戒指', icon: '💍', baseCritRate: 10, quality: 'blue', setId: 'hunter', levelReq: 12, desc: '镶嵌着变异晶石的戒指，能引导使用者的杀意集中在一点。据说戒指内的晶石是用变异体的核心打磨的。' },
                { id: 'c4', name: '电能核心', icon: '🔋', baseCritRate: 15, baseAttack: 10, baseCritDamage: 20, quality: 'purple', levelReq: 20, desc: '微型聚变核心，为武器系统提供持续能量。蓝色的光芒在黑暗中闪烁，像是一颗不灭的星。' },
                { id: 'c5', name: '暗能量水晶', icon: '🔮', baseCritRate: 20, baseAttack: 25, baseCritDamage: 40, baseLifeSteal: 5, quality: 'orange', levelReq: 30, desc: '从虚空裂缝中析出的暗能量结晶，持有者能感受到来自深渊的脉动。它在汲取光线的同时，也在汲取灵魂。' },
                { id: 'c6', name: '时间碎片', icon: '⏳', baseCritRate: 30, baseAttack: 50, baseCritDamage: 60, baseLifeSteal: 10, baseCombo: 5, quality: 'red', levelReq: 45, desc: '被击碎的时间之沙的碎片，持有者偶尔能看到未来的片段。但代价是——每一秒都在加速老去。' }
            ],
            head: [
                { id: 'h1', name: '布帽', icon: '🧢', baseDefense: 2, baseHp: 10, quality: 'white', setId: null, levelReq: 1, desc: '一顶褪色的棒球帽，帽檐上有个弹孔。前主人大概是个乐观的人——他在帽子内侧写著「明天见」。' },
                { id: 'h2', name: '摩托车头盔', icon: '⛑️', baseDefense: 5, baseHp: 25, quality: 'green', setId: 'guardian', levelReq: 5, desc: '全盔式摩托车头盔，面罩有划痕但完好。在末世里，一个好头盔就是一条命。' },
                { id: 'h3', name: '防毒面具', icon: '😷', baseDefense: 10, baseHp: 50, quality: 'blue', setId: 'guardian', levelReq: 12, desc: '军方制式防毒面具，能过滤绝大多数已知毒素。滤芯已经泛黄，但在这片被辐射笼罩的大地上，它是你最好的朋友。' },
                { id: 'h4', name: '夜视仪头盔', icon: '👓', baseDefense: 18, baseHp: 90, quality: 'purple', setId: 'hunter', levelReq: 20, desc: '集成夜视仪的战术头盔，让黑暗不再是庇护所。当你在夜里看到绿色的眼睛时——先开枪。' },
                { id: 'h5', name: '能量头盔', icon: '👺', baseDefense: 30, baseHp: 150, quality: 'orange', setId: 'guardian', levelReq: 30, desc: '内置能量力场的头盔，在遭遇攻击时自动激活护盾。面罩上的HUD能实时显示威胁等级和弹药余量。' },
                { id: 'h6', name: 'T-800头盔', icon: '🤖', baseDefense: 50, baseHp: 250, quality: 'red', setId: 'guardian', levelReq: 45, desc: '来自未来的液态合金头盔，HUD中显示的数据不属于这个时代。它的AI会低声提示威胁方位——像是亡灵在耳边低语。' }
            ],
            cloak: [
                { id: 'cl1', name: '破布', icon: '🧣', baseHp: 15, quality: 'white', setId: null, levelReq: 1, desc: '一块从窗帘上扯下来的布，勉强能披在肩上。总比什么都没有强。' },
                { id: 'cl2', name: '迷彩披风', icon: '🎽', baseHp: 35, baseDefense: 3, quality: 'green', setId: 'warrior', levelReq: 5, desc: '军用迷彩披风，经过特殊处理能在夜间降低红外特征。披上它，你就是夜的一部分。' },
                { id: 'cl3', name: '防弹披风', icon: '🛡️', baseHp: 70, baseDefense: 8, quality: 'blue', setId: 'guardian', levelReq: 12, desc: '内衬陶瓷片的战术披风，能抵挡流弹。它很重，但在这片大地上，重量等于安全感。' },
                { id: 'cl4', name: '隐形披风', icon: '👻', baseHp: 120, baseCritRate: 5, quality: 'purple', setId: 'hunter', levelReq: 20, desc: '利用光折射原理的隐形装置，能在静止时达到90%隐形效果。但别忘了——变异犬靠嗅觉，不靠视觉。' },
                { id: 'cl5', name: '能量披风', icon: '⚡', baseHp: 200, baseDefense: 15, baseCritDamage: 15, quality: 'orange', setId: 'warrior', levelReq: 30, desc: '流淌着能量的丝质披风，像一匹流动的极光。它不仅能抵御攻击，还能为使用者的武器充能。' },
                { id: 'cl6', name: '神器披风', icon: '🔥', baseHp: 350, baseDefense: 25, baseCritDamage: 30, baseLifeSteal: 5, quality: 'red', setId: 'warrior', levelReq: 45, desc: '由神殿遗物编织的披风，据说每一根丝线都曾浸泡在英雄的血中。穿戴者会感到一股古老的怒意在血管中奔涌。' }
            ],
            ring: [
                { id: 'r1', name: '铁戒指', icon: '💍', baseCritRate: 1, quality: 'white', setId: null, levelReq: 1, desc: '一枚粗糙的铁戒指，内侧刻着两个名字。也许这是末世前某段爱情的见证。' },
                { id: 'r2', name: '银戒指', icon: '🥈', baseCritRate: 3, baseAttack: 3, quality: 'green', setId: 'hunter', levelReq: 5, desc: '银质戒指，镶嵌着一颗小小的蓝宝石。据说银能辟邪——在变异体横行的世界里，这值得一试。' },
                { id: 'r3', name: '金戒指', icon: '🥇', baseCritRate: 6, baseAttack: 8, quality: 'blue', setId: 'hunter', levelReq: 12, desc: '金戒指上刻着家族纹章。在旧时代它是地位的象征，现在它只是你能换到一餐饭的金属。但留着它——或许旧世界会回来。' },
                { id: 'r4', name: '钻石戒指', icon: '💎', baseCritRate: 10, baseAttack: 15, baseCritDamage: 10, quality: 'purple', setId: 'warrior', levelReq: 20, desc: '钻戒在光线下折射出虹彩。钻石是世界上最硬的物质——正如持有者的决心。' },
                { id: 'r5', name: '神器戒指', icon: '👑', baseCritRate: 15, baseAttack: 25, baseCritDamage: 25, baseLifeSteal: 3, quality: 'orange', setId: 'warrior', levelReq: 30, desc: '蕴含远古力量的戒指，传说它曾属于一位陨落的王。戴上它时，能感受到千军万马在血液中奔腾。' },
                { id: 'r6', name: '传奇戒指', icon: '🏆', baseCritRate: 25, baseAttack: 40, baseCritDamage: 40, baseLifeSteal: 8, baseCombo: 3, quality: 'red', setId: 'warrior', levelReq: 45, desc: '诞生于世界末日的传奇之戒，据说每一位佩戴过它的战士都改写了历史。现在轮到你了。' }
            ],
            amulet: [
                { id: 'am1', name: '绳子', icon: '🪢', baseHp: 10, quality: 'white', setId: null, levelReq: 1, desc: '一根系在脖子上的粗绳，上面挂着家人的照片。在末世里，记忆就是你的铠甲。' },
                { id: 'am2', name: '护身符', icon: '📿', baseHp: 30, baseDefense: 2, quality: 'green', setId: 'guardian', levelReq: 5, desc: '一位老人临终前塞给你的佛珠。他说这串珠子跟了他六十年——穿过战争、瘟疫和末日。也许真的有神灵在守护。' },
                { id: 'am3', name: '魔法护符', icon: '🧿', baseHp: 60, baseDefense: 5, quality: 'blue', setId: 'guardian', levelReq: 12, desc: '镶嵌着变异晶石的护符，能感应到附近的危险时微微发热。它像第三只眼，在你看不到的地方替你守望。' },
                { id: 'am4', name: '暗影护符', icon: '🌑', baseHp: 100, baseCritRate: 3, baseCritDamage: 10, quality: 'purple', setId: 'hunter', levelReq: 20, desc: '来自暗影维度的护符，佩戴者会发现自己的影子开始有了自己的意志。它在保护你——以它自己的方式。' },
                { id: 'am5', name: '神圣护符', icon: '☀️', baseHp: 180, baseDefense: 12, baseLifeSteal: 3, quality: 'orange', setId: 'guardian', levelReq: 30, desc: '在废墟的神殿中找到的护符，散发着温暖的光芒。佩戴它时，变异体的气息似乎会避开你。光明，终究没有死。' },
                { id: 'am6', name: '神器护符', icon: '⭐', baseHp: 300, baseDefense: 20, baseLifeSteal: 8, baseCritDamage: 20, quality: 'red', setId: 'guardian', levelReq: 45, desc: '蕴含创世之力的护符，据说是人类文明最后的火种被封印于此。佩戴它时，你能听到大地深处传来古老的脉搏。' }
            ],
            boots: [
                { id: 'b1', name: '草鞋', icon: '👡', baseDefense: 1, baseHp: 8, quality: 'white', setId: null, levelReq: 1, desc: '用变异草编织的草鞋，轻便但不耐磨。每走一步都能感受到大地的温度——这也许是你与旧世界最后的联系。' },
                { id: 'b2', name: '运动鞋', icon: '👟', baseDefense: 3, baseHp: 20, quality: 'green', setId: 'warrior', levelReq: 5, desc: '一双跑鞋，鞋底还有弹性。在末世中跑得快意味着活得更久——这双鞋的主人大概跑了很远。' },
                { id: 'b3', name: '军靴', icon: '👢', baseDefense: 7, baseHp: 45, quality: 'blue', setId: 'guardian', levelReq: 12, desc: '军靴，钢头，防穿刺。它陪伴一位士兵走过了最后的日子。靴筒里塞着一张皱巴巴的全家福。' },
                { id: 'b4', name: '战靴', icon: '🥾', baseDefense: 12, baseHp: 80, baseCritRate: 2, quality: 'purple', setId: 'guardian', levelReq: 20, desc: '特种部队的战术靴，内置减震和防滑系统。穿着它能在废墟上如履平地。每一道磨损都是一段活下来的故事。' },
                { id: 'b5', name: '疾风靴', icon: '💨', baseDefense: 20, baseHp: 130, baseCombo: 3, quality: 'orange', setId: 'warrior', levelReq: 30, desc: '注入了风之力的战靴，穿戴者移动如风。据说第一位穿戴者跑出了音障——然后再也没有人见过他。' },
                { id: 'b6', name: '神器靴', icon: '⚡', baseDefense: 35, baseHp: 220, baseCombo: 5, baseLifeSteal: 3, quality: 'red', setId: 'warrior', levelReq: 45, desc: '融合了雷神之力的战靴，每一步都带着雷霆。穿戴者能在水面和墙壁上行走——重力已不再束缚你。' }
            ],
            clothes: [
                { id: 'cs1', name: 'T恤', icon: '👕', baseDefense: 2, baseHp: 15, quality: 'white', setId: null, levelReq: 1, desc: '一件印着「I Love NY」的旧T恤。纽约早已不在，但这件衣服还在。也许这就够了。' },
                { id: 'cs2', name: '夹克', icon: '🧥', baseDefense: 5, baseHp: 35, quality: 'green', setId: 'guardian', levelReq: 5, desc: '一件皮夹克，肘部打着补丁。口袋里还有半包已经不能抽的烟和一个打火机——你留着它们，当个念想。' },
                { id: 'cs3', name: '军装', icon: '🎖️', baseDefense: 12, baseHp: 75, quality: 'blue', setId: 'guardian', levelReq: 12, desc: '制式军装，耐磨耐穿。肩章还在，但军队早已不存在。你穿着它，也许是在延续某种使命。' },
                { id: 'cs4', name: '作战服', icon: '👔', baseDefense: 20, baseHp: 130, baseCritRate: 3, quality: 'purple', setId: 'warrior', levelReq: 20, desc: '特种作战服，内置陶瓷装甲板和急救包。衣服内侧缝着一个口袋——里面放着前主人最后的遗书。' },
                { id: 'cs5', name: '纳米作战服', icon: '🧪', baseDefense: 35, baseHp: 220, baseCritDamage: 15, quality: 'orange', setId: 'warrior', levelReq: 30, desc: '由纳米纤维编织的作战服，能自动修复损伤。它在黑暗中泛着微微的荧光——像是千万只萤火虫在守护你。' },
                { id: 'cs6', name: '神器战甲', icon: '🦸', baseDefense: 60, baseHp: 380, baseCritDamage: 25, baseLifeSteal: 5, baseCombo: 3, quality: 'red', setId: 'guardian', levelReq: 45, desc: '传说中英雄的战甲，内衬编织着符文。穿戴者会感到无畏的勇气涌入胸腔——这就是英雄的感觉。' }
            ]
        };

        // 材料
        export const MATERIALS = [
            { id: 'm1', name: '废铁', icon: '🔩', dropRate: 30 },
            { id: 'm2', name: '零件', icon: '⚙️', dropRate: 25 },
            { id: 'm3', name: '能源', icon: '🔋', dropRate: 20 },
            { id: 'm4', name: '晶体', icon: '💎', dropRate: 15 },
            { id: 'm5', name: '核心', icon: '🌀', dropRate: 8 },
            { id: 'm6', name: '神性', icon: '✨', dropRate: 2 },
            { id: 'enhance_stone', name: '强化石', icon: '🪨', dropRate: 40 }
        ];

        // 普通怪物模板（每2关升一档）
        export const ENEMY_TYPES = [
            { name: '辐射鼠', icon: '🐀', image: 'assets/images/monster/rat.png', baseHp: 15, baseAttack: 2, baseDefense: 0 },
            { name: '变异狗', icon: '🐕', image: 'assets/images/monster/dog.png', baseHp: 25, baseAttack: 4, baseDefense: 1 },
            { name: '感染者', icon: '🧟', image: 'assets/images/monster/zombie.png', baseHp: 40, baseAttack: 6, baseDefense: 2 },
            { name: '变异蜘蛛', icon: '🕷️', image: 'assets/images/monster/spider.png', baseHp: 55, baseAttack: 8, baseDefense: 3 },
            { name: '腐尸', icon: '💀', image: 'assets/images/monster/skeleton.png', baseHp: 70, baseAttack: 10, baseDefense: 4 },
            { name: '变异蜥蜴', icon: '🦎', image: 'assets/images/monster/lizard.png', baseHp: 90, baseAttack: 12, baseDefense: 5 },
            { name: '狂暴兽', icon: '🐗', image: 'assets/images/monster/boar.png', baseHp: 110, baseAttack: 15, baseDefense: 6 },
            { name: '暗影行者', icon: '👤', image: 'assets/images/monster/shadow.png', baseHp: 130, baseAttack: 18, baseDefense: 7 },
            { name: '辐射巨蟒', icon: '🐍', image: 'assets/images/monster/snake.png', baseHp: 160, baseAttack: 22, baseDefense: 8 },
            { name: '机械犬', icon: '🐕‍🦺', image: 'assets/images/monster/cyberdog.png', baseHp: 200, baseAttack: 28, baseDefense: 10 }
        ];

        // BOSS模板（10个Boss共用一张boss图，留接口便于后续分种类）
        export const BOSS_TEMPLATES = [
            { name: '变异体', icon: '👹', image: 'assets/images/boss.png' },
            { name: '感染者', icon: '🧟', image: 'assets/images/boss.png' },
            { name: '巨型蜘蛛', icon: '🕷️', image: 'assets/images/boss.png' },
            { name: '变异犬', icon: '🐕', image: 'assets/images/boss.png' },
            { name: '机甲战士', icon: '🤖', image: 'assets/images/boss.png' },
            { name: '辐射巨兽', icon: '🦖', image: 'assets/images/boss.png' },
            { name: '暗影杀手', icon: '👤', image: 'assets/images/boss.png' },
            { name: '堕落博士', icon: '👨‍🔬', image: 'assets/images/boss.png' },
            { name: '终极形态', icon: '👺', image: 'assets/images/boss.png' },
            { name: '末世之主', icon: '😈', image: 'assets/images/boss.png' }
        ];

        // 庇护所升级
        export const SHELTER_UPGRADE_COST = {
            1: { materials: [{ id: 'm1', count: 10 }], incomeBonus: 10, dropBonus: 0 },
            2: { materials: [{ id: 'm1', count: 20 }, { id: 'm2', count: 5 }], incomeBonus: 25, dropBonus: 5 },
            3: { materials: [{ id: 'm2', count: 15 }, { id: 'm3', count: 5 }], incomeBonus: 45, dropBonus: 10 },
            4: { materials: [{ id: 'm3', count: 10 }, { id: 'm4', count: 3 }], incomeBonus: 70, dropBonus: 18 },
            5: { materials: [{ id: 'm4', count: 8 }, { id: 'm5', count: 2 }], incomeBonus: 100, dropBonus: 28 },
            6: { materials: [{ id: 'm5', count: 5 }, { id: 'm6', count: 1 }], incomeBonus: 140, dropBonus: 40 },
            7: { materials: [{ id: 'm6', count: 3 }], incomeBonus: 200, dropBonus: 55 },
            8: { materials: [{ id: 'm6', count: 5 }], incomeBonus: 300, dropBonus: 75 },
            9: { materials: [{ id: 'm6', count: 10 }], incomeBonus: 450, dropBonus: 100 },
            10: { materials: [{ id: 'm6', count: 20 }], incomeBonus: 666, dropBonus: 150 }
        };

// 桥接：把模块内 export 暴露到 window 全局，让 game.js(传统脚本)可直接引用
window.SURVIVOR_TYPES = SURVIVOR_TYPES;
window.STORY_INTRO = STORY_INTRO;
window.CHAPTER_STORIES = CHAPTER_STORIES;
window.QUALITY_COLORS = QUALITY_COLORS;
window.SETS = SETS;
window.GEMS = GEMS;
window.EQUIPMENT_TEMPLATES = EQUIPMENT_TEMPLATES;
window.MATERIALS = MATERIALS;
window.BOSS_TEMPLATES = BOSS_TEMPLATES;
window.SHELTER_UPGRADE_COST = SHELTER_UPGRADE_COST;
window.ENEMY_TYPES = ENEMY_TYPES;