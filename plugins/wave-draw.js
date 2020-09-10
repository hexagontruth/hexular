class WaveDraw extends Plugin {
  defaultSettings() {
    return `
      {
        // For use with WaveCore plugin
        drawFn: (plugin, cell, s, v, a) => {
          let hue = s;
          let sat = 1 - Math.tanh(Math.abs(v));
          let light = Math.tanh(Math.abs(a));
          plugin.adapter.context.fillStyle = \`hsl(\${hue * 60}, \${sat * 100}%, \${light * 100}%)\`;
          plugin.adapter.drawPath(cell, plugin.config.pointyVertices);
          plugin.adapter.context.fill();
        },
        // Set to [0, 1] to use only current cell value, [0, 19] for full 19-cell average, etc.
        selectNeighborRange: [0, 7],
      }
    `;
  }

  _activate() {
    this.registerHook('draw', (adapter) => this.onDraw(adapter));
  }

  _enable() {
    this.sMap = this.shared.get(this, 'sMap', new Map());
    this.vMap = this.shared.get(this, 'vMap', new Map());
    this.aMap = this.shared.get(this, 'aMap', new Map());
  }

  _disable() {
    this.shared.delete(this, 'sMap');
    this.shared.delete(this, 'vMap');
    this.shared.delete(this, 'aMap');
  }

  onDraw(adapter) {
    let ctx = adapter.context;
    let avgMapS = new Map();
    let avgMapV = new Map();
    let avgMapA = new Map();
    let [nStart, nEnd] = this.settings.selectNeighborRange;
    let nSize = nEnd - nStart;
    this.model.eachCell((cell) => {
      let totalS = 0;
      let totalV = 0;
      let totalA = 0;
      for (let i = nStart; i < nEnd; i++) {
        totalS += this.sMap.get(cell.nbrs[i]);
        totalV += this.vMap.get(cell.nbrs[i]);
        totalA += this.aMap.get(cell.nbrs[i]);
      }
      avgMapS.set(cell, totalS / nSize);
      avgMapV.set(cell, totalV / nSize);
      avgMapA.set(cell, totalA / nSize);
    });
    this.drawEachCell((cell) => {
      let s = avgMapS.get(cell);
      let v = avgMapV.get(cell);
      let a = avgMapA.get(cell);
      this.settings.drawFn(this, cell, s, v, a);
    });
  }
}
Board.registerPlugin(WaveDraw);
