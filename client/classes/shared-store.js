// Not actually used, but left in b/c it may be needed at some point
class SharedStore {
  // TODO De-dup writes per step
  constructor() {
    this.owners = new Map();
    this.objects = new Map();
  }

  get(owner, key, defaultObject={}) {
    let obj = this.objects.get(key);
    if (obj) {
      this.owners.get(key).add(owner);
    }
    else {
      obj = defaultObject;
      this.objects.set(key, obj);
      this.owners.set(key, new Set());
    }
    return obj;
  }

  delete(owner, key) {
    let owners = this.owners.get(key);
    owners.delete(owner);
    if (!owners.size) {
      this.owners.delete(key);
      this.objects.delete(key);
    }
  }
}
