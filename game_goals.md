h1 - alligator
h2 - banner
h3 - small

<!--
      ::::::::   ::::::::  :::::::::  ::::::::::          ::::::::   ::::::::  ::::    :::  ::::::::  :::::::::: ::::::::: :::::::::::
    :+:    :+: :+:    :+: :+:    :+: :+:                :+:    :+: :+:    :+: :+:+:   :+: :+:    :+: :+:        :+:    :+:    :+:
   +:+        +:+    +:+ +:+    +:+ +:+                +:+        +:+    +:+ :+:+:+  +:+ +:+        +:+        +:+    +:+    +:+
  +#+        +#+    +:+ +#++:++#:  +#++:++#           +#+        +#+    +:+ +#+ +:+ +#+ +#+        +#++:++#   +#++:++#+     +#+
 +#+        +#+    +#+ +#+    +#+ +#+                +#+        +#+    +#+ +#+  +#+#+# +#+        +#+        +#+           +#+
#+#    #+# #+#    #+# #+#    #+# #+#                #+#    #+# #+#    #+# #+#   #+#+# #+#    #+# #+#        #+#           #+#
########   ########  ###    ### ##########          ########   ########  ###    ####  ########  ########## ###           ###
-->
Space elves believe nothing is random:
    Minimal RNG in the mechanics. Main play mode can be reliably speedran.
Dark elves believe everything is random:
    The mechanics should be so fun that players will make their
    own games in completely randomly generated maps and scenarios.

<!--
      :::::::::   ::::::::          :::::::::: ::::::::::: :::::::::   :::::::: :::::::::::
     :+:    :+: :+:    :+:         :+:            :+:     :+:    :+: :+:    :+:    :+:
    +:+    +:+ +:+    +:+         +:+            +:+     +:+    +:+ +:+           +:+
   +#+    +:+ +#+    +:+         :#::+::#       +#+     +#++:++#:  +#++:++#++    +#+
  +#+    +#+ +#+    +#+         +#+            +#+     +#+    +#+        +#+    +#+
 #+#    #+# #+#    #+#         #+#            #+#     #+#    #+# #+#    #+#    #+#
#########   ########          ###        ########### ###    ###  ########     ###
-->

- high scores
- music
- graphics
-- fix direction change src bug
- ship

- all players in one list
- janky menus (better menu handling)
- for honor countdown and best of 5
- ISO draw
- A* pathing
- Gamepad and touch screen buttons
- Create more bullet types
- Inventory Management
-- X is pickup, A is always Sword, never drop A
- target on minimap
- Collision rays (fast objects go through colliders)
- Sound distances
-- Web Audio API
- Waves and Wind
- Shoot along z rotation in iso view
- Bots always shoot at z axis in every view (no hiding on top of blocks)
- Racing
- Complete speed physics (top speed, actual speed, weight)
- Graphics are block attached to character
-- Are shadows blocks, too?
- Give blocks friction for wall jumping rooftop drag
-- Fix floor slam on top of block bug
- Animators
- Emitters
- Melee Weapons
- Polyblock regions
- 3D Polyblocks
- Camera Zoom/Pan
- Draw xhair from anywhere
- Arc Aiming Cone

<!--
      :::::::::  :::    :::  ::::::::   ::::::::
     :+:    :+: :+:    :+: :+:    :+: :+:    :+:
    +:+    +:+ +:+    +:+ +:+        +:+
   +#++:++#+  +#+    +:+ :#:        +#++:++#++
  +#+    +#+ +#+    +#+ +#+   +#+#        +#+
 #+#    #+# #+#    #+# #+#    #+# #+#    #+#
#########   ########   ########   ########
-->

- bullets always collide on left of block?
-- fast moving objects penetrate deeper. need raycasting collision
- z height too high on ortho view when over tall block
- z block top vs player bottom bad when block z is raised
- ring height too low in iso view when on block
- bullet cylinder shadow not aligning in iso view
- choppy gamepad aim

<!--
    #                                        #
   # #   ###### ##### ###### #####           # ###### ##### #####  # #    # ######  ####
  #   #  #        #   #      #    #          # #        #   #    # # #   #  #      #
 #     # #####    #   #####  #    #          # #####    #   #####  # ####   #####   ####
 ####### #        #   #      #####     #     # #        #   #    # # #  #   #           #
 #     # #        #   #      #   #     #     # #        #   #    # # #   #  #      #    #
 #     # #        #   ###### #    #     #####  ######   #   #####  # #    # ######  ####

-->

- Advanced Inventory
-- Backpack bags/slots
-- Ordered / Sorted vs Slots
-- Hotkey bar with adjustable max slots


<!--
    :::       ::: ::::::::::     :::     :::::::::   ::::::::  ::::    :::          ::::::::::: :::::::::  ::::::::::     :::      ::::::::
   :+:       :+: :+:          :+: :+:   :+:    :+: :+:    :+: :+:+:   :+:              :+:     :+:    :+: :+:          :+: :+:   :+:    :+:
  +:+       +:+ +:+         +:+   +:+  +:+    +:+ +:+    +:+ :+:+:+  +:+              +:+     +:+    +:+ +:+         +:+   +:+  +:+
 +#+  +:+  +#+ +#++:++#   +#++:++#++: +#++:++#+  +#+    +:+ +#+ +:+ +#+              +#+     +#+    +:+ +#++:++#   +#++:++#++: +#++:++#++
+#+ +#+#+ +#+ +#+        +#+     +#+ +#+        +#+    +#+ +#+  +#+#+#              +#+     +#+    +#+ +#+        +#+     +#+        +#+
#+#+# #+#+#  #+#        #+#     #+# #+#        #+#    #+# #+#   #+#+#              #+#     #+#    #+# #+#        #+#     #+# #+#    #+#
###   ###   ########## ###     ### ###         ########  ###    ####          ########### #########  ########## ###     ###  ########
-->
- shield drains power to absorb and reflect damage
- grapple hook slings you around blocks and disabling attacks
- ballistic beats power beats plasma beats ballistic
- pistol and sniper beat sheild and grapple by outranging
- flamer and lance beat pistol and sniper by closing distance and burst damage
- shield and grapple beat flamer and lance by disabling when grappled and reflecting momentum




<!--
      ::::    ::: :::::::::: :::       :::          ::::::::      :::       :::   :::   ::::::::::          ::::::::::: :::::::::  ::::::::::     :::      ::::::::
     :+:+:   :+: :+:        :+:       :+:         :+:    :+:   :+: :+:    :+:+: :+:+:  :+:                     :+:     :+:    :+: :+:          :+: :+:   :+:    :+:
    :+:+:+  +:+ +:+        +:+       +:+         +:+         +:+   +:+  +:+ +:+:+ +:+ +:+                     +:+     +:+    +:+ +:+         +:+   +:+  +:+
   +#+ +:+ +#+ +#++:++#   +#+  +:+  +#+         :#:        +#++:++#++: +#+  +:+  +#+ +#++:++#                +#+     +#+    +:+ +#++:++#   +#++:++#++: +#++:++#++
  +#+  +#+#+# +#+        +#+ +#+#+ +#+         +#+   +#+# +#+     +#+ +#+       +#+ +#+                     +#+     +#+    +#+ +#+        +#+     +#+        +#+
 #+#   #+#+# #+#         #+#+# #+#+#          #+#    #+# #+#     #+# #+#       #+# #+#                     #+#     #+#    #+# #+#        #+#     #+# #+#    #+#
###    #### ##########   ###   ###            ########  ###     ### ###       ### ##########          ########### #########  ########## ###     ###  ########
-->

- Space Elves fantasy mmo ala Runescape
- Tank crew. 4 guys in a tank fight infantry in an APC
- Warhammer 40k RTS from lists
