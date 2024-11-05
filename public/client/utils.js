/**
 * Represents a 2D vector.
 * @class
 */
class Vect2 {
    /**
     * Creates a new Vect2 instance.
     * @constructor
     * @param {number} x - The x-coordinate of the vector.
     * @param {number} y - The y-coordinate of the vector.
     */
    constructor(x, y) {
        this.x = x || 0;
        this.y = y || 0;
    }

    /**
     * Compares the vector with a target vector.
     * @param {Vect2} target - The target vector to compare with.
     * @returns {Object} - An object containing the angle, difference, and distance between the vectors.
     */
    compare(target) {
        let xd = target.x - this.x;
        let yd = target.y - this.y;
        let dist2 = Math.sqrt(xd ** 2 + yd ** 2);
        return {
            angle2: new Vect3(xd / dist2, yd / dist2, 0),
            difference: new Vect3(xd, yd, zd),
            distance2: dist2,
        }
    }
}

/**
 * Represents a 3D vector.
 * @class
 * @extends Vect2
 */
class Vect3 extends Vect2 {
    /**
     * Creates a new Vect3 instance.
     * @constructor
     * @param {number} x - The x-coordinate of the vector.
     * @param {number} y - The y-coordinate of the vector.
     * @param {number} z - The z-coordinate of the vector.
     */
    constructor(x, y, z) {
        super(x, y)
        this.z = z || 0;
    }

    /**
     * Compares the vector with a target vector.
     * @param {Vect3} target - The target vector to compare with.
     * @returns {Object} - An object containing the angles, difference, and distances between the vectors.
     */
    compare(target) {
        let xd = target.x - this.x;
        let yd = target.y - this.y;
        let zd = target.z - this.z;
        let dist2 = Math.sqrt(xd ** 2 + yd ** 2);
        let dist3 = Math.sqrt(xd ** 2 + yd ** 2 + zd ** 2);
        return {
            angle2: new Vect3(xd / dist2, yd / dist2, 0),
            angle3: new Vect3(xd / dist3, yd / dist3, zd / dist3),
            difference: new Vect3(xd, yd, zd),
            distance2: dist2,
            distance3: dist3
        }
    }
}

/**
 * Represents a rectangle.
 * @class
 */
class Rect {
    /**
     * Creates a new Rect instance.
     * @constructor
     * @param {number} x - The x-coordinate of the top-left corner of the rectangle.
     * @param {number} y - The y-coordinate of the top-left corner of the rectangle.
     * @param {number} w - The width of the rectangle.
     * @param {number} h - The height of the rectangle.
     */
    constructor(x, y, w, h) {
        this.x = x || 0;
        this.y = y || 0;
        this.w = w || 0;
        this.h = h || 0;
    }

    /**
     * Returns the center coordinates of the rectangle.
     * @returns {Object} - An object containing the x and y coordinates of the center.
     */
    center() {
        return {
            x: this.x + (this.w / 2),
            y: this.y + (this.h / 2)
        }
    }

    /**
    * Checks if the rectangle collides with another rectangle.
    * @param {Rect} c - The rectangle to check collision with.
    * @returns {boolean} - True if collision occurs, false otherwise.
    */
    collidePoint(x, y) {
        if (x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h)
            return true
        return false
    }

    /**
     * Checks if the rectangle collides with another rectangle.
     * @param {Rect} c - The rectangle to check collision with.
     * @returns {boolean} - True if collision occurs, false otherwise.
     */
    collideRect(c) {
        if (this.x < c.x + c.w && this.x + this.w > c.x)
            if (this.y < c.y + c.h && this.y + this.h > c.y)
                return true
        return false
    }

    /**
     * Checks if the rectangle collides with a cube.
     * @param {Cube} c - The cube to check collision with.
     * @returns {boolean} - True if collision occurs, false otherwise.
     */
    collideCube(c) {
        if (this.x < c.pos.x + c.volume.x && this.x + this.w > c.pos.x)
            if (this.y < c.pos.y + c.volume.y && this.y + this.h > c.pos.y)
                return true
        return false
    }
}

/**
 * Represents a cube.
 * @class
 */
class Cube {
    /**
     * Creates a new Cube instance.
     * @constructor
     * @param {Vect3} origin - The origin position of the cube.
     * @param {Vect3} volume - The volume of the cube.
     */
    constructor(origin = new Vect3(0,0,0), volume = new Vect3(0,0,0)) {
        this.pos = origin;
        this.volume = volume;
        this.end = new Vect3(origin.x + volume.x, origin.y + volume.y, origin.z + volume.z);
    }

    /**
     * Returns half of the cube's volume as a vector.
     * @returns {Vect3} - The half volume of the cube.
     */
    half() {
        return new Vect3(this.volume.x / 2, this.volume.y / 2, this.volume.z / 2)
    }

    /**
     * Returns the center coordinates of the cube.
     * @returns {Vect3} - The center coordinates of the cube.
     */
    center() {
        return new Vect3(this.pos.x + (this.volume.x / 2), this.pos.x + (this.volume.y / 2), this.pos.x + (this.volume.z / 2))
    }
}

/**
 * Represents a cylinder.
 * @class
 */
class Cylinder {
    /**
     * Creates a new Cylinder instance.
     * @constructor
     * @param {Vect3} origin - The origin position of the cylinder.
     * @param {number} radius - The radius of the cylinder.
     * @param {number} height - The height of the cylinder.
     */
    constructor(origin, radius, height) {
        this.pos = origin;
        this.radius = radius;
        this.height = height;
    }

    center() {
        return new Vect3(this.pos.x, this.pos.y, this.pos.z + this.height / 2);
    }

    /**
     * Checks if the cylinder collides with another shape.
     * @param {Rect|Cube} c - The shape to check collision with.
     * @param {Vect3} speed - The speed vector of the cylinder (optional).
     * @returns {string|boolean} - The side of collision if collision occurs, false otherwise.
     */
    collide(c, speed = new Vect3(0, 0, 0)) {
        //RECT/CUBE COLLIDE
        if (c instanceof Rect || c instanceof Cube) {
            // Calculate the potential new position of the circle after movement
            let newX = this.pos.x + speed.x;
            let newY = this.pos.y + speed.y;
            let newZ = this.pos.z + speed.z + this.height / 2;

            // Find the closest point on the rectangle to the circle
            let closestX = Math.max(Math.min(newX, c.pos.x + c.volume.x), c.pos.x);
            let closestY = Math.max(Math.min(newY, c.pos.y + c.volume.y), c.pos.y);
            let closestZ = Math.max(Math.min(newZ, c.pos.z + c.volume.z), c.pos.z);

            // Calculate the distance between the circle's center and the closest point on the rectangle
            let distanceX = newX - closestX;
            let distanceY = newY - closestY;
            let distanceZ = newZ - closestZ;

            // Calculate penetration depths
            let penX = Math.abs(distanceX);
            let penY = Math.abs(distanceY);
            let penZ = Math.abs(distanceZ);

            let side;
            if (penX <= this.radius && penY <= this.radius && penZ <= this.height / 2) {
                let maxValue = Math.max(...[penX, penY, penZ]);
                if (maxValue == penX) {
                    if (distanceX > 0)
                        side = 'right';
                    else
                        side = 'left';
                } else if (maxValue == penY) {
                    if (distanceY > 0)
                        side = 'front';
                    else
                        side = 'rear';
                }
                else if (maxValue == penZ) {
                    if (distanceZ > 0) {
                        side = 'top';
                    } else {
                        side = 'bottom';
                    }
                }
                return side;
            } else {
                return false;
            }
        } else if (c instanceof Cylinder) {
            // Calculate the potential new position of the circle after movement
            let newX = this.pos.x + speed.x;
            let newY = this.pos.y + speed.y;
            let newZ = this.pos.z + speed.z;

            // calculate the distance between the circle's center and the other circle's center
            let distanceXY = Math.sqrt((newX - c.pos.x) ** 2 + (newY - c.pos.y) ** 2);

            if (distanceXY == 0) {
                return 'center';
            } else if (distanceXY > this.radius + c.radius) {
                return false;
            } else {
                // z center of this cylinder
                newZ += this.height / 2;
                // z center of c cylinder
                let cZ = c.pos.z + c.height / 2;
                // calculate z distance
                let distanceZ = Math.abs(newZ - cZ);
                // a z collision occurs if the z distance is less than the sum of the z radii
                distanceXY -= this.radius + c.radius;
                if (distanceZ <= this.height / 2 + c.height / 2) {
                    distanceZ = distanceZ - this.height / 2 - c.height / 2;
                    if (distanceXY < distanceZ) {
                        if (distanceZ > 0)
                            return 'bottom';
                        else
                            return 'top';
                    } else if (distanceXY == 0 || distanceZ == 0) {
                        return 'center';
                    }
                    return 'side';
                } else {
                    return false;
                }

            }

        }
    }

    /**
     * Checks if the current object is positioned above a given volume.
     * @param {Object} c - The volume to check against.
     * @returns {boolean} - True if the object is above the volume, false otherwise.
     */
    above(c) {
        if (c instanceof Rect || c instanceof Cube) { // Check if the circle is positioned above the rectangle
            const xWithinVolume = this.pos.x + this.radius >= c.pos.x && this.pos.x - this.radius <= c.pos.x + c.volume.x;
            const yWithinVolume = this.pos.y + this.radius >= c.pos.y && this.pos.y - this.radius <= c.pos.y + c.volume.y;
            const zHigherThanVolume = this.pos.z + this.height / 2 >= c.pos.z + c.volume.z;
            return xWithinVolume && yWithinVolume && zHigherThanVolume;
        } else if (c instanceof Cylinder) { // Check if the circle is positioned above the cylinder
            const xWithinVolume = this.pos.x + this.radius >= c.pos.x && this.pos.x - this.radius <= c.pos.x + c.radius;
            const yWithinVolume = this.pos.y + this.radius >= c.pos.y && this.pos.y - this.radius <= c.pos.y + c.radius;
            const zHigherThanVolume = this.pos.z >= c.pos.z + c.height;
            return xWithinVolume && yWithinVolume && zHigherThanVolume;
        }
    }
}

/**
 * Performs a sine animation.
 * @param {number} amp - The amplitude of the sine wave.
 * @param {number} freq - The frequency of the sine wave.
 * @param {number} offset - The offset of the sine wave (optional).
 * @returns {number} - The value of the sine animation.
 */
function sineAnimate(amp, freq, offset) {
    if (!offset) offset = 0
    return amp * Math.sin(freq * (game.match.ticks + offset));
}

/**
 * Applies ease-out effect to a value.
 * @param {number} userValue - The user-defined value.
 * @param {number} maxValue - The maximum value.
 * @returns {number} - The modified value with ease-out effect.
 */
function easeout(userValue, maxValue) {
    const normalizedValue = userValue / maxValue;
    const easedValue = normalizedValue * (2 - normalizedValue);
    const modifiedValue = easedValue * maxValue;
    return modifiedValue;
}

/**
 * Applies ease-in-out effect to a value.
 * @param {number} userValue - The user-defined value.
 * @param {number} maxValue - The maximum value.
 * @returns {number} - The modified value with ease-in-out effect.
 */
function easeinout(userValue, maxValue) {
    const normalizedValue = userValue / maxValue;
    const easeInValue = normalizedValue < 0.5 ? 2 * normalizedValue * normalizedValue : -1 + (4 - 2 * normalizedValue) * normalizedValue;
    const easeOutValue = normalizedValue * (2 - normalizedValue);
    const modifiedValue = (easeInValue + easeOutValue) / 2 * maxValue;
    return modifiedValue
}

function formatTicks(ticks) {
    let milliseconds = Math.floor(ticks % 60);
    let seconds = Math.floor(ticks / 60);
    let minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;
    if (seconds < 10) seconds = '0' + seconds;
    if (minutes < 10) minutes = '0' + minutes;
    return minutes + ':' + seconds + '.' + milliseconds;
}