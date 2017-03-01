var rules = {

  // Default identity rule - same as Hexular.nullRule

  nullRule: function(cell) {
    return cell.state;
  },

  // Standard binary activation rule for off cells

  standardOff: function(cell) {
    const tot = cell.total();
    if (tot == 2)
      return 1;
    else
      return 0;
  },

  // Standard binary activation rule for already-activated cells

  standardOn: function(cell) {
    const tot = cell.total();
    if (tot > 2 && tot < 5)
      return 1;
    else
      return 0;
  },

  // Same as standardOff, but will activate for either 2 or 3

  easyOff: function(cell) {
    const tot = cell.total();
    if (tot == 2 || tot == 3)
      return 1;
    else
      return 0;
  },

  // Simple multistate rule

  simpleIncrementor: function(cell) {
    const count = cell.countAll();
    if (count == 2 || count == 3)
      return cell.offset(1);
    else if (count > 3)
      return cell.offset(-1);
    else
      return 0;
  },

  // Increment each state -- useful for holding activation for fixed period

  cycleRule: function(cell) {
    return cell.offset(1);
  },

  // A random example of a more complex state -- not actually useful

  fancytown: function(cell) {
    const tot = cell.total();
    if (tot > 2 && tot < 5)
      return cell.offset(1);
    else if (tot >= 9)
      return cell.offset(-1);
    else
      return cell.state;
  },

  // Another useless example, similar to simpleIncrementor

  isomod: function(cell) {
    return cell.offset(cell.total());
  },

  // Always set to zero

  alwaysOff: function(cell) {
    return 0;
  }
}
