/*
      ::::::::  ::::    ::: :::        ::::::::::: ::::    ::: ::::::::::            :::   :::   :::    ::: :::    ::::::::::: ::::::::::: :::::::::  :::            :::   :::   ::: :::::::::: :::::::::
    :+:    :+: :+:+:   :+: :+:            :+:     :+:+:   :+: :+:                  :+:+: :+:+:  :+:    :+: :+:        :+:         :+:     :+:    :+: :+:          :+: :+: :+:   :+: :+:        :+:    :+:
   +:+    +:+ :+:+:+  +:+ +:+            +:+     :+:+:+  +:+ +:+                 +:+ +:+:+ +:+ +:+    +:+ +:+        +:+         +:+     +:+    +:+ +:+         +:+   +:+ +:+ +:+  +:+        +:+    +:+
  +#+    +:+ +#+ +:+ +#+ +#+            +#+     +#+ +:+ +#+ +#++:++#            +#+  +:+  +#+ +#+    +:+ +#+        +#+         +#+     +#++:++#+  +#+        +#++:++#++: +#++:   +#++:++#   +#++:++#:
 +#+    +#+ +#+  +#+#+# +#+            +#+     +#+  +#+#+# +#+                 +#+       +#+ +#+    +#+ +#+        +#+         +#+     +#+        +#+        +#+     +#+  +#+    +#+        +#+    +#+
#+#    #+# #+#   #+#+# #+#            #+#     #+#   #+#+# #+#                 #+#       #+# #+#    #+# #+#        #+#         #+#     #+#        #+#        #+#     #+#  #+#    #+#        #+#    #+#
########  ###    #### ########## ########### ###    #### ##########          ###       ###  ########  ########## ###     ########### ###        ########## ###     ###  ###    ########## ###    ###
*/
class Match_OnlineMP extends Match {
    constructor() {
        super();
    }

    /*

     #####  ######  ####  ###### #####
     #    # #      #      #        #
     #    # #####   ####  #####    #
     #####  #           # #        #
     #   #  #      #    # #        #
     #    # ######  ####  ######   #

    */
    reset() {
        super.reset();

    }

    /*

      ####  ###### ##### #    # #####
     #      #        #   #    # #    #
      ####  #####    #   #    # #    #
          # #        #   #    # #####
     #    # #        #   #    # #
      ####  ######   #    ####  #

    */
    setup() {
        super.setup();
        // Listen for server events
        socket.on('message', (data) => {
            console.log(data);
        });

        socket.on('update_svcl', (data) => {
            this.bots[0].character.HB.pos.x = data.pos.x;
            this.bots[0].character.HB.pos.y = data.pos.y;
            this.bots[0].character.HB.pos.z = data.pos.z;
        });

        this.bots.push(new Bot());
        this.bots[this.bots.length - 1].findTarget = () => { };
        // I wish i knew a better way of cloning objects instead of referencing them
        game.player.character.last = {};
        game.player.character.last.HB = new Cube();

    }

    step() {
        super.step();

        // if this player's HB pos in not equal to the last HB pos
        if (game.player.character.HB.pos.x != game.player.character.last.HB.pos.x ||
            game.player.character.HB.pos.y != game.player.character.last.HB.pos.y ||
            game.player.character.HB.pos.z != game.player.character.last.HB.pos.z) {
            // send the new HB pos to the server
            socket.emit('update_clsv', {
                id: game.player.character.id,
                pos: game.player.character.HB.pos
            });
            // update the last HB pos
            game.player.character.last.HB.pos.x = game.player.character.HB.pos.x;
            game.player.character.last.HB.pos.y = game.player.character.HB.pos.y;
            game.player.character.last.HB.pos.z = game.player.character.HB.pos.z;
        }

    }

    /*

     #####  #####    ##   #    #
     #    # #    #  #  #  #    #
     #    # #    # #    # #    #
     #    # #####  ###### # ## #
     #    # #   #  #    # ##  ##
     #####  #    # #    # #    #

    */
    draw() {
        super.draw();

    }
}