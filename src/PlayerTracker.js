var Packet = require('./packet');
var GameServer = require('./GameServer');

function PlayerTracker(gameServer, socket) {
    this.pID = -1;
    this.name = "";
    this.gameServer = gameServer;
    this.socket = socket;
    this.nodeAdditionQueue = [];
    this.nodeDestroyQueue = [];
    this.visibleNodes = [];
    this.cells = [];
    this.score = 0; // Needed for leaderboard

    this.mouse = {x: 0, y: 0};
    this.tickLeaderboard = 0; //
    this.tickViewBox = 0;

    this.team = 0;
    this.spectate = false;
    this.spectatedPlayer = -1; // Current player that this player is watching

    // Viewing box
    this.sightRange = 0;
    this.centerPos = {x: 3000, y: 3000 };
    this.viewBox = {
        topY: 0,
        bottomY: 0,
        leftX: 0,
        rightX: 0,
        width: 0 // Half-width
    };

    // Gamemode function
    if (gameServer) {
        this.pID = gameServer.getNewPlayerID();
        gameServer.gameMode.onPlayerInit(this);
    }
    this.epicness = {};
}

module.exports = PlayerTracker;

// Setters/Getters

PlayerTracker.prototype.setName = function(name) {
    this.name = name;
};

PlayerTracker.prototype.getName = function() {
    return this.name;
};

PlayerTracker.prototype.getScore = function(reCalcScore) {
    if (reCalcScore) {
        var s = 0;
        for (var i = 0; i < this.cells.length; i++) {
            s += this.cells[i].mass;
            this.score = s;
        }
    }
    return this.score >> 0;
};

PlayerTracker.prototype.setColor = function(color) {
    this.color.r = color.r;
    this.color.b = color.b;
    this.color.g = color.g;
};

PlayerTracker.prototype.getTeam = function() {
    return this.team;
};

// Functions

PlayerTracker.prototype.update = function() {
// Actions buffer (So that people cant spam packets)

    // Keys
    for (var id in this.socket.packetHandler.keys) {
        if (this.socket.packetHandler["press" + this.socket.packetHandler.keys[id]]) {
            this.gameServer.gameMode["press" + this.socket.packetHandler.keys[id]](this.gameServer,this);
            this.socket.packetHandler["press" + this.socket.packetHandler.keys[id]] = false;
        }
    }

    // Chatbox Messages
    for (var id in this.socket.packetHandler.messagesBuffer) {
        var msg = this.socket.packetHandler.messagesBuffer[id];
        if (msg.substr(0, 1) == "/" && msg.length > 1) {
            var command = msg.substr(1).split(" ")[0];
            var params = msg.substr(1).split(" ").splice(1);
            this.gameServer.gameMode.playerCommand(command, params, this);
        }
        else {
            for (var clientId in this.gameServer.clients) {
                this.gameServer.clients[clientId].playerTracker.socket.sendPacket(new Packet.ChatboxMessage(
                    msg,
                    this.getName(),
                    (this.color)?this.color:{r:200,g:200,b:200},
                    0
                ));
            }
        }
    }
    this.socket.packetHandler.messagesBuffer = [];
    
    var updateNodes = []; // Nodes that need to be updated via packet
    
    // Remove nodes from visible nodes if possible
    var d = 0;
    while (d < this.nodeDestroyQueue.length) {
    	var index = this.visibleNodes.indexOf(this.nodeDestroyQueue[d]);
        if (index > -1) {
            this.visibleNodes.splice(index, 1);
            d++; // Increment
        } else {
            // Node was never visible anyways
            this.nodeDestroyQueue.splice(d,1);
        }
    }
    
    // Get visible nodes every 400 ms
    var nonVisibleNodes = []; // Nodes that are not visible
    if (this.tickViewBox <= 0) {
        var newVisible = this.calcViewBox();

        // Compare and destroy nodes that are not seen
        for (var i = 0; i < this.visibleNodes.length; i++) {
            var index = newVisible.indexOf(this.visibleNodes[i]);
            if (index == -1) {
                // Not seen by the client anymore
                nonVisibleNodes.push(this.visibleNodes[i]);
            }
        }
        
        // Add nodes to client's screen if client has not seen it already
        for (var i = 0; i < newVisible.length; i++) {
            var index = this.visibleNodes.indexOf(newVisible[i]);
            if (index == -1) {
                updateNodes.push(newVisible[i]);
            }
        }
        
        this.visibleNodes = newVisible;
        // Reset Ticks
        this.tickViewBox = 8;
    } else {
        this.tickViewBox--;
        // Add nodes to screen
        for (var i = 0; i < this.nodeAdditionQueue.length; i++) {
            var node = this.nodeAdditionQueue[i];
            this.visibleNodes.push(node);
            updateNodes.push(node);
        }
    }
    
    // Update moving nodes
    for (var i = 0; i < this.visibleNodes.length; i++) {
        var node = this.visibleNodes[i];
        if (node.sendUpdate()) {
            // Sends an update if cell is moving
            updateNodes.push(node);
        }
    }

    // Send packet
    this.socket.sendPacket(new Packet.UpdateNodes(this.nodeDestroyQueue.slice(0), updateNodes, nonVisibleNodes));

    var ratioEpicness = 0;
    var length = 0;
    for (var id in this.epicness) {
        ratioEpicness += this.epicness[id];
        length++;
    }
    if (length * this.gameServer.config.playerEpicnessCeil != 0) ratioEpicness /= length * this.gameServer.config.playerEpicnessCeil;
    //globalLogs.push(this.pID + " " + this.getName() + " : " + sendEpic);
    this.socket.sendPacket(new Packet.Epicness(ratioEpicness));

    this.nodeDestroyQueue = []; // Reset destroy queue
    this.nodeAdditionQueue = []; // Reset addition queue

    // Update leaderboard
    if (this.tickLeaderboard <= 0) {
        this.socket.sendPacket(this.gameServer.lb_packet);
        this.tickLeaderboard = 20; // 20 ticks = 1 second
    } else {
        this.tickLeaderboard--;
    }
};

// Viewing box

PlayerTracker.prototype.updateSightRange = function() { // For view distance
    var totalSize = 1.0;
    var len = this.cells.length;

    for (var i = 0; i < len;i++) {
        if (!this.cells[i]) {
            continue;
        }

        totalSize += this.cells[i].getSize();
    }
    this.sightRange = this.gameServer.config.serverViewBase / Math.pow(Math.min(64.0 / totalSize, 1), 0.4);
};

PlayerTracker.prototype.updateCenter = function() { // Get center of cells
    var len = this.cells.length;

    if (len <= 0) {
        return; // End the function if no cells exsist
    }

    var X = 0;
    var Y = 0;
    for (var i = 0; i < len ;i++) {
        if (!this.cells[i]) {
            continue;
        }

        X += this.cells[i].position.x;
        Y += this.cells[i].position.y;
    }

    this.centerPos.x = X / len >> 0;
    this.centerPos.y = Y / len >> 0;
};

PlayerTracker.prototype.calcViewBox = function() {
    if (this.spectate) {
        // Spectate mode
        return this.getSpectateNodes();
    }

    // Main function
    this.updateSightRange();
    this.updateCenter();

    // Box
    this.viewBox.topY = this.centerPos.y - this.sightRange;
    this.viewBox.bottomY = this.centerPos.y + this.sightRange;
    this.viewBox.leftX = this.centerPos.x - this.sightRange;
    this.viewBox.rightX = this.centerPos.x + this.sightRange;
    this.viewBox.width = this.sightRange;

    var newVisible = [];
    for (var i = 0; i < this.gameServer.nodes.length ;i++) {
        node = this.gameServer.nodes[i];

        if (!node) {
            continue;
        }

        if (node.visibleCheck(this.viewBox,this.centerPos)) {
            // Cell is in range of viewBox
            newVisible.push(node);
        }
    }
    return newVisible;
};

PlayerTracker.prototype.getSpectateNodes = function() {
    var specPlayer;

    if (this.gameServer.getMode().specByLeaderboard) {
        this.spectatedPlayer = Math.min(this.gameServer.leaderboard.length - 1, this.spectatedPlayer);
        specPlayer = this.spectatedPlayer == -1 ? null : this.gameServer.leaderboard[this.spectatedPlayer];
    } else {
        this.spectatedPlayer = Math.min(this.gameServer.clients.length - 1, this.spectatedPlayer);
        specPlayer = this.spectatedPlayer == -1 ? null : this.gameServer.clients[this.spectatedPlayer].playerTracker;
    }

    if (specPlayer) {
        // If selected player has died/disconnected, switch spectator and try again next tick
        if (specPlayer.cells.length == 0) {
            this.gameServer.switchSpectator(this);
            return [];
        }

        // Get spectated player's location and calculate zoom amount
        var specZoom = Math.sqrt(100 * specPlayer.score);
        specZoom = Math.pow(Math.min(40.5 / specZoom, 1.0), 0.4) * 0.75;
        // TODO: Send packet elsewhere so it is send more often
        this.socket.sendPacket(new Packet.UpdatePosition(specPlayer.centerPos.x, specPlayer.centerPos.y, specZoom));
        // TODO: Recalculate visible nodes for spectator to match specZoom
        return specPlayer.visibleNodes.slice(0,specPlayer.visibleNodes.length);
    } else {
        return []; // Nothing
    }
};

PlayerTracker.prototype.sendMessage = function(msg) {
    this.socket.sendPacket(new Packet.ChatboxMessage(
        msg,
        "System",
        {r:220,g:60,b:60},
        1
    ));
};