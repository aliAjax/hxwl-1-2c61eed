type Trait = "fresh" | "sweet" | "wood" | "spice";

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

export type Creation = {
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
  recipeId?: string;
  version?: number;
  parentVersionId?: string;
  versionNote?: string;
  updatedAt?: string;
};

export type ImportResult = {
  success: Creation[];
  skipped: { creation: Partial<Creation> & { id?: string }; reason: string }[];
  successCount: number;
  skippedCount: number;
};

type SyncMessage = {
  type: "creations-updated" | "creations-added" | "creations-deleted";
  ids?: string[];
};

const DB_NAME = "hxwl-1-library";
const DB_VERSION = 1;
const STORE_NAME = "creations";
const LS_KEY_CREATIONS = "hxwl-1-creations";
const LS_KEY_VERSION = "hxwl-1-data-version";
const LS_KEY_BACKUP = "hxwl-1-creations-backup";
const CURRENT_DATA_VERSION = 1;
const BROADCAST_CHANNEL_NAME = "hxwl-1-sync";
const DEFAULT_DROPS = 1;
const MAX_DROPS_PER_NOTE = 10;

function getNoteByName(name: string): { id: string; name: string; traits: Record<Trait, number> } | undefined {
  const allNotes: { id: string; name: string; traits: Record<Trait, number>; isBasic: boolean }[] = [
    { id: "rainleaf", name: "雨叶", traits: { fresh: 4, sweet: 1, wood: 0, spice: 0 }, isBasic: true },
    { id: "pearjam", name: "梨酱", traits: { fresh: 1, sweet: 4, wood: 0, spice: 0 }, isBasic: true },
    { id: "cedar", name: "雪松屑", traits: { fresh: 0, sweet: 0, wood: 4, spice: 1 }, isBasic: true },
    { id: "pepper", name: "粉胡椒", traits: { fresh: 0, sweet: 0, wood: 1, spice: 4 }, isBasic: true },
    { id: "milkflower", name: "奶白花", traits: { fresh: 1, sweet: 3, wood: 0, spice: 1 }, isBasic: true },
    { id: "smoketea", name: "烟茶", traits: { fresh: 1, sweet: 0, wood: 3, spice: 2 }, isBasic: true },
    { id: "bamboodew", name: "竹露", traits: { fresh: 5, sweet: 0, wood: 1, spice: 0 }, isBasic: false },
    { id: "honeycomb", name: "蜂巢", traits: { fresh: 0, sweet: 5, wood: 1, spice: 0 }, isBasic: false },
    { id: "sandalwood", name: "檀木", traits: { fresh: 0, sweet: 1, wood: 5, spice: 0 }, isBasic: false },
    { id: "cinnamon", name: "桂皮", traits: { fresh: 0, sweet: 1, wood: 0, spice: 5 }, isBasic: false },
    { id: "jasmine", name: "夜茉莉", traits: { fresh: 2, sweet: 4, wood: 0, spice: 0 }, isBasic: false },
    { id: "oudh", name: "沉香", traits: { fresh: 0, sweet: 0, wood: 4, spice: 3 }, isBasic: false },
    { id: "citruspeel", name: "柑橘皮", traits: { fresh: 3, sweet: 2, wood: 0, spice: 1 }, isBasic: false },
    { id: "vanillabean", name: "香草豆", traits: { fresh: 0, sweet: 4, wood: 2, spice: 0 }, isBasic: false }
  ];
  return allNotes.find((n) => n.name === name);
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
    const noteIds: string[] = [];
    for (const noteName of safeNotes) {
      const note = getNoteByName(noteName);
      if (note) noteIds.push(note.id);
    }
    if (noteIds.length > 0) {
      const dropsMap = safeNoteDrops && Object.keys(safeNoteDrops).length > 0 ? safeNoteDrops : null;
      const allNotes = [
        { id: "rainleaf", name: "雨叶", traits: { fresh: 4, sweet: 1, wood: 0, spice: 0 } },
        { id: "pearjam", name: "梨酱", traits: { fresh: 1, sweet: 4, wood: 0, spice: 0 } },
        { id: "cedar", name: "雪松屑", traits: { fresh: 0, sweet: 0, wood: 4, spice: 1 } },
        { id: "pepper", name: "粉胡椒", traits: { fresh: 0, sweet: 0, wood: 1, spice: 4 } },
        { id: "milkflower", name: "奶白花", traits: { fresh: 1, sweet: 3, wood: 0, spice: 1 } },
        { id: "smoketea", name: "烟茶", traits: { fresh: 1, sweet: 0, wood: 3, spice: 2 } },
        { id: "bamboodew", name: "竹露", traits: { fresh: 5, sweet: 0, wood: 1, spice: 0 } },
        { id: "honeycomb", name: "蜂巢", traits: { fresh: 0, sweet: 5, wood: 1, spice: 0 } },
        { id: "sandalwood", name: "檀木", traits: { fresh: 0, sweet: 1, wood: 5, spice: 0 } },
        { id: "cinnamon", name: "桂皮", traits: { fresh: 0, sweet: 1, wood: 0, spice: 5 } },
        { id: "jasmine", name: "夜茉莉", traits: { fresh: 2, sweet: 4, wood: 0, spice: 0 } },
        { id: "oudh", name: "沉香", traits: { fresh: 0, sweet: 0, wood: 4, spice: 3 } },
        { id: "citruspeel", name: "柑橘皮", traits: { fresh: 3, sweet: 2, wood: 0, spice: 1 } },
        { id: "vanillabean", name: "香草豆", traits: { fresh: 0, sweet: 4, wood: 2, spice: 0 } }
      ];
      const computedTraits = noteIds.reduce(
        (total, noteId) => {
          const note = allNotes.find((n) => n.id === noteId);
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
          const note = allNotes.find((n) => n.id === id);
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
    phaseDescriptions: data.phaseDescriptions && typeof data.phaseDescriptions === "object" ? data.phaseDescriptions : undefined,
    recipeId: typeof data.recipeId === "string" && data.recipeId ? data.recipeId : data.id,
    version: typeof data.version === "number" && isFinite(data.version) && data.version >= 1 ? Math.round(data.version) : 1,
    parentVersionId: typeof data.parentVersionId === "string" && data.parentVersionId ? data.parentVersionId : undefined,
    versionNote: typeof data.versionNote === "string" ? data.versionNote : undefined,
    updatedAt: typeof data.updatedAt === "string" && data.updatedAt ? data.updatedAt : undefined
  };
}

function parseMigrateItems(raw: unknown): { items: Creation[]; recovered: number; deduped: number; corrupted: number } {
  let rawArray: unknown[] = [];
  let corrupted = 0;

  if (Array.isArray(raw)) {
    rawArray = raw;
  } else if (raw && typeof raw === "object") {
    if (Array.isArray((raw as Record<string, unknown>).creations)) {
      rawArray = (raw as { creations: unknown[] }).creations;
    } else {
      rawArray = [raw];
    }
  } else {
    return { items: [], recovered: 0, deduped: 0, corrupted: 0 };
  }

  const validItems: (Partial<Creation> & { id: string })[] = [];
  for (const item of rawArray) {
    if (!item || typeof item !== "object") {
      corrupted++;
      continue;
    }
    const obj = item as Record<string, unknown>;
    if (typeof obj.id === "string" && obj.id) {
      validItems.push(obj as Partial<Creation> & { id: string });
    } else if (typeof obj.name === "string" || typeof obj.score === "number") {
      validItems.push({ ...obj, id: crypto.randomUUID() } as Partial<Creation> & { id: string });
    } else {
      corrupted++;
    }
  }

  const seenIds = new Set<string>();
  const dedupedItems: (Partial<Creation> & { id: string })[] = [];
  let deduped = 0;
  for (const item of validItems) {
    if (seenIds.has(item.id)) {
      deduped++;
      dedupedItems.push({ ...item, id: crypto.randomUUID() });
    } else {
      seenIds.add(item.id);
      dedupedItems.push(item);
    }
  }

  const normalized = dedupedItems
    .map(normalizeCreation)
    .filter((item) => item.notes.length > 0 || item.score > 0);

  return { items: normalized, recovered: corrupted, deduped, corrupted };
}

class LibraryDB {
  private db: IDBDatabase | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private onExternalChange: (() => void) | null = null;

  async init(onExternalChange?: () => void): Promise<{ migrated: boolean; migrationReport?: { count: number; recovered: number; deduped: number; corrupted: number } }> {
    this.onExternalChange = onExternalChange ?? null;

    try {
      this.broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      this.broadcastChannel.onmessage = (event: MessageEvent) => {
        const msg = event.data as SyncMessage;
        if (msg && (msg.type === "creations-updated" || msg.type === "creations-added" || msg.type === "creations-deleted")) {
          this.onExternalChange?.();
        }
      };
    } catch {
      this.broadcastChannel = null;
    }

    const migrationNeeded = this.checkMigrationNeeded();

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (_event: IDBVersionChangeEvent) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("createdAt", "createdAt", { unique: false });
          store.createIndex("name", "name", { unique: false });
        }
      };

      request.onsuccess = async () => {
        this.db = request.result;

        this.db.onclose = () => {
          this.db = null;
        };

        this.db.onerror = () => {
          this.db = null;
        };

        let migrationReport: { count: number; recovered: number; deduped: number; corrupted: number } | undefined;

        if (migrationNeeded) {
          migrationReport = await this.migrateFromLocalStorage();
        }

        resolve({ migrated: migrationNeeded, migrationReport });
      };

      request.onerror = () => {
        reject(new Error("Failed to open IndexedDB"));
      };
    });
  }

  private checkMigrationNeeded(): boolean {
    try {
      const version = localStorage.getItem(LS_KEY_VERSION);
      if (version === null) {
        const oldData = localStorage.getItem(LS_KEY_CREATIONS);
        return !!oldData;
      }
      return Number(version) < CURRENT_DATA_VERSION;
    } catch {
      return false;
    }
  }

  private async migrateFromLocalStorage(): Promise<{ count: number; recovered: number; deduped: number; corrupted: number }> {
    let raw: unknown;
    try {
      const rawStr = localStorage.getItem(LS_KEY_CREATIONS);
      raw = rawStr ? JSON.parse(rawStr) : null;
    } catch {
      raw = null;
    }

    if (!raw) {
      localStorage.setItem(LS_KEY_VERSION, String(CURRENT_DATA_VERSION));
      return { count: 0, recovered: 0, deduped: 0, corrupted: 0 };
    }

    const { items, recovered, deduped, corrupted } = parseMigrateItems(raw);

    if (items.length > 0) {
      try {
        await this.addAll(items);
      } catch {
        // If IndexedDB write fails, fall back to keeping localStorage data
        localStorage.setItem(LS_KEY_VERSION, "0");
        return { count: 0, recovered, deduped, corrupted };
      }
    }

    try {
      localStorage.setItem(LS_KEY_BACKUP, localStorage.getItem(LS_KEY_CREATIONS) || "[]");
      localStorage.removeItem(LS_KEY_CREATIONS);
      localStorage.setItem(LS_KEY_VERSION, String(CURRENT_DATA_VERSION));
    } catch {
      // Storage full, but migration succeeded
    }

    return { count: items.length, recovered, deduped, corrupted };
  }

  private broadcast(msg: SyncMessage) {
    try {
      this.broadcastChannel?.postMessage(msg);
    } catch {
      // ignore
    }
  }

  async getAll(): Promise<Creation[]> {
    if (!this.db) return [];
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const index = store.index("createdAt");
      const request = index.openCursor(null, "prev");
      const results: Creation[] = [];

      request.onsuccess = () => {
        const cursor = request.result as IDBCursorWithValue | null;
        if (cursor) {
          results.push(cursor.value as Creation);
          cursor.continue();
        } else {
          resolve(results);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async count(): Promise<number> {
    if (!this.db) return 0;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(id: string): Promise<Creation | null> {
    if (!this.db) return null;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => resolve((request.result as Creation) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async add(creation: Creation): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(creation);
      request.onsuccess = () => {
        this.broadcast({ type: "creations-added", ids: [creation.id] });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async addAll(creations: Creation[]): Promise<void> {
    if (!this.db || creations.length === 0) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      for (const creation of creations) {
        store.put(creation);
      }
      tx.oncomplete = () => {
        this.broadcast({ type: "creations-added", ids: creations.map((c) => c.id) });
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  async update(creation: Creation): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(creation);
      request.onsuccess = () => {
        this.broadcast({ type: "creations-updated", ids: [creation.id] });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => {
        this.broadcast({ type: "creations-deleted", ids: [id] });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteAll(): Promise<void> {
    if (!this.db) return;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => {
        this.broadcast({ type: "creations-deleted" });
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  destroy() {
    try {
      this.broadcastChannel?.close();
    } catch {
      // ignore
    }
    this.broadcastChannel = null;
    try {
      this.db?.close();
    } catch {
      // ignore
    }
    this.db = null;
  }
}

export const libraryDB = new LibraryDB();

export { normalizeCreation, parseMigrateItems, CURRENT_DATA_VERSION, LS_KEY_VERSION, LS_KEY_BACKUP, LS_KEY_CREATIONS };
