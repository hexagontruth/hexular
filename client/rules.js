const RULES = {

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

  offset23minus: (cell) => {
    const count = cell.count;
    if (count == 2 || count == 3)
      return cell.state + 1;
    else if (count > 3)
      return cell.state - 1;
    else
      return 0;
  },

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

  // Some xor-inspired rules

  totalXor: (cell) => cell.total % 2,

  countXor: (cell) => cell.count % 2,

  incrementXor: (cell) => Math.max(0, cell.state + (cell.count % 2 ? 1 : -1)),

  // This doesn't do a lot but can be a good utility placeholder in certain states

  average: (cell) => cell.average,

  // Here are some examples of the built-in ruleBuilder functionality

  socialMinimalist: Hexular.util.ruleBuilder([
    0b1000001,
    0b1000010,
    0b1000100,
    0b1001000,
    0b1010000,
    0b1100000,
  ], {range: [0, 7], inc: false}),

  fractalLeft: Hexular.util.ruleBuilder([
    0b010000,
    0b000100,
    0b000001,
  ]),

  lineFilter: Hexular.util.ruleBuilder([
    0b001001,
    0b010010,
    0b100100,
  ], {invert: true}),

  ennead: Hexular.util.ruleBuilder([
    0b001001,
    0b010010,
    0b100100,
    0b000011,
    0b000110,
    0b001100,
    0b011000,
    0b110000,
    0b100001,
  ]),
};
