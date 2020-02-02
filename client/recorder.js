class Recorder {
  constructor(board) {
    this.board = board;
  }
  start() {
    this.stream = board.bg.captureStream();
    this.stream.getTracks()[0].applyConstraints({aspectRatio: window.innerWidth / window.innerHeight});
    let opts = {
      mimeType: 'video/webm'
    };
    this.recorder = new MediaRecorder(this.stream, opts);
    let blobs = [];
    this.recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        blobs.push(ev.data);
      }
    };
    this.recorder.onstop = (ev) => {
      let buffer = new Blob(blobs, {type: 'video/webm', });
      let dataUri = window.URL.createObjectURL(buffer);
      board.promptDownload(board.defaultVideoFilename, dataUri);
    };
    this.recorder.start(1000);
  }

  stop() {
    this.recorder.stop();
    this.stream.getTracks()[0].stop();
  }
}