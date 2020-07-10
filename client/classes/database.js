// This is provisional and terrible
class Database {
  constructor(name, version, stores={}) {
    this.open = false;
    this.name = name;
    this.version = version;
    this.pending = [];
    this.factory = window.indexedDB;
    this.stores = Object.entries(stores).map(([storeName, storeOpts]) => {
      let store = new Database.Store(this, storeName, storeOpts);
      if (!this[storeName])
        this[storeName] = store;
      return store;
    });
  }

  connect() {
    if (!window.indexedDB) {
      throw new Hexular.HexError('IndexedDB not available. Too bad.');
    }
    return new Promise((resolve, reject) => {
      let req = this.factory.open(this.name, this.version);
      req.onupgradeneeded = (ev) => {
        let db = ev.target.result;
        this.open = true;
        this.stores.forEach((store) => {
          db.createObjectStore(store.name, store.opts);
        });
      };
      req.onerror = (err) => {
        console.error(err);
        reject();
      }
      req.onsuccess = () => {
        this.db = req.result;
        this.pending.forEach((e) => {
          e.resolve(this.t(...e.args));
        });
        resolve(this);
      }
    });
  }

  async t(...args) {
    if (this.db) {
      return this.db.transaction(...args);
    }
    else {
      return new Promise((resolve, reject) => {
        this.pending.push({resolve, reject, args});
      });
    }
  }

  close() {
    this.db.close();
    this.open = false;
  }

  clear() {
    return new Promise((resolve, reject) => {
      this.open && this.close();
      let req = this.factory.deleteDatabase(this.name);
      req.onerror = () => {
        console.error(req.error);
        reject(req.error);
      }
      req.onsuccess = () => {
        resolve(this.connect());
      }
    });
  }
}

Database.Store = class {
  constructor(db, name, opts={}) {
    this.db = db;
    this.name = name;
    this.opts = opts;
  }

  async t(type='readwrite') {
    let t = await this.db.t(this.name, type);
    return t.objectStore(this.name);
  }

  p(req) {
    return new Promise((resolve, reject) => {
      req.onerror = () => {
        reject(req.error);
      }
      req.onsuccess = () => {
        resolve(req.result);
      }
    });
  }

  async put(obj) {
    let t = await this.t();
    let req = await this.p(t.put(obj));
    return this;
  }

  async get(key) {
    let t = await this.t('readonly');
    let req = await this.p(t.get(key));
    return req;
  }

  async delete(key) {
    let t = await this.t();
    let req = await this.p(t.delete(key));
    return this;
  }

  async move(oldKey, newKey) {
    let t = await this.t();
    let obj = await this.p(t.get(oldKey));
    obj[t.keyPath] = newKey;
    t.put(obj);
    t.delete(oldKey);
    return this;
  }
}
