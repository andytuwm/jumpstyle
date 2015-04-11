Player = function (game, playerSprite, createX, createY) {

    // Player stats constants
    var moveVelocity = 300,
        gravityAcceleration = 1500,
        jumpVelocity = 500,
        jumpLimit = 1,
        dashTime = 70,
        dashResetTime = 500;

    // Set up the player sprite
    var player = game.add.sprite(createX, createY, playerSprite);
    player.anchor.setTo(0.5, 0.5);
    // Tell Phaser that the player will use the Arcade physics engine
    game.physics.arcade.enable(player);
    // Add vertical gravity to the player
    player.body.gravity.y = gravityAcceleration;
    return player;
};