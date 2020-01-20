var RULES = {

  // Default identity rule - same as Hexular.nullRule

  nullRule: (cell) => cell.state,

  // Standard binary activation rule for off cells

  standardOff: (cell) => {
    const count = cell.countAll();
    if (count == 2)
      return 1;
    else
      return 0;
  },

  // Standard binary activation rule for already-activated cells

  standardOn: (cell) => {
    const count = cell.countAll();
    if (count == 3 || count == 4)
      return 1;
    else
      return 0;
  },

  // Same as standardOff, but will activate for either 2 or 3

  easyOff: (cell) => {
    const count = cell.countAll();
    if (count == 2 || count == 3)
      return 1;
    else
      return 0;
  },

  // Same as standardOn, using states > 1 to represent activation generation

  generationalStandardOn: (cell) => {
    const count = cell.countAll();
    if (count == 3 || count == 4)
      return cell.offset(1) || 1;
    else
      return 0;
  },

  // Simple multistate rule

  simpleIncrementor: (cell) => {
    const count = cell.countAll();
    if (count == 2 || count == 3)
      return cell.offset(1);
    else if (count > 3)
      return cell.offset(-1);
    else
      return 0;
  },

  // Increment each state -- useful for holding activation for fixed period

  cycleRule: (cell) => cell.offset(1),

  // A random example of a more complex state -- not actually useful

  fancytown: (cell) => {
    const tot = cell.total();
    if (tot > 2 && tot < 5)
      return cell.offset(1);
    else if (tot >= 9)
      return cell.offset(-1);
    else
      return cell.state;
  },

  // Another useless example, similar to simpleIncrementor

  isomod: (cell) => cell.offset(cell.total()),

  // Total xor

  totalXor: (cell) => cell.total() % 2,

  // Count xor

  countXor: (cell) => cell.countAll() % 2,

  // Debug rule

  trackOut: (cell) => {
    let count = cell.countAll();
    return (count == 1 || count == 2) ? 1 : 0;
  },

  mrWiggleburg: (cell) => {
    let count = cell.countAll();
    if (count == 0)
      return 0;
    else if (count < 3)
      return cell.offset(1);
    else if (count > 4)
      return cell.offset(-1);
    else
      return 0;
  },

  // Always set to zero

  alwaysOff: (cell) => 0,

};