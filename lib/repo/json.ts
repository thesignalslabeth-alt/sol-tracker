import "server-only";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Trade } from "../trade-schema";
import type { TradesRepo } from "../trades-repo";

const FILE = path.join(process.cwd(), "data/trades.json");

/** Local-dev store backed by data/trades.json. */
export class JsonTradesRepo implements TradesRepo {
  async list(): Promise<Trade[]> {
    return JSON.parse(await readFile(FILE, "utf8"));
  }

  async create(trade: Trade) {
    await this.write([...(await this.list()), trade]);
  }

  async update(trade: Trade) {
    const trades = await this.list();
    if (!trades.some((t) => t.id === trade.id)) throw new Error(`Trade ${trade.id} not found`);
    await this.write(trades.map((t) => (t.id === trade.id ? trade : t)));
  }

  async remove(id: string) {
    await this.write((await this.list()).filter((t) => t.id !== id));
  }

  // Write to a temp file then rename, so a crash can't leave half-written JSON.
  private async write(trades: Trade[]) {
    const tmp = `${FILE}.tmp`;
    await writeFile(tmp, JSON.stringify(trades, null, 2) + "\n");
    await rename(tmp, FILE);
  }
}
