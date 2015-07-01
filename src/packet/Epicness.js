function Epicness(epic) {
    this.epic = epic;
}

module.exports = Epicness;

Epicness.prototype.build = function() {
    var buf = new ArrayBuffer(2);
    var view = new DataView(buf);

    view.setUint8(0, 42, true);
    view.setUint8(1, (this.epic)?1:0, true);

    return buf;
};

