/**
 * @file @/data/session.ts
 * A session: one place records live while a screen is in use. Asking for the same record twice gives the
 * same object, so an edit shows everywhere it is shown, and all the changes can be saved together.
 */
import { EventEmitter } from '@/core/events/event-emitter';
import type { Model, ModelClass } from '@/data/model';

export interface SessionChanges {
  created: Array<Model<any>>;
  updated: Array<Model<any>>;
  erased: Array<Model<any>>;
}

export interface SaveResult {
  saved: number;
  /** What went wrong, by record (the rest were still saved) */
  errors: Array<{ model: Model<any>; error: unknown }>;
}

export class Session extends EventEmitter {
  private maps = new Map<ModelClass<any>, Map<string, Model<any>>>();
  private created = new Set<Model<any>>();
  private erased = new Set<Model<any>>();
  private listeners = new Map<Model<any>, (e: unknown) => void>();

  private map(cls: ModelClass<any>): Map<string, Model<any>> {
    let m = this.maps.get(cls);
    if (!m) this.maps.set(cls, (m = new Map()));
    return m;
  }

  private classOf(model: Model<any>): ModelClass<any> {
    return model.constructor as ModelClass<any>;
  }

  /** Bring a record into the session. If another object for the same id is already here, that one is returned. */
  adopt<T extends Model<any>>(model: T): T {
    const cls = this.classOf(model);
    const id = model.id;
    if (id !== undefined && id !== null && id !== '') {
      const existing = this.map(cls).get(String(id));
      if (existing && existing !== model) return existing as T;
      this.map(cls).set(String(id), model);
    }
    if (model.phantom) this.created.add(model);
    if (!this.listeners.has(model)) {
      const onChange = () => this.emit('change', { model });
      model.on('change', onChange);
      this.listeners.set(model, onChange);
    }
    return model;
  }

  /** The record with this id, if the session has it */
  get<T extends Record<string, any>>(cls: ModelClass<T>, id: string | number): Model<T> | undefined {
    return this.map(cls).get(String(id)) as Model<T> | undefined;
  }

  /** A new record, tracked as created */
  create<T extends Record<string, any>>(cls: ModelClass<T>, data: Partial<T> = {}): Model<T> {
    const model = cls.create(data);
    return this.adopt(model);
  }

  /** Get a record: the session's own if it has it, else fetched through the model's proxy and kept */
  async load<T extends Record<string, any>>(cls: ModelClass<T>, id: string | number): Promise<Model<T>> {
    const have = this.get(cls, id);
    if (have) return have;
    const fetched = await cls.load(id);
    return this.adopt(fetched);
  }

  /** Mark a record to be deleted by the next `save()` (a record never saved is simply forgotten) */
  erase(model: Model<any>): void {
    if (model.phantom) { this.forget(model); return; }
    this.erased.add(model);
    this.emit('change', { model });
  }

  /** Let go of a record without saving anything for it */
  forget(model: Model<any>): void {
    const id = model.id;
    if (id !== undefined && id !== null) this.map(this.classOf(model)).delete(String(id));
    this.created.delete(model);
    this.erased.delete(model);
    const l = this.listeners.get(model);
    if (l) { model.off('change', l); this.listeners.delete(model); }
  }

  private all(): Array<Model<any>> {
    const out = new Set<Model<any>>(this.created);
    this.maps.forEach(m => m.forEach(model => out.add(model)));
    return [...out];
  }

  getChanges(): SessionChanges {
    const all = this.all();
    return {
      created: all.filter(m => m.phantom && !this.erased.has(m)),
      updated: all.filter(m => !m.phantom && m.dirty && !this.erased.has(m)),
      erased: [...this.erased]
    };
  }

  hasChanges(): boolean {
    const c = this.getChanges();
    return c.created.length + c.updated.length + c.erased.length > 0;
  }

  /**
   * Save every change: new records first, then edited ones, then deletions. One failing does not stop
   * the others; what failed is in `errors`, and those records stay changed so you can try again.
   */
  async save(): Promise<SaveResult> {
    const { created, updated, erased } = this.getChanges();
    const result: SaveResult = { saved: 0, errors: [] };
    this.emit('beforesave', { created, updated, erased });
    const run = async (model: Model<any>, action: () => Promise<unknown>) => {
      try { await action(); result.saved++; } catch (error) { result.errors.push({ model, error }); }
    };
    for (const m of created) {
      await run(m, async () => { await m.save(); this.created.delete(m); this.adopt(m); }); // it has an id now
    }
    for (const m of updated) await run(m, () => m.save());
    for (const m of erased) await run(m, async () => { await m.erase(); this.forget(m); });
    this.emit('save', result);
    return result;
  }

  /** Undo every change: edits are put back, new records are forgotten, deletions are cancelled */
  reject(): void {
    for (const m of this.all()) {
      if (this.created.has(m) || (m.phantom && !m.id)) { this.forget(m); continue; }
      if (m.dirty) m.reject();
    }
    this.erased.clear();
    this.emit('reject', {});
  }

  /** Accept the current values of every record as saved (without sending anything) */
  commit(): void {
    for (const m of this.all()) m.commit();
    this.created.clear();
    this.erased.forEach(m => this.forget(m));
    this.erased.clear();
  }

  destroy(): void {
    this.listeners.forEach((l, m) => m.off('change', l));
    this.listeners.clear();
    this.maps.clear();
    this.created.clear();
    this.erased.clear();
    this.removeAllListeners();
  }
}

export function createSession(): Session {
  return new Session();
}
