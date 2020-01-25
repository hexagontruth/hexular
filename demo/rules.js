let RULES = {

  nullRule: (cell) => 0,

  // Default identity rule - same as Hexular.identityRule

  identityRule: (cell) => cell.state,

  binary1: (cell) => cell.count == 1 ? 1 : 0,

  binary2: (cell) => cell.count == 2 ? 1 : 0,

  binary3: (cell) => cell.count == 3 ? 1 : 0,

  binary12: (cell) => {
    let count = cell.count;
    return count == 1 || count == 2 ? 1 : 0;
  },

  binary23: (cell) => {
    const count = cell.count;
    return count == 2 || count == 3 ? 1 : 0;
  },

  binary24: (cell) => {
    const count = cell.count;
    return count == 2 || count == 4 ? 1 : 0;
  },

  binary34: (cell) => {
    const count = cell.count;
    return count == 3 || count == 4 ? 1 : 0;
  },

  // offset is similar to binary except it increments instead of setting to 1

  offset23: (cell) => {
    const count = cell.count;
    return count == 2 || count == 3 ? cell.state + 1 : 0;
  },

  // Same as standardOn, using states > 1 to represent activation generation

  offset34: (cell) => {
    const count = cell.count;
    return count == 3 || count == 4 ? cell.state + 1 : 0;
  },

  // Simple multistate rule

  duplexOffset23: (cell) => {
    const count = cell.count;
    if (count == 2 || count == 3)
      return cell.state + 1;
    else if (count > 3)
      return cell.state - 1;
    else
      return 0;
  },

  // A random example of a more complex state -- not actually useful
  // Keeping this in the revised version mainly because I find the name charming

  fancytown: (cell) => {
    const tot = cell.total;
    if (tot > 2 && tot < 5)
      return cell.state + 1;
    else if (tot >= 9)
      return cell.state - 1;
    else
      return cell.state;
  },

  // Increment each state -- useful for holding activation for fixed period
  // Generally not helpful to use this as a ground state

  cycle: (cell) => cell.state + 1,

  anticycle: (cell) => cell.state - 1,

  // A cumulative offset rule
  // Pretty sure I meant for "isomod" to stand for "isotropic modulo" but I'm not sure what this means here

  isomod: (cell) => cell.state + cell.total,

  incCountAll: (cell) => {
    const count = cell.count + cell.state;
    return count;
  },

  // Total xor

  totalXor: (cell) => cell.total % 2,

  // Count xor

  countXor: (cell) => cell.count % 2,

  // Incrementxor

  incrementXor: (cell) => Math.max(0, cell.state + (cell.count % 2 ? 1 : -1)),

  // I made this while testing the new topologies. I am keeping it, again, because of the name

  mrWiggleburg: (cell) => {
    let count = cell.count;
    if (count == 0)
      return 0;
    else if (count < 3)
      return cell.state + 1;
    else if (count > 4)
      return cell.state - 1;
    else
      return 0;
  },

};
