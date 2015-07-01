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
}

module.exports = FFACustom;
FFACustom.prototype = new FFA();

// Gamemode Specific Functions

FFACustom.prototype.epicnessInc = function(cell, epicness) {
    var id = cell.getId();
    if (epicness == undefined) epicness = 1;
    epicness = Math.max(epicness, 0);
    this.epicness[id] += epicness;
    if (this.epicness[id] >= this.gameServer.config.playerEpicnessStart) {
        this.epicness[id] = Math.abs(this.gameServer.config.playerEpicnessEnd);
        if (cell.owner) cell.owner.epic[cell.getId()] = true;
    }
}

FFACustom.prototype.epicnessDec = function(cell, epicness) {
    var id = cell.getId();
    if (epicness == undefined) epicness = 1;
    if (!this.epicness[id]) this.epicness[id] = 0;
    epicness = Math.max(epicness, 0);
    this.epicness[id] = Math.max(this.epicness[id] - epicness, 0);
    if (cell.getName() == "Shyked") globalLogs.push(cell.getName() + " " + this.epicness[id]);
    if (this.epicness[id] == 0) {
        if (cell.owner) cell.owner.epic[cell.getId()] = false;
    }
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

        for (var id in cells) {

            var otherCell = cells[id];
            if (otherCell.getType() != 0) {
                continue;
            }
            if (cell.owner == otherCell.owner) {
                continue;
            }

            var dist = cell.getDist(cell.getPosition().x, cell.getPosition().y, otherCell.getPosition().x, otherCell.getPosition().y);
            var minDist = Math.max(cell.getEatingRange(),otherCell.getEatingRange()) * 3.5 + 500;
            /*var deltaAngle = (cell.getAngle() - otherCell.getAngle()).mod(Math.PI*2);
            var minAngle = Math.PI/6;*/
            var ratioMass = cell.mass / otherCell.mass;


            // if (dist < minDist && (deltaAngle < minAngle || deltaAngle > Math.PI * 2 - minAngle))
            var e = (y1 - cell.getPosition().y) / (x1 - cell.getPosition().x);
            var f = y1 - e * x1;
            var a = otherCell.getPosition().x;
            var b = otherCell.getPosition().y;
            var R = otherCell.getEatingRange() * 0.8 + 100;


            if (dist < minDist
                && ratioMass < this.gameServer.config.playerEpicnessRatioMass && ratioMass > 1 / this.gameServer.config.playerEpicnessRatioMass
                && Math.pow(-2*a + 2*e * (f - b),2) - 4 * (1 + Math.pow(e,2)) * (Math.pow(a,2) + Math.pow(f - b,2) - Math.pow(R,2)) >= 0) {
                this.epicnessInc(cell);
                this.epicnessInc(otherCell);
            }


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
    }
};

FFACustom.prototype.onCellRemove = function(cell) {
    if (cell.owner) cell.owner.epic[cell.getId()] = false;
};