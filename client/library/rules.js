const Rules = (() => {
  const coreRules = Hexular.rules;
  const simpleRules = SimpleRules;
  const customRules = {
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
    // This rule can also be effected with `total()` and `deltaFilter`.

    isomod: (cell) => cell.state + cell.total,

    // Some xor-inspired rules

    xorCountOffset: (cell) => SimpleRules.xorCount(cell) || -1,

    xorTotalOffset: (cell) => SimpleRules.xorTotal(cell) || -1,

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
  let rules = {};
  let entries = Object.entries(Object.assign({}, coreRules, simpleRules, customRules));
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  entries.forEach(([rule, fn]) => {
    rules[rule] = fn;
  });
  return rules;
})();