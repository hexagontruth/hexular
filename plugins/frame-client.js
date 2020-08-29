class FrameClient extends Plugin {
  static policy() {
    return {
      autostart: false
    };
  }

  defaultSettings() {
    return `
      {
        // This requires ffmpeg and running "npm run imageserver" locally
        endpoint: 'http://localhost:8008/',
        frameOnActivate: true,
      }
    `;
  }

  _activate() {
    this.registerHook('drawStep', () => this.onDrawStep());
  }

  _enable() {
    this.settings.frameOnActivate && this.onDrawStep();
  }

  async onDrawStep() {
    let dataUrl = await this.board.getImage();
    try {
      await fetch(this.settings.endpoint, {
        method: 'POST',
        mode: 'no-cors',
        headers: {'Content-Type': `text/plain`},
        body: dataUrl
      });
    }
    catch (err) {
      this.board.setMessage(err, 'error');
      console.error(err);
    }
  }
}
Board.registerPlugin(FrameClient);
