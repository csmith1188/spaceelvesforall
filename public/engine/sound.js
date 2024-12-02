// (function (root, factory) {
//     if (typeof define === 'function' && define.amd) {
//         // AMD. Register as an anonymous module.
//         define([], factory);
//     } else if (typeof module === 'object' && module.exports) {
//         // Nodejs
//         module.exports = factory();
//     } else {
//         // Browser globals (root is window)
//         root.Sounds = factory();
//     }
// }(typeof self !== 'undefined' ? self : this, function () {

const Sounds = {
    'hit_bullet': new Audio('sfx/hit_01.wav'),
    'hit_flamer': new Audio('sfx/exp_03.wav'),
    'hit_rifle': new Audio('sfx/hit03.wav'),
    'hit_lance': new Audio('sfx/hit05.wav'),
    'shoot_pistol': new Audio('sfx/shoot_pistol.wav'),
    'shoot_flamer': new Audio('sfx/hit_02.wav'),
    'shoot_rifle': new Audio('sfx/exp05.wav'),
    'shoot_lance': new Audio('sfx/shoot_lance.wav'),
    'shoot_sword': new Audio('sfx/shoot_sword.wav'),
    'reload_empty': new Audio('sfx/power02.wav'),
    'reload_done': new Audio('sfx/power03.wav'),
    'pickup_ammo': new Audio('sfx/pickup02.wav'),
    'pickup_health': new Audio('sfx/power05.wav'),
    'pickup_weapon': new Audio('sfx/power03.wav'),
    'upBoost': new Audio('sfx/exp_04.wav'),
    'boost': new Audio('sfx/pup_01.wav'),
    'wallhit': new Audio('sfx/hardhit_01.wav'),
    'groundhit': new Audio('sfx/hit01.wav'),
    'death': new Audio('sfx/hit05.wav'),
    'goal': new Audio('sfx/powerup06.wav'),
    'prop': [
        new Audio('sfx/prop_00.wav'),
        new Audio('sfx/prop_01.wav'),
        new Audio('sfx/prop_02.wav'),
        new Audio('sfx/prop_03.wav'),
        new Audio('sfx/prop_04.wav'),
        new Audio('sfx/prop_05.wav'),
        new Audio('sfx/prop_06.wav'),
        new Audio('sfx/prop_07.wav'),
        new Audio('sfx/prop_08.wav'),
        new Audio('sfx/prop_09.wav'),
        new Audio('sfx/prop_10.wav'),
        new Audio('sfx/prop_11.wav'),
        new Audio('sfx/prop_12.wav'),
        new Audio('sfx/prop_13.wav'),
        new Audio('sfx/prop_14.wav'),
        new Audio('sfx/prop_15.wav'),
        new Audio('sfx/prop_16.wav'),
        new Audio('sfx/prop_17.wav'),
        new Audio('sfx/prop_18.wav'),
        new Audio('sfx/prop_19.wav')
    ]
}
// return sounds;
// }));

