const OnMouseEvent = EventHole('mousedown', 'mouseup', 'mouseout', 'mousemove');
const OnTouchEvent = EventHole('touchstart', 'touchmove', 'touchend');

// Let us populate some HTML why not
window.addEventListener('DOMContentLoaded',(e) => {
  let paintButtonGroup = document.querySelector('#color-menu .group');
  let colorControllerGroup = document.querySelector('#color-controllers');
  let paintButtonPrototype = document.querySelector('.assets .paint-button');
  let colorControllerPrototype = document.querySelector('.assets .color-controller');
  for (let i = 0; i < 64; i++) {
    paintButtonGroup.appendChild(paintButtonPrototype.cloneNode());
    colorControllerGroup.appendChild(colorControllerPrototype.cloneNode());
  }
  jscolor.installByClassName('jscolor');
});

// Do the stuff
window.addEventListener('load', (e) => {
  Select.init('.modal select');
  Board.resize();
});

