var FFA = require('./FFA'); // Base gamemode
var Cell = require('../entity/Cell');
var EjectedMass = require('../entity/EjectedMass');
var Food = require('../entity/Food');
var Virus = require('../entity/Virus');
var VirusFeed = require('../entity/Virus').prototype.feed;
var Entity = require('../entity');

function HideAndSeek() {
    FFA.apply(this, Array.prototype.slice.call(arguments));
    this.ID = 30;
    this.name = "Hide and Seek";
    this.specByLeaderboard = true;
}

module.exports = HideAndSeek;
HideAndSeek.prototype = new FFA();

// Gamemode Specific Functions

HideAndSeek.prototype.spawnVirus = function(gameServer,pos) {
    var v = new Entity.Virus(gameServer.getNextNodeId(), null, pos, gameServer.config.virusStartMass);
    v.hostingPlayers = {};
    v.moveDecay = 0.95;
    v.originalPosition = {x: pos.x, y: pos.y};
    //v.spiked = false;
    gameServer.addNode(v);
};

// Override

HideAndSeek.prototype.onServerInit = function(gameServer) {
    // Called when the server starts

    gameServer.config.serverBots = 0;
    gameServer.config.foodSpawnAmount = 0;
    gameServer.config.foodStartAmount = 0;
    gameServer.config.foodMaxAmount = 0;
    gameServer.config.playerMassDecayRate = 0;
    gameServer.config.playerMinMassSplit = gameServer.config.playerMaxMass + 1;
    gameServer.config.ejectMassLoss = 0;
    gameServer.config.ejectMass = 50;
    gameServer.config.playerMaxMass = 15;
    gameServer.config.playerMinMassDecay = 10;
    gameServer.config.playerMinMassEject = gameServer.config.playerMinMassDecay;
    gameServer.config.playerStartMass = 14;
    gameServer.config.virusMinAmount = 0;
    gameServer.config.virusStartMass *= 1.5;
    gameServer.config.borderRight /= 2;
    gameServer.config.borderBottom /= 2;

    gameServer.run = true;
    
    // Special virus mechanics
    Virus.prototype.feed = function(feeder,gameServer) {
        gameServer.removeNode(feeder);
        // Pushes the virus
        this.setAngle(feeder.getAngle()); // Set direction if the virus explodes
        this.moveEngineTicks = 50; // Amount of times to loop the movement function
        this.moveEngineSpeed = 50;
        
        var index = gameServer.movingNodes.indexOf(this);
        if (index == -1) {
            gameServer.movingNodes.push(this);
        }
    };

    EjectedMass.prototype.getSize = function() {
        return 10;
    };

    this.left = gameServer.config.borderLeft;
    this.right = gameServer.config.borderRight;
    this.top = gameServer.config.borderTop;
    this.bottom = gameServer.config.borderBottom;
    this.mapWidth = this.right - this.left;
    this.mapHeight = this.bottom - this.top;

    var angle = Math.random() * Math.PI/2;
    this.virusNumber = (this.mapHeight * this.mapWidth) / 200000;
    gameServer.config.virusMaxAmount = this.virusNumber;
    this.subLineAfter = Math.random()*7 + 5;
    for (var i = 0 ; i < 4 ; i++) {
        this.generateVirusLine(
            gameServer,
            this.left + this.mapWidth / 2,
            this.top + this.mapHeight / 2,
            angle + i * (Math.PI / 2),
            2,
            this.virusNumber/4,
            Math.PI/4
        );
    }


    gameServer.config.virusMaxAmount = 1000;

};

HideAndSeek.prototype.generateVirusLine = function(gameServer, x, y, angle, maxLines, virusNumber, dAngle) {
    var dist = gameServer.config.virusStartMass * 1.4;

    var count = 0;

    var nextSide = Math.PI/2;

    do {
        //dAngle += Math.random() * dVar - dVar*2;
        dAngle = dAngle/1.2+0.015;
        dAngle = Math.max(dAngle,0);

        angle += dAngle;

        x += Math.cos(angle) * dist;
        y += Math.sin(angle) * dist;

        if (x >= this.left && x <= this.right && y > this.top && y < this.bottom) this.spawnVirus(gameServer,{x: x, y: y});
        else break;

        if (maxLines > 0 && count > this.subLineAfter) {
            virusNumber /= 2;
            this.generateVirusLine(gameServer, x, y, angle + nextSide, --maxLines, virusNumber, dAngle);
            nextSide = -nextSide;
        }

        count++;
    } while (count < 50);
};

HideAndSeek.prototype.onPlayerSpawn = function(gameServer,player) {
    player.color = {
        r: 0,
        g: 200,
        b: 0
    };
    gameServer.spawnPlayer(player,{x: this.left + this.mapWidth/2, y: this.top + this.mapHeight/2});
};

HideAndSeek.prototype.onCellAdd = function(cell) {
    cell.onConsume = function(consumer, gameServer) {
        gameServer.sendMessage(this.getName() + " has been eaten by " + consumer.getName() + " !", false, "(ˆڡˆ)", {r: 210, g: 110, b: 180});
    };
    cell.speed = 1.3;
};

HideAndSeek.prototype.onTick = function(gameServer) {
    for (var id in gameServer.nodesVirus) {
        var virus = gameServer.nodesVirus[id];
        var hosting = false;
        for (var idHosting in virus.hostingPlayers) {
            hosting = true;
            break;
        }
        if (hosting) {
            if (virus.color.g <= 100) virus.color.g = 100.942;
            else if (virus.color.g*1000 - parseInt(virus.color.g)*1000 == 942) virus.color.g = Math.min(virus.color.g + 10, 254.942);
            else virus.color.g = Math.max(virus.color.g - virus.color.g/255*10, 100);
        }
        else virus.color.g = Math.min(virus.color.g + 3, 255);
        virus.hostingPlayers = {};
        var index = gameServer.movingNodes.indexOf(virus);
        if (index == -1 && Math.random() < 0.1) {
            var angleDist = this.getAngleDist(
                virus.originalPosition.x-virus.position.x,
                virus.originalPosition.y-virus.position.y
            );
            if (angleDist !== null && angleDist["dist"] > 70) {
                virus.setAngle(-angleDist["angle"]+Math.PI/2);
                virus.moveEngineTicks = 50;
                virus.moveEngineSpeed = 5;
                
                if (index == -1) {
                    gameServer.movingNodes.push(virus);
                }
            }
        }
        first = false;
    }
};

HideAndSeek.prototype.onChange = function(gameServer) {
    // Add back default virus function
    Virus.prototype.feed = VirusFeed;
};

HideAndSeek.prototype.pressW = function(gameServer,player) {
    // Called when the W key is pressed
    for (var i = 0; i < player.cells.length; i++) {
        var cell = player.cells[i];

        if (!cell) {
            continue;
        }

        if (cell.mass < gameServer.config.playerMinMassEject) {
            continue;
        }

        /*var deltaY = player.mouse.y - cell.position.y;
        var deltaX = player.mouse.x - cell.position.x;*/
        var deltaY = cell.position.y - cell.lastPosition.y;
        var deltaX = cell.position.x - cell.lastPosition.x;
        var angle = Math.atan2(deltaX,deltaY);

        // Get starting position
        var size = cell.getSize() + 5;
        var startPos = {
            x: cell.position.x + ( (size) * Math.sin(angle) ),
            y: cell.position.y + ( (size) * Math.cos(angle) )
        };

        // Remove mass from parent cell
        cell.mass -= gameServer.config.ejectMassLoss;
        // Randomize angle
        angle += (Math.random() * .4) - .2;

        // Create cell
        var ejected = new Entity.EjectedMass(gameServer.getNextNodeId(), null, startPos, gameServer.config.ejectMass);
        ejected.setAngle(angle);
        ejected.setMoveEngineData(gameServer.config.ejectSpeed, 40);
        ejected.setColor(cell.getColor());

        gameServer.addNode(ejected);
        gameServer.setAsMovingNode(ejected);
    }
};

HideAndSeek.prototype.onCellMove = function(x1,y1,cell) {
    if (cell.getType() == 0) {
        // Spawn point, safe zone
        cell.lastPosition = {x: cell.position.x, y: cell.position.y};
        var centerX = this.left + this.mapWidth/2;
        var centerY = this.top + this.mapHeight/2;
        var distCenter = Math.sqrt(Math.pow(cell.position.x - centerX, 2) + Math.pow(cell.position.y - centerY, 2));
        if (distCenter < 200 && cell.mass < 14.5) cell.mass = 14;
        else if (distCenter > 200 && cell.mass < 14.5) cell.mass = cell.owner.gameServer.config.playerMinMassDecay;

        // Higlight viruses
        if (cell.mass < 14) {
            cells = cell.owner.visibleNodes;
            for (var id in cells) {
                if (cells[id].getType() == 2) {
                    var deltaX = cells[id].position.x - cell.position.x;
                    var deltaY = cells[id].position.y - cell.position.y;
                    var dist = Math.sqrt(deltaX*deltaX + deltaY*deltaY);
                    if (dist < cells[id].getSize() * 0.95) {
                        cells[id].hostingPlayers[cell.getId()] = true;
                    }
                    //else delete cells[id].hostingPlayers[cell.getId()];
                }
            }
        }
    }
};

HideAndSeek.prototype.setSeeker = function(playerTracker) {
    for (var clientId in playerTracker.gameServer.clients) {
        var client = playerTracker.gameServer.clients[clientId].playerTracker;
        for (var id in client.cells) {
            client.cells[id].color = {r: 0, g: 200, b: 0};
            client.cells[id].mass = playerTracker.gameServer.config.playerStartMass;
            client.cells[id].speed = 1.35;
        }
        client.color = {r: 0, g: 200, b: 0};
    }
    for (var id in playerTracker.cells) {
        playerTracker.cells[id].color = {r:220,g:60,b:60};
        playerTracker.cells[id].mass = 15;
        playerTracker.cells[id].speed = 1.4;
    }
    playerTracker.color = {r:220,g:60,b:60};
};

HideAndSeek.prototype.playerCommand = function(command, params, playerTracker) {
    if (command = "set") {
        if (params[0] == "seeker") {
            var name = ((params[1])?params[1]:"").toLowerCase();
            var players = [];
            for (var clientId in playerTracker.gameServer.clients) {
                if (playerTracker.gameServer.clients[clientId].playerTracker.getName().toLowerCase() == name) {
                    players.push(playerTracker.gameServer.clients[clientId].playerTracker);
                }
            }
            if (players.length == 0) {
                playerTracker.sendMessage("Can't find player " + params[1]);
            }
            else if (players.length == 1) {
                this.setSeeker(players[0]);
                playerTracker.gameServer.sendMessage(players[0].getName() + " is the new seeker !",true);
            }
            else {
                playerTracker.sendMessage("Too many players with this name. Fuck it.");
            }
        }
    }
};


// Lib

HideAndSeek.prototype.getAngleDist = function(dx,dy) {
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist != 0) {
        var angle = Math.acos(dx / dist);
        if (dy < 0) angle = -angle;
        return {
            "angle" : angle,
            "dist" : dist
        };
    }
    else return null;
}