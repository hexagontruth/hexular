class Modal {
  constructor(board, name) {
    this.board = board;
    this.config = board.config;
    this.model = board.model;
    this.name = name;
    this.modal = document.querySelector(`.modal.${name}`);
    let title = this.modal.querySelector('.modal-title');
    if (title)
      title.onclick = () => console.log('curd') || this.board.toggleModal();
  }

  open() {
    this.board.modal = this;
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