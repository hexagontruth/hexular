class Recorder {
  constructor(board) {
    this.board = board;
    this.config = board.config;
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.draw();
  }

  draw() {
    this.ctx.drawImage(
      this.board.bg,
      0, 0, this.board.bg.width, this.board.bg.height,
      0, 0, this.canvas.width, this.canvas.height
    );
  }

  start() {
    this.stream = this.canvas.captureStream();
    let constraints = {
      frameRate: 60,
    };
    let opts = {};
    let customCodec = `video/webm;codecs=${this.config.codec || 'vp9'}`;
    if (MediaRecorder.isTypeSupported(customCodec))
      opts.mimeType = customCodec;
    else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9'))
      opts.mimeType = 'video/webm;codecs=vp9';
    else
      opts.mimeType = 'video/webm';
    this.stream.getTracks()[0].applyConstraints(constraints);
    this.recorder = new MediaRecorder(this.stream, opts);
    let blobs = [];
    this.recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        blobs.push(ev.data);
      }
    };
    this.recorder.onstop = (ev) => {
      let buffer = new Blob(blobs, {type: 'video/webm'});
      let dataUri = window.URL.createObjectURL(buffer);
      this.board.promptDownload(this.config.defaultVideoFilename, dataUri);
    };
    this.recorder.start();
  }

  stop() {
    this.recorder.stop();
    this.stream.getTracks()[0].stop();
  }
}