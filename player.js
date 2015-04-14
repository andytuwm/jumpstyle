Player = function (id, game, playerSprite, createX, createY, stats) {

    var sprite = game.add.sprite(createX, createY, playerSprite, 0, game.state.states.main.players);
    sprite.anchor.setTo(0.5, 0.5);
    // Tell Phaser that the player will use the Arcade physics engine
    game.physics.arcade.enable(sprite);
    // Add vertical gravity to the player
    sprite.body.gravity.y = stats.gravityAcceleration;
    return {
        sprite: sprite,
        moveVelocity: stats.moveVelocity,
        gravityAcceleration: stats.gravityAcceleration,
        jumpVelocity: stats.jumpVelocity,
        jumpLimit: stats.jumpLimit,
        dashTime: stats.dashTime,
        dashResetTime: stats.dashResetTime,
        id: id
    };
};