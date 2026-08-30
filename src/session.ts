import {promises as fs} from "node:fs";
import path from "node:path";
import {randomUUID} from "node:crypto";

export interface SessionMessage {
  role: "user" | "assistant" | "tool";
  content: string;
}

export interface SessionRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  messages: SessionMessage[];
}

function stateRoot(): string {
  return process.env.XDG_STATE_HOME ? path.join(process.env.XDG_STATE_HOME, "robining-agent", "sessions") : path.join(process.env.HOME ?? process.cwd(), ".local", "state", "robining-agent", "sessions");
}

export class SessionStore {
  constructor(private readonly directory = stateRoot()) {}

  async create(): Promise<SessionRecord> {
    const now = new Date().toISOString();
    const record = {id: randomUUID(), createdAt: now, updatedAt: now, messages: []};
    await this.save(record);
    return record;
  }

  async append(record: SessionRecord, message: SessionMessage): Promise<void> {
    record.messages.push(message);
    record.updatedAt = new Date().toISOString();
    await this.save(record);
  }

  async save(record: SessionRecord): Promise<void> {
    await fs.mkdir(this.directory, {recursive: true, mode: 0o700});
    await fs.writeFile(path.join(this.directory, `${record.id}.json`), `${JSON.stringify(record, null, 2)}\n`, {encoding: "utf8", mode: 0o600});
  }

  async load(id: string): Promise<SessionRecord> {
    return JSON.parse(await fs.readFile(path.join(this.directory, `${id}.json`), "utf8")) as SessionRecord;
  }

  async list(): Promise<SessionRecord[]> {
    await fs.mkdir(this.directory, {recursive: true, mode: 0o700});
    const names = (await fs.readdir(this.directory)).filter((name) => name.endsWith(".json"));
    const records: SessionRecord[] = [];
    for (const name of names) records.push(JSON.parse(await fs.readFile(path.join(this.directory, name), "utf8")) as SessionRecord);
    return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}
