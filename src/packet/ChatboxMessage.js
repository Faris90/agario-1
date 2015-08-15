function ChatboxMessage(msg,name,color,type) {
    this.msg = msg;
    this.name = name;
    this.color = color;

    // 0 => Standard message
    // 1 => System message
    this.type = type;
}

module.exports = ChatboxMessage;

ChatboxMessage.prototype.build = function() {
    // DataType Type Colors NameLength MessageLength
    var buf = new ArrayBuffer(1 + 1 + 3 + 2 + 2 + this.name.length*4 + this.msg.length*4);
    var view = new DataView(buf);
    var c = 0;

    view.setUint8(c++, 100, true);
    view.setUint8(c++, this.type, true);
    view.setUint8(c++, this.color.r, true);
    view.setUint8(c++, this.color.g, true);
    view.setUint8(c++, this.color.b, true);
    view.setUint16(c, this.name.length, true);
    c += 2
    for (var i = 0; i < this.name.length; ++i) {
        view.setUint32(c, this.name.charCodeAt(i), true);
        c += 4;
    }
    view.setUint16(c, this.msg.length, true);
    c += 2;
	for (var i = 0; i < this.msg.length; ++i) {
        view.setUint32(c, this.msg.charCodeAt(i), true);
        c += 4;
    }

    return buf;
};

