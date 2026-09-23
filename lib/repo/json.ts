import "server-only";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_PREFS, type Prefs, type PrefsRepo } from "../prefs-repo";
import type { Trade } from "../trade-schema";
import type { TradesRepo } from "../trades-repo";

const FILE = path.join(process.cwd(), "data/trades.json");

type StoredTrade = Trade & { user_id?: string };

// Rows without a user_id (the committed seed data) belong to SEED_USER_ID.
const ownerOf = (t: StoredTrade) => t.user_id ?? process.env.SEED_USER_ID;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const strip = ({ user_id, ...t }: StoredTrade): Trade => t;

/** Local-dev store backed by data/trades.json. */
export class JsonTradesRepo implements TradesRepo {
  async list(userId: string): Promise<Trade[]> {
    return (await this.readAll()).filter((t) => ownerOf(t) === userId).map(strip);
  }

  async create(userId: string, trade: Trade) {
    await this.write([...(await this.readAll()), { ...trade, user_id: userId }]);
  }

  async createMany(userId: string, trades: Trade[]) {
    const all = await this.readAll();
    const ids = new Set(all.map((t) => t.id));
    const fresh = trades.filter((t) => !ids.has(t.id));
    if (fresh.length) await this.write([...all, ...fresh.map((t) => ({ ...t, user_id: userId }))]);
    return fresh.length;
  }

  async update(userId: string, trade: Trade) {
    const all = await this.readAll();
    const i = all.findIndex((t) => t.id === trade.id && ownerOf(t) === userId);
    if (i === -1) throw new Error(`Trade ${trade.id} not found`);
    all[i] = { ...trade, user_id: all[i].user_id };
    await this.write(all);
  }

  async remove(userId: string, id: string) {
    await this.write((await this.readAll()).filter((t) => !(t.id === id && ownerOf(t) === userId)));
  }

  private async readAll(): Promise<StoredTrade[]> {
    return JSON.parse(await readFile(FILE, "utf8"));
  }

  // Write to a temp file then rename, so a crash can't leave half-written JSON.
  private async write(trades: StoredTrade[]) {
    const tmp = `${FILE}.tmp`;
    await writeFile(tmp, JSON.stringify(trades, null, 2) + "\n");
    await rename(tmp, FILE);
  }
}

const PREFS_FILE = path.join(process.cwd(), "data/prefs.json");

/** Local-dev settings store backed by data/prefs.json (created on first write). */
export class JsonPrefsRepo implements PrefsRepo {
  async get(userId: string): Promise<Prefs> {
    return { ...DEFAULT_PREFS, ...(await this.readAll())[userId] };
  }

  async set(userId: string, prefs: Prefs) {
    const all = await this.readAll();
    all[userId] = prefs;
    const tmp = `${PREFS_FILE}.tmp`;
    await writeFile(tmp, JSON.stringify(all, null, 2) + "\n");
    await rename(tmp, PREFS_FILE);
  }

  private async readAll(): Promise<Record<string, Prefs>> {
    try {
      return JSON.parse(await readFile(PREFS_FILE, "utf8"));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return {};
      throw e;
    }
  }
}
