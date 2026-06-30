// The 16 MBTI types grouped into the four 16Personalities families, plus a
// gender expansion to 32 selectable fighters. Colors recreate the reference
// art's family palette (Analysts=purple, Diplomats=green, Sentinels=blue,
// Explorers=yellow) — original procedural art, no copyrighted assets.

export const CATEGORIES = {
  Analysts: {
    name: "Analysts", cn: "分析家",
    colors: { main: "#7a5cc4", dark: "#523a8e", light: "#a98fde", accent: "#d9c7ff", skin: "#e7c4a4" },
  },
  Diplomats: {
    name: "Diplomats", cn: "外交家",
    colors: { main: "#3fa45b", dark: "#2c763f", light: "#7fd197", accent: "#c9f5d4", skin: "#e7c4a4" },
  },
  Sentinels: {
    name: "Sentinels", cn: "守护者",
    colors: { main: "#2f9bbf", dark: "#1f6c87", light: "#79cfe6", accent: "#cdf0fb", skin: "#e7c4a4" },
  },
  Explorers: {
    name: "Explorers", cn: "探险家",
    colors: { main: "#e0a92b", dark: "#a87b14", light: "#f4cf6a", accent: "#fff0c2", skin: "#e7c4a4" },
  },
};

// stats: health multiplier, walk speed, jump strength. Kept close to balanced.
export const TYPES = [
  // --- Analysts ---
  { type: "INTJ", role: "Architect", roleCN: "建筑师", category: "Analysts",
    special: "beam", specialName: "蓝图打击", stats: { health: 95, speed: 3.4, jump: -15 } },
  { type: "INTP", role: "Logician", roleCN: "逻辑学家", category: "Analysts",
    special: "bomb", specialName: "逻辑炸弹", stats: { health: 92, speed: 3.5, jump: -15 } },
  { type: "ENTJ", role: "Commander", roleCN: "指挥官", category: "Analysts",
    special: "rush", specialName: "统帅冲锋", stats: { health: 105, speed: 3.7, jump: -15 } },
  { type: "ENTP", role: "Debater", roleCN: "辩论家", category: "Analysts",
    special: "barrage", specialName: "舌战连击", stats: { health: 94, speed: 3.8, jump: -15.5 } },

  // --- Diplomats ---
  { type: "INFJ", role: "Advocate", roleCN: "提倡者", category: "Diplomats",
    special: "shield", specialName: "心灵之盾", stats: { health: 96, speed: 3.5, jump: -15 } },
  { type: "INFP", role: "Mediator", roleCN: "调停者", category: "Diplomats",
    special: "heal", specialName: "治愈之歌", stats: { health: 90, speed: 3.6, jump: -15.5 } },
  { type: "ENFJ", role: "Protagonist", roleCN: "主人公", category: "Diplomats",
    special: "inspire", specialName: "鼓舞冲击", stats: { health: 100, speed: 3.7, jump: -15 } },
  { type: "ENFP", role: "Campaigner", roleCN: "竞选者", category: "Diplomats",
    special: "whirlwind", specialName: "热情旋风", stats: { health: 95, speed: 3.9, jump: -16 } },

  // --- Sentinels ---
  { type: "ISTJ", role: "Logistician", roleCN: "物流师", category: "Sentinels",
    special: "armorstrike", specialName: "秩序铁拳", stats: { health: 108, speed: 3.3, jump: -14.5 } },
  { type: "ISFJ", role: "Defender", roleCN: "守卫者", category: "Sentinels",
    special: "counter", specialName: "守护反击", stats: { health: 106, speed: 3.3, jump: -14.5 } },
  { type: "ESTJ", role: "Executive", roleCN: "总经理", category: "Sentinels",
    special: "shockwave", specialName: "命令重锤", stats: { health: 104, speed: 3.5, jump: -15 } },
  { type: "ESFJ", role: "Consul", roleCN: "执政官", category: "Sentinels",
    special: "aura", specialName: "团结光环", stats: { health: 100, speed: 3.5, jump: -15 } },

  // --- Explorers ---
  { type: "ISTP", role: "Virtuoso", roleCN: "鉴赏家", category: "Explorers",
    special: "combo", specialName: "机械连段", stats: { health: 98, speed: 3.9, jump: -16 } },
  { type: "ISFP", role: "Adventurer", roleCN: "探险家", category: "Explorers",
    special: "burst", specialName: "艺术爆发", stats: { health: 94, speed: 3.8, jump: -16 } },
  { type: "ESTP", role: "Entrepreneur", roleCN: "企业家", category: "Explorers",
    special: "flyingkick", specialName: "极限飞踢", stats: { health: 100, speed: 4.0, jump: -16.5 } },
  { type: "ESFP", role: "Entertainer", roleCN: "表演者", category: "Explorers",
    special: "spotlight", specialName: "聚光灯秀", stats: { health: 96, speed: 3.9, jump: -16 } },
];

// Expand to 32 selectable characters (male / female variants share stats+special).
export const CHARACTERS = [];
for (const t of TYPES) {
  for (const gender of ["M", "F"]) {
    CHARACTERS.push({
      id: `${t.type}_${gender}`,
      gender,
      ...t,
      colors: CATEGORIES[t.category].colors,
    });
  }
}

export function getCharacter(id) {
  return CHARACTERS.find((c) => c.id === id);
}

// Order families like the reference image for the select grid.
export const FAMILY_ORDER = ["Analysts", "Diplomats", "Sentinels", "Explorers"];
