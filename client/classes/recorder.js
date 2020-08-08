class Recorder {
  constructor(board) {
    this.board = board;
    this.config = board.config;
    this.transferCanvas = new TransferCanvas(this.board);
  }

  draw() {
    this.transferCanvas.draw();
  }

  start() {
    this.stream = this.transferCanvas.canvas.captureStream();
    let constraints = {
      frameRate: this.config.videoFrameRate,
    };
    let opts = {
      videoBitsPerSecond: this.config.videoBitsPerSecond,
    };
    let customCodec = `${this.config.videoMimeType};codecs=${this.config.videoCodec || 'vp9'}`;
    if (MediaRecorder.isTypeSupported(customCodec))
      opts.mimeType = customCodec;
    else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9'))
      opts.mimeType = 'video/webm;codecs=vp9';
    else
      opts.mimeType = 'video/webm';
    this.stream.getTracks()[0].applyConstraints(constraints);
    this.recorder = new MediaRecorder(this.stream, opts);
    let chunks = [];
    this.recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        chunks.push(ev.data);
      }
    };
    this.recorder.onstop = (ev) => {
      let buffer = new Blob(chunks, {type: 'video/webm'});
      let dataUri = window.URL.createObjectURL(buffer);
      this.board.promptDownload(this.config.defaultVideoFilename, dataUri);
      this.board.runHooks('recordStop', chunks);
    };
    this.recorder.start();
  }

  stop() {
    this.recorder.stop();
    this.stream.getTracks()[0].stop();
  }
}
