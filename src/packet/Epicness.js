function Epicness(epicness) {
    this.epicness = epicness;
}

module.exports = Epicness;

Epicness.prototype.build = function() {
    var buf = new ArrayBuffer(9);
    var view = new DataView(buf);

    view.setUint8(0, 42, true);
    view.setFloat64(1, this.epicness, true);

    return buf;
};

