class Modal {
  constructor(board, name) {
    this.board = board;
    this.config = board.config;
    this.model = board.model;
    this.name = name;
    this.modal = document.querySelector(`.modal.${name}`);
    let title = this.modal.querySelector('.modal-title');
    if (title) {
      let closeBox = document.createElement('div');
      closeBox.className = 'close-box icon-clear';
      title.appendChild(closeBox);
      closeBox.onclick = (ev) => this.board.toggleModal();
      title.onmousedown = (ev) => this.board.translateModal([ev.pageX, ev.pageY]);
    }
  }

  open() {
    this.board.modal = this;
    this.modal.style.left = '0';
    this.modal.style.top = '0';
    this.reset();
    this.modal.classList.remove('hidden');
    this.board.overlay.classList.remove('hidden');
    let focus = this.modal.querySelector('.focus');
    focus && focus.focus();
  }

  close() {
    this.board.modal = null;
    this.board.overlay.classList.add('hidden');
    this.modal.classList.add('hidden');
  }

  reset() {}

  upate() {}
}