import { useMemo, useState } from "react";

type Note = {
  id: string;
  name: string;
  color: string;
  profile: string;
  traits: Record<Trait, number>;
};

type Trait = "fresh" | "sweet" | "wood" | "spice";

type Creation = {
  id: string;
  name: string;
  originalName: string;
  score: number;
  description: string;
  traits: Record<Trait, number>;
  notes: string[];
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
    traits: { fresh: 4, sweet: 1, wood: 0, spice: 0 }
  },
  {
    id: "pearjam",
    name: "梨酱",
    color: "#f4c95d",
    profile: "圆润的果甜，能把配方变得柔软。",
    traits: { fresh: 1, sweet: 4, wood: 0, spice: 0 }
  },
  {
    id: "cedar",
    name: "雪松屑",
    color: "#b77b54",
    profile: "干燥、安静，给香气一层骨架。",
    traits: { fresh: 0, sweet: 0, wood: 4, spice: 1 }
  },
  {
    id: "pepper",
    name: "粉胡椒",
    color: "#d96c63",
    profile: "明亮的刺激感，适合给尾调加火花。",
    traits: { fresh: 0, sweet: 0, wood: 1, spice: 4 }
  },
  {
    id: "milkflower",
    name: "奶白花",
    color: "#f7dfda",
    profile: "轻柔花香，甜而不腻。",
    traits: { fresh: 1, sweet: 3, wood: 0, spice: 1 }
  },
  {
    id: "smoketea",
    name: "烟茶",
    color: "#8d8f6f",
    profile: "微苦茶烟，适合做成熟的底色。",
    traits: { fresh: 1, sweet: 0, wood: 3, spice: 2 }
  }
];

function loadHistory(): Creation[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey) || "[]") as Creation[];
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

export default function App() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [history, setHistory] = useState<Creation[]>(loadHistory);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [customName, setCustomName] = useState<string>("");
  const [isEditingName, setIsEditingName] = useState<boolean>(false);

  const selectedNotes = selectedIds.map((id) => notes.find((note) => note.id === id)!).filter(Boolean);
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

  function addNoteFromDrawer() {
    if (!activeNote || selectedIds.length >= 5) return;
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
      notes: selectedNotes.map((note) => note.name)
    };
    const next = [creation, ...history].slice(0, 5);
    setHistory(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    setSelectedIds([]);
    setCustomName("");
    setIsEditingName(false);
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
            setIsEditingName(false);
          }}
        >
          清空调香台
        </button>
      </section>

      <section className="workspace">
        <div className="panel note-panel">
          <h2>香调架</h2>
          <div className="note-grid">
            {notes.map((note) => (
              <button key={note.id} className="note-card" onClick={() => openNoteDetail(note)}>
                <span className="swatch" style={{ background: note.color }} />
                <strong>{note.name}</strong>
                <small>{note.profile}</small>
              </button>
            ))}
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
                      value={customName || current.name}
                      onChange={(e) => setCustomName(e.target.value)}
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
                        setCustomName(displayName);
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
          <h2>最近作品</h2>
          {history.length === 0 ? (
            <p className="empty">还没有封瓶作品。</p>
          ) : (
            <div className="history-list">
              {history.map((creation) => (
                <article key={creation.id}>
                  <span>{creation.score}分</span>
                  <h3>{creation.name}</h3>
                  <p>{creation.notes.join(" / ")}</p>
                </article>
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
              <span className="swatch-large" style={{ background: activeNote.color }} />
              <h2 className="drawer-title">{activeNote.name}</h2>
              <p className="drawer-profile">{activeNote.profile}</p>
              <div className="drawer-traits">
                <h3>气味性格</h3>
                {(Object.keys(activeNote.traits) as Trait[]).map((trait) => (
                  <label key={trait}>
                    <span>{traitLabels[trait]}</span>
                    <meter min={0} max={4} value={activeNote.traits[trait]} />
                    <b>{activeNote.traits[trait]}</b>
                  </label>
                ))}
              </div>
              <button
                className="primary-button drawer-action"
                disabled={selectedIds.length >= 5}
                onClick={addNoteFromDrawer}
              >
                {selectedIds.length >= 5 ? "调香台已满" : "加入调香台"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
