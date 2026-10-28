# Immediate
- Sword/bullet instant no animation
- modifier keys no longer work

# Master Server
- ~~Spawn a game server~~
- ~~redirect user to game server~~
- ~~Login~~
- ~~redirect user with credentials~~
- ~~Local Login~~
- ~~Email Validation~~
- ~~Chat WS~~
- ~~Chat rooms~~
- ~~Route Handling~~
- ~~WS Broken~~
- ~~Two windows one user chat~~
- Better chat rate limiting
- Profiles with links
- local and formbar displayName overlap
- Newsletter/Updates/Unsubscribe
- News Blog
- Forums
- Forgot Password

# Game Server
- ~~Basic WS~~
- ~~Load a single player space elves~~
- ~~Report stats back to Master~~
- Database performance stats
- Master profile stats from DB
- Development tutorial
- clip through walls collision
- deathmatch mode (bounty mode, like suck)
- soccer mode

Match For Honor:
- ~~Waiting screen~~
- ~~Win conditions~~
- ~~End Game / Rematch~~

# Client
- ~~Basic WS~~
- ~~SP shared Physics engine~~
- Replace Master web server with in-client menus
- Debug menu (how does it currently work? Unified design)
- Banner text in UI
- why does it redownload block textures every second?
- sound broadcast by server by distance
- No bullet debris for local player
- match await player ready (await controls)
- client side menus
- move fire function to items (hold to fire flamer)
- Fix controller / player / character relationship (fix mouse controls aiming from camera instead character)
- show score tab
- restore full camera functionality ??? (camera zoom)
- offline mode (consider running server in electron app)

# New Goals.md
- ~~Players connect, id, add to player list~~
- ~~load a match~~
- ~~load a map~~
- ~~load a map with blocks~~
- ~~load a map with tiles~~
- ~~camera follows player's character~~
- ~~handle inputs from players~~
- ~~move player on client~~
- ~~send position back to user~~
- ~~import items/weapons~~
- ~~clientside aiming + firing~~
- ~~bullets and debris~~
- ~~bullets not moving / dying server side (duplicate client bullets)~~
- ~~fix desync/rubberbanding (slow cpu issue?)~~
- ~~characters assigned to correct players~~
- ~~sword shots 2 bullets, 1 visible~~
- sword/bullet doesn't spawn client-side if instant hit
- ~~request full pack for first time loading character/etc.~~
- ~~spawn weapons completely / correct spot~~
- ~~Create HB generator util~~
- ~~client side hud~~
- ~~pickup weapons~~
- ~~reload page~~
- ~~lance bullets~~
- ~~flamer bullets~~
- ~~sword work?~~
- ~~lance visible~~
- ~~lance raycast damage multiplier~~
- sword slash
- ~~fix team selector rings, second player sees nuetral first player~~
- ~~last man standing in match reset all players~~
- ~~redownload image on flip~~
- ~~handle death properly~~
- ~~other characters face left~~


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
