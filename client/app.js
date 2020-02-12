const OnMouseEvent = EventHole('mousedown', 'mouseup', 'mouseout', 'mousemove');
const OnTouchEvent = EventHole('touchstart', 'touchmove', 'touchend');

window.addEventListener('load', function(e) {
  Select.init('.modal select');
  Board.resize();
});

