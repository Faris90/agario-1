function GameMode(gamemodeId) {
    this.id = gamemodeId;
}

module.exports = GameMode;

GameMode.prototype.build = function() {
    var buf = new ArrayBuffer(2);
    var view = new DataView(buf);

    view.setUint8(0, 65, true);
    view.setUint8(1, this.id, true);

    return buf;
};

