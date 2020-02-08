const Rules = (() => {
  const Rules = {

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
      return count == 3 || count == 4 ? cell.state + 1 : 0;
    },

    offset1: (cell) => cell.count == 1 ? cell.state + 1 : 0,

    offset2: (cell) => cell.count == 2 ? cell.state + 1 : 0,

    offset3: (cell) => cell.count == 3 ? cell.state + 1 : 0,

    offset12: (cell) => {
      const count = cell.count;
      return count == 1 || count == 2 ? cell.state + 1 : 0;
    },

    offset23: (cell) => {
      const count = cell.count;
      return count == 2 || count == 3 ? cell.state + 1 : 0;
    },

    offset24: (cell) => {
      const count = cell.count;
      return count == 2 || count == 4 ? cell.state + 1 : 0;
    },

    offset34: (cell) => {
      const count = cell.count;
      return count == 3 || count == 4 ? cell.state + 1 : 0;
    },

    // Increment or decrement each state -- useful for holding activation for fixed period

    stepDown: (cell) => cell.state - 1,

    stepUp: (cell) => cell.state + 1,

    // Simple multistate rule - was the original higher-state ruel in the "classic" Hexular demo

    classicDuplex23: (cell) => {
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

    // A simple cumulative offset rule - can also be effected by total rule + N7 neighborhood
    // Pretty sure I meant for "isomod" to stand for "isotropic modulo" but I'm not sure what that means here

    isomod: (cell) => cell.state + cell.total,

    // Some xor-inspired rules

    xorCount: (cell) => cell.count % 2,

    xorTotal: (cell) => cell.total % 2,

    xorIncrement: (cell) => cell.state + (cell.count % 2 ? 1 : -1),

    xorOffset: (cell) => cell.state + (cell.total - cell.state) % 2 ? 1 : -1,

    // Basic passthrough functions

    average: (cell) => cell.average,

    count: (cell) => cell.count,

    total: (cell) => cell.total,

    // Here are some examples of the built-in ruleBuilder functionality

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

    fractalLeft: Hexular.util.ruleBuilder([
      0b010000,
      0b000100,
      0b000001,
    ]),

    fractalRight: Hexular.util.ruleBuilder([
      0b100000,
      0b001000,
      0b000010,
    ]),

    lineFilter: Hexular.util.ruleBuilder([
      0b001001,
      0b010010,
      0b100100,
    ], {invert: true}),

    patternedOffset: Hexular.util.ruleBuilder([
      0b010101,
      0b101010,
      0b000101,
      0b001010,
      0b010100,
      0b101000,
      0b010001,
      0b100010,
      0b001001,
      0b010010,
      0b100100,
      0b000011,
      0b000110,
      0b001100,
      0b011000,
      0b110000,
      0b100001,
    ], {dec: true}),

    socialMinimalist: Hexular.util.ruleBuilder([
      0b1000001,
      0b1000010,
      0b1000100,
      0b1001000,
      0b1010000,
      0b1100000,
    ], {range: [0, 7], inc: false}),
  };
  return Rules;
})();