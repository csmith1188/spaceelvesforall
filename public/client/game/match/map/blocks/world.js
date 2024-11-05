/*
    :::       :::  ::::::::  :::::::::  :::        :::::::::
   :+:       :+: :+:    :+: :+:    :+: :+:        :+:    :+:
  +:+       +:+ +:+    +:+ +:+    +:+ +:+        +:+    +:+
 +#+  +:+  +#+ +#+    +:+ +#++:++#:  +#+        +#+    +:+
+#+ +#+#+ +#+ +#+    +#+ +#+    +#+ +#+        +#+    +#+
#+#+# #+#+#  #+#    #+# #+#    #+# #+#        #+#    #+#
###   ###    ########  ###    ### ########## #########
*/

/*
 #     #
 #  #  #   ##   #    # ###### #      ###### #####
 #  #  #  #  #  #    # #      #      #        #
 #  #  # #    # #    # #####  #      #####    #
 #  #  # ###### #    # #      #      #        #
 #  #  # #    #  #  #  #      #      #        #
  ## ##  #    #   ##   ###### ###### ######   #

*/
class Wavelet extends Block {
    constructor(id, posVect, volVect, options) {
        super(id, posVect, volVect, options);
        this.HB = new Cylinder(new Vect3(posVect.x, posVect.y, posVect.z), volVect.x, volVect.y);
        this.push = new Vect3(0.075, 0.075, 0.5);
        this.intensity = 1;
        this.frequency = 0.05;
        this.offset = 0;
        this.type = 'wavelet';
        this.color = [150, 150, 255];
        this.colorSide = [200, 200, 250];
        this.solid = false;
        this.opacity = 0.5;
        this.shadowDraw = false;

        if (typeof options === 'object')
            for (var key of Object.keys(options)) {
                this[key] = options[key];
            }

        this.runFunc = [
            () => {
                this.HB.pos.z = sineAnimate(10, this.frequency, this.offset) + 10 + 16;
            }
        ]
    }

    trigger = (actor, side) => {
        actor.speed.z += sineAnimate(0.5, this.frequency, 60) + 0.5 + this.push.z;
        // push actor away from the center of this wavelet
        let angle = Math.atan2(actor.HB.pos.y - this.HB.pos.y, actor.HB.pos.x - this.HB.pos.x);
        actor.speed.x += Math.cos(angle) * this.push.x;
        actor.speed.y += Math.sin(angle) * this.push.y;

    }
}

class Wave extends Block {
    constructor(id, posVect, volVect, options) {
        super(id, posVect, volVect, options);
        this.HB = new Cube(new Vect3(posVect.x, posVect.y, posVect.z), new Vect3(volVect.x, volVect.y, volVect.z));
        this.push = new Vect3(0.05, 0.05, 0.5);
        this.end = new Vect3(0, 0, 0);
        this.type = 'wave';
        this.color = [150, 150, 255];
        this.colorSide = [200, 200, 250];
        this.solid = false;
        this.opacity = 0.4;
        this.shadowDraw = false;
        this.runFunc = [
            () => {
                this.HB.pos.x += this.speed.x;
                this.HB.pos.y += this.speed.y;
                this.HB.pos.z += this.speed.z;
                // generate wavelets at random positions within this wave
                if (game.match.ticks % 5 == 0) {
                    // generate sine offset for wavelets
                    let offset = Math.random() * 60;
                    game.match.map.blocks.push(new Wavelet(allID++, this.HB.pos.x + (Math.random() * this.HB.volume.x), this.HB.pos.y + (Math.random() * this.HB.volume.y), this.HB.pos.z, 8, 8, 0, { dying: true, livetime: 60, offset: offset }));
                }
            }
        ]

        if (typeof options === 'object')
            for (var key of Object.keys(options)) {
                this[key] = options[key];
            }
    }

    trigger = (actor, side) => {

    }
}