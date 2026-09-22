import "server-only";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
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
