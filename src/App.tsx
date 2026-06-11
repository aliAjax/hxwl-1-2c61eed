import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { libraryDB } from "./library";

type Note = {
  id: string;
  name: string;
  color: string;
  profile: string;
  traits: Record<Trait, number>;
  isBasic: boolean;
  unlockCondition?: {
    type: "trait" | "score";
    trait?: Trait;
    minValue?: number;
    minScore?: number;
    description: string;
  };
};

type Trait = "fresh" | "sweet" | "wood" | "spice";

type SelectedNote = {
  noteId: string;
  drops: number;
};

type Creation = {
  id: string;
  name: string;
  originalName: string;
  score: number;
  description: string;
  traits?: Record<Trait, number>;
  notes: string[];
  noteDrops?: Record<string, number>;
  createdAt: string;
  sourceCreationId?: string;
  sourceCreationName?: string;
  isReplicate?: boolean;
  fragranceStructure?: FragranceStructure;
  phaseDescriptions?: Record<FragrancePhase, string>;
};

type ReplicateResult = {
  restoredNoteIds: string[];
  restoredNoteNames: string[];
  restoredNoteDrops: Record<string, number>;
  missingUnlockedNotes: string[];
  missingUnknownNotes: string[];
  originalNoteCount: number;
  restoredTraits: Record<Trait, number>;
};

type ImportResult = {
  success: Creation[];
  skipped: { creation: Partial<Creation> & { id?: string }; reason: string }[];
  successCount: number;
  skippedCount: number;
};

type MigrationReport = {
  count: number;
  recovered: number;
  deduped: number;
  corrupted: number;
};

type HistoryReplicateFilter = "all" | "original" | "replicate";
type HistorySortOption = "created-desc" | "created-asc" | "score-desc" | "score-asc";

type FragrancePhase = "top" | "middle" | "base";

type PhaseProfile = {
  phase: FragrancePhase;
  traits: Record<Trait, number>;
  dominantTrait: Trait;
  noteNames: string[];
  totalDrops: number;
};

type FragranceStructure = {
  top: PhaseProfile | null;
  middle: PhaseProfile | null;
  base: PhaseProfile | null;
  overallTraits: Record<Trait, number>;
  phaseCount: number;
};

const PAGE_SIZE = 20;

const MAX_NOTES = 5;
const MIN_DROPS_PER_NOTE = 1;
const MAX_DROPS_PER_NOTE = 10;
const MIN_TOTAL_DROPS = 2;
const MAX_TOTAL_DROPS = 30;
const DEFAULT_DROPS = 1;

const traitLabels: Record<Trait, string> = {
  fresh: "清新",
  sweet: "甜度",
  wood: "木质",
  spice: "辛辣"
};

const phaseLabels: Record<FragrancePhase, string> = {
  top: "前调",
  middle: "中调",
  base: "后调"
};

function getNotePhase(note: Note): FragrancePhase {
  const t = note.traits;
  const maxVal = Math.max(t.fresh, t.sweet, t.wood, t.spice);
  if (t.fresh === maxVal) return "top";
  if (t.wood === maxVal) return "base";
  return "middle";
}

const notes: Note[] = [
  {
    id: "rainleaf",
    name: "雨叶",
    color: "#75c7a5",
    profile: "潮湿、透明、像清晨窗边的绿叶。",
    traits: { fresh: 4, sweet: 1, wood: 0, spice: 0 },
    isBasic: true
  },
  {
    id: "pearjam",
    name: "梨酱",
    color: "#f4c95d",
    profile: "圆润的果甜，能把配方变得柔软。",
    traits: { fresh: 1, sweet: 4, wood: 0, spice: 0 },
    isBasic: true
  },
  {
    id: "cedar",
    name: "雪松屑",
    color: "#b77b54",
    profile: "干燥、安静，给香气一层骨架。",
    traits: { fresh: 0, sweet: 0, wood: 4, spice: 1 },
    isBasic: true
  },
  {
    id: "pepper",
    name: "粉胡椒",
    color: "#d96c63",
    profile: "明亮的刺激感，适合给尾调加火花。",
    traits: { fresh: 0, sweet: 0, wood: 1, spice: 4 },
    isBasic: true
  },
  {
    id: "milkflower",
    name: "奶白花",
    color: "#f7dfda",
    profile: "轻柔花香，甜而不腻。",
    traits: { fresh: 1, sweet: 3, wood: 0, spice: 1 },
    isBasic: true
  },
  {
    id: "smoketea",
    name: "烟茶",
    color: "#8d8f6f",
    profile: "微苦茶烟，适合做成熟的底色。",
    traits: { fresh: 1, sweet: 0, wood: 3, spice: 2 },
    isBasic: true
  },
  {
    id: "bamboodew",
    name: "竹露",
    color: "#a8d8c8",
    profile: "清冷的竹林气息，带着晨露的湿润。",
    traits: { fresh: 5, sweet: 0, wood: 1, spice: 0 },
    isBasic: false,
    unlockCondition: {
      type: "trait",
      trait: "fresh",
      minValue: 6,
      description: "创作出清新值 ≥ 6 的作品"
    }
  },
  {
    id: "honeycomb",
    name: "蜂巢",
    color: "#e8b84a",
    profile: "浓厚的蜜香，温暖而有包裹感。",
    traits: { fresh: 0, sweet: 5, wood: 1, spice: 0 },
    isBasic: false,
    unlockCondition: {
      type: "trait",
      trait: "sweet",
      minValue: 6,
      description: "创作出甜度值 ≥ 6 的作品"
    }
  },
  {
    id: "sandalwood",
    name: "檀木",
    color: "#a06a4a",
    profile: "醇厚的东方木香，沉稳而神秘。",
    traits: { fresh: 0, sweet: 1, wood: 5, spice: 0 },
    isBasic: false,
    unlockCondition: {
      type: "trait",
      trait: "wood",
      minValue: 6,
      description: "创作出木质值 ≥ 6 的作品"
    }
  },
  {
    id: "cinnamon",
    name: "桂皮",
    color: "#c45a3a",
    profile: "温热的辛香，像冬日壁炉旁的气息。",
    traits: { fresh: 0, sweet: 1, wood: 0, spice: 5 },
    isBasic: false,
    unlockCondition: {
      type: "trait",
      trait: "spice",
      minValue: 6,
      description: "创作出辛辣值 ≥ 6 的作品"
    }
  },
  {
    id: "jasmine",
    name: "夜茉莉",
    color: "#f0e6d2",
    profile: "夜晚绽放的白花，浓烈而优雅。",
    traits: { fresh: 2, sweet: 4, wood: 0, spice: 0 },
    isBasic: false,
    unlockCondition: {
      type: "score",
      minScore: 80,
      description: "创作出评分 ≥ 80 的作品"
    }
  },
  {
    id: "oudh",
    name: "沉香",
    color: "#6b4a3a",
    profile: "珍贵的沉香油，深邃而持久。",
    traits: { fresh: 0, sweet: 0, wood: 4, spice: 3 },
    isBasic: false,
    unlockCondition: {
      type: "score",
      minScore: 90,
      description: "创作出评分 ≥ 90 的作品"
    }
  },
  {
    id: "citruspeel",
    name: "柑橘皮",
    color: "#f2a93a",
    profile: "明亮的柑橘果皮，带着微苦的清新。",
    traits: { fresh: 3, sweet: 2, wood: 0, spice: 1 },
    isBasic: false,
    unlockCondition: {
      type: "trait",
      trait: "fresh",
      minValue: 8,
      description: "创作出清新值 ≥ 8 的作品"
    }
  },
  {
    id: "vanillabean",
    name: "香草豆",
    color: "#d4a574",
    profile: "柔滑的香草香气，甜美而温暖。",
    traits: { fresh: 0, sweet: 4, wood: 2, spice: 0 },
    isBasic: false,
    unlockCondition: {
      type: "trait",
      trait: "sweet",
      minValue: 8,
      description: "创作出甜度值 ≥ 8 的作品"
    }
  }
];

const noteStorageKey = "hxwl-1-unlocked-notes";
const draftStorageKey = "hxwl-1-draft";

type DraftData = {
  selectedNotes: SelectedNote[];
  customName: string;
  replicateSourceId?: string;
  replicateSourceName?: string;
  editingSourceId?: string;
  editingSourceName?: string;
};

function loadDraft(): DraftData | null {
  try {
    const raw = localStorage.getItem(draftStorageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.selectedNotes)) {
        return parsed as DraftData;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function saveDraft(data: DraftData) {
  try {
    if (data.selectedNotes.length === 0) {
      localStorage.removeItem(draftStorageKey);
    } else {
      localStorage.setItem(draftStorageKey, JSON.stringify(data));
    }
  } catch {
    // ignore
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(draftStorageKey);
  } catch {
    // ignore
  }
}

function getNoteById(id: string): Note | undefined {
  return notes.find((n) => n.id === id);
}

function getNoteByName(name: string): Note | undefined {
  return notes.find((n) => n.name === name);
}

function loadUnlockedNotes(): string[] {
  try {
    const raw = localStorage.getItem(noteStorageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((id) => typeof id === "string" && getNoteById(id));
      }
    }
  } catch {
    // ignore
  }
  return notes.filter((n) => n.isBasic).map((n) => n.id);
}

function saveUnlockedNotes(ids: string[]) {
  try {
    localStorage.setItem(noteStorageKey, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

function isNoteUnlocked(noteId: string, unlockedIds: string[]): boolean {
  return unlockedIds.includes(noteId);
}

function checkNoteUnlock(
  note: Note,
  traits: Record<Trait, number>,
  score: number
): boolean {
  if (note.isBasic) return true;
  if (!note.unlockCondition) return false;

  const { type, trait, minValue, minScore } = note.unlockCondition;
  if (type === "trait" && trait && minValue !== undefined) {
    return traits[trait] >= minValue;
  }
  if (type === "score" && minScore !== undefined) {
    return score >= minScore;
  }
  return false;
}

function getNewlyUnlockedNotes(
  traits: Record<Trait, number>,
  score: number,
  currentUnlockedIds: string[]
): Note[] {
  return notes.filter(
    (note) =>
      !currentUnlockedIds.includes(note.id) &&
      checkNoteUnlock(note, traits, score)
  );
}

function resolveCreationNoteIds(creation: Creation): string[] {
  const ids: string[] = [];
  for (const noteName of creation.notes) {
    const note = getNoteByName(noteName);
    if (note) {
      ids.push(note.id);
    }
  }
  return ids;
}

function resolveCreationNoteIdsLegacy(notes: string[]): string[] {
  const ids: string[] = [];
  for (const noteName of notes) {
    const note = getNoteByName(noteName);
    if (note) {
      ids.push(note.id);
    }
  }
  return ids;
}

function normalizeCreation(data: Partial<Creation> & { id: string }): Creation {
  const safeNotes = Array.isArray(data.notes) ? data.notes.filter((n) => typeof n === "string") : [];

  let safeNoteDrops: Record<string, number> | undefined;
  if (data.noteDrops && typeof data.noteDrops === "object") {
    safeNoteDrops = {};
    for (const [k, v] of Object.entries(data.noteDrops)) {
      if (typeof v === "number" && isFinite(v) && v > 0) {
        safeNoteDrops[k] = Math.min(Math.round(v), MAX_DROPS_PER_NOTE);
      }
    }
  }

  let safeTraits: Record<Trait, number> | undefined;
  if (data.traits && typeof data.traits === "object") {
    safeTraits = {
      fresh: typeof data.traits.fresh === "number" && isFinite(data.traits.fresh) ? data.traits.fresh : 0,
      sweet: typeof data.traits.sweet === "number" && isFinite(data.traits.sweet) ? data.traits.sweet : 0,
      wood: typeof data.traits.wood === "number" && isFinite(data.traits.wood) ? data.traits.wood : 0,
      spice: typeof data.traits.spice === "number" && isFinite(data.traits.spice) ? data.traits.spice : 0
    };
  } else if (safeNotes.length > 0) {
    const noteIds = resolveCreationNoteIdsLegacy(safeNotes);
    if (noteIds.length > 0) {
      const dropsMap = safeNoteDrops && Object.keys(safeNoteDrops).length > 0 ? safeNoteDrops : null;
      const computedTraits = noteIds.reduce(
        (total, noteId) => {
          const note = getNoteById(noteId);
          if (note) {
            const drops = dropsMap ? (dropsMap[noteId] || dropsMap[note.name] || DEFAULT_DROPS) : DEFAULT_DROPS;
            (Object.keys(total) as Trait[]).forEach((trait) => {
              total[trait] += note.traits[trait] * drops;
            });
          }
          return total;
        },
        { fresh: 0, sweet: 0, wood: 0, spice: 0 }
      );
      safeTraits = computedTraits;
      if (!safeNoteDrops || Object.keys(safeNoteDrops).length === 0) {
        safeNoteDrops = {};
        noteIds.forEach((id) => {
          const note = getNoteById(id);
          if (note) safeNoteDrops![note.name] = DEFAULT_DROPS;
        });
      }
    }
  }
  const hasAnyTrait = safeTraits && (safeTraits.fresh + safeTraits.sweet + safeTraits.wood + safeTraits.spice) > 0;

  return {
    id: data.id,
    name: typeof data.name === "string" && data.name ? data.name : "未命名作品",
    originalName: typeof data.originalName === "string" && data.originalName ? data.originalName : (typeof data.name === "string" && data.name ? data.name : "未命名作品"),
    score: typeof data.score === "number" && isFinite(data.score) ? data.score : 0,
    description: typeof data.description === "string" && data.description ? data.description : "暂无描述",
    traits: hasAnyTrait ? safeTraits : undefined,
    notes: safeNotes,
    noteDrops: safeNoteDrops,
    createdAt: typeof data.createdAt === "string" && data.createdAt ? data.createdAt : new Date().toISOString(),
    sourceCreationId: typeof data.sourceCreationId === "string" && data.sourceCreationId ? data.sourceCreationId : undefined,
    sourceCreationName: typeof data.sourceCreationName === "string" && data.sourceCreationName ? data.sourceCreationName : undefined,
    isReplicate: typeof data.isReplicate === "boolean" ? data.isReplicate : false,
    fragranceStructure: data.fragranceStructure && typeof data.fragranceStructure === "object" ? data.fragranceStructure : undefined,
    phaseDescriptions: data.phaseDescriptions && typeof data.phaseDescriptions === "object" ? data.phaseDescriptions : undefined
  };
}

function getCreationNoteDrops(creation: Creation): Record<string, number> {
  if (creation.noteDrops && Object.keys(creation.noteDrops).length > 0) {
    return creation.noteDrops;
  }
  const drops: Record<string, number> = {};
  creation.notes.forEach((name) => {
    drops[name] = DEFAULT_DROPS;
  });
  return drops;
}

function computeTraitsFromSelected(selected: SelectedNote[]): Record<Trait, number> {
  return selected.reduce(
    (total, item) => {
      const note = getNoteById(item.noteId);
      if (note) {
        (Object.keys(total) as Trait[]).forEach((trait) => {
          total[trait] += note.traits[trait] * item.drops;
        });
      }
      return total;
    },
    { fresh: 0, sweet: 0, wood: 0, spice: 0 }
  );
}

function getTotalDrops(selected: SelectedNote[]): number {
  return selected.reduce((sum, item) => sum + item.drops, 0);
}

function computeFragranceStructure(
  selected: SelectedNote[],
  overallTraits: Record<Trait, number>
): FragranceStructure {
  const phaseItems: Record<FragrancePhase, { note: Note; drops: number }[]> = {
    top: [],
    middle: [],
    base: []
  };

  for (const item of selected) {
    const note = getNoteById(item.noteId);
    if (note) {
      const phase = getNotePhase(note);
      phaseItems[phase].push({ note, drops: item.drops });
    }
  }

  function buildPhaseProfile(
    phase: FragrancePhase,
    items: { note: Note; drops: number }[]
  ): PhaseProfile | null {
    if (items.length === 0) return null;
    const traits: Record<Trait, number> = { fresh: 0, sweet: 0, wood: 0, spice: 0 };
    let totalDrops = 0;
    const noteNames: string[] = [];
    for (const { note, drops } of items) {
      (Object.keys(traits) as Trait[]).forEach((t) => {
        traits[t] += note.traits[t] * drops;
      });
      totalDrops += drops;
      noteNames.push(note.name);
    }
    const dominantTrait = (Object.keys(traits) as Trait[]).sort(
      (a, b) => traits[b] - traits[a]
    )[0];
    return { phase, traits, dominantTrait, noteNames, totalDrops };
  }

  const top = buildPhaseProfile("top", phaseItems.top);
  const middle = buildPhaseProfile("middle", phaseItems.middle);
  const base = buildPhaseProfile("base", phaseItems.base);
  const phaseCount = [top, middle, base].filter(Boolean).length;

  return { top, middle, base, overallTraits, phaseCount };
}

async function loadAllFromDB(): Promise<Creation[]> {
  try {
    return await libraryDB.getAll();
  } catch {
    return [];
  }
}

function describe(traits: Record<Trait, number>, selected: SelectedNote[]) {
  const structure = computeFragranceStructure(selected, traits);
  const topTrait = (Object.keys(traits) as Trait[]).sort((a, b) => traits[b] - traits[a])[0];
  const totalDrops = getTotalDrops(selected);
  const uniqueNotes = selected.length;
  const balancedTraits = Object.values(traits).filter((value) => value >= Math.max(...Object.values(traits)) * 0.4).length;

  const maxTraitValue = Math.max(...Object.values(traits));
  const dropDiversityBonus = uniqueNotes >= 4 ? 8 : uniqueNotes >= 3 ? 5 : uniqueNotes >= 2 ? 3 : 0;
  const concentrationBonus = Math.min(totalDrops * 1.2, 18);
  const balanceBonus = balancedTraits * 4;

  const phaseBonus = structure.phaseCount >= 3 ? 8 : structure.phaseCount >= 2 ? 4 : 0;
  let structureTransitionBonus = 0;
  if (
    structure.top && structure.top.dominantTrait === "fresh" &&
    structure.middle && (structure.middle.dominantTrait === "sweet" || structure.middle.dominantTrait === "spice") &&
    structure.base && structure.base.dominantTrait === "wood"
  ) {
    structureTransitionBonus = 5;
  }
  const score = Math.min(98, 35 + dropDiversityBonus + concentrationBonus + balanceBonus + Math.min(maxTraitValue, 20) + phaseBonus + structureTransitionBonus);

  const nameParts: Record<Trait, string[]> = {
    fresh: ["晨雾", "玻璃雨", "青叶"],
    sweet: ["糖梨", "柔光", "蜜径"],
    wood: ["木匣", "旧书", "雪松"],
    spice: ["火星", "胡椒月", "赤信"]
  };

  const suffix = totalDrops >= 15 ? "浓香水" : totalDrops >= 8 ? "淡香精" : structure.phaseCount >= 3 ? "三调" : uniqueNotes >= 4 ? "复调" : uniqueNotes >= 2 ? "短诗" : "试香";

  let name: string;
  if (structure.phaseCount >= 3 && structure.top && structure.middle && structure.base) {
    const topWord = nameParts[structure.top.dominantTrait][Math.floor(traits[structure.top.dominantTrait] / 3) % 3];
    const midWord = nameParts[structure.middle.dominantTrait][Math.floor(traits[structure.middle.dominantTrait] / 3) % 3];
    const baseWord = nameParts[structure.base.dominantTrait][Math.floor(traits[structure.base.dominantTrait] / 3) % 3];
    name = `${topWord}·${midWord}·${baseWord}${suffix}`;
  } else if (structure.phaseCount === 2) {
    const present = [structure.top, structure.middle, structure.base].filter((p): p is PhaseProfile => p !== null);
    const w1 = nameParts[present[0].dominantTrait][Math.floor(traits[present[0].dominantTrait] / 3) % 3];
    const w2 = nameParts[present[1].dominantTrait][Math.floor(traits[present[1].dominantTrait] / 3) % 3];
    name = `${w1}·${w2}${suffix}`;
  } else {
    name = `${nameParts[topTrait][Math.floor(traits[topTrait] / 3) % 3]}${suffix}`;
  }

  const phaseDescMap: Record<FragrancePhase, Record<Trait, string>> = {
    top: {
      fresh: "清新的绿意率先拂面，带着晨露般的透明感。",
      sweet: "轻柔的甜香开场，像远处飘来的果香。",
      wood: "沉稳的木质首先浮现，出人意料的开场。",
      spice: "辛辣的火花率先绽放，大胆而鲜明。"
    },
    middle: {
      fresh: "清新的气息延续，如微风穿行花间。",
      sweet: "甜美的核心逐渐绽放，包裹住整个嗅觉。",
      wood: "木质的中调沉稳展开，像翻开一本旧书。",
      spice: "辛香在心脏位置发热，带着温暖的个性。"
    },
    base: {
      fresh: "淡淡的清新留到最后，像雨后的空气。",
      sweet: "甜意绵延至尾声，像化不开的糖纸。",
      wood: "木质底色悠长而安静，是最后的记忆。",
      spice: "辛香的余温不散，带着微妙的暖意。"
    }
  };

  const phaseDescriptions: Record<FragrancePhase, string> = {
    top: structure.top ? phaseDescMap.top[structure.top.dominantTrait] : "",
    middle: structure.middle ? phaseDescMap.middle[structure.middle.dominantTrait] : "",
    base: structure.base ? phaseDescMap.base[structure.base.dominantTrait] : ""
  };

  let description: string;
  if (structure.phaseCount >= 3 && structure.top && structure.middle && structure.base) {
    description = `前调${phaseDescriptions.top}中调${phaseDescriptions.middle}后调${phaseDescriptions.base}三调层次分明，是一支完整的小诗。`;
  } else if (structure.phaseCount === 2) {
    const present = [structure.top, structure.middle, structure.base].filter((p): p is PhaseProfile => p !== null);
    const firstLabel = phaseLabels[present[0].phase];
    const secondLabel = phaseLabels[present[1].phase];
    description = `${firstLabel}${phaseDescMap[present[0].phase][present[0].dominantTrait]}随后${secondLabel}${phaseDescMap[present[1].phase][present[1].dominantTrait]}双层香气缓缓交替。`;
  } else {
    const singleDescMap: Record<Trait, string> = {
      fresh: "像刚打开的窗，干净、轻快，适合雨后出门。",
      sweet: "有柔软的果香和一点暖意，像藏在衣袋里的糖纸。",
      wood: "结构清楚，尾调安静，适合慢慢靠近。",
      spice: "第一秒就有亮点，辛香让整瓶作品更有脾气。"
    };
    description = singleDescMap[topTrait];
  }

  return {
    score: Math.round(score),
    name,
    description,
    fragranceStructure: structure,
    phaseDescriptions
  };
}

function analyzeReplicability(
  creation: Creation,
  unlockedIds: string[]
): {
  canReplicate: boolean;
  isPartial: boolean;
  unlockedCount: number;
  missingUnlockedNotes: string[];
  missingUnknownNotes: string[];
  allUnlocked: string[];
} {
  let unlockedCount = 0;
  const missingUnlocked: string[] = [];
  const missingUnknown: string[] = [];
  const allUnlocked: string[] = [];

  for (const noteName of creation.notes) {
    const note = getNoteByName(noteName);
    if (note) {
      if (unlockedIds.includes(note.id)) {
        unlockedCount++;
        allUnlocked.push(note.id);
      } else {
        missingUnlocked.push(noteName);
      }
    } else {
      missingUnknown.push(noteName);
    }
  }

  return {
    canReplicate: unlockedCount > 0,
    isPartial: unlockedCount > 0 && unlockedCount < creation.notes.length,
    unlockedCount,
    missingUnlockedNotes: missingUnlocked,
    missingUnknownNotes: missingUnknown,
    allUnlocked
  };
}

type QuizOption = {
  label: string;
  traitDelta: Partial<Record<Trait, number>>;
  intensityBoost?: number;
};

type QuizQuestion = {
  question: string;
  options: QuizOption[];
};

type RecommendedNote = {
  note: Note;
  recommendedDrops: number;
};

type NoteUnlockProgress = {
  note: Note;
  currentValue: number;
  targetValue: number;
  remaining: number;
  progressPercent: number;
  isScoreType: boolean;
  source: "history" | "current" | "both";
  sourceDetail: string;
};

type UnlockRecipeSuggestion = {
  targetNote: Note;
  recipe: { note: Note; drops: number }[];
  estimatedTraits: Record<Trait, number>;
  estimatedScore: number;
  reason: string;
  isScoreType: boolean;
  strategy: "incremental" | "historical" | "extreme";
};

const quizQuestions: QuizQuestion[] = [
  {
    question: "今天想要什么样的感觉？",
    options: [
      { label: "清冷通透", traitDelta: { fresh: 3 } },
      { label: "甜暖柔软", traitDelta: { sweet: 3 } },
      { label: "都想试试", traitDelta: { fresh: 1, sweet: 1 } }
    ]
  },
  {
    question: "更偏爱哪种底色？",
    options: [
      { label: "木质沉稳", traitDelta: { wood: 3 } },
      { label: "辛辣个性", traitDelta: { spice: 3 } },
      { label: "温和不刺激", traitDelta: { wood: 1, spice: 1 } }
    ]
  },
  {
    question: "香气的浓淡偏好？",
    options: [
      { label: "轻透淡雅", traitDelta: { fresh: 2 }, intensityBoost: -2 },
      { label: "刚好就好", traitDelta: {}, intensityBoost: 0 },
      { label: "浓郁有存在感", traitDelta: { sweet: 1, wood: 1, spice: 1 }, intensityBoost: 3 }
    ]
  },
  {
    question: "主要在什么场景使用？",
    options: [
      { label: "日常通勤 / 办公", traitDelta: { fresh: 2, wood: 1 }, intensityBoost: 0 },
      { label: "约会 / 社交聚会", traitDelta: { sweet: 2, spice: 1 }, intensityBoost: 1 },
      { label: "居家放松 / 睡前", traitDelta: { wood: 2, sweet: 1 }, intensityBoost: -1 },
      { label: "运动 / 户外活动", traitDelta: { fresh: 2, spice: 1 }, intensityBoost: 1 }
    ]
  },
  {
    question: "更偏爱哪个季节的氛围？",
    options: [
      { label: "春：万物复苏", traitDelta: { fresh: 2, sweet: 1 }, intensityBoost: 0 },
      { label: "夏：烈日海风", traitDelta: { fresh: 3 }, intensityBoost: -1 },
      { label: "秋：落叶暖阳", traitDelta: { wood: 2, sweet: 1 }, intensityBoost: 1 },
      { label: "冬：壁炉暖意", traitDelta: { spice: 2, wood: 1, sweet: 1 }, intensityBoost: 2 }
    ]
  }
];

function recommendNotes(
  quizTraits: Record<Trait, number>,
  intensityBoost: number,
  unlockedIds: string[],
  targetCount: number = 3
): RecommendedNote[] {
  const totalTraitWeight = Math.max(
    1,
    (Object.keys(quizTraits) as Trait[]).reduce((s, t) => s + quizTraits[t], 0)
  );
  const baseDrops = 5;
  const adjustedBase = Math.max(2, Math.min(8, baseDrops + intensityBoost));

  const scored = [...notes]
    .filter((note) => unlockedIds.includes(note.id))
    .map((note) => {
      let score = 0;
      (Object.keys(quizTraits) as Trait[]).forEach((trait) => {
        score += note.traits[trait] * quizTraits[trait];
      });
      return { note, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];

  const topNotes = scored.slice(0, Math.min(targetCount, scored.length));
  const topScore = Math.max(1, topNotes[0].score);

  return topNotes.map(({ note, score }) => {
    const ratio = score / topScore;
    const rawDrops = Math.max(1, Math.round(adjustedBase * ratio));
    const clampedDrops = Math.max(
      MIN_DROPS_PER_NOTE,
      Math.min(MAX_DROPS_PER_NOTE, rawDrops)
    );
    return { note, recommendedDrops: clampedDrops };
  });
}

function getCreationEffectiveTraits(creation: Creation): Record<Trait, number> | null {
  if (creation.traits && Object.values(creation.traits).some((v) => v > 0)) {
    return creation.traits;
  }
  const noteIds = resolveCreationNoteIdsLegacy(creation.notes || []);
  if (noteIds.length === 0) return null;
  const dropsMap = creation.noteDrops && Object.keys(creation.noteDrops).length > 0
    ? creation.noteDrops
    : null;
  return noteIds.reduce(
    (total, noteId) => {
      const note = getNoteById(noteId);
      if (note) {
        const drops = dropsMap
          ? (dropsMap[noteId] || dropsMap[note.name] || DEFAULT_DROPS)
          : DEFAULT_DROPS;
        (Object.keys(total) as Trait[]).forEach((trait) => {
          total[trait] += note.traits[trait] * drops;
        });
      }
      return total;
    },
    { fresh: 0, sweet: 0, wood: 0, spice: 0 }
  );
}

function computeNoteUnlockProgress(
  note: Note,
  history: Creation[],
  currentTraits: Record<Trait, number>,
  currentScore: number
): NoteUnlockProgress | null {
  if (note.isBasic || !note.unlockCondition) return null;

  const { type, trait, minValue, minScore } = note.unlockCondition;
  const isScoreType = type === "score";

  let historyBest = 0;
  let historySource = "";
  for (const creation of history) {
    if (isScoreType) {
      if (creation.score > historyBest) {
        historyBest = creation.score;
        historySource = creation.name;
      }
    } else if (trait) {
      const effTraits = getCreationEffectiveTraits(creation);
      if (effTraits && effTraits[trait] > historyBest) {
        historyBest = effTraits[trait];
        historySource = creation.name;
      }
    }
  }

  const currentVal = isScoreType ? currentScore : (trait ? currentTraits[trait] : 0);

  const targetValue = isScoreType ? (minScore ?? 0) : (minValue ?? 0);
  const currentValue = Math.max(historyBest, currentVal);
  const remaining = Math.max(0, targetValue - currentValue);
  const progressPercent = Math.min(100, (currentValue / targetValue) * 100);

  let source: "history" | "current" | "both" = "history";
  let sourceDetail = "";
  if (historyBest > 0 && currentVal > 0 && historyBest !== currentVal) {
    source = "both";
    sourceDetail = `历史最佳「${historySource}」${historyBest}，调香台当前 ${currentVal}`;
  } else if (currentVal > historyBest) {
    source = "current";
    sourceDetail = `调香台当前 ${currentVal}`;
  } else if (historyBest > 0) {
    source = "history";
    sourceDetail = `历史最佳「${historySource}」${historyBest}`;
  } else {
    source = "history";
    sourceDetail = "暂无记录";
  }

  return {
    note,
    currentValue,
    targetValue,
    remaining,
    progressPercent,
    isScoreType,
    source,
    sourceDetail
  };
}

function getAllUnlockProgress(
  history: Creation[],
  currentTraits: Record<Trait, number>,
  currentScore: number,
  unlockedNoteIds: string[]
): NoteUnlockProgress[] {
  return notes
    .filter((n) => !unlockedNoteIds.includes(n.id) && !n.isBasic)
    .map((n) => computeNoteUnlockProgress(n, history, currentTraits, currentScore))
    .filter((p): p is NoteUnlockProgress => p !== null)
    .sort((a, b) => a.remaining - b.remaining);
}

function estimateScoreFromTraitsAndNotes(
  traits: Record<Trait, number>,
  noteCount: number,
  totalDrops: number,
  selectedNotes?: SelectedNote[]
): number {
  const maxTraitValue = Math.max(...Object.values(traits));
  const dropDiversityBonus = noteCount >= 4 ? 8 : noteCount >= 3 ? 5 : noteCount >= 2 ? 3 : 0;
  const concentrationBonus = Math.min(totalDrops * 1.2, 18);
  const balancedTraits = Object.values(traits).filter(
    (value) => value >= Math.max(...Object.values(traits)) * 0.4
  ).length;
  const balanceBonus = balancedTraits * 4;

  let phaseBonus = 0;
  if (selectedNotes && selectedNotes.length > 0) {
    const structure = computeFragranceStructure(selectedNotes, traits);
    phaseBonus = structure.phaseCount >= 3 ? 8 : structure.phaseCount >= 2 ? 4 : 0;
    if (
      structure.top && structure.top.dominantTrait === "fresh" &&
      structure.middle && (structure.middle.dominantTrait === "sweet" || structure.middle.dominantTrait === "spice") &&
      structure.base && structure.base.dominantTrait === "wood"
    ) {
      phaseBonus += 5;
    }
  }

  return Math.min(98, Math.round(35 + dropDiversityBonus + concentrationBonus + balanceBonus + Math.min(maxTraitValue, 20) + phaseBonus));
}

function findBestHistoricalCreation(
  targetNote: Note,
  history: Creation[],
  unlockedNoteIds: string[]
): Creation | null {
  if (history.length === 0) return null;

  const isScoreType = targetNote.unlockCondition?.type === "score";
  const targetTrait = targetNote.unlockCondition?.trait;

  let best: Creation | null = null;
  let bestScore = -1;

  for (const creation of history) {
    const effTraits = getCreationEffectiveTraits(creation);
    if (!effTraits) continue;

    const unlockedNoteCount = creation.notes.filter((name) => {
      const n = getNoteByName(name);
      return n && unlockedNoteIds.includes(n.id);
    }).length;
    if (unlockedNoteCount < 2) continue;

    let candidateScore = 0;
    if (isScoreType) {
      candidateScore = creation.score;
    } else if (targetTrait) {
      candidateScore = effTraits[targetTrait] + creation.score * 0.05;
    }

    if (candidateScore > bestScore) {
      bestScore = candidateScore;
      best = creation;
    }
  }

  return best;
}

function buildRecipeFromCreation(
  creation: Creation,
  unlockedNoteIds: string[],
  targetTrait?: Trait,
  remainingNeeded: number = 0
): { note: Note; drops: number }[] | null {
  const creationDrops = getCreationNoteDrops(creation);
  const recipe: { note: Note; drops: number }[] = [];

  for (const noteName of creation.notes) {
    const note = getNoteByName(noteName);
    if (!note || !unlockedNoteIds.includes(note.id)) continue;
    if (recipe.length >= MAX_NOTES) break;
    const drops = Math.max(
      MIN_DROPS_PER_NOTE,
      Math.min(MAX_DROPS_PER_NOTE, creationDrops[noteName] || creationDrops[note.id] || DEFAULT_DROPS)
    );
    recipe.push({ note, drops });
  }

  if (recipe.length === 0) return null;

  if (targetTrait && remainingNeeded > 0) {
    const currentTraitValue = recipe.reduce(
      (sum, r) => sum + r.note.traits[targetTrait] * r.drops,
      0
    );
    if (currentTraitValue < remainingNeeded) {
      const traitNote = recipe
        .slice()
        .sort((a, b) => b.note.traits[targetTrait] - a.note.traits[targetTrait])[0];
      if (traitNote && traitNote.note.traits[targetTrait] > 0) {
        const extraDrops = Math.ceil(
          (remainingNeeded - currentTraitValue) / traitNote.note.traits[targetTrait]
        );
        const idx = recipe.findIndex((r) => r.note.id === traitNote.note.id);
        if (idx >= 0) {
          recipe[idx] = {
            ...recipe[idx],
            drops: Math.min(MAX_DROPS_PER_NOTE, recipe[idx].drops + Math.max(0, extraDrops))
          };
        }
      }
    }
  }

  let total = recipe.reduce((s, r) => s + r.drops, 0);
  if (total < MIN_TOTAL_DROPS) {
    let idx = 0;
    while (total < MIN_TOTAL_DROPS && idx < 1000) {
      const maxIdx = recipe.reduce(
        (mi, it, i) => (it.drops < recipe[mi].drops ? i : mi),
        0
      );
      if (recipe[maxIdx].drops < MAX_DROPS_PER_NOTE) {
        recipe[maxIdx].drops += 1;
        total += 1;
      }
      idx++;
    }
  }
  if (total > MAX_TOTAL_DROPS) {
    const scale = MAX_TOTAL_DROPS / total;
    let scaled = recipe.map((r) => ({
      ...r,
      drops: Math.max(MIN_DROPS_PER_NOTE, Math.round(r.drops * scale))
    }));
    let scaledTotal = scaled.reduce((s, r) => s + r.drops, 0);
    let idx = 0;
    while (scaledTotal > MAX_TOTAL_DROPS && idx < 1000) {
      const maxIdx = scaled.reduce(
        (mi, it, i) => (it.drops > scaled[mi].drops ? i : mi),
        0
      );
      if (scaled[maxIdx].drops > MIN_DROPS_PER_NOTE) {
        scaled[maxIdx].drops -= 1;
        scaledTotal -= 1;
      }
      idx++;
    }
    return scaled;
  }

  return recipe;
}

function ensureRecipeValid(
  recipe: { note: Note; drops: number }[]
): { note: Note; drops: number }[] {
  if (recipe.length === 0) return recipe;

  let result = recipe.map((r) => ({
    ...r,
    drops: Math.max(MIN_DROPS_PER_NOTE, Math.min(MAX_DROPS_PER_NOTE, r.drops))
  }));

  let total = result.reduce((s, r) => s + r.drops, 0);

  if (result.length === 1) {
    result[0].drops = Math.max(MIN_TOTAL_DROPS, result[0].drops);
    total = result[0].drops;
  }

  if (total < MIN_TOTAL_DROPS) {
    let idx = 0;
    while (total < MIN_TOTAL_DROPS && idx < 2000) {
      const maxIdx = result.reduce(
        (mi, it, i) => (it.drops < result[mi].drops ? i : mi),
        0
      );
      if (result[maxIdx].drops < MAX_DROPS_PER_NOTE) {
        result[maxIdx].drops += 1;
        total += 1;
      }
      idx++;
    }
  }

  if (total > MAX_TOTAL_DROPS) {
    const scale = MAX_TOTAL_DROPS / total;
    let scaled = result.map((r) => ({
      ...r,
      drops: Math.max(MIN_DROPS_PER_NOTE, Math.round(r.drops * scale))
    }));
    let scaledTotal = scaled.reduce((s, r) => s + r.drops, 0);
    let idx = 0;
    while (scaledTotal > MAX_TOTAL_DROPS && idx < 2000) {
      const maxIdx = scaled.reduce(
        (mi, it, i) => (it.drops > scaled[mi].drops ? i : mi),
        0
      );
      if (scaled[maxIdx].drops > MIN_DROPS_PER_NOTE) {
        scaled[maxIdx].drops -= 1;
        scaledTotal -= 1;
      }
      idx++;
    }
    while (scaledTotal < MIN_TOTAL_DROPS && scaled.length > 0 && idx < 4000) {
      const minIdx = scaled.reduce(
        (mi, it, i) => (it.drops < scaled[mi].drops ? i : mi),
        0
      );
      if (scaled[minIdx].drops < MAX_DROPS_PER_NOTE) {
        scaled[minIdx].drops += 1;
        scaledTotal += 1;
      }
      idx++;
    }
    result = scaled;
  }

  return result.map((r) => ({
    ...r,
    drops: Math.max(
      result.length === 1 ? MIN_TOTAL_DROPS : MIN_DROPS_PER_NOTE,
      Math.min(MAX_DROPS_PER_NOTE, r.drops)
    )
  }));
}

function buildTraitTargetRecipe(
  unlockedNotesList: Note[],
  targetTrait: Trait,
  remaining: number,
  noteCount: number = 1
): { recipe: { note: Note; drops: number }[]; reason: string } {
  const traitNotes = unlockedNotesList
    .filter((n) => n.traits[targetTrait] > 0)
    .sort((a, b) => b.traits[targetTrait] - a.traits[targetTrait]);

  if (traitNotes.length === 0) {
    const fallback = unlockedNotesList.slice(0, Math.min(noteCount, MAX_NOTES));
    const recipe = ensureRecipeValid(
      fallback.map((n) => ({ note: n, drops: Math.max(MIN_DROPS_PER_NOTE, 3) }))
    );
    return { recipe, reason: `基础配方尝试` };
  }

  const topNotes = traitNotes.slice(0, Math.min(noteCount, MAX_NOTES, traitNotes.length));
  const totalTraitPerDrop = topNotes.reduce((s, n) => s + n.traits[targetTrait], 0);
  const baseDrops = Math.max(1, Math.ceil(remaining / Math.max(1, totalTraitPerDrop)) + 2);

  const recipe = ensureRecipeValid(
    topNotes.map((n, i) => ({
      note: n,
      drops: Math.max(MIN_DROPS_PER_NOTE, baseDrops - Math.min(2, i))
    }))
  );

  if (noteCount === 1) {
    return {
      recipe,
      reason: `单香调主打「${topNotes[0].name}」，最大化${traitLabels[targetTrait]}`
    };
  } else if (noteCount === 2) {
    return {
      recipe,
      reason: `双香调叠加「${topNotes[0].name}」+「${topNotes[1]?.name || ""}」`
    };
  } else {
    return {
      recipe,
      reason: `${noteCount}种高${traitLabels[targetTrait]}香调复配`
    };
  }
}

function buildScoreTargetRecipe(
  unlockedNotesList: Note[],
  strategy: "balanced" | "trait-focused" | "max-diversity"
): { recipe: { note: Note; drops: number }[]; reason: string } {
  if (strategy === "balanced" || unlockedNotesList.length < 3) {
    const count = Math.min(MAX_NOTES, Math.max(2, unlockedNotesList.length));
    const notes = unlockedNotesList.slice(0, count);
    const recipe = ensureRecipeValid(
      notes.map((n) => ({
        note: n,
        drops: Math.max(MIN_DROPS_PER_NOTE, Math.floor(MAX_TOTAL_DROPS / count))
      }))
    );
    return {
      recipe,
      reason: `均衡搭配${count}种香调，追求平衡高分`,
    };
  }

  if (strategy === "trait-focused") {
    const byTrait: Record<Trait, Note[]> = { fresh: [], sweet: [], wood: [], spice: [] };
    unlockedNotesList.forEach((n) => {
      (Object.keys(byTrait) as Trait[]).forEach((t) => {
        if (n.traits[t] >= 2) byTrait[t].push(n);
      });
    });
    const sortedTraits = (Object.keys(byTrait) as Trait[]).sort(
      (a, b) => byTrait[b].length - byTrait[a].length
    );
    const picks: Note[] = [];
    for (const t of sortedTraits) {
      if (byTrait[t].length > 0 && picks.length < MAX_NOTES) {
        picks.push(byTrait[t][0]);
      }
    }
    if (picks.length < 2) {
      return buildScoreTargetRecipe(unlockedNotesList, "balanced");
    }
    const recipe = ensureRecipeValid(
      picks.map((n) => ({
        note: n,
        drops: Math.max(MIN_DROPS_PER_NOTE, Math.floor(MAX_TOTAL_DROPS / picks.length))
      }))
    );
    return {
      recipe,
      reason: `高特质香调组合，最大化浓度分`,
    };
  }

  const uniqueTraitNotes: Note[] = [];
  const coveredTraits = new Set<Trait>();
  for (const n of unlockedNotesList) {
    const traits = (Object.keys(n.traits) as Trait[]).filter((t) => n.traits[t] >= 2);
    if (traits.length > 0 && traits.some((t) => !coveredTraits.has(t))) {
      uniqueTraitNotes.push(n);
      traits.forEach((t) => coveredTraits.add(t));
    }
    if (uniqueTraitNotes.length >= MAX_NOTES) break;
  }
  if (uniqueTraitNotes.length < 3) {
    return buildScoreTargetRecipe(unlockedNotesList, "trait-focused");
  }
  const recipe = ensureRecipeValid(
    uniqueTraitNotes.map((n) => ({
      note: n,
      drops: Math.max(MIN_DROPS_PER_NOTE, Math.floor(MAX_TOTAL_DROPS / uniqueTraitNotes.length))
    }))
  );
  return {
    recipe,
    reason: `${uniqueTraitNotes.length}维度全覆盖，追求综合极限高分`,
  };
}

function recipeToSuggestion(
  recipe: { note: Note; drops: number }[],
  targetNote: Note,
  isScoreType: boolean,
  reason: string,
  strategy: "incremental" | "historical" | "extreme"
): UnlockRecipeSuggestion {
  const validRecipe = ensureRecipeValid(recipe);
  const selected = validRecipe.map((r) => ({ noteId: r.note.id, drops: r.drops }));
  const traits = computeTraitsFromSelected(selected);
  const total = validRecipe.reduce((s, r) => s + r.drops, 0);
  return {
    targetNote,
    recipe: validRecipe,
    estimatedTraits: traits,
    estimatedScore: estimateScoreFromTraitsAndNotes(traits, validRecipe.length, total, selected),
    reason,
    isScoreType,
    strategy
  };
}

function suggestUnlockRecipes(
  targetProgress: NoteUnlockProgress,
  unlockedNoteIds: string[],
  history: Creation[],
  currentSelected: SelectedNote[],
  suggestionCount: number = 3
): UnlockRecipeSuggestion[] {
  const { note: targetNote, isScoreType, remaining, currentValue, targetValue } = targetProgress;
  const unlockedNotesList = notes.filter((n) => unlockedNoteIds.includes(n.id));
  const suggestions: UnlockRecipeSuggestion[] = [];

  if (unlockedNotesList.length === 0) return suggestions;

  const existingIds = new Set(currentSelected.map((s) => s.noteId));
  const existingNotes = currentSelected
    .map((s) => {
      const note = getNoteById(s.noteId);
      return note ? { note, drops: s.drops } : null;
    })
    .filter((x): x is { note: Note; drops: number } => x !== null);

  const currentTraitsBase = computeTraitsFromSelected(currentSelected);
  const needMore = remaining > 0;

  const getRecipeSignature = (recipe: { note: Note; drops: number }[]): string => {
    return recipe
      .map((r) => `${r.note.id}:${r.drops}`)
      .sort()
      .join("|");
  };

  const existingSignatures = new Set<string>();

  const addIfUnique = (suggestion: UnlockRecipeSuggestion | null) => {
    if (!suggestion || suggestion.recipe.length === 0) return false;
    const sig = getRecipeSignature(suggestion.recipe);
    if (existingSignatures.has(sig)) return false;
    existingSignatures.add(sig);
    suggestions.push(suggestion);
    return true;
  };

  const hasStrategy = (strategy: "incremental" | "historical" | "extreme"): boolean => {
    return suggestions.some((s) => s.strategy === strategy);
  };

  if (!isScoreType && targetNote.unlockCondition?.trait) {
    const targetTrait = targetNote.unlockCondition.trait;

    const traitNotes = unlockedNotesList
      .filter((n) => n.traits[targetTrait] > 0)
      .sort((a, b) => b.traits[targetTrait] - a.traits[targetTrait]);

    if (traitNotes.length === 0) {
      const fallback = buildTraitTargetRecipe(unlockedNotesList, "fresh", remaining, 2);
      addIfUnique(
        recipeToSuggestion(fallback.recipe, targetNote, isScoreType, fallback.reason, "incremental")
      );
    } else {
      const incrementalRecipe = (() => {
        if (existingNotes.length === 0) {
          const fallback = buildTraitTargetRecipe(unlockedNotesList, targetTrait, remaining, 2);
          return {
            recipe: fallback.recipe,
            traits: computeTraitsFromSelected(
              fallback.recipe.map((r) => ({ noteId: r.note.id, drops: r.drops }))
            ),
            total: fallback.recipe.reduce((s, r) => s + r.drops, 0),
            reason: `推荐起点：${fallback.reason}`
          };
        }

        const currentTraitVal = currentTraitsBase[targetTrait];
        if (!needMore && currentTraitVal >= targetValue) {
          const traits = computeTraitsFromSelected(
            existingNotes.map((e) => ({ noteId: e.note.id, drops: e.drops }))
          );
          const total = existingNotes.reduce((s, e) => s + e.drops, 0);
          return {
            recipe: existingNotes.map((e) => ({ note: e.note, drops: e.drops })),
            traits,
            total,
            reason: `当前配方已满足条件，可直接封瓶`
          };
        }

        const needed = Math.max(0, targetValue - currentTraitVal);
        const availableSlots = MAX_NOTES - existingNotes.length;
        if (availableSlots <= 0) {
          const bestTraitNote = existingNotes
            .slice()
            .sort((a, b) => b.note.traits[targetTrait] - a.note.traits[targetTrait])[0];
          if (bestTraitNote && bestTraitNote.note.traits[targetTrait] > 0) {
            const currentTotal = existingNotes.reduce((s, e) => s + e.drops, 0);
            const availableDrops = MAX_TOTAL_DROPS - currentTotal;
            if (availableDrops > 0) {
              const extraDrops = Math.min(
                availableDrops,
                Math.ceil(needed / bestTraitNote.note.traits[targetTrait])
              );
              const recipe = existingNotes.map((e) =>
                e.note.id === bestTraitNote.note.id
                  ? { note: e.note, drops: Math.min(MAX_DROPS_PER_NOTE, e.drops + extraDrops) }
                  : { note: e.note, drops: e.drops }
              );
              const total = recipe.reduce((s, r) => s + r.drops, 0);
              const traits = computeTraitsFromSelected(
                recipe.map((r) => ({ noteId: r.note.id, drops: r.drops }))
              );
              return {
                recipe,
                traits,
                total,
                reason: `增加「${bestTraitNote.note.name}」${extraDrops} 滴，补足${traitLabels[targetTrait]}`
              };
            }
          }
          return {
            recipe: existingNotes.map((e) => ({ note: e.note, drops: e.drops })),
            traits: currentTraitsBase,
            total: existingNotes.reduce((s, e) => s + e.drops, 0),
            reason: `维持当前配方，尝试封瓶`
          };
        }

        const newTraitNotes = traitNotes.filter((n) => !existingIds.has(n.id));
        if (newTraitNotes.length === 0) {
          const bestTraitNote = existingNotes
            .slice()
            .sort((a, b) => b.note.traits[targetTrait] - a.note.traits[targetTrait])[0];
          if (bestTraitNote && bestTraitNote.note.traits[targetTrait] > 0) {
            const currentTotal = existingNotes.reduce((s, e) => s + e.drops, 0);
            const availableDrops = MAX_TOTAL_DROPS - currentTotal;
            if (availableDrops > 0) {
              const extraDrops = Math.min(
                availableDrops,
                Math.max(1, Math.ceil(needed / bestTraitNote.note.traits[targetTrait]))
              );
              const recipe = existingNotes.map((e) =>
                e.note.id === bestTraitNote.note.id
                  ? { note: e.note, drops: Math.min(MAX_DROPS_PER_NOTE, e.drops + extraDrops) }
                  : { note: e.note, drops: e.drops }
              );
              const total = recipe.reduce((s, r) => s + r.drops, 0);
              const traits = computeTraitsFromSelected(
                recipe.map((r) => ({ noteId: r.note.id, drops: r.drops }))
              );
              return {
                recipe,
                traits,
                total,
                reason: `提浓「${bestTraitNote.note.name}」，增加 ${extraDrops} 滴`
              };
            }
          }
          return {
            recipe: existingNotes.map((e) => ({ note: e.note, drops: e.drops })),
            traits: currentTraitsBase,
            total: existingNotes.reduce((s, e) => s + e.drops, 0),
            reason: `维持当前配方，尝试封瓶`
          };
        }

        const topNewNote = newTraitNotes[0];
        const dropsToAdd = Math.min(
          MAX_DROPS_PER_NOTE,
          Math.max(1, Math.ceil(needed / topNewNote.traits[targetTrait]))
        );
        const existingTotal = existingNotes.reduce((s, e) => s + e.drops, 0);
        const safeDrops = Math.max(
          MIN_DROPS_PER_NOTE,
          Math.min(dropsToAdd, MAX_TOTAL_DROPS - existingTotal)
        );

        const recipe = [
          ...existingNotes.map((e) => ({ note: e.note, drops: e.drops })),
          { note: topNewNote, drops: safeDrops }
        ];
        const total = recipe.reduce((s, r) => s + r.drops, 0);
        const traits = computeTraitsFromSelected(
          recipe.map((r) => ({ noteId: r.note.id, drops: r.drops }))
        );
        return {
          recipe,
          traits,
          total,
          reason: `加入「${topNewNote.name}」${safeDrops} 滴，在现有配方基础上突破`
        };
      })();

      if (incrementalRecipe) {
        addIfUnique({
          targetNote,
          recipe: ensureRecipeValid(incrementalRecipe.recipe),
          estimatedTraits: incrementalRecipe.traits,
          estimatedScore: estimateScoreFromTraitsAndNotes(
            incrementalRecipe.traits,
            incrementalRecipe.recipe.length,
            incrementalRecipe.total,
            incrementalRecipe.recipe.map((r) => ({ noteId: r.note.id, drops: r.drops }))
          ),
          reason: incrementalRecipe.reason,
          isScoreType,
          strategy: "incremental"
        });
      }

      const bestHistorical = findBestHistoricalCreation(targetNote, history, unlockedNoteIds);
      if (bestHistorical) {
        const histRecipe = buildRecipeFromCreation(
          bestHistorical,
          unlockedNoteIds,
          targetTrait,
          remaining
        );
        if (histRecipe && histRecipe.length > 0) {
          addIfUnique(
            recipeToSuggestion(
              histRecipe,
              targetNote,
              isScoreType,
              `参考历史最佳「${bestHistorical.name}」，经典配方验证`,
              "historical"
            )
          );
        }
      }

      if (!hasStrategy("historical")) {
        if (traitNotes.length >= 2) {
          const histFallback = buildTraitTargetRecipe(unlockedNotesList, targetTrait, remaining, 2);
          addIfUnique(
            recipeToSuggestion(
              histFallback.recipe,
              targetNote,
              isScoreType,
              `经典双香：${histFallback.reason}`,
              "historical"
            )
          );
        } else if (traitNotes.length >= 1) {
          const altNote = unlockedNotesList.find((n) => n.id !== traitNotes[0].id);
          if (altNote) {
            const combo = ensureRecipeValid([
              { note: traitNotes[0], drops: Math.max(MIN_DROPS_PER_NOTE, 4) },
              { note: altNote, drops: Math.max(MIN_DROPS_PER_NOTE, 3) }
            ]);
            addIfUnique(
              recipeToSuggestion(
                combo,
                targetNote,
                isScoreType,
                `经典组合：「${traitNotes[0].name}」+「${altNote.name}」`,
                "historical"
              )
            );
          }
        }
      }

      if (traitNotes.length >= 1) {
        const topNote = traitNotes[0];
        const dropsNeeded = Math.min(
          MAX_DROPS_PER_NOTE,
          Math.max(MIN_TOTAL_DROPS, Math.ceil(remaining / Math.max(1, topNote.traits[targetTrait])) + 2)
        );
        addIfUnique(
          recipeToSuggestion(
            [{ note: topNote, drops: dropsNeeded }],
            targetNote,
            isScoreType,
            `极致单香：「${topNote.name}」${dropsNeeded} 滴，最大化${traitLabels[targetTrait]}`,
            "extreme"
          )
        );
      }

      if (!hasStrategy("extreme") && traitNotes.length >= 2) {
        const extreme = buildTraitTargetRecipe(unlockedNotesList, targetTrait, remaining, 3);
        addIfUnique(
          recipeToSuggestion(extreme.recipe, targetNote, isScoreType, `极致复配：${extreme.reason}`, "extreme")
        );
      }
    }
  } else if (isScoreType) {
    const existingTotal = existingNotes.reduce((s, e) => s + e.drops, 0);

    const incrementalRecipe = (() => {
      if (existingNotes.length === 0) {
        const fallback = buildScoreTargetRecipe(unlockedNotesList, "balanced");
        return {
          recipe: fallback.recipe,
          traits: computeTraitsFromSelected(
            fallback.recipe.map((r) => ({ noteId: r.note.id, drops: r.drops }))
          ),
          total: fallback.recipe.reduce((s, r) => s + r.drops, 0),
          reason: `推荐起点：${fallback.reason}`
        };
      }

      if (!needMore && currentValue >= targetValue) {
        const traits = computeTraitsFromSelected(
          existingNotes.map((e) => ({ noteId: e.note.id, drops: e.drops }))
        );
        return {
          recipe: existingNotes.map((e) => ({ note: e.note, drops: e.drops })),
          traits,
          total: existingTotal,
          reason: `当前配方已达 ${currentValue} 分，可直接封瓶`
        };
      }

      const availableSlots = MAX_NOTES - existingNotes.length;
      const availableDrops = MAX_TOTAL_DROPS - existingTotal;

      if (availableSlots <= 0 || availableDrops <= 0) {
        return {
          recipe: existingNotes.map((e) => ({ note: e.note, drops: e.drops })),
          traits: currentTraitsBase,
          total: existingTotal,
          reason: existingNotes.length >= 3
            ? `维持当前多香调配方，尝试封瓶获取评分`
            : `当前配方已满，尝试封瓶`
        };
      }

      const traitCoverage: Record<Trait, boolean> = { fresh: false, sweet: false, wood: false, spice: false };
      existingNotes.forEach((e) => {
        (Object.keys(traitCoverage) as Trait[]).forEach((t) => {
          if (e.note.traits[t] >= 2) traitCoverage[t] = true;
        });
      });

      const missingTraits = (Object.keys(traitCoverage) as Trait[]).filter((t) => !traitCoverage[t]);
      const candidates = unlockedNotesList
        .filter((n) => !existingIds.has(n.id))
        .filter((n) => missingTraits.some((t) => n.traits[t] >= 2))
        .sort((a, b) => {
          const aCoverage = missingTraits.filter((t) => a.traits[t] >= 2).length;
          const bCoverage = missingTraits.filter((t) => b.traits[t] >= 2).length;
          if (aCoverage !== bCoverage) return bCoverage - aCoverage;
          return Math.max(...Object.values(b.traits)) - Math.max(...Object.values(a.traits));
        });

      if (candidates.length > 0) {
        const toAdd = candidates.slice(0, Math.min(availableSlots, missingTraits.length, 2));
        const dropsPerNew = Math.min(
          MAX_DROPS_PER_NOTE,
          Math.max(MIN_DROPS_PER_NOTE, Math.floor(availableDrops / toAdd.length))
        );
        const recipe = [
          ...existingNotes.map((e) => ({ note: e.note, drops: e.drops })),
          ...toAdd.map((n) => ({ note: n, drops: dropsPerNew }))
        ];
        const total = recipe.reduce((s, r) => s + r.drops, 0);
        const traits = computeTraitsFromSelected(
          recipe.map((r) => ({ noteId: r.note.id, drops: r.drops }))
        );
        return {
          recipe,
          traits,
          total,
          reason: `补充${toAdd.map((n) => `「${n.name}」`).join("")}，补齐气味维度提升评分`
        };
      }

      return {
        recipe: existingNotes.map((e) => ({ note: e.note, drops: e.drops })),
        traits: currentTraitsBase,
        total: existingTotal,
        reason: `维持当前配方，尝试封瓶`
      };
    })();

    if (incrementalRecipe) {
      addIfUnique({
        targetNote,
        recipe: ensureRecipeValid(incrementalRecipe.recipe),
        estimatedTraits: incrementalRecipe.traits,
        estimatedScore: estimateScoreFromTraitsAndNotes(
          incrementalRecipe.traits,
          incrementalRecipe.recipe.length,
          incrementalRecipe.total,
          incrementalRecipe.recipe.map((r) => ({ noteId: r.note.id, drops: r.drops }))
        ),
        reason: incrementalRecipe.reason,
        isScoreType,
        strategy: "incremental"
      });
    }

    const bestHistorical = findBestHistoricalCreation(targetNote, history, unlockedNoteIds);
    if (bestHistorical && bestHistorical.score >= Math.max(60, targetValue * 0.5)) {
      const histRecipe = buildRecipeFromCreation(bestHistorical, unlockedNoteIds);
      if (histRecipe && histRecipe.length >= 2) {
        addIfUnique(
          recipeToSuggestion(
            histRecipe,
            targetNote,
            isScoreType,
            `参考历史高分「${bestHistorical.name}」(${bestHistorical.score}分)，稳定路线`,
            "historical"
          )
        );
      }
    }

    if (!hasStrategy("historical")) {
      const histFallback = buildScoreTargetRecipe(unlockedNotesList, "trait-focused");
      addIfUnique(
        recipeToSuggestion(
          histFallback.recipe,
          targetNote,
          isScoreType,
          `经典组合：${histFallback.reason}`,
          "historical"
        )
      );
    }

    const extreme = buildScoreTargetRecipe(unlockedNotesList, "max-diversity");
    if (extreme.recipe.length >= 2) {
      addIfUnique(
        recipeToSuggestion(
          extreme.recipe,
          targetNote,
          isScoreType,
          `极致路线：${extreme.reason}`,
          "extreme"
        )
      );
    }

    if (!hasStrategy("extreme")) {
      const balanced = buildScoreTargetRecipe(unlockedNotesList, "balanced");
      addIfUnique(
        recipeToSuggestion(
          balanced.recipe,
          targetNote,
          isScoreType,
          `均衡路线：${balanced.reason}`,
          "extreme"
        )
      );
    }
  }

  if (suggestions.length === 0 && unlockedNotesList.length > 0) {
    const defaultRecipe = ensureRecipeValid(
      unlockedNotesList.slice(0, Math.min(2, MAX_NOTES)).map((n) => ({
        note: n,
        drops: Math.max(MIN_DROPS_PER_NOTE, 4)
      }))
    );
    addIfUnique(
      recipeToSuggestion(defaultRecipe, targetNote, isScoreType, `基础尝试配方`, "incremental")
    );
  }

  const strategiesNeeded: ("incremental" | "historical" | "extreme")[] = [
    "incremental",
    "historical",
    "extreme"
  ];

  for (const strategy of strategiesNeeded) {
    if (suggestions.length >= suggestionCount) break;
    if (hasStrategy(strategy)) continue;

    if (!isScoreType && targetNote.unlockCondition?.trait) {
      const targetTrait = targetNote.unlockCondition.trait;
      const noteCount = strategy === "extreme" ? 1 : strategy === "historical" ? 2 : 2;
      const fallback = buildTraitTargetRecipe(unlockedNotesList, targetTrait, remaining, noteCount);
      addIfUnique(
        recipeToSuggestion(fallback.recipe, targetNote, isScoreType, fallback.reason, strategy)
      );
    } else if (isScoreType) {
      const strat = strategy === "incremental" ? "balanced" : strategy === "historical" ? "trait-focused" : "max-diversity";
      const fallback = buildScoreTargetRecipe(unlockedNotesList, strat);
      addIfUnique(
        recipeToSuggestion(fallback.recipe, targetNote, isScoreType, fallback.reason, strategy)
      );
    }
  }

  let variantCounter = 0;
  while (suggestions.length < suggestionCount && variantCounter < 10) {
    variantCounter++;
    if (!isScoreType && targetNote.unlockCondition?.trait) {
      const targetTrait = targetNote.unlockCondition.trait;
      const altCount = 2 + (variantCounter % 2);
      const variant = buildTraitTargetRecipe(unlockedNotesList, targetTrait, remaining + variantCounter, altCount);
      const success = addIfUnique(
        recipeToSuggestion(
          variant.recipe,
          targetNote,
          isScoreType,
          `变体${variantCounter}：${variant.reason}`,
          variantCounter % 2 === 0 ? "historical" : "extreme"
        )
      );
      if (!success && unlockedNotesList.length > 0) {
        const altNote = unlockedNotesList[variantCounter % unlockedNotesList.length];
        const recipe = ensureRecipeValid([{ note: altNote, drops: MIN_TOTAL_DROPS }]);
        addIfUnique(
          recipeToSuggestion(
            recipe,
            targetNote,
            isScoreType,
            `变体${variantCounter}：单香「${altNote.name}」尝试`,
            "extreme"
          )
        );
      }
    } else if (isScoreType) {
      const strategies: Array<"balanced" | "trait-focused" | "max-diversity"> = ["balanced", "trait-focused", "max-diversity"];
      const strat = strategies[variantCounter % strategies.length];
      const variant = buildScoreTargetRecipe(unlockedNotesList, strat);
      const success = addIfUnique(
        recipeToSuggestion(
          variant.recipe,
          targetNote,
          isScoreType,
          `变体${variantCounter}：${variant.reason}`,
          variantCounter % 2 === 0 ? "historical" : "extreme"
        )
      );
      if (!success && unlockedNotesList.length >= 2) {
        const idx1 = variantCounter % unlockedNotesList.length;
        const idx2 = (variantCounter + 1) % unlockedNotesList.length;
        if (idx1 !== idx2) {
          const recipe = ensureRecipeValid([
            { note: unlockedNotesList[idx1], drops: 4 },
            { note: unlockedNotesList[idx2], drops: 3 }
          ]);
          addIfUnique(
            recipeToSuggestion(
              recipe,
              targetNote,
              isScoreType,
              `变体${variantCounter}：「${unlockedNotesList[idx1].name}」+「${unlockedNotesList[idx2].name}」`,
              "historical"
            )
          );
        }
      }
    }
  }

  return suggestions.slice(0, suggestionCount);
}

export default function App() {
  const [selectedNotes, setSelectedNotes] = useState<SelectedNote[]>(() => {
    const draft = loadDraft();
    if (draft && draft.selectedNotes.length > 0) {
      const valid = draft.selectedNotes.filter(
        (s) => typeof s.noteId === "string" && typeof s.drops === "number" && getNoteById(s.noteId)
      );
      if (valid.length > 0) return valid;
    }
    return [];
  });
  const [history, setHistory] = useState<Creation[]>([]);
  const [dbReady, setDbReady] = useState(false);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyNameFilter, setHistoryNameFilter] = useState("");
  const [historyNoteFilter, setHistoryNoteFilter] = useState("");
  const [historyScoreMin, setHistoryScoreMin] = useState("");
  const [historyScoreMax, setHistoryScoreMax] = useState("");
  const [historyReplicateFilter, setHistoryReplicateFilter] = useState<HistoryReplicateFilter>("all");
  const [historySort, setHistorySort] = useState<HistorySortOption>("created-desc");
  const [historyFiltersOpen, setHistoryFiltersOpen] = useState(false);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [customName, setCustomName] = useState<string>(() => {
    const draft = loadDraft();
    return draft?.customName || "";
  });
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [pendingCustomName, setPendingCustomName] = useState<string>("");
  const [activeCreation, setActiveCreation] = useState<Creation | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [quizTraits, setQuizTraits] = useState<Record<Trait, number>>({ fresh: 0, sweet: 0, wood: 0, spice: 0 });
  const [quizIntensity, setQuizIntensity] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareId1, setCompareId1] = useState<string | null>(null);
  const [compareId2, setCompareId2] = useState<string | null>(null);
  const [unlockedNoteIds, setUnlockedNoteIds] = useState<string[]>(loadUnlockedNotes);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Note[]>([]);
  const [unlockNotificationOpen, setUnlockNotificationOpen] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);
  const [replicateSource, setReplicateSource] = useState<Creation | null>(() => {
    const draft = loadDraft();
    if (draft?.replicateSourceId && draft?.replicateSourceName) {
      return {
        id: draft.replicateSourceId,
        name: draft.replicateSourceName,
        originalName: draft.replicateSourceName,
        score: 0,
        description: "",
        notes: [],
        createdAt: new Date().toISOString()
      } as Creation;
    }
    return null;
  });
  const [replicateNotificationOpen, setReplicateNotificationOpen] = useState(false);
  const [replicateResult, setReplicateResult] = useState<ReplicateResult | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth());
  const [calendarSelectedDay, setCalendarSelectedDay] = useState<number | null>(null);
  const [importNotificationOpen, setImportNotificationOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [draftBannerVisible, setDraftBannerVisible] = useState<boolean>(() => loadDraft() !== null);
  const [unlockProgressOpen, setUnlockProgressOpen] = useState<boolean>(false);
  const [selectedProgressNoteId, setSelectedProgressNoteId] = useState<string | null>(null);
  const [editingSource, setEditingSource] = useState<Creation | null>(() => {
    const draft = loadDraft();
    if (draft?.editingSourceId && draft?.editingSourceName) {
      return {
        id: draft.editingSourceId,
        name: draft.editingSourceName,
        originalName: draft.editingSourceName,
        score: 0,
        description: "",
        notes: [],
        createdAt: new Date().toISOString()
      } as Creation;
    }
    return null;
  });
  const [saveDialogOpen, setSaveDialogOpen] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reloadHistory = useCallback(async () => {
    const all = await loadAllFromDB();
    setHistory(all);
  }, []);

  useEffect(() => {
    let mounted = true;
    libraryDB.init(async () => {
      if (mounted) {
        const all = await loadAllFromDB();
        if (mounted) setHistory(all);
      }
    }).then(async (result) => {
      if (!mounted) return;
      if (result.migrationReport && result.migrationReport.count > 0) {
        setMigrationReport(result.migrationReport);
      }
      const all = await loadAllFromDB();
      if (mounted) {
        setHistory(all);
        setDbReady(true);
      }
    }).catch(async () => {
      if (mounted) {
        const all = await loadAllFromDB();
        if (mounted) {
          setHistory(all);
          setDbReady(true);
        }
      }
    });
    return () => { mounted = false; libraryDB.destroy(); };
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        reloadHistory();
      }
    };
    const handleFocus = () => {
      reloadHistory();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [reloadHistory]);

  useEffect(() => {
    if (selectedNotes.length > 0) {
      saveDraft({
        selectedNotes,
        customName,
        replicateSourceId: replicateSource?.id,
        replicateSourceName: replicateSource?.name,
        editingSourceId: editingSource?.id,
        editingSourceName: editingSource?.name
      });
    } else {
      clearDraft();
    }
  }, [selectedNotes, customName, replicateSource, editingSource]);

  const unlockedNotes = useMemo(
    () => notes.filter((note) => unlockedNoteIds.includes(note.id)),
    [unlockedNoteIds]
  );

  const lockedNotes = useMemo(
    () => notes.filter((note) => !unlockedNoteIds.includes(note.id)),
    [unlockedNoteIds]
  );

  const displayNotes = useMemo(
    () => (showAllNotes ? [...unlockedNotes, ...lockedNotes] : unlockedNotes),
    [showAllNotes, unlockedNotes, lockedNotes]
  );

  const hasHistoryFilters = Boolean(
    historyNameFilter.trim() ||
    historyNoteFilter.trim() ||
    historyScoreMin.trim() ||
    historyScoreMax.trim() ||
    historyReplicateFilter !== "all"
  );

  const filteredAndSortedHistory = useMemo(() => {
    const nameQuery = historyNameFilter.trim().toLowerCase();
    const noteQuery = historyNoteFilter.trim().toLowerCase();
    const minScore = historyScoreMin.trim() === "" ? null : Number(historyScoreMin);
    const maxScore = historyScoreMax.trim() === "" ? null : Number(historyScoreMax);
    const hasMinScore = minScore !== null && Number.isFinite(minScore);
    const hasMaxScore = maxScore !== null && Number.isFinite(maxScore);

    return history
      .filter((creation) => {
        if (nameQuery) {
          const names = `${creation.name} ${creation.originalName}`.toLowerCase();
          if (!names.includes(nameQuery)) return false;
        }
        if (noteQuery) {
          const noteNames = (creation.notes || []).join(" ").toLowerCase();
          if (!noteNames.includes(noteQuery)) return false;
        }
        if (hasMinScore && creation.score < minScore) return false;
        if (hasMaxScore && creation.score > maxScore) return false;
        if (historyReplicateFilter === "original" && creation.isReplicate) return false;
        if (historyReplicateFilter === "replicate" && !creation.isReplicate) return false;
        return true;
      })
      .sort((a, b) => {
        if (historySort === "score-desc") return b.score - a.score;
        if (historySort === "score-asc") return a.score - b.score;
        const timeA = Date.parse(a.createdAt) || 0;
        const timeB = Date.parse(b.createdAt) || 0;
        return historySort === "created-asc" ? timeA - timeB : timeB - timeA;
      });
  }, [
    history,
    historyNameFilter,
    historyNoteFilter,
    historyScoreMin,
    historyScoreMax,
    historyReplicateFilter,
    historySort
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedHistory.length / PAGE_SIZE));
  const safeHistoryPage = Math.min(historyPage, totalPages);
  const pagedHistory = useMemo(() => {
    const start = (safeHistoryPage - 1) * PAGE_SIZE;
    return filteredAndSortedHistory.slice(start, start + PAGE_SIZE);
  }, [filteredAndSortedHistory, safeHistoryPage]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyNameFilter, historyNoteFilter, historyScoreMin, historyScoreMax, historyReplicateFilter, historySort]);

  function clearHistoryFilters() {
    setHistoryNameFilter("");
    setHistoryNoteFilter("");
    setHistoryScoreMin("");
    setHistoryScoreMax("");
    setHistoryReplicateFilter("all");
    setHistoryPage(1);
  }

  const selectedNoteObjects = selectedNotes
    .map((item) => {
      const note = notes.find((n) => n.id === item.noteId);
      return note ? { note, drops: item.drops } : null;
    })
    .filter((x): x is { note: Note; drops: number } => x !== null);

  const traits = useMemo(
    () => computeTraitsFromSelected(selectedNotes),
    [selectedNotes]
  );

  const totalDrops = useMemo(() => getTotalDrops(selectedNotes), [selectedNotes]);
  const isValidForBottling = totalDrops >= MIN_TOTAL_DROPS && totalDrops <= MAX_TOTAL_DROPS;

  const current = selectedNotes.length > 0 ? describe(traits, selectedNotes) : null;
  const displayName = customName || (current ? current.name : "");

  const unlockProgressList = useMemo(() => {
    const currentScore = current ? current.score : 0;
    return getAllUnlockProgress(history, traits, currentScore, unlockedNoteIds);
  }, [history, traits, current, unlockedNoteIds]);

  const selectedProgress = useMemo(() => {
    if (!selectedProgressNoteId) return null;
    return unlockProgressList.find((p) => p.note.id === selectedProgressNoteId) || null;
  }, [selectedProgressNoteId, unlockProgressList]);

  const selectedProgressSuggestions = useMemo(() => {
    if (!selectedProgress) return [];
    return suggestUnlockRecipes(selectedProgress, unlockedNoteIds, history, selectedNotes, 3);
  }, [selectedProgress, unlockedNoteIds, history, selectedNotes]);

  function applyRecipeSuggestion(suggestion: UnlockRecipeSuggestion) {
    const recipeIds = suggestion.recipe.map((r) => r.note.id);
    const recipeIdSet = new Set(recipeIds);
    const existingMap = new Map(selectedNotes.map((s) => [s.noteId, s]));

    let merged: SelectedNote[] = [];

    if (suggestion.strategy === "incremental") {
      for (const item of selectedNotes) {
        const recipeItem = suggestion.recipe.find((r) => r.note.id === item.noteId);
        merged.push({
          noteId: item.noteId,
          drops: recipeItem ? recipeItem.drops : item.drops
        });
      }
      for (const r of suggestion.recipe) {
        if (!existingMap.has(r.note.id) && merged.length < MAX_NOTES) {
          merged.push({ noteId: r.note.id, drops: r.drops });
        }
      }
    } else {
      merged = suggestion.recipe
        .slice(0, MAX_NOTES)
        .map((r) => ({ noteId: r.note.id, drops: r.drops }));
    }

    let total = merged.reduce((s, i) => s + i.drops, 0);

    if (total < MIN_TOTAL_DROPS && merged.length > 0) {
      let idx = 0;
      while (total < MIN_TOTAL_DROPS && idx < 1000) {
        const maxIdx = merged.reduce(
          (mi, it, i) => (it.drops < merged[mi].drops ? i : mi),
          0
        );
        if (merged[maxIdx].drops < MAX_DROPS_PER_NOTE) {
          merged[maxIdx].drops += 1;
          total += 1;
        }
        idx++;
      }
    }

    if (total > MAX_TOTAL_DROPS) {
      const scale = MAX_TOTAL_DROPS / total;
      let scaled = merged.map((item) => ({
        ...item,
        drops: Math.max(MIN_DROPS_PER_NOTE, Math.round(item.drops * scale))
      }));
      let scaledTotal = scaled.reduce((s, i) => s + i.drops, 0);
      let idx = 0;
      while (scaledTotal > MAX_TOTAL_DROPS && idx < 1000) {
        const maxIdx = scaled.reduce(
          (mi, it, i) => (it.drops > scaled[mi].drops ? i : mi),
          0
        );
        if (scaled[maxIdx].drops > MIN_DROPS_PER_NOTE) {
          scaled[maxIdx].drops -= 1;
          scaledTotal -= 1;
        }
        idx++;
      }
      while (scaledTotal < MIN_TOTAL_DROPS && scaled.length > 0 && idx < 2000) {
        const minIdx = scaled.reduce(
          (mi, it, i) => (it.drops < scaled[mi].drops ? i : mi),
          0
        );
        if (scaled[minIdx].drops < MAX_DROPS_PER_NOTE) {
          scaled[minIdx].drops += 1;
          scaledTotal += 1;
        }
        idx++;
      }
      merged = scaled;
    }

    if (merged.length === 1) {
      merged[0].drops = Math.max(MIN_TOTAL_DROPS, merged[0].drops);
    }

    merged = merged.map((item) => ({
      ...item,
      drops: Math.max(
        merged.length === 1 ? MIN_TOTAL_DROPS : MIN_DROPS_PER_NOTE,
        Math.min(MAX_DROPS_PER_NOTE, item.drops)
      )
    }));

    setSelectedNotes(merged);
    setDraftBannerVisible(true);
  }

  function openNoteDetail(note: Note) {
    setActiveNote(note);
  }

  function closeNoteDetail() {
    setActiveNote(null);
  }

  function openCreationDetail(creation: Creation) {
    setActiveCreation(creation);
  }

  function closeCreationDetail() {
    setActiveCreation(null);
  }

  function hasTraits(creation: Creation): creation is Creation & { traits: Record<Trait, number> } {
    return !!(creation.traits && typeof creation.traits === "object" && Object.keys(creation.traits).length > 0);
  }

  function addNoteFromDrawer() {
    if (!activeNote || selectedNotes.length >= MAX_NOTES) return;
    if (!unlockedNoteIds.includes(activeNote.id)) return;
    if (selectedNotes.some((s) => s.noteId === activeNote.id)) return;
    const initialDrops = selectedNotes.length === 0 ? MIN_TOTAL_DROPS : DEFAULT_DROPS;
    setSelectedNotes((items) => [...items, { noteId: activeNote.id, drops: initialDrops }]);
    closeNoteDetail();
  }

  function removeNoteAtIndex(index: number) {
    setSelectedNotes((items) => {
      const remaining = items.filter((_, i) => i !== index);
      if (remaining.length === 1) {
        const currentTotal = getTotalDrops(remaining);
        if (currentTotal < MIN_TOTAL_DROPS) {
          return [{ ...remaining[0], drops: MIN_TOTAL_DROPS }];
        }
      }
      return remaining;
    });
  }

  function getEffectiveMinDrops(allItems: SelectedNote[], itemIndex: number): number {
    if (allItems.length === 1) {
      return MIN_TOTAL_DROPS;
    }
    return MIN_DROPS_PER_NOTE;
  }

  function updateNoteDrops(index: number, newDrops: number) {
    setSelectedNotes((items) => {
      const effectiveMin = getEffectiveMinDrops(items, index);
      const effectiveMax = Math.min(
        MAX_DROPS_PER_NOTE,
        MAX_TOTAL_DROPS - (getTotalDrops(items) - items[index].drops)
      );
      const clampedDrops = Math.max(effectiveMin, Math.min(effectiveMax, Math.round(newDrops)));
      return items.map((item, i) => (i === index ? { ...item, drops: clampedDrops } : item));
    });
  }

  function increaseNoteDrops(index: number) {
    setSelectedNotes((items) => {
      const current = items[index];
      if (!current) return items;
      const currentTotal = getTotalDrops(items);
      if (current.drops >= MAX_DROPS_PER_NOTE) return items;
      if (currentTotal >= MAX_TOTAL_DROPS) return items;
      return items.map((item, i) => (i === index ? { ...item, drops: item.drops + 1 } : item));
    });
  }

  function decreaseNoteDrops(index: number) {
    setSelectedNotes((items) => {
      const current = items[index];
      if (!current) return items;
      const effectiveMin = getEffectiveMinDrops(items, index);
      if (current.drops <= effectiveMin) return items;
      return items.map((item, i) => (i === index ? { ...item, drops: item.drops - 1 } : item));
    });
  }

  function buildCurrentCreation(): { creation: Creation; newlyUnlockedNotes: Note[] } {
    const finalName = customName.trim() || current!.name;
    const noteDropsMap: Record<string, number> = {};
    selectedNoteObjects.forEach(({ note, drops }) => {
      noteDropsMap[note.name] = drops;
    });
    const creation: Creation = {
      id: crypto.randomUUID(),
      name: finalName,
      originalName: current!.name,
      score: current!.score,
      description: current!.description,
      traits,
      notes: selectedNoteObjects.map(({ note }) => note.name),
      noteDrops: noteDropsMap,
      createdAt: new Date().toISOString(),
      sourceCreationId: replicateSource?.id,
      sourceCreationName: replicateSource?.name,
      isReplicate: !!replicateSource,
      fragranceStructure: current!.fragranceStructure,
      phaseDescriptions: current!.phaseDescriptions
    };
    const newlyUnlockedNotes = getNewlyUnlockedNotes(
      traits,
      current!.score,
      unlockedNoteIds
    );
    return { creation, newlyUnlockedNotes };
  }

  function finalizeAfterSave(newlyUnlockedNotes: Note[]) {
    if (newlyUnlockedNotes.length > 0) {
      const nextUnlocked = [...unlockedNoteIds, ...newlyUnlockedNotes.map((n) => n.id)];
      setUnlockedNoteIds(nextUnlocked);
      saveUnlockedNotes(nextUnlocked);
      setNewlyUnlocked(newlyUnlockedNotes);
      setUnlockNotificationOpen(true);
    }
    clearDraft();
    setSelectedNotes([]);
    setCustomName("");
    setPendingCustomName("");
    setIsEditingName(false);
    setReplicateSource(null);
    setReplicateResult(null);
    setEditingSource(null);
  }

  async function saveAsNewCreation() {
    if (!current || selectedNotes.length === 0) return;
    if (!isValidForBottling) return;
    const { creation, newlyUnlockedNotes } = buildCurrentCreation();
    if (editingSource?.isReplicate || editingSource?.sourceCreationId || editingSource?.sourceCreationName) {
      creation.sourceCreationId = editingSource.sourceCreationId ?? editingSource.id;
      creation.sourceCreationName = editingSource.sourceCreationName ?? editingSource.name;
      creation.isReplicate = true;
    }
    await libraryDB.add(creation);
    setHistory([creation, ...history]);
    finalizeAfterSave(newlyUnlockedNotes);
    setSaveDialogOpen(false);
  }

  async function overwriteOriginalCreation() {
    if (!current || selectedNotes.length === 0 || !editingSource) return;
    if (!isValidForBottling) return;
    const { creation: newCreation, newlyUnlockedNotes } = buildCurrentCreation();

    const original = history.find((c) => c.id === editingSource.id);
    const updatedCreation: Creation = {
      ...newCreation,
      id: editingSource.id,
      createdAt: original?.createdAt || editingSource.createdAt,
      sourceCreationId: original?.sourceCreationId ?? editingSource.sourceCreationId,
      sourceCreationName: original?.sourceCreationName ?? editingSource.sourceCreationName,
      isReplicate: !!(original?.isReplicate ?? editingSource.isReplicate)
    };

    await libraryDB.update(updatedCreation);
    const next = history.map((c) => (c.id === editingSource.id ? updatedCreation : c));
    setHistory(next);
    finalizeAfterSave(newlyUnlockedNotes);
    setSaveDialogOpen(false);
  }

  function bottleCreation() {
    if (!current || selectedNotes.length === 0) return;
    if (!isValidForBottling) return;
    if (editingSource) {
      setSaveDialogOpen(true);
    } else {
      saveAsNewCreation();
    }
  }

  function replicateCreation(creation: Creation) {
    const analysis = analyzeReplicability(creation, unlockedNoteIds);
    if (!analysis.canReplicate) {
      return;
    }

    const creationDrops = getCreationNoteDrops(creation);
    const restoredItems: SelectedNote[] = [];
    const restoredDropsMap: Record<string, number> = {};
    for (const noteId of analysis.allUnlocked) {
      const note = getNoteById(noteId);
      if (note && restoredItems.length < MAX_NOTES) {
        const drops = Math.max(MIN_DROPS_PER_NOTE, Math.min(MAX_DROPS_PER_NOTE, creationDrops[note.name] || creationDrops[noteId] || DEFAULT_DROPS));
        restoredItems.push({ noteId, drops });
        restoredDropsMap[note.name] = drops;
      }
    }
    const restoredNoteIds = restoredItems.map((r) => r.noteId);
    const restoredNoteNames = restoredItems
      .map((r) => getNoteById(r.noteId)?.name)
      .filter((n): n is string => !!n);

    const restoredTraits = computeTraitsFromSelected(restoredItems);

    const result: ReplicateResult = {
      restoredNoteIds,
      restoredNoteNames,
      restoredNoteDrops: restoredDropsMap,
      missingUnlockedNotes: analysis.missingUnlockedNotes,
      missingUnknownNotes: analysis.missingUnknownNotes,
      originalNoteCount: creation.notes.length,
      restoredTraits
    };

    let remainingTotal = MAX_TOTAL_DROPS;
    const clampedItems = restoredItems.map((item, idx, arr) => {
      const safeDrops = Math.min(item.drops, remainingTotal);
      remainingTotal -= safeDrops;
      const minDrops = arr.length === 1 ? MIN_TOTAL_DROPS : MIN_DROPS_PER_NOTE;
      return { ...item, drops: Math.max(minDrops, safeDrops) };
    });

    setSelectedNotes(clampedItems);
    const replicateName = `${creation.name}（复刻）`;
    setCustomName(replicateName);
    setPendingCustomName(replicateName);
    setIsEditingName(false);
    setReplicateSource(creation);
    setReplicateResult(result);
    closeCreationDetail();
    setReplicateNotificationOpen(true);
  }

  function clearReplicateSource() {
    setReplicateSource(null);
    setReplicateResult(null);
  }

  function continueAdjusting(creation: Creation) {
    const analysis = analyzeReplicability(creation, unlockedNoteIds);
    if (!analysis.canReplicate) {
      return;
    }

    const creationDrops = getCreationNoteDrops(creation);
    const restoredItems: SelectedNote[] = [];
    for (const noteId of analysis.allUnlocked) {
      const note = getNoteById(noteId);
      if (note && restoredItems.length < MAX_NOTES) {
        const drops = Math.max(MIN_DROPS_PER_NOTE, Math.min(MAX_DROPS_PER_NOTE, creationDrops[note.name] || creationDrops[noteId] || DEFAULT_DROPS));
        restoredItems.push({ noteId, drops });
      }
    }

    let remainingTotal = MAX_TOTAL_DROPS;
    const clampedItems = restoredItems.map((item, idx, arr) => {
      const safeDrops = Math.min(item.drops, remainingTotal);
      remainingTotal -= safeDrops;
      const minDrops = arr.length === 1 ? MIN_TOTAL_DROPS : MIN_DROPS_PER_NOTE;
      return { ...item, drops: Math.max(minDrops, safeDrops) };
    });

    setSelectedNotes(clampedItems);
    setCustomName(creation.name);
    setPendingCustomName(creation.name);
    setIsEditingName(false);
    setEditingSource(creation);
    setReplicateSource(null);
    setReplicateResult(null);
    closeCreationDetail();
  }

  function clearEditingSource() {
    setEditingSource(null);
  }

  function handleQuizAnswer(option: QuizOption) {
    const nextTraits = { ...quizTraits };
    (Object.keys(option.traitDelta) as Trait[]).forEach((trait) => {
      nextTraits[trait] += option.traitDelta[trait] ?? 0;
    });
    const nextIntensity = quizIntensity + (option.intensityBoost ?? 0);
    if (quizStep < quizQuestions.length - 1) {
      setQuizTraits(nextTraits);
      setQuizIntensity(nextIntensity);
      setQuizStep(quizStep + 1);
    } else {
      setQuizTraits(nextTraits);
      setQuizIntensity(nextIntensity);
      setQuizDone(true);
    }
  }

  function resetQuiz() {
    setQuizStep(0);
    setQuizTraits({ fresh: 0, sweet: 0, wood: 0, spice: 0 });
    setQuizIntensity(0);
    setQuizDone(false);
  }

  function applyRecommendation() {
    const existingSelected = [...selectedNotes];
    const existingIds = new Set(existingSelected.map((s) => s.noteId));
    const slotsRemaining = MAX_NOTES - existingSelected.length;

    if (slotsRemaining <= 0) {
      setQuizOpen(false);
      resetQuiz();
      return;
    }

    const recommendations = recommendNotes(
      quizTraits,
      quizIntensity,
      unlockedNoteIds,
      3
    );

    const existingTotal = existingSelected.reduce((s, i) => s + i.drops, 0);
    const availableDrops = MAX_TOTAL_DROPS - existingTotal;
    const newRecs = recommendations.filter((r) => !existingIds.has(r.note.id));
    const toAdd = newRecs.slice(0, Math.min(slotsRemaining, Math.max(0, availableDrops)));
    const recTotalRaw = toAdd.reduce((s, r) => s + r.recommendedDrops, 0);

    let finalNewItems: SelectedNote[] = [];

    if (toAdd.length === 0) {
      setQuizOpen(false);
      resetQuiz();
      return;
    }

    if (existingSelected.length === 0 && toAdd.length === 1) {
      const d = Math.max(
        MIN_TOTAL_DROPS,
        Math.min(MAX_DROPS_PER_NOTE, toAdd[0].recommendedDrops)
      );
      finalNewItems = [{ noteId: toAdd[0].note.id, drops: d }];
    } else if (recTotalRaw < MIN_TOTAL_DROPS && existingSelected.length === 0) {
      const scaleUp = MIN_TOTAL_DROPS / recTotalRaw;
      let scaled = toAdd.map((r) => ({
        noteId: r.note.id,
        drops: Math.max(MIN_DROPS_PER_NOTE, Math.round(r.recommendedDrops * scaleUp))
      }));
      let scaledTotal = scaled.reduce((s, i) => s + i.drops, 0);
      let idx = 0;
      while (scaledTotal < MIN_TOTAL_DROPS && idx < scaled.length) {
        if (scaled[idx].drops < MAX_DROPS_PER_NOTE) {
          scaled[idx].drops += 1;
          scaledTotal += 1;
        }
        idx++;
        if (idx >= scaled.length) idx = 0;
      }
      finalNewItems = scaled.map((s) => ({
        noteId: s.noteId,
        drops: Math.min(MAX_DROPS_PER_NOTE, s.drops)
      }));
    } else if (recTotalRaw > availableDrops) {
      const allowedForNew = availableDrops;
      const scaleDown = allowedForNew / recTotalRaw;
      let scaled = toAdd.map((r) => ({
        noteId: r.note.id,
        drops: Math.max(MIN_DROPS_PER_NOTE, Math.round(r.recommendedDrops * scaleDown))
      }));
      let scaledTotal = scaled.reduce((s, i) => s + i.drops, 0);
      let idx = 0;
      while (scaledTotal > allowedForNew && scaledTotal > toAdd.length * MIN_DROPS_PER_NOTE && idx < 1000) {
        const maxIdx = scaled.reduce(
          (mi, it, i) => (it.drops > scaled[mi].drops ? i : mi),
          0
        );
        if (scaled[maxIdx].drops > MIN_DROPS_PER_NOTE) {
          scaled[maxIdx].drops -= 1;
          scaledTotal -= 1;
        }
        idx++;
      }
      finalNewItems = scaled;
    } else {
      finalNewItems = toAdd.map((r) => ({
        noteId: r.note.id,
        drops: r.recommendedDrops
      }));
    }

    setSelectedNotes([...existingSelected, ...finalNewItems]);
    setQuizOpen(false);
    resetQuiz();
  }

  async function exportCreations() {
    const storedCreations = await loadAllFromDB();
    if (storedCreations.length === 0) {
      setHistory([]);
      return;
    }
    setHistory(storedCreations);
    const exportData = storedCreations.map((creation) => ({
      id: creation.id,
      name: creation.name,
      originalName: creation.originalName,
      score: creation.score,
      description: creation.description,
      notes: creation.notes,
      noteDrops: creation.noteDrops,
      traits: creation.traits,
      createdAt: creation.createdAt,
      sourceCreationId: creation.sourceCreationId,
      sourceCreationName: creation.sourceCreationName,
      isReplicate: creation.isReplicate,
      fragranceStructure: creation.fragranceStructure,
      phaseDescriptions: creation.phaseDescriptions
    }));
    const jsonData = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonData], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const timestamp = new Date().toISOString().slice(0, 10);
    link.download = `雾瓶调香作品-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function parseImportData(rawData: unknown): ImportResult {
    const result: ImportResult = {
      success: [],
      skipped: [],
      successCount: 0,
      skippedCount: 0
    };

    let items: unknown[] = [];
    if (Array.isArray(rawData)) {
      items = rawData;
    } else if (rawData && typeof rawData === "object") {
      if (Array.isArray((rawData as { creations?: unknown[] }).creations)) {
        items = (rawData as { creations: unknown[] }).creations;
      } else {
        items = [rawData];
      }
    }

    const existingIds = new Set(history.map((c) => c.id));

    for (const item of items) {
      if (!item || typeof item !== "object") {
        result.skipped.push({ creation: {}, reason: "无效数据格式" });
        result.skippedCount++;
        continue;
      }

      const obj = item as Record<string, unknown>;

      let id: string;
      if (typeof obj.id === "string") {
        id = obj.id;
      } else {
        id = crypto.randomUUID();
      }

      if (existingIds.has(id)) {
        result.skipped.push({
          creation: { ...(obj as Partial<Creation> & { id: string }) },
          reason: "同ID作品已存在"
        });
        result.skippedCount++;
        continue;
      }

      const normalized = normalizeCreation({
        ...(obj as Partial<Creation>),
        id
      });

      if (normalized.notes.length === 0 && normalized.score === 0) {
        result.skipped.push({
          creation: { ...(obj as Partial<Creation> & { id: string }) },
          reason: "无有效香调和评分"
        });
        result.skippedCount++;
        continue;
      }

      result.success.push(normalized);
      result.successCount++;
      existingIds.add(id);
    }

    return result;
  }

  function importCreations(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const rawData = JSON.parse(content);
        const importResult = parseImportData(rawData);

        if (importResult.success.length > 0) {
          await libraryDB.addAll(importResult.success);
          const merged = [...importResult.success, ...history];
          setHistory(merged);

          for (const creation of importResult.success) {
            if (hasTraits(creation) && creation.score > 0) {
              const newlyUnlockedNotes = getNewlyUnlockedNotes(
                creation.traits,
                creation.score,
                unlockedNoteIds
              );
              if (newlyUnlockedNotes.length > 0) {
                const nextUnlocked = [...unlockedNoteIds, ...newlyUnlockedNotes.map((n) => n.id)];
                setUnlockedNoteIds(nextUnlocked);
                saveUnlockedNotes(nextUnlocked);
                setNewlyUnlocked((prev) => {
                  const existingIds = new Set(prev.map((n) => n.id));
                  const newNotes = newlyUnlockedNotes.filter((n) => !existingIds.has(n.id));
                  return [...prev, ...newNotes];
                });
                setUnlockNotificationOpen(true);
              }
            }
          }
        }

        setImportResult(importResult);
        setImportNotificationOpen(true);
      } catch {
        setImportResult({
          success: [],
          skipped: [{ creation: {}, reason: "文件解析失败，请确认是有效的JSON文件" }],
          successCount: 0,
          skippedCount: 1
        });
        setImportNotificationOpen(true);
      }
    };
    reader.readAsText(file);
  }

  function openCompare() {
    setCompareOpen(true);
    if (history.length >= 1 && !compareId1) {
      setCompareId1(history[0].id);
    }
    if (history.length >= 2 && !compareId2) {
      setCompareId2(history[1].id);
    }
  }

  function closeCompare() {
    setCompareOpen(false);
  }

  function selectForCompare(slot: 1 | 2, id: string) {
    if (slot === 1) {
      if (compareId2 === id) {
        setCompareId2(compareId1);
      }
      setCompareId1(id);
    } else {
      if (compareId1 === id) {
        setCompareId1(compareId2);
      }
      setCompareId2(id);
    }
  }

  const compareCreation1 = compareId1 ? history.find((c) => c.id === compareId1) || null : null;
  const compareCreation2 = compareId2 ? history.find((c) => c.id === compareId2) || null : null;

  function getTraitDiff(a: Creation | null, b: Creation | null, trait: Trait): number {
    if (!a || !b || !hasTraits(a) || !hasTraits(b)) return 0;
    return a.traits[trait] - b.traits[trait];
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">雾瓶调香台</p>
          <h1>把小众气味调成一瓶短诗</h1>
        </div>
        <button
          className="ghost-button"
          onClick={() => {
            clearDraft();
            setSelectedNotes([]);
            setCustomName("");
            setPendingCustomName("");
            setIsEditingName(false);
            setReplicateSource(null);
            setReplicateResult(null);
            setEditingSource(null);
          }}
        >
          清空调香台
        </button>
      </section>

      <section className="quiz-section">
        {!quizOpen ? (
          <button className="quiz-toggle" onClick={() => setQuizOpen(true)}>
            <span className="quiz-toggle-icon">✦</span>
            气味心情问答推荐
          </button>
        ) : (
          <div className="quiz-panel">
            <div className="quiz-header">
              <h2>气味心情问答</h2>
              <button className="drawer-close quiz-close" onClick={() => { setQuizOpen(false); resetQuiz(); }}>×</button>
            </div>
            {!quizDone ? (
              <>
                <div className="quiz-progress">
                  {quizQuestions.map((_, i) => (
                    <span key={i} className={`quiz-dot ${i <= quizStep ? "active" : ""} ${i < quizStep ? "done" : ""}`} />
                  ))}
                </div>
                <p className="quiz-question">{quizQuestions[quizStep].question}</p>
                <div className="quiz-options">
                  {quizQuestions[quizStep].options.map((option, i) => (
                    <button key={i} className="quiz-option" onClick={() => handleQuizAnswer(option)}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p className="quiz-result-label">为你推荐以下香调组合</p>
                <div className="quiz-recommendations">
                  {recommendNotes(quizTraits, quizIntensity, unlockedNoteIds, 3).map(({ note, recommendedDrops }) => (
                    <div key={note.id} className="quiz-rec-card">
                      <span className="swatch" style={{ background: note.color }} />
                      <strong>{note.name}</strong>
                      <small>{note.profile}</small>
                      <span className="quiz-rec-drops" title="建议滴数">
                        建议 {recommendedDrops} 滴
                      </span>
                    </div>
                  ))}
                </div>
                <div className="quiz-traits-preview">
                  {(Object.keys(quizTraits) as Trait[]).map((trait) => (
                    <span key={trait} className="quiz-trait-chip" style={{ borderColor: getTraitColor(trait) }}>
                      {traitLabels[trait]} {quizTraits[trait]}
                    </span>
                  ))}
                </div>
                <div className="quiz-actions">
                  <button className="primary-button" onClick={applyRecommendation}>
                    一键放入调香台
                  </button>
                  <button className="ghost-button" onClick={resetQuiz}>
                    重新作答
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <section className="workspace">
        <div className="panel note-panel">
          <div className="note-panel-header">
            <h2>香调架</h2>
            <div className="note-stats">
              <span className="stat-badge">
                已解锁 {unlockedNotes.length}/{notes.length}
              </span>
              {lockedNotes.length > 0 && (
                <button
                  className={`ghost-button small progress-toggle-btn ${unlockProgressOpen ? "active" : ""}`}
                  onClick={() => setUnlockProgressOpen(!unlockProgressOpen)}
                >
                  🔓 解锁进度 {unlockProgressOpen ? "收起" : "展开"}
                </button>
              )}
              <button
                className={`ghost-button small toggle-notes-btn ${showAllNotes ? "active" : ""}`}
                onClick={() => setShowAllNotes(!showAllNotes)}
              >
                {showAllNotes ? "隐藏未解锁" : "显示全部"}
              </button>
            </div>
          </div>
          {unlockProgressOpen && (
            <div className="unlock-progress-panel">
              <div className="unlock-progress-header">
                <h3>未解锁香调进度</h3>
                <span className="unlock-progress-subtitle">
                  按距离解锁从近到远排列
                </span>
              </div>
              {unlockProgressList.length === 0 ? (
                <div className="unlock-progress-empty">
                  <span className="unlock-progress-empty-icon">✨</span>
                  <p>所有香调已解锁！</p>
                </div>
              ) : (
                <div className="unlock-progress-list">
                  {unlockProgressList.map((progress) => (
                    <div
                      key={progress.note.id}
                      className={`unlock-progress-item ${selectedProgressNoteId === progress.note.id ? "selected" : ""}`}
                      onClick={() => setSelectedProgressNoteId(
                        selectedProgressNoteId === progress.note.id ? null : progress.note.id
                      )}
                    >
                      <div className="unlock-progress-item-header">
                        <div className="unlock-progress-note-info">
                          <span
                            className="swatch small-swatch"
                            style={{ background: progress.note.color, opacity: 0.7 }}
                          />
                          <div>
                            <strong>{progress.note.name}</strong>
                            <small>{progress.note.unlockCondition?.description}</small>
                          </div>
                        </div>
                        <div className="unlock-progress-remaining">
                          {progress.remaining > 0 ? (
                            <span className="remaining-badge">
                              还差 <b>{progress.remaining}</b>
                              {progress.isScoreType ? " 分" : ` ${traitLabels[progress.note.unlockCondition?.trait ?? "fresh"]}`}
                            </span>
                          ) : (
                            <span className="ready-badge">可解锁！</span>
                          )}
                        </div>
                      </div>
                      <div className="unlock-progress-bar-track">
                        <div
                          className="unlock-progress-bar-fill"
                          style={{
                            width: `${progress.progressPercent}%`,
                            background: progress.isScoreType
                              ? "linear-gradient(90deg, #b77b54, #f4c95d)"
                              : getTraitColor(progress.note.unlockCondition?.trait ?? "fresh")
                          }}
                        />
                      </div>
                      <div className="unlock-progress-meta">
                        <span className="progress-value">
                          当前：<b>{progress.currentValue}</b> / {progress.targetValue}
                          {progress.isScoreType ? " 分" : ""}
                        </span>
                        <span className="progress-source">
                          {progress.sourceDetail}
                        </span>
                      </div>
                      {selectedProgressNoteId === progress.note.id && (
                        <div className="unlock-recipe-suggestions">
                          <div className="recipe-suggestions-header">
                            <h4>🧭 解锁路线</h4>
                            <span className="recipe-suggestions-subtitle">
                              基于已解锁香调、历史最佳和当前配方，推荐 {selectedProgressSuggestions.length} 条路线
                            </span>
                          </div>
                          {selectedProgressSuggestions.length === 0 ? (
                            <p className="recipe-suggestions-empty">
                              暂无推荐配方，请先解锁更多基础香调
                            </p>
                          ) : (
                            <div className="recipe-suggestions-list">
                              {selectedProgressSuggestions.map((suggestion, idx) => {
                                const totalRecipeDrops = suggestion.recipe.reduce((s, r) => s + r.drops, 0);
                                const existingNoteIds = new Set(selectedNotes.map((s) => s.noteId));
                                const recipeExistingNotes = suggestion.recipe.filter((r) => existingNoteIds.has(r.note.id));
                                const recipeNewNotes = suggestion.recipe.filter((r) => !existingNoteIds.has(r.note.id));

                                let canApply = true;
                                let cannotApplyReason = "";
                                if (suggestion.strategy === "incremental") {
                                  const newNoteCount = recipeNewNotes.length;
                                  const availableSlots = MAX_NOTES - selectedNotes.length;
                                  if (newNoteCount > availableSlots) {
                                    canApply = false;
                                    cannotApplyReason = "调香台位置不足";
                                  }
                                } else {
                                  if (suggestion.recipe.length === 0) {
                                    canApply = false;
                                    cannotApplyReason = "无有效香调";
                                  }
                                }

                                const strategyLabels: Record<string, { label: string; emoji: string }> = {
                                  incremental: { label: "渐进路线", emoji: "🌱" },
                                  historical: { label: "历史复刻", emoji: "📜" },
                                  extreme: { label: "极致路线", emoji: "⚡" }
                                };
                                const strategyInfo = strategyLabels[suggestion.strategy] || { label: "推荐路线", emoji: "✨" };

                                return (
                                  <div key={idx} className={`recipe-suggestion-card recipe-strategy-${suggestion.strategy}`}>
                                    <div className="recipe-strategy-header">
                                      <span className={`recipe-strategy-badge strategy-badge-${suggestion.strategy}`}>
                                        {strategyInfo.emoji} {strategyInfo.label}
                                      </span>
                                    </div>
                                    <div className="recipe-suggestion-reason">
                                      {suggestion.reason}
                                    </div>
                                    <div className="recipe-suggestion-notes">
                                      {suggestion.recipe.map((r, i) => {
                                        const isExisting = existingNoteIds.has(r.note.id);
                                        return (
                                          <span
                                            key={i}
                                            className={`recipe-note-tag ${isExisting ? "recipe-note-existing" : "recipe-note-new"}`}
                                            title={isExisting ? "已在调香台" : "新增香调"}
                                          >
                                            <span
                                              className="swatch small-swatch"
                                              style={{ background: r.note.color }}
                                            />
                                            {r.note.name} × {r.drops}
                                            {isExisting && <span className="recipe-note-status recipe-note-status-existing">已存在</span>}
                                            {!isExisting && <span className="recipe-note-status recipe-note-status-new">新增</span>}
                                          </span>
                                        );
                                      })}
                                    </div>
                                    {(recipeExistingNotes.length > 0 || recipeNewNotes.length > 0) && (
                                      <div className="recipe-change-summary">
                                        {recipeExistingNotes.length > 0 && selectedNotes.length > 0 && (
                                          <span className="recipe-change-item">
                                            保留 {recipeExistingNotes.length} 种现有香调
                                          </span>
                                        )}
                                        {recipeNewNotes.length > 0 && (
                                          <span className="recipe-change-item">
                                            新增 {recipeNewNotes.length} 种香调
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    <div className="recipe-suggestion-stats">
                                      <span className="recipe-stat">
                                        总滴数：<b>{totalRecipeDrops}</b>
                                      </span>
                                      <span className="recipe-stat">
                                        香调数：<b>{suggestion.recipe.length}</b>
                                      </span>
                                      {!suggestion.isScoreType && suggestion.targetNote.unlockCondition?.trait && (
                                        <span
                                          className="recipe-stat"
                                          style={{ color: getTraitColor(suggestion.targetNote.unlockCondition.trait) }}
                                        >
                                          {traitLabels[suggestion.targetNote.unlockCondition.trait]}：
                                          <b>{suggestion.estimatedTraits[suggestion.targetNote.unlockCondition.trait]}</b>
                                        </span>
                                      )}
                                      <span className="recipe-stat recipe-score">
                                        预估评分：<b>{suggestion.estimatedScore}</b> 分
                                      </span>
                                    </div>
                                    {!suggestion.isScoreType && suggestion.targetNote.unlockCondition?.trait && suggestion.estimatedTraits[suggestion.targetNote.unlockCondition.trait] >= (suggestion.targetNote.unlockCondition.minValue ?? 0) && (
                                      <div className="recipe-unlock-ready">
                                        ✅ 该路线可达成解锁条件
                                      </div>
                                    )}
                                    {suggestion.isScoreType && suggestion.estimatedScore >= (suggestion.targetNote.unlockCondition?.minScore ?? 0) && (
                                      <div className="recipe-unlock-ready">
                                        ✅ 该路线可达成解锁条件
                                      </div>
                                    )}
                                    <button
                                      className={`primary-button small apply-recipe-btn apply-recipe-btn-${suggestion.strategy}`}
                                      disabled={!canApply}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        applyRecipeSuggestion(suggestion);
                                      }}
                                      title={!canApply ? cannotApplyReason : suggestion.strategy === "incremental" ? "在当前配方基础上调整" : "替换为该路线配方"}
                                    >
                                      {canApply
                                        ? suggestion.strategy === "incremental"
                                          ? "✓ 应用（保留来源）"
                                          : "✓ 应用路线"
                                        : cannotApplyReason || "无法应用"}
                                    </button>
                                    {suggestion.strategy === "incremental" && (replicateSource || editingSource) && (
                                      <div className="recipe-source-preserve-hint">
                                        🔒 保留作品来源信息
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="note-grid">
            {displayNotes.map((note) => {
              const unlocked = unlockedNoteIds.includes(note.id);
              return (
                <button
                  key={note.id}
                  className={`note-card ${!unlocked ? "locked" : ""}`}
                  onClick={() => openNoteDetail(note)}
                >
                  {!unlocked && <div className="lock-overlay"><span className="lock-icon">🔒</span></div>}
                  <span className="swatch" style={{ background: unlocked ? note.color : "#ccc" }} />
                  <strong style={{ opacity: unlocked ? 1 : 0.5 }}>{note.name}</strong>
                  <span className={`phase-badge-mini phase-badge-mini-${getNotePhase(note)}`}>
                    {phaseLabels[getNotePhase(note)]}
                  </span>
                  <small style={{ opacity: unlocked ? 1 : 0.5 }}>
                    {unlocked ? note.profile : note.unlockCondition?.description || "未解锁"}
                  </small>
                </button>
              );
            })}
          </div>
        </div>

        <div className="panel lab-panel">
          <h2>调香台</h2>
          {draftBannerVisible && selectedNotes.length > 0 && (
            <div className="draft-banner">
              <span className="draft-banner-text">已恢复上次未封瓶的草稿</span>
              <button
                className="draft-banner-close"
                onClick={() => setDraftBannerVisible(false)}
              >
                ×
              </button>
            </div>
          )}
          <div className="lab-mode-header">
            <span className={`lab-mode-badge ${totalDrops > 0 ? "active" : ""}`}>
              配方实验室模式
            </span>
            <div className={`total-drops-display ${!isValidForBottling && totalDrops > 0 ? "invalid" : ""}`}>
              总滴数：<b>{totalDrops}</b>
              <span className="drops-range"> / {MIN_TOTAL_DROPS}-{MAX_TOTAL_DROPS}</span>
            </div>
          </div>
          {totalDrops > 0 && !isValidForBottling && (
            <div className="drops-warning">
              {totalDrops < MIN_TOTAL_DROPS ? (
                selectedNotes.length === 1 ? (
                  <>⚠ 单香调至少需要 {MIN_TOTAL_DROPS} 滴才能封瓶，请增加滴数</>
                ) : (
                  <>⚠ 总滴数不足 {MIN_TOTAL_DROPS}，请增加香调或滴数</>
                )
              ) : (
                <>⚠ 总滴数超过 {MAX_TOTAL_DROPS}，请减少滴数</>
              )}
            </div>
          )}
          <div className="bottle">
            {selectedNoteObjects.length === 0 ? (
              <span>选择香调开始</span>
            ) : (
              (() => {
                const maxDrops = Math.max(...selectedNoteObjects.map((s) => s.drops), 1);
                const bottleMaxHeight = 160;
                return selectedNoteObjects.map(({ note, drops }, index) => {
                  const height = Math.max(24, Math.round((drops / maxDrops) * bottleMaxHeight * 0.7 + 24));
                  return (
                    <i
                      key={`${note.id}-${index}`}
                      style={{ background: note.color, height: `${height}px` }}
                      title={`${note.name} · ${drops}滴`}
                    />
                  );
                });
              })()
            )}
          </div>
          <div className="selected-list">
            {selectedNoteObjects.map(({ note, drops }, index) => {
              const canIncrease = drops < MAX_DROPS_PER_NOTE && totalDrops < MAX_TOTAL_DROPS;
              const effectiveMin = getEffectiveMinDrops(selectedNotes, index);
              const canDecrease = drops > effectiveMin;
              return (
                <div key={`${note.id}-${index}`} className="selected-item-row">
                  <button
                    className="selected-item-name"
                    onClick={() => removeNoteAtIndex(index)}
                    title="点击移除"
                  >
                    <span className="swatch small-swatch" style={{ background: note.color }} />
                    {note.name}
                    <span className={`phase-badge-mini phase-badge-mini-${getNotePhase(note)}`}>
                      {phaseLabels[getNotePhase(note)]}
                    </span>
                  </button>
                  <div className="drops-controller">
                    <button
                      className="drops-btn minus"
                      onClick={() => decreaseNoteDrops(index)}
                      disabled={!canDecrease}
                      title={canDecrease ? "减少滴数" : selectedNotes.length === 1 ? `单香调最少需要 ${MIN_TOTAL_DROPS} 滴` : `最少 ${MIN_DROPS_PER_NOTE} 滴`}
                    >
                      −
                    </button>
                    <span className="drops-count">
                      <b>{drops}</b>
                      <small>滴</small>
                    </span>
                    <button
                      className="drops-btn plus"
                      onClick={() => increaseNoteDrops(index)}
                      disabled={!canIncrease}
                      title={canIncrease ? "增加滴数" : totalDrops >= MAX_TOTAL_DROPS ? `总滴数已达上限 ${MAX_TOTAL_DROPS}` : `单香调最多 ${MAX_DROPS_PER_NOTE} 滴`}
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="traits">
            {(Object.keys(traits) as Trait[]).map((trait) => (
              <label key={trait}>
                <span>{traitLabels[trait]}</span>
                <meter min={0} max={20} value={traits[trait]} />
                <b>{traits[trait]}</b>
              </label>
            ))}
          </div>
          {current && current.fragranceStructure && current.fragranceStructure.phaseCount >= 2 && (
            <div className="lab-phase-preview">
              <div className="lab-phase-preview-header">
                <span className="lab-phase-preview-title">香气结构</span>
                <span className="lab-phase-count">{current.fragranceStructure.phaseCount}层</span>
              </div>
              <div className="lab-phase-preview-list">
                {(["top", "middle", "base"] as FragrancePhase[]).map((phase) => {
                  const profile = current.fragranceStructure![phase];
                  if (!profile) return null;
                  return (
                    <div key={phase} className={`lab-phase-row lab-phase-${phase}`}>
                      <span className={`phase-badge phase-badge-${phase}`}>{phaseLabels[phase]}</span>
                      <span className="lab-phase-notes">{profile.noteNames.join("、")}</span>
                      <span className="lab-phase-dominant" style={{ color: getTraitColor(profile.dominantTrait) }}>
                        {traitLabels[profile.dominantTrait]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="result">
            {current ? (
              <>
                {isEditingName ? (
                  <div className="name-editor">
                    <input
                      type="text"
                      className="name-input"
                      value={pendingCustomName}
                      onChange={(e) => setPendingCustomName(e.target.value)}
                      placeholder="输入新名称"
                      autoFocus
                    />
                    <div className="name-editor-actions">
                      <button
                        className="ghost-button small"
                        onClick={() => {
                          setIsEditingName(false);
                        }}
                      >
                        取消
                      </button>
                      <button
                        className="primary-button small"
                        onClick={() => {
                          setCustomName(pendingCustomName.trim() === current.name ? "" : pendingCustomName);
                          setIsEditingName(false);
                        }}
                      >
                        确认
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="name-display">
                    <strong>{displayName}</strong>
                    {customName && <span className="original-name">原名：{current.name}</span>}
                    {replicateSource && (
                      <span className="replicate-source">
                        ✦ 复刻自：{replicateSource.name}
                        <button
                          className="replicate-clear-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearReplicateSource();
                          }}
                          title="取消复刻标记"
                        >
                          ×
                        </button>
                      </span>
                    )}
                    {editingSource && (
                      <span className="replicate-source editing-source">
                        ✎ 调整自：{editingSource.name}
                        <button
                          className="replicate-clear-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            clearEditingSource();
                          }}
                          title="取消调整标记，保存时将作为新作品"
                        >
                          ×
                        </button>
                      </span>
                    )}
                  </div>
                )}
                {!isEditingName && (
                  <div className="name-actions">
                    <button
                      className="ghost-button small"
                      onClick={() => {
                        setPendingCustomName(displayName);
                        setIsEditingName(true);
                      }}
                    >
                      改名
                    </button>
                    {customName && (
                      <button
                        className="ghost-button small"
                        onClick={() => {
                          setCustomName("");
                        }}
                      >
                        恢复系统命名
                      </button>
                    )}
                  </div>
                )}
                <p>{current.description}</p>
                <button
                  className="primary-button"
                  disabled={!current || !isValidForBottling}
                  onClick={bottleCreation}
                >
                  封瓶记录
                </button>
              </>
            ) : (
              <>
                <strong>未命名试香</strong>
                <p>至少加入一种香调并设置 {MIN_TOTAL_DROPS}-{MAX_TOTAL_DROPS} 总滴数，系统会根据气味性格生成名字和评分。</p>
              </>
            )}
          </div>
        </div>

        <div className="panel history-panel">
          <div className="history-header">
            <div className="history-title-row">
              <h2>作品库{history.length > 0 ? `（${history.length}）` : ""}</h2>
              <div className="history-header-right">
                <label className="history-sort-select">
                  <select
                    className="sort-select"
                    value={historySort}
                    onChange={(e) => setHistorySort(e.target.value as HistorySortOption)}
                    aria-label="历史作品排序"
                  >
                    <option value="created-desc">创建时间从新到旧</option>
                    <option value="created-asc">创建时间从旧到新</option>
                    <option value="score-desc">评分从高到低</option>
                    <option value="score-asc">评分从低到高</option>
                  </select>
                </label>
                <button
                  className={`ghost-button small filter-toggle-button ${historyFiltersOpen ? "active" : ""} ${hasHistoryFilters ? "has-filters" : ""}`}
                  onClick={() => setHistoryFiltersOpen((open) => !open)}
                >
                  {historyFiltersOpen ? "收起筛选" : "筛选作品"}
                </button>
              </div>
            </div>
            <div className="history-actions">
              <button
                className="ghost-button small calendar-toggle-button"
                onClick={() => { setCalendarOpen(!calendarOpen); setCalendarSelectedDay(null); }}
              >
                {calendarOpen ? "返回列表" : "气味日记"}
              </button>
              <button
                className="ghost-button small compare-button"
                disabled={history.length < 2}
                onClick={openCompare}
              >
                配方对比
              </button>
              <button
                className="ghost-button small export-button"
                disabled={history.length === 0}
                onClick={exportCreations}
              >
                导出作品
              </button>
              <button
                className="ghost-button small import-button"
                onClick={() => fileInputRef.current?.click()}
              >
                导入作品
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    importCreations(file);
                  }
                  e.target.value = "";
                }}
              />
            </div>
          </div>
          {historyFiltersOpen && (
            <div className="filter-panel">
              <div className="filter-row">
                <div className="filter-item">
                  <label htmlFor="history-name-filter">作品名</label>
                  <input
                    id="history-name-filter"
                    className="filter-input"
                    type="search"
                    value={historyNameFilter}
                    onChange={(e) => setHistoryNameFilter(e.target.value)}
                    placeholder="搜索作品名"
                  />
                </div>
                <div className="filter-item">
                  <label htmlFor="history-note-filter">香调名</label>
                  <input
                    id="history-note-filter"
                    className="filter-input"
                    type="search"
                    value={historyNoteFilter}
                    onChange={(e) => setHistoryNoteFilter(e.target.value)}
                    placeholder="搜索香调名"
                  />
                </div>
              </div>
              <div className="filter-row">
                <div className="filter-item">
                  <label>评分区间</label>
                  <div className="score-range-inputs">
                    <input
                      className="filter-input score-input"
                      type="number"
                      min="0"
                      max="100"
                      value={historyScoreMin}
                      onChange={(e) => setHistoryScoreMin(e.target.value)}
                      placeholder="最低分"
                      aria-label="最低评分"
                    />
                    <span className="score-range-separator">至</span>
                    <input
                      className="filter-input score-input"
                      type="number"
                      min="0"
                      max="100"
                      value={historyScoreMax}
                      onChange={(e) => setHistoryScoreMax(e.target.value)}
                      placeholder="最高分"
                      aria-label="最高评分"
                    />
                  </div>
                </div>
                <div className="filter-item">
                  <label>复刻作品</label>
                  <div className="filter-radio-group">
                    <label className="filter-radio">
                      <input
                        type="radio"
                        name="history-replicate-filter"
                        checked={historyReplicateFilter === "all"}
                        onChange={() => setHistoryReplicateFilter("all")}
                      />
                      <span>全部</span>
                    </label>
                    <label className="filter-radio">
                      <input
                        type="radio"
                        name="history-replicate-filter"
                        checked={historyReplicateFilter === "original"}
                        onChange={() => setHistoryReplicateFilter("original")}
                      />
                      <span>原创</span>
                    </label>
                    <label className="filter-radio">
                      <input
                        type="radio"
                        name="history-replicate-filter"
                        checked={historyReplicateFilter === "replicate"}
                        onChange={() => setHistoryReplicateFilter("replicate")}
                      />
                      <span>复刻</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="filter-actions">
                <span className="filter-result-count">
                  显示 {filteredAndSortedHistory.length}/{history.length} 个作品
                </span>
                <button className="ghost-button small" onClick={clearHistoryFilters} disabled={!hasHistoryFilters}>
                  清空筛选
                </button>
              </div>
            </div>
          )}
          {migrationReport && (
            <div className="migration-banner">
              <div className="migration-banner-content">
                <span className="migration-banner-icon">📦</span>
                <div className="migration-banner-text">
                  <strong>数据迁移完成</strong>
                  <span>已从旧版本迁移 {migrationReport.count} 个作品
                    {migrationReport.deduped > 0 && `，修复 ${migrationReport.deduped} 个重复ID`}
                    {migrationReport.corrupted > 0 && `，跳过 ${migrationReport.corrupted} 条损坏记录`}
                    {migrationReport.recovered > 0 && `，恢复 ${migrationReport.recovered} 条记录`}
                  </span>
                </div>
                <button className="migration-banner-close" onClick={() => setMigrationReport(null)}>×</button>
              </div>
            </div>
          )}
          {!dbReady ? (
            <div className="history-loading">
              <div className="history-loading-spinner" />
              <span>加载作品库...</span>
            </div>
          ) : calendarOpen ? (
            <div className="calendar-view">
              {(() => {
                const creationsByDate = new Map<string, Creation[]>();
                filteredAndSortedHistory.forEach((c) => {
                  let dateStr: string;
                  try {
                    const d = new Date(c.createdAt);
                    if (isNaN(d.getTime())) dateStr = "";
                    else dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                  } catch {
                    dateStr = "";
                  }
                  if (!dateStr) return;
                  const arr = creationsByDate.get(dateStr) || [];
                  arr.push(c);
                  creationsByDate.set(dateStr, arr);
                });

                const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay();
                const today = new Date();
                const isCurrentMonth = today.getFullYear() === calendarYear && today.getMonth() === calendarMonth;
                const todayDate = today.getDate();

                function getDominantTraitLabel(creations: Creation[]): string | null {
                  const totals: Record<Trait, number> = { fresh: 0, sweet: 0, wood: 0, spice: 0 };
                  let hasAny = false;
                  for (const c of creations) {
                    if (c.traits) {
                      (Object.keys(totals) as Trait[]).forEach((t) => {
                        totals[t] += c.traits![t] ?? 0;
                      });
                      hasAny = true;
                    }
                  }
                  if (!hasAny) return null;
                  const top = (Object.keys(totals) as Trait[]).sort((a, b) => totals[b] - totals[a])[0];
                  return traitLabels[top];
                }

                const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
                const monthNames = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

                const selectedDateStr = calendarSelectedDay !== null
                  ? `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(calendarSelectedDay).padStart(2, "0")}`
                  : null;
                const selectedDayCreations = selectedDateStr ? (creationsByDate.get(selectedDateStr) || []) : [];

                return (
                  <>
                    <div className="calendar-nav">
                      <button
                        className="ghost-button small calendar-nav-btn"
                        onClick={() => {
                          let m = calendarMonth - 1;
                          let y = calendarYear;
                          if (m < 0) { m = 11; y--; }
                          setCalendarMonth(m);
                          setCalendarYear(y);
                          setCalendarSelectedDay(null);
                        }}
                      >
                        ◀
                      </button>
                      <span className="calendar-month-label">{calendarYear}年 {monthNames[calendarMonth]}</span>
                      <button
                        className="ghost-button small calendar-nav-btn"
                        onClick={() => {
                          let m = calendarMonth + 1;
                          let y = calendarYear;
                          if (m > 11) { m = 0; y++; }
                          setCalendarMonth(m);
                          setCalendarYear(y);
                          setCalendarSelectedDay(null);
                        }}
                      >
                        ▶
                      </button>
                    </div>
                    <div className="calendar-weekdays">
                      {weekdays.map((d) => (
                        <span key={d} className="calendar-weekday">{d}</span>
                      ))}
                    </div>
                    <div className="calendar-grid">
                      {Array.from({ length: firstDayOfWeek }, (_, i) => (
                        <span key={`empty-${i}`} className="calendar-cell empty" />
                      ))}
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const day = i + 1;
                        const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                        const dayCreations = creationsByDate.get(dateStr) || [];
                        const hasCreations = dayCreations.length > 0;
                        const isToday = isCurrentMonth && day === todayDate;
                        const isSelected = calendarSelectedDay === day;
                        const dominant = hasCreations ? getDominantTraitLabel(dayCreations) : null;
                        let dotColor = "#b77b54";
                        if (dominant === "清新") dotColor = "#75c7a5";
                        else if (dominant === "甜度") dotColor = "#f4c95d";
                        else if (dominant === "辛辣") dotColor = "#d96c63";

                        return (
                          <button
                            key={day}
                            className={`calendar-cell ${hasCreations ? "has-creations" : ""} ${isToday ? "is-today" : ""} ${isSelected ? "is-selected" : ""}`}
                            onClick={() => setCalendarSelectedDay(isSelected ? null : day)}
                          >
                            <span className="calendar-day-number">{day}</span>
                            {hasCreations && (
                              <span className="calendar-dot" style={{ background: dotColor }} />
                            )}
                            {hasCreations && (
                              <span className="calendar-day-count">{dayCreations.length}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {history.length === 0 && (
                      <div className="calendar-empty">
                        <span className="calendar-empty-icon">✧</span>
                        <p>还没有封瓶记录</p>
                        <small>在调香台创作并封瓶后，你的气味日记就会出现在这里</small>
                      </div>
                    )}
                    {history.length > 0 && filteredAndSortedHistory.length === 0 && (
                      <div className="calendar-empty">
                        <span className="calendar-empty-icon">✧</span>
                        <p>没有符合筛选的作品</p>
                        <small>调整筛选条件后，气味日记会同步显示匹配记录</small>
                      </div>
                    )}
                    {calendarSelectedDay !== null && selectedDayCreations.length > 0 && (
                      <div className="calendar-day-detail">
                        <div className="calendar-day-detail-header">
                          <h3>{calendarMonth + 1}月{calendarSelectedDay}日</h3>
                          {(() => {
                            const dom = getDominantTraitLabel(selectedDayCreations);
                            return dom ? <span className="calendar-tendency">倾向：{dom}</span> : null;
                          })()}
                        </div>
                        <div className="calendar-day-creations">
                          {selectedDayCreations.map((c) => (
                            <button
                              key={c.id}
                              className={`calendar-creation-item ${c.isReplicate ? "replicate-item" : ""}`}
                              onClick={() => openCreationDetail(c)}
                            >
                              <span className="calendar-creation-score">{c.score}分</span>
                              <div className="calendar-creation-info">
                                <strong>
                                  {c.name}
                                  {c.isReplicate && <small className="replicate-tag">✦ 复刻</small>}
                                </strong>
                                <span className="calendar-creation-notes">{(c.notes || []).join(" / ") || "无香调记录"}</span>
                                {c.fragranceStructure && (
                                  <span className="calendar-creation-phase">
                                    {(["top", "middle", "base"] as FragrancePhase[])
                                      .filter((p) => c.fragranceStructure![p])
                                      .map((p) => phaseLabels[p])
                                      .join("→")}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {calendarSelectedDay !== null && selectedDayCreations.length === 0 && (
                      <div className="calendar-day-detail">
                        <div className="calendar-day-detail-header">
                          <h3>{calendarMonth + 1}月{calendarSelectedDay}日</h3>
                        </div>
                        <p className="calendar-day-empty">这天没有封瓶记录</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          ) : history.length === 0 ? (
            <p className="empty">还没有封瓶作品。</p>
          ) : filteredAndSortedHistory.length === 0 ? (
            <p className="empty">没有符合筛选的作品。</p>
          ) : (
            <>
              <div className="history-list">
                {pagedHistory.map((creation) => (
                  <button key={creation.id} className={`history-item ${creation.isReplicate ? "replicate-item" : ""}`} onClick={() => openCreationDetail(creation)}>
                    <span>{creation.score}分</span>
                    <h3>
                      {creation.name}
                      {creation.isReplicate && <small className="replicate-tag">✦ 复刻</small>}
                    </h3>
                    <p>{(creation.notes || []).join(" / ") || "无香调记录"}</p>
                  </button>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="ghost-button small pagination-btn"
                    disabled={safeHistoryPage <= 1}
                    onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                  >
                    ◀ 上一页
                  </button>
                  <span className="pagination-info">
                    {safeHistoryPage} / {totalPages}
                    <small className="pagination-total">共 {filteredAndSortedHistory.length} 个</small>
                  </span>
                  <button
                    className="ghost-button small pagination-btn"
                    disabled={safeHistoryPage >= totalPages}
                    onClick={() => setHistoryPage((p) => Math.min(totalPages, p + 1))}
                  >
                    下一页 ▶
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {activeNote && (
        <div className="drawer-overlay" onClick={closeNoteDetail}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close" onClick={closeNoteDetail}>×</button>
            <div className="drawer-content">
              <span
                className="swatch-large"
                style={{
                  background: unlockedNoteIds.includes(activeNote.id)
                    ? activeNote.color
                    : "#ccc",
                  opacity: unlockedNoteIds.includes(activeNote.id) ? 1 : 0.6
                }}
              />
              <h2 className="drawer-title">
                {activeNote.name}
                {!unlockedNoteIds.includes(activeNote.id) && (
                  <span className="locked-badge">🔒 未解锁</span>
                )}
              </h2>
              <p className="drawer-profile">{activeNote.profile}</p>
              <span className={`phase-badge phase-badge-${getNotePhase(activeNote)}`}>
                {phaseLabels[getNotePhase(activeNote)]}香调
              </span>
              {!unlockedNoteIds.includes(activeNote.id) && activeNote.unlockCondition && (
                <div className="unlock-condition-box">
                  <h3>解锁条件</h3>
                  <p>{activeNote.unlockCondition.description}</p>
                </div>
              )}
              <div className="drawer-traits">
                <h3>气味性格</h3>
                {(Object.keys(activeNote.traits) as Trait[]).map((trait) => (
                  <label key={trait}>
                    <span>{traitLabels[trait]}</span>
                    <meter min={0} max={5} value={activeNote.traits[trait]} />
                    <b>{activeNote.traits[trait]}</b>
                  </label>
                ))}
              </div>
              <button
                className="primary-button drawer-action"
                disabled={selectedNotes.length >= MAX_NOTES || !unlockedNoteIds.includes(activeNote.id) || selectedNotes.some((s) => s.noteId === activeNote.id)}
                onClick={addNoteFromDrawer}
              >
                {!unlockedNoteIds.includes(activeNote.id)
                  ? "香调未解锁"
                  : selectedNotes.some((s) => s.noteId === activeNote.id)
                  ? "已在调香台"
                  : selectedNotes.length >= MAX_NOTES
                  ? "调香台已满"
                  : "加入调香台"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCreation && (
        <div className="drawer-overlay" onClick={closeCreationDetail}>
          <div className="drawer creation-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close" onClick={closeCreationDetail}>×</button>
            <div className="drawer-content">
              <div className="creation-score-badge">
                <span className="score-value">{activeCreation.score}</span>
                <span className="score-label">分</span>
              </div>
              <h2 className="drawer-title">
                {activeCreation.name}
                {activeCreation.isReplicate && <span className="replicate-badge">✦ 复刻</span>}
              </h2>
              {activeCreation.originalName && activeCreation.name !== activeCreation.originalName && (
                <p className="creation-original-name">原名：{activeCreation.originalName}</p>
              )}
              {activeCreation.sourceCreationName && (
                <p className="replicate-source-info">复刻来源：{activeCreation.sourceCreationName}</p>
              )}
              <p className="drawer-profile">{activeCreation.description}</p>

              <div className="creation-section">
                <h3>香调列表</h3>
                <div className="creation-notes">
                  {(() => {
                    const dropsMap = getCreationNoteDrops(activeCreation);
                    return (activeCreation.notes || []).map((noteName, index) => {
                      const note = getNoteByName(noteName);
                      const isLocked = note ? !unlockedNoteIds.includes(note.id) : true;
                      const isUnknown = !note;
                      const drops = dropsMap[noteName] || dropsMap[note?.id || ""] || DEFAULT_DROPS;
                      return (
                        <span
                          key={index}
                          className={`creation-note-tag ${isLocked ? "note-locked" : ""} ${isUnknown ? "note-unknown" : ""}`}
                        >
                          {isLocked && !isUnknown && <span className="note-lock-icon">🔒</span>}
                          {isUnknown && <span className="note-lock-icon">?</span>}
                          {noteName}
                          <span className="note-drops-badge">×{drops}</span>
                        </span>
                      );
                    });
                  })()}
                  {(!activeCreation.notes || activeCreation.notes.length === 0) && (
                    <span className="creation-note-tag" style={{ opacity: 0.6 }}>无香调记录</span>
                  )}
                </div>
                {(() => {
                  const total = Object.values(getCreationNoteDrops(activeCreation)).reduce((s, n) => s + n, 0);
                  if (activeCreation.notes && activeCreation.notes.length > 0 && total > 0) {
                    return (
                      <div className="creation-drops-summary">
                        <span>配方总滴数：</span>
                        <b>{total}</b>
                        <span className="drops-summary-note">滴</span>
                      </div>
                    );
                  }
                  return null;
                })()}
                {(() => {
                  const analysis = analyzeReplicability(activeCreation, unlockedNoteIds);
                  if (analysis.isPartial || analysis.missingUnknownNotes.length > 0) {
                    return (
                      <div className="replicate-warning-box">
                        {analysis.missingUnlockedNotes.length > 0 && (
                          <div className="replicate-warning-item">
                            <span className="warning-icon">🔒</span>
                            <span>{analysis.missingUnlockedNotes.length} 种香调未解锁：{analysis.missingUnlockedNotes.join("、")}</span>
                          </div>
                        )}
                        {analysis.missingUnknownNotes.length > 0 && (
                          <div className="replicate-warning-item">
                            <span className="warning-icon">?</span>
                            <span>{analysis.missingUnknownNotes.length} 种香调无法识别：{analysis.missingUnknownNotes.join("、")}</span>
                          </div>
                        )}
                        {analysis.canReplicate && (
                          <div className="replicate-warning-hint">
                            将仅恢复 {analysis.unlockedCount} 种已解锁香调
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="creation-section">
                <h3>性格分布</h3>
                {hasTraits(activeCreation) ? (
                  <div className="creation-traits">
                    {(Object.keys(traitLabels) as Trait[]).map((trait) => {
                      const value = activeCreation.traits[trait] ?? 0;
                      const maxValue = Math.max(...Object.values(activeCreation.traits).filter(v => typeof v === "number"), 1);
                      return (
                        <div key={trait} className="trait-bar-item">
                          <div className="trait-bar-header">
                            <span className="trait-name">{traitLabels[trait]}</span>
                            <b className="trait-value">{value}</b>
                          </div>
                          <div className="trait-bar-track">
                            <div
                              className="trait-bar-fill"
                              style={{
                                width: `${(value / maxValue) * 100}%`,
                                background: getTraitColor(trait)
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="traits-empty">
                    <span className="traits-empty-icon">✧</span>
                    <p>暂无性格分布数据</p>
                    <small>这是旧版本的作品记录，当时还没有性格分析功能。</small>
                  </div>
                )}
              </div>

              {activeCreation.fragranceStructure && (
                <div className="creation-section">
                  <h3>香气结构</h3>
                  <div className="phase-breakdown">
                    {(["top", "middle", "base"] as FragrancePhase[]).map((phase) => {
                      const profile = activeCreation.fragranceStructure![phase];
                      if (!profile) return null;
                      const phaseDesc = activeCreation.phaseDescriptions?.[phase] || "";
                      return (
                        <div key={phase} className={`phase-card phase-card-${phase}`}>
                          <div className="phase-card-header">
                            <span className={`phase-badge phase-badge-${phase}`}>{phaseLabels[phase]}</span>
                            <span className="phase-dominant">{traitLabels[profile.dominantTrait]}主导</span>
                          </div>
                          <div className="phase-card-notes">
                            {profile.noteNames.map((name, i) => (
                              <span key={i} className="phase-note-tag">{name}</span>
                            ))}
                          </div>
                          {phaseDesc && <p className="phase-card-desc">{phaseDesc}</p>}
                          <div className="phase-card-traits">
                            {(Object.keys(traitLabels) as Trait[]).map((trait) => {
                              const val = profile.traits[trait];
                              if (val === 0) return null;
                              return (
                                <span key={trait} className="phase-trait-chip" style={{ borderColor: getTraitColor(trait) }}>
                                  {traitLabels[trait]} {val}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="creation-actions">
                {(() => {
                  const analysis = analyzeReplicability(activeCreation, unlockedNoteIds);
                  const canReplicate = activeCreation.notes.length > 0 && analysis.canReplicate;
                  let replicateButtonText = "✦ 复刻到调香台";
                  if (activeCreation.notes.length === 0) {
                    replicateButtonText = "无香调可复刻";
                  } else if (!analysis.canReplicate) {
                    replicateButtonText = "无可复刻香调";
                  } else if (analysis.isPartial) {
                    replicateButtonText = `✦ 部分复刻（${analysis.unlockedCount}/${activeCreation.notes.length}种）`;
                  }
                  let adjustButtonText = "✎ 继续调整";
                  if (activeCreation.notes.length === 0) {
                    adjustButtonText = "无香调可调整";
                  } else if (!analysis.canReplicate) {
                    adjustButtonText = "无可调整香调";
                  } else if (analysis.isPartial) {
                    adjustButtonText = `✎ 继续调整（${analysis.unlockedCount}/${activeCreation.notes.length}种）`;
                  }
                  return (
                    <>
                      <button
                        className={`primary-button replicate-action-btn ${analysis.isPartial ? "partial-btn" : ""}`}
                        onClick={() => replicateCreation(activeCreation)}
                        disabled={!canReplicate}
                      >
                        {replicateButtonText}
                      </button>
                      <button
                        className={`ghost-button replicate-action-btn adjust-action-btn ${analysis.isPartial ? "partial-btn" : ""}`}
                        onClick={() => continueAdjusting(activeCreation)}
                        disabled={!canReplicate}
                      >
                        {adjustButtonText}
                      </button>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {unlockNotificationOpen && newlyUnlocked.length > 0 && (
        <div className="drawer-overlay unlock-overlay" onClick={() => setUnlockNotificationOpen(false)}>
          <div className="unlock-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setUnlockNotificationOpen(false)}>×</button>
            <div className="unlock-content">
              <div className="unlock-celebration">✨</div>
              <h2 className="unlock-title">恭喜解锁新香调！</h2>
              <p className="unlock-subtitle">你的作品出色，解锁了新的调香材料</p>
              <div className="unlock-notes-grid">
                {newlyUnlocked.map((note) => (
                  <div key={note.id} className="unlock-note-card">
                    <span className="swatch-large" style={{ background: note.color }} />
                    <h3>{note.name}</h3>
                    <p>{note.profile}</p>
                    <div className="unlock-note-traits">
                      {(Object.keys(note.traits) as Trait[]).map((trait) => (
                        <span
                          key={trait}
                          className="unlock-trait-chip"
                          style={{ borderColor: getTraitColor(trait) }}
                        >
                          {traitLabels[trait]} {note.traits[trait]}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <button
                className="primary-button"
                onClick={() => setUnlockNotificationOpen(false)}
              >
                太棒了！
              </button>
            </div>
          </div>
        </div>
      )}

      {replicateNotificationOpen && replicateSource && replicateResult && (
        <div className="drawer-overlay replicate-overlay" onClick={() => setReplicateNotificationOpen(false)}>
          <div className="replicate-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setReplicateNotificationOpen(false)}>×</button>
            <div className="replicate-content">
              <div className={`replicate-icon ${replicateResult.originalNoteCount > replicateResult.restoredNoteIds.length ? "partial" : ""}`}>
                {replicateResult.originalNoteCount > replicateResult.restoredNoteIds.length ? "⚠" : "✦"}
              </div>
              <h2 className="replicate-title">
                {replicateResult.originalNoteCount > replicateResult.restoredNoteIds.length ? "部分复刻到调香台" : "已复刻到调香台"}
              </h2>
              <p className="replicate-subtitle">
                配方「{replicateSource.name}」
                {replicateResult.originalNoteCount > replicateResult.restoredNoteIds.length
                  ? "已部分恢复，可继续调整后封瓶"
                  : "已恢复，你可以继续调整后封瓶"}
              </p>
              <div className="replicate-details">
                <div className="replicate-detail-item">
                  <span className="replicate-detail-label">香调数量</span>
                  <span className="replicate-detail-value">
                    {replicateResult.restoredNoteIds.length}
                    {replicateResult.originalNoteCount > replicateResult.restoredNoteIds.length && (
                      <span className="replicate-count-original">
                        {" "}
                        / {replicateResult.originalNoteCount}
                      </span>
                    )}
                    {" 种"}
                  </span>
                </div>
                <div className="replicate-detail-item">
                  <span className="replicate-detail-label">配方滴数</span>
                  <span className="replicate-detail-value">
                    {Object.entries(replicateResult.restoredNoteDrops)
                      .map(([name, d]) => `${name}×${d}`)
                      .join("、")}
                  </span>
                </div>
                <div className="replicate-detail-item">
                  <span className="replicate-detail-label">新作品名</span>
                  <span className="replicate-detail-value">{replicateSource.name}（复刻）</span>
                </div>
                <div className="replicate-detail-traits">
                  <div className="replicate-traits-label">当前气味性格（已恢复部分）</div>
                  <div className="replicate-traits-chips">
                    {(Object.keys(traitLabels) as Trait[]).map((trait) => (
                      <span
                        key={trait}
                        className="replicate-trait-chip"
                        style={{ borderColor: getTraitColor(trait) }}
                      >
                        {traitLabels[trait]} {replicateResult.restoredTraits[trait]}
                      </span>
                    ))}
                  </div>
                </div>
                {(replicateResult.missingUnlockedNotes.length > 0 || replicateResult.missingUnknownNotes.length > 0) && (
                  <div className="replicate-missing-section">
                    <div className="replicate-missing-title">未恢复的香调：</div>
                    {replicateResult.missingUnlockedNotes.length > 0 && (
                      <div className="replicate-missing-item">
                        <span className="replicate-missing-icon">🔒</span>
                        <span className="replicate-missing-text">
                          未解锁：{replicateResult.missingUnlockedNotes.join("、")}
                        </span>
                      </div>
                    )}
                    {replicateResult.missingUnknownNotes.length > 0 && (
                      <div className="replicate-missing-item">
                        <span className="replicate-missing-icon">?</span>
                        <span className="replicate-missing-text">
                          无法识别：{replicateResult.missingUnknownNotes.join("、")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <button
                className="primary-button"
                onClick={() => setReplicateNotificationOpen(false)}
              >
                开始调整
              </button>
            </div>
          </div>
        </div>
      )}

      {importNotificationOpen && importResult && (
        <div className="drawer-overlay import-overlay" onClick={() => setImportNotificationOpen(false)}>
          <div className="import-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setImportNotificationOpen(false)}>×</button>
            <div className="import-content">
              <div className={`import-icon ${importResult.skippedCount > 0 ? "partial" : ""}`}>
                {importResult.successCount > 0 ? (importResult.skippedCount > 0 ? "⚠" : "✓") : "✕"}
              </div>
              <h2 className="import-title">
                {importResult.successCount > 0
                  ? importResult.skippedCount > 0
                    ? "部分作品导入成功"
                    : "作品导入成功"
                  : "导入失败"}
              </h2>
              <p className="import-subtitle">
                {importResult.successCount > 0
                  ? `成功导入 ${importResult.successCount} 个作品`
                  : "没有成功导入的作品"}
                {importResult.skippedCount > 0 && `，跳过 ${importResult.skippedCount} 个`}
              </p>
              {importResult.success.length > 0 && (
                <div className="import-details">
                  <div className="import-detail-section">
                    <h3>成功导入的作品</h3>
                    <div className="import-success-list">
                      {importResult.success.slice(0, 5).map((creation) => (
                        <div key={creation.id} className="import-success-item">
                          <span className="import-success-score">{creation.score}分</span>
                          <span className="import-success-name">{creation.name}</span>
                          <span className="import-success-notes">
                            {(creation.notes || []).join(" / ") || "无香调"}
                          </span>
                        </div>
                      ))}
                      {importResult.success.length > 5 && (
                        <div className="import-more-hint">还有 {importResult.success.length - 5} 个作品...</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {importResult.skipped.length > 0 && (
                <div className="import-details">
                  <div className="import-detail-section">
                    <h3>跳过的作品及原因</h3>
                    <div className="import-skipped-list">
                      {(() => {
                        const reasonGroups = new Map<string, number>();
                        importResult.skipped.forEach((item) => {
                          const reason = item.reason || "未知原因";
                          reasonGroups.set(reason, (reasonGroups.get(reason) || 0) + 1);
                        });
                        return Array.from(reasonGroups.entries()).map(([reason, count]) => (
                          <div key={reason} className="import-skipped-item">
                            <span className="import-skipped-icon">⚠</span>
                            <span className="import-skipped-reason">{reason}</span>
                            <span className="import-skipped-count">{count} 个</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                </div>
              )}
              <button
                className="primary-button"
                onClick={() => setImportNotificationOpen(false)}
              >
                知道了
              </button>
            </div>
          </div>
        </div>
      )}

      {saveDialogOpen && editingSource && current && (
        <div className="drawer-overlay save-overlay" onClick={() => setSaveDialogOpen(false)}>
          <div className="save-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close" onClick={() => setSaveDialogOpen(false)}>×</button>
            <div className="save-content">
              <div className="save-icon">💾</div>
              <h2 className="save-title">保存作品</h2>
              <p className="save-subtitle">
                正在调整的作品：<b>{editingSource.name}</b>
                {editingSource.sourceCreationName && (
                  <>
                    {" "}（来源：{editingSource.sourceCreationName}）
                  </>
                )}
              </p>
              <p className="save-description">
                调整后新作品名为：<b>{displayName}</b>
              </p>
              <div className="save-options">
                <button
                  className="save-option-card"
                  onClick={saveAsNewCreation}
                >
                  <div className="save-option-icon">✨</div>
                  <h3>保存为新作品</h3>
                  <p>保留原作品不变，创建一个新的作品记录</p>
                </button>
                <button
                  className="save-option-card save-option-overwrite"
                  onClick={overwriteOriginalCreation}
                >
                  <div className="save-option-icon">✎</div>
                  <h3>覆盖原作品</h3>
                  <p>
                    更新原作品的配方、名称和评分，
                    保留原始创建时间
                    {editingSource.sourceCreationName && "和来源信息"}
                  </p>
                </button>
              </div>
              <button
                className="ghost-button"
                onClick={() => setSaveDialogOpen(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {compareOpen && (
        <div className="drawer-overlay compare-overlay" onClick={closeCompare}>
          <div className="compare-drawer" onClick={(e) => e.stopPropagation()}>
            <button className="drawer-close compare-close" onClick={closeCompare}>×</button>
            <div className="compare-content">
              <div className="compare-header">
                <h2 className="compare-title">配方对比台</h2>
                <p className="compare-subtitle">选择两个作品，并排对比它们的气味性格</p>
              </div>

              {history.length < 2 ? (
                <div className="compare-empty">
                  <span className="compare-empty-icon">✧</span>
                  <p>至少需要两个封瓶作品才能对比</p>
                  <small>先去调香台创作几瓶吧～</small>
                </div>
              ) : (
                <>
                  <div className="compare-selectors">
                    <div className="compare-selector">
                      <label className="compare-selector-label">作品 A</label>
                      <select
                        className="compare-select"
                        value={compareId1 || ""}
                        onChange={(e) => selectForCompare(1, e.target.value)}
                      >
                        {history.map((creation) => (
                          <option key={creation.id} value={creation.id}>
                            {creation.name || "未命名作品"} ({creation.score ?? 0}分)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="compare-vs">
                      <span>VS</span>
                    </div>
                    <div className="compare-selector">
                      <label className="compare-selector-label">作品 B</label>
                      <select
                        className="compare-select"
                        value={compareId2 || ""}
                        onChange={(e) => selectForCompare(2, e.target.value)}
                      >
                        {history.map((creation) => (
                          <option key={creation.id} value={creation.id}>
                            {creation.name || "未命名作品"} ({creation.score ?? 0}分)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {compareId1 === compareId2 && (
                    <div className="compare-warning">
                      <span>⚠</span>
                      两个位置选择了同一个作品，差异将显示为零
                    </div>
                  )}

                  <div className="compare-grid">
                    <CompareCard creation={compareCreation1} side="left" />
                    <CompareCard creation={compareCreation2} side="right" />
                  </div>

                  <div className="compare-diff-section">
                    <h3>性格差异对比</h3>
                    {(Object.keys(traitLabels) as Trait[]).map((trait) => {
                      const diff = getTraitDiff(compareCreation1, compareCreation2, trait);
                      const hasBoth = compareCreation1 && compareCreation2 && hasTraits(compareCreation1) && hasTraits(compareCreation2);
                      const absMax = 12;
                      return (
                        <div key={trait} className="compare-diff-row">
                          <span className="compare-diff-label">{traitLabels[trait]}</span>
                          <div className="compare-diff-bar">
                            <div className="compare-diff-left">
                              {hasBoth && diff < 0 && (
                                <div
                                  className="compare-diff-fill left"
                                  style={{
                                    width: `${(Math.abs(diff) / absMax) * 100}%`,
                                    background: getTraitColor(trait)
                                  }}
                                />
                              )}
                            </div>
                            <div className="compare-diff-center" />
                            <div className="compare-diff-right">
                              {hasBoth && diff > 0 && (
                                <div
                                  className="compare-diff-fill right"
                                  style={{
                                    width: `${(Math.abs(diff) / absMax) * 100}%`,
                                    background: getTraitColor(trait)
                                  }}
                                />
                              )}
                            </div>
                          </div>
                          <span className={`compare-diff-value ${diff > 0 ? "positive" : diff < 0 ? "negative" : ""}`}>
                            {!hasBoth ? "—" : diff > 0 ? `+${diff}` : diff}
                          </span>
                        </div>
                      );
                    })}
                    {(!compareCreation1 || !compareCreation2 || !hasTraits(compareCreation1) || !hasTraits(compareCreation2)) && (
                      <div className="compare-diff-note">
                        <span>✧</span>
                        部分作品缺少性格数据，无法计算完整差异
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function CompareCard({ creation, side }: { creation: Creation | null; side: "left" | "right" }) {
  if (!creation) {
    return (
      <div className={`compare-card compare-card-${side} compare-card-empty`}>
        <div className="compare-card-placeholder">
          <span className="compare-empty-icon">✧</span>
          <p>请选择一个作品</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`compare-card compare-card-${side}`}>
      <div className="compare-card-header">
        <div className="compare-card-score">
          <span className="compare-score-value">{creation.score}</span>
          <span className="compare-score-label">分</span>
        </div>
        <h3 className="compare-card-name">{creation.name}</h3>
        {creation.originalName && creation.name !== creation.originalName && (
          <p className="compare-card-original">原名：{creation.originalName}</p>
        )}
      </div>
      <p className="compare-card-desc">{creation.description}</p>

      <div className="compare-card-section">
        <h4>香调组成</h4>
        <div className="compare-card-notes">
          {(() => {
            const dropsMap = getCreationNoteDropsStandalone(creation);
            return (creation.notes || []).map((noteName, index) => (
              <span key={index} className="compare-note-tag">
                {noteName}
                <span className="compare-note-drops">×{dropsMap[noteName] || DEFAULT_DROPS}</span>
              </span>
            ));
          })()}
          {(!creation.notes || creation.notes.length === 0) && (
            <span className="compare-note-tag" style={{ opacity: 0.6 }}>无香调记录</span>
          )}
        </div>
        {(() => {
          const total = Object.values(getCreationNoteDropsStandalone(creation)).reduce((s, n) => s + n, 0);
          if (creation.notes && creation.notes.length > 0 && total > 0) {
            return (
              <div className="compare-drops-summary">
                总滴数：<b>{total}</b>
              </div>
            );
          }
          return null;
        })()}
      </div>

      <div className="compare-card-section">
        <h4>性格分布</h4>
        {hasTraitsStandalone(creation) ? (
          <div className="compare-card-traits">
            {(Object.keys(traitLabelsStandalone) as Trait[]).map((trait) => {
              const value = creation.traits![trait] ?? 0;
              const maxValue = Math.max(
                ...Object.values(creation.traits!).filter((v) => typeof v === "number"),
                1
              );
              return (
                <div key={trait} className="compare-trait-item">
                  <div className="compare-trait-header">
                    <span className="compare-trait-name">{traitLabelsStandalone[trait]}</span>
                    <b className="compare-trait-value">{value}</b>
                  </div>
                  <div className="compare-trait-track">
                    <div
                      className="compare-trait-fill"
                      style={{
                        width: `${(value / maxValue) * 100}%`,
                        background: getTraitColorStandalone(trait)
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="compare-traits-empty">
            <span>✧</span>
            <small>暂无性格数据</small>
          </div>
        )}
      </div>

      {creation.fragranceStructure && (
        <div className="compare-card-section">
          <h4>香气结构</h4>
          <div className="compare-phase-breakdown">
            {(["top", "middle", "base"] as FragrancePhase[]).map((phase) => {
              const profile = creation.fragranceStructure![phase];
              if (!profile) return null;
              return (
                <div key={phase} className={`compare-phase-item compare-phase-${phase}`}>
                  <span className={`compare-phase-badge compare-phase-badge-${phase}`}>
                    {phaseLabelsStandalone[phase]}
                  </span>
                  <span className="compare-phase-notes">
                    {profile.noteNames.join("、")}
                  </span>
                  <span className="compare-phase-dominant" style={{ color: getTraitColorStandalone(profile.dominantTrait) }}>
                    {traitLabelsStandalone[profile.dominantTrait]}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function hasTraitsStandalone(creation: Creation): creation is Creation & { traits: Record<Trait, number> } {
  return !!(creation.traits && typeof creation.traits === "object" && Object.keys(creation.traits).length > 0);
}

function getCreationNoteDropsStandalone(creation: Creation): Record<string, number> {
  if (creation.noteDrops && Object.keys(creation.noteDrops).length > 0) {
    return creation.noteDrops;
  }
  const drops: Record<string, number> = {};
  creation.notes.forEach((name) => {
    drops[name] = DEFAULT_DROPS;
  });
  return drops;
}

const traitLabelsStandalone: Record<Trait, string> = {
  fresh: "清新",
  sweet: "甜度",
  wood: "木质",
  spice: "辛辣"
};

const phaseLabelsStandalone: Record<FragrancePhase, string> = {
  top: "前调",
  middle: "中调",
  base: "后调"
};

function getTraitColorStandalone(trait: Trait): string {
  const colors: Record<Trait, string> = {
    fresh: "#75c7a5",
    sweet: "#f4c95d",
    wood: "#b77b54",
    spice: "#d96c63"
  };
  return colors[trait];
}

function getTraitColor(trait: Trait): string {
  const colors: Record<Trait, string> = {
    fresh: "#75c7a5",
    sweet: "#f4c95d",
    wood: "#b77b54",
    spice: "#d96c63"
  };
  return colors[trait];
}
