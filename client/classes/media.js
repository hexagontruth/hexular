class Media {
  static getImage(name, cb) {
    if (Media.images[name])
      return Media.images[name];
    let image = new Image;
    Media.images[name] = image;
    image.onerror = () => {
      cb && cb(new Hexular.HexError(`Error loading image URL for "${name}"!`));
    };
    image.onload = () => {
      cb && cb();
    };
    (async () => {
      let media = await Media.load(name)
      image.src = media && media.url;
    })();
    return image;
  }
  static async load(name) {
    if (Media.loaded[name])
      return Media.loaded[name];
    let obj = await Board.db.media.get(name);
    if (!obj)
      throw new Hexular.HexError(`Media "${name}" not found!`);
    let media = Media.import(obj);
    let image = Media.images[name];
    if (image && !image.src && media && media.url)
      image.src = media.url;
    return media;
  }

  static import(obj) {
    return new Media(obj.name, obj.blob);
  }

  constructor(name, data, type='application/octet-stream') {
    this.set(data, type);
    this.move(name);
  }

  delete() {
    delete Media.loaded[this.name];
    Board.db.media.delete(this.name);
    URL.revokeObjectURL(this.url);
    this.blob = null;
  }

  set(data, type) {
    if (data instanceof Blob) {
      this.blob = data;
      this.type = data.type;
    }
    else {
      this.blob = new Blob([data], {type});
      this.type = type;
    }
    this.url = URL.createObjectURL(this.blob);
    return this;
  }

  move(name) {
    let oldName = this.name;
    this.name = name;
    if (oldName) {
      delete Media.loaded[oldName];
      Board.db.media.move(oldName, name);
    } else {
      Board.db.media.put(this.export());
    }
    this.name = name;
    Media.loaded[name] = this;
  }

  export() {
    return {name: this.name, blob: this.blob};
  }
}
Media.loaded = {};
Media.images = {};
