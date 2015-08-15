var FFA = require('./FFA'); // Base gamemode
var Food = require('../entity/Food');
var FoodUp = require('../entity/Food').prototype.sendUpdate;

function FFACustom() {
    FFA.apply(this, Array.prototype.slice.call(arguments));

    this.ID = 21;
    this.name = "FFA Custom";
    this.specByLeaderboard = true;
    this.gameServer = null;

    this.epicness = {};
    this.epicnessAimed = {};
}

module.exports = FFACustom;
FFACustom.prototype = new FFA();

// Gamemode Specific Functions

FFACustom.prototype.epicnessInc = function(cell, epicness) {
    var id = cell.getId();
    if (epicness == undefined) epicness = 1;
    epicness = Math.max(epicness, 0);
    this.epicness[id] += epicness;
    if (this.epicness[id] >= this.gameServer.config.playerEpicnessCeil) {
        this.epicness[id] = Math.abs(this.gameServer.config.playerEpicnessCeil);
    }
    if (cell.owner) cell.owner.epicness[cell.getId()] = this.epicness[id];
}

FFACustom.prototype.epicnessDec = function(cell, epicness) {
    var id = cell.getId();
    if (epicness == undefined) epicness = 1;
    if (!this.epicness[id]) this.epicness[id] = 0;
    epicness = Math.max(epicness, 0);
    this.epicness[id] = Math.max(this.epicness[id] - epicness, 0);
    if (cell.owner) cell.owner.epicness[cell.getId()] = this.epicness[id];
}

// Override

FFACustom.prototype.onServerInit = function(gameServer) {
    gameServer.run = true;
    this.gameServer = gameServer;
}

FFACustom.prototype.onCellMove = function(x1, y1, cell) {
    if (cell.getType() == 0) {

        this.epicnessDec(cell, this.gameServer.config.playerEpicnessDec);

        cells = cell.owner.visibleNodes;

        this.epicnessInc(cell,this.epicnessAimed[cell.getId()]);
        this.epicnessAimed[cell.getId()] = 0;
        var epicnessFocus = 0;

        for (var id in cells) {

            var otherCell = cells[id];

            // otherCell must be a player cell
            if (otherCell.getType() != 0) {
                continue;
            }
            // otherCell must have a different owner
            if (cell.owner == otherCell.owner) {
                continue;
            }
            // otherCell must be smaller
            if (cell.mass < otherCell.mass) {
                continue;
            }

            // Distance variables
            var dist = cell.getDist(cell.getPosition().x, cell.getPosition().y, otherCell.getPosition().x, otherCell.getPosition().y);
            var minDist = Math.max(cell.getEatingRange(),otherCell.getEatingRange()) * 5 + 500;

            // Assault variable (is the cell facing to or back the otherCell)
            var dx = otherCell.position.x - cell.position.x;
            var dy = otherCell.position.y - cell.position.y;
            var angle = cell.getAngleDist(otherCell.position.x - cell.position.x, otherCell.position.y - cell.position.y)["angle"];
            var dir = cell.getAngleDist(x1 - cell.position.x, y1 - cell.position.y)["angle"];
            var assault = false;
            if (!isNaN(dir) && !isNaN(angle)) {
                var delta = (angle - dir).mod(Math.PI*2);
                assault = (delta < Math.PI / 2 || delta > 3 * Math.PI / 2) ? true : false;
            }

            // Mass difference
            var notTooBig = (cell.mass < otherCell.mass * 3);


            // Direction variables (is the cell heading directly to the otherCell)
            // y = ex + f
            var e = (y1 - cell.getPosition().y) / (x1 - cell.getPosition().x);
            var f = y1 - e * x1;

            // (x - a)² + (y - b)² = R²
            var a = otherCell.getPosition().x;
            var b = otherCell.getPosition().y;
            var R = otherCell.getEatingRange() * 0.9 + 150;


            // Conditions
            var isNear = dist < minDist;
            var aim = Math.pow(-2*a + 2*e * (f - b),2) - 4 * (1 + Math.pow(e,2)) * (Math.pow(a,2) + Math.pow(f - b,2) - Math.pow(R,2)) >= 0;


            // Epicness increase
            var totalEpicness = 0;

            if (isNear) totalEpicness += this.gameServer.config.playerEpicnessGainDist;
            if (aim) totalEpicness += this.gameServer.config.playerEpicnessGainDir;
            if (assault) totalEpicness += this.gameServer.config.playerEpicnessGainAssault;
            if (isNear && aim && assault) totalEpicness += this.gameServer.config.playerEpicnessGainAll;
            if (notTooBig) totalEpicness *= this.gameServer.config.playerEpicnessBonusMass;

            //globalLogs.push(((isNear)?"o":" ") + " " + ((aim)?"o":" ") + " " + ((assault)?"o":" "));

            if (totalEpicness > epicnessFocus) epicnessFocus += totalEpicness;
            else epicnessFocus += totalEpicness / this.gameServer.config.playerEpicnessMalusMulti;
            if (totalEpicness > this.epicnessAimed[otherCell.getId()]) this.epicnessAimed[otherCell.getId()] = totalEpicness;
            else this.epicnessAimed[otherCell.getId()] += totalEpicness / this.gameServer.config.playerEpicnessMalusMulti;


            // Circle : (x - a)² + (y - b)² = R²
            // Line : y = ex + f

            // Intersection
            // (x - a)² + (ex + f - b)² = R²
            // (x - a)² + (ex + (f - b))² = R²
            // x² - 2ax + a² + (ex)² + 2ex * (f - b) + (f - b)² = R²
            // x² + e²x² - 2ax + 2ex * (f - b) + a² + (f - b)² - R² = 0
            // x² * (1 + e²) + x * (-2a + 2e * (f - b)) + a² + (f - b)² - R² = 0

            // Delta
            // d = (-2a + 2e * (f - b))² - 4 * (1 + e²) * (a² + (f - b)² - R²)

            // If delta >= 0, intersection
            // (-2a + 2e * (f - b))² - 4 * (1 + e²) * (a² + (f - b)² - R²) >= 0
        }
        this.epicnessInc(cell,epicnessFocus);
    }
};

FFACustom.prototype.onCellRemove = function(cell) {
    if (cell.owner) delete cell.owner.epicness[cell.getId()];
    delete this.epicness[cell.getId()];
};

FFACustom.prototype.onPlayerSpawn = function(gameServer,player) {
    // Called when a player is spawned
    player.color = gameServer.getRandomColor(); // Random color
    gameServer.spawnPlayer(player);
    player.epicness = {};
};