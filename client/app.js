const OnMouseEvent = EventHole('mousedown', 'mouseup', 'mouseout', 'mousemove');
const OnTouchEvent = EventHole('touchstart', 'touchmove', 'touchend');

// Let us populate some HTML why not
window.addEventListener('DOMContentLoaded',(e) => {
  let paintButtonGroup = document.querySelector('#color-menu .group');
  let colorControllerGroup = document.querySelector('#color-controllers');
  let paintButtonPrototype = document.querySelector('.assets .paint-button');
  let ruleButtonPrototype = document.querySelector('.assets .color-controller');
  for (let i = 0; i < 256; i++) {
    let paintButton = paintButtonPrototype.cloneNode();
    let ruleButton = ruleButtonPrototype.cloneNode();
    paintButton.setAttribute('title', i);
    ruleButton.setAttribute('title', i);
    paintButtonGroup.appendChild(paintButton);
    colorControllerGroup.appendChild(ruleButton);
  }
  jscolor.installByClassName('jscolor');
});

// Do the stuff
window.addEventListener('load', (e) => {
  // Build select wrappers
  Select.init('.modal select');
  // Set up board
  Board.resize();
});

