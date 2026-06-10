import { useEffect, useMemo, useState } from "react";

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

type Creation = {
  id: string;
  name: string;
  originalName: string;
  score: number;
  description: string;
  traits?: Record<Trait, number>;
  notes: string[];
  createdAt: string;
};

const storageKey = "hxwl-1-creations";

const traitLabels: Record<Trait, string> = {
  fresh: "清新",
  sweet: "甜度",
  wood: "木质",
  spice: "辛辣"
};

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

function isValidCreation(data: unknown): data is Creation {
  if (!data || typeof data !== "object") return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.score === "number" &&
    typeof obj.description === "string" &&
    Array.isArray(obj.notes)
  );
}

function normalizeCreation(data: Partial<Creation> & { id: string }): Creation {
  const safeNotes = Array.isArray(data.notes) ? data.notes.filter((n) => typeof n === "string") : [];
  const safeTraits = (data.traits && typeof data.traits === "object")
    ? {
        fresh: typeof data.traits.fresh === "number" && isFinite(data.traits.fresh) ? data.traits.fresh : 0,
        sweet: typeof data.traits.sweet === "number" && isFinite(data.traits.sweet) ? data.traits.sweet : 0,
        wood: typeof data.traits.wood === "number" && isFinite(data.traits.wood) ? data.traits.wood : 0,
        spice: typeof data.traits.spice === "number" && isFinite(data.traits.spice) ? data.traits.spice : 0
      }
    : undefined;
  const hasAnyTrait = safeTraits && (safeTraits.fresh + safeTraits.sweet + safeTraits.wood + safeTraits.spice) > 0;
  return {
    id: data.id,
    name: typeof data.name === "string" && data.name ? data.name : "未命名作品",
    originalName: typeof data.originalName === "string" && data.originalName ? data.originalName : (typeof data.name === "string" && data.name ? data.name : "未命名作品"),
    score: typeof data.score === "number" && isFinite(data.score) ? data.score : 0,
    description: typeof data.description === "string" && data.description ? data.description : "暂无描述",
    traits: hasAnyTrait ? safeTraits : undefined,
    notes: safeNotes,
    createdAt: typeof data.createdAt === "string" && data.createdAt ? data.createdAt : new Date().toISOString()
  };
}

function loadHistory(): Creation[] {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((item): item is Partial<Creation> & { id: string } => {
        return item && typeof item === "object" && typeof (item as { id?: string }).id === "string";
      })
      .map(normalizeCreation)
      .filter((item) => item.notes.length > 0 || item.score > 0);
  } catch {
    return [];
  }
}

function describe(traits: Record<Trait, number>, selected: Note[]) {
  const topTrait = (Object.keys(traits) as Trait[]).sort((a, b) => traits[b] - traits[a])[0];
  const balance = Object.values(traits).filter((value) => value >= 3).length;
  const score = Math.min(98, 54 + selected.length * 8 + balance * 5 + Math.max(...Object.values(traits)));
  const nameParts: Record<Trait, string[]> = {
    fresh: ["晨雾", "玻璃雨", "青叶"],
    sweet: ["糖梨", "柔光", "蜜径"],
    wood: ["木匣", "旧书", "雪松"],
    spice: ["火星", "胡椒月", "赤信"]
  };
  const suffix = selected.length >= 4 ? "复调" : selected.length >= 2 ? "短诗" : "试香";
  const name = `${nameParts[topTrait][traits[topTrait] % 3]}${suffix}`;
  const descriptionMap: Record<Trait, string> = {
    fresh: "像刚打开的窗，干净、轻快，适合雨后出门。",
    sweet: "有柔软的果香和一点暖意，像藏在衣袋里的糖纸。",
    wood: "结构清楚，尾调安静，适合慢慢靠近。",
    spice: "第一秒就有亮点，辛香让整瓶作品更有脾气。"
  };
  return { score, name, description: descriptionMap[topTrait] };
}

type QuizOption = {
  label: string;
  traitDelta: Partial<Record<Trait, number>>;
};

type QuizQuestion = {
  question: string;
  options: QuizOption[];
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
      { label: "轻透淡雅", traitDelta: { fresh: 2 } },
      { label: "刚好就好", traitDelta: {} },
      { label: "浓郁有存在感", traitDelta: { sweet: 1, wood: 1, spice: 1 } }
    ]
  }
];

function recommendNotes(quizTraits: Record<Trait, number>, unlockedIds: string[]): Note[] {
  return [...notes]
    .filter((note) => unlockedIds.includes(note.id))
    .map((note) => {
      let score = 0;
      (Object.keys(quizTraits) as Trait[]).forEach((trait) => {
        score += note.traits[trait] * quizTraits[trait];
      });
      return { note, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((item) => item.note);
}

export default function App() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [history, setHistory] = useState<Creation[]>(loadHistory);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [customName, setCustomName] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [pendingCustomName, setPendingCustomName] = useState<string>("");
  const [activeCreation, setActiveCreation] = useState<Creation | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizStep, setQuizStep] = useState(0);
  const [quizTraits, setQuizTraits] = useState<Record<Trait, number>>({ fresh: 0, sweet: 0, wood: 0, spice: 0 });
  const [quizDone, setQuizDone] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareId1, setCompareId1] = useState<string | null>(null);
  const [compareId2, setCompareId2] = useState<string | null>(null);
  const [unlockedNoteIds, setUnlockedNoteIds] = useState<string[]>(loadUnlockedNotes);
  const [newlyUnlocked, setNewlyUnlocked] = useState<Note[]>([]);
  const [unlockNotificationOpen, setUnlockNotificationOpen] = useState(false);
  const [showAllNotes, setShowAllNotes] = useState(false);

  useEffect(() => {
    const syncHistory = () => {
      setHistory(loadHistory());
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === storageKey) {
        syncHistory();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncHistory();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("focus", syncHistory);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("focus", syncHistory);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

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

  const selectedNotes = selectedIds
    .map((id) => notes.find((note) => note.id === id)!)
    .filter(Boolean);
  const traits = useMemo(
    () =>
      selectedNotes.reduce(
        (total, note) => {
          (Object.keys(total) as Trait[]).forEach((trait) => {
            total[trait] += note.traits[trait];
          });
          return total;
        },
        { fresh: 0, sweet: 0, wood: 0, spice: 0 }
      ),
    [selectedNotes]
  );

  const current = selectedNotes.length > 0 ? describe(traits, selectedNotes) : null;
  const displayName = customName || (current ? current.name : "");

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
    if (!activeNote || selectedIds.length >= 5) return;
    if (!unlockedNoteIds.includes(activeNote.id)) return;
    setSelectedIds((items) => [...items, activeNote.id]);
    closeNoteDetail();
  }

  function bottleCreation() {
    if (!current || selectedNotes.length === 0) return;
    const finalName = customName.trim() || current.name;
    const creation: Creation = {
      id: crypto.randomUUID(),
      name: finalName,
      originalName: current.name,
      score: current.score,
      description: current.description,
      traits,
      notes: selectedNotes.map((note) => note.name),
      createdAt: new Date().toISOString()
    };
    const next = [creation, ...history].slice(0, 5);
    setHistory(next);
    localStorage.setItem(storageKey, JSON.stringify(next));

    const newlyUnlockedNotes = getNewlyUnlockedNotes(
      traits,
      current.score,
      unlockedNoteIds
    );
    if (newlyUnlockedNotes.length > 0) {
      const nextUnlocked = [...unlockedNoteIds, ...newlyUnlockedNotes.map((n) => n.id)];
      setUnlockedNoteIds(nextUnlocked);
      saveUnlockedNotes(nextUnlocked);
      setNewlyUnlocked(newlyUnlockedNotes);
      setUnlockNotificationOpen(true);
    }

    setSelectedIds([]);
    setCustomName("");
    setPendingCustomName("");
    setIsEditingName(false);
  }

  function handleQuizAnswer(option: QuizOption) {
    const next = { ...quizTraits };
    (Object.keys(option.traitDelta) as Trait[]).forEach((trait) => {
      next[trait] += option.traitDelta[trait] ?? 0;
    });
    if (quizStep < quizQuestions.length - 1) {
      setQuizTraits(next);
      setQuizStep(quizStep + 1);
    } else {
      setQuizTraits(next);
      setQuizDone(true);
    }
  }

  function resetQuiz() {
    setQuizStep(0);
    setQuizTraits({ fresh: 0, sweet: 0, wood: 0, spice: 0 });
    setQuizDone(false);
  }

  function applyRecommendation() {
    const recommended = recommendNotes(quizTraits, unlockedNoteIds);
    const newIds = recommended
      .map((n) => n.id)
      .filter((id) => !selectedIds.includes(id))
      .slice(0, 5 - selectedIds.length);
    if (newIds.length > 0) {
      setSelectedIds((ids) => [...ids, ...newIds]);
    }
    setQuizOpen(false);
    resetQuiz();
  }

  function exportCreations() {
    const storedCreations = loadHistory();
    if (storedCreations.length === 0) {
      setHistory([]);
      return;
    }
    setHistory(storedCreations);
    const exportData = storedCreations.map((creation) => ({
      name: creation.name,
      score: creation.score,
      description: creation.description,
      notes: creation.notes,
      createdAt: creation.createdAt
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
            setSelectedIds([]);
            setCustomName("");
            setPendingCustomName("");
            setIsEditingName(false);
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
                  {recommendNotes(quizTraits, unlockedNoteIds).map((note) => (
                    <div key={note.id} className="quiz-rec-card">
                      <span className="swatch" style={{ background: note.color }} />
                      <strong>{note.name}</strong>
                      <small>{note.profile}</small>
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
              <button
                className={`ghost-button small toggle-notes-btn ${showAllNotes ? "active" : ""}`}
                onClick={() => setShowAllNotes(!showAllNotes)}
              >
                {showAllNotes ? "隐藏未解锁" : "显示全部"}
              </button>
            </div>
          </div>
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
          <div className="bottle">
            {selectedNotes.length === 0 ? (
              <span>选择香调开始</span>
            ) : (
              selectedNotes.map((note, index) => (
                <i key={`${note.id}-${index}`} style={{ background: note.color, height: `${34 + index * 10}px` }} />
              ))
            )}
          </div>
          <div className="selected-list">
            {selectedNotes.map((note, index) => (
              <button key={`${note.id}-${index}`} onClick={() => setSelectedIds((ids) => ids.filter((_, i) => i !== index))}>
                {note.name}
              </button>
            ))}
          </div>
          <div className="traits">
            {(Object.keys(traits) as Trait[]).map((trait) => (
              <label key={trait}>
                <span>{traitLabels[trait]}</span>
                <meter min={0} max={12} value={traits[trait]} />
                <b>{traits[trait]}</b>
              </label>
            ))}
          </div>
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
                <button className="primary-button" disabled={!current} onClick={bottleCreation}>
                  封瓶记录
                </button>
              </>
            ) : (
              <>
                <strong>未命名试香</strong>
                <p>至少加入一种香调，系统会根据气味性格生成名字和评分。</p>
              </>
            )}
          </div>
        </div>

        <div className="panel history-panel">
          <div className="history-header">
            <h2>最近作品</h2>
            <div className="history-actions">
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
            </div>
          </div>
          {history.length === 0 ? (
            <p className="empty">还没有封瓶作品。</p>
          ) : (
            <div className="history-list">
              {history.map((creation) => (
                <button key={creation.id} className="history-item" onClick={() => openCreationDetail(creation)}>
                  <span>{creation.score}分</span>
                  <h3>{creation.name}</h3>
                  <p>{(creation.notes || []).join(" / ") || "无香调记录"}</p>
                </button>
              ))}
            </div>
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
                disabled={selectedIds.length >= 5 || !unlockedNoteIds.includes(activeNote.id)}
                onClick={addNoteFromDrawer}
              >
                {!unlockedNoteIds.includes(activeNote.id)
                  ? "香调未解锁"
                  : selectedIds.length >= 5
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
              <h2 className="drawer-title">{activeCreation.name}</h2>
              {activeCreation.originalName && activeCreation.name !== activeCreation.originalName && (
                <p className="creation-original-name">原名：{activeCreation.originalName}</p>
              )}
              <p className="drawer-profile">{activeCreation.description}</p>

              <div className="creation-section">
                <h3>香调列表</h3>
                <div className="creation-notes">
                  {(activeCreation.notes || []).map((noteName, index) => (
                    <span key={index} className="creation-note-tag">
                      {noteName}
                    </span>
                  ))}
                  {(!activeCreation.notes || activeCreation.notes.length === 0) && (
                    <span className="creation-note-tag" style={{ opacity: 0.6 }}>无香调记录</span>
                  )}
                </div>
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
          {(creation.notes || []).map((noteName, index) => (
            <span key={index} className="compare-note-tag">
              {noteName}
            </span>
          ))}
          {(!creation.notes || creation.notes.length === 0) && (
            <span className="compare-note-tag" style={{ opacity: 0.6 }}>无香调记录</span>
          )}
        </div>
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
    </div>
  );
}

function hasTraitsStandalone(creation: Creation): creation is Creation & { traits: Record<Trait, number> } {
  return !!(creation.traits && typeof creation.traits === "object" && Object.keys(creation.traits).length > 0);
}

const traitLabelsStandalone: Record<Trait, string> = {
  fresh: "清新",
  sweet: "甜度",
  wood: "木质",
  spice: "辛辣"
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
