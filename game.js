window.onload = function () {
    "use strict";

    var moveVelocity = 300,
        gravityAcceleration = 1500,
        jumpVelocity = 500;

    // Load 800 x 600 game window, auto rendering method, append to body
    var game = new Phaser.Game(800, 600, Phaser.AUTO, "");
    var mainState = {
        // We define the 3 default Phaser functions

        // This function will be executed at the beginning
        // That's where we load the game's assets
        preload: function () {
            game.stage.backgroundColor = '#3498db';
            game.load.image('player', 'assets/player.png');
            game.load.image('wallV', 'assets/wallVertical.png');
            game.load.image('wallH', 'assets/wallHorizontal.png');
        },

        // This function is called after the preload function
        // Here we set up the game, display sprites, etc.
        create: function () {

            // Load arcade physics option
            game.physics.startSystem(Phaser.Physics.ARCADE);

            // this.cursor will refer to keyboard input
            this.cursor = game.input.keyboard.createCursorKeys();

            // Set up the player sprite
            this.player = game.add.sprite(game.world.centerX, game.world.centerY, 'player');
            this.player.anchor.setTo(0.5, 0.5);
            // Tell Phaser that the player will use the Arcade physics engine
            game.physics.arcade.enable(this.player);
            // Add vertical gravity to the player
            this.player.body.gravity.y = gravityAcceleration;

            this.createWorld();
        },

        // This function is called 60 times per second 
        // It contains the game's logic
        update: function () {
            // add collision between player and walls
            game.physics.arcade.collide(this.player, this.walls);

            // function to control player movements
            this.movePlayer();

        },

        movePlayer: function () {
            // If the left arrow key is pressed
            if (this.cursor.left.isDown) {
                // Move the player to the left
                this.player.body.velocity.x = -moveVelocity;
            }

            // If the right arrow key is pressed
            else if (this.cursor.right.isDown) {
                // Move the player to the right
                this.player.body.velocity.x = moveVelocity;
            }

            // If neither the right or left arrow key is pressed
            else {
                // Stop the player
                this.player.body.velocity.x = 0;
            }

            // If the up arrow key is pressed and the player is touching the ground
            if (this.cursor.up.isDown && this.player.body.touching.down) {
                // Move the player upward (jump)
                this.player.body.velocity.y = -jumpVelocity;
            }
        },

        createWorld: function () {
            // Create group for walls
            this.walls = game.add.group();
            this.walls.enableBody = true;

            // Create the 10 walls 
            game.add.sprite(0, 0, 'wallV', 0, this.walls); // Left
            game.add.sprite(780, 0, 'wallV', 0, this.walls); // Right

            game.add.sprite(100, 50, 'wallH', 0, this.walls); // Top left
            game.add.sprite(400, 50, 'wallH', 0, this.walls); // Top right
            game.add.sprite(100, 370, 'wallH', 0, this.walls); // Bottom left
            game.add.sprite(400, 370, 'wallH', 0, this.walls); // Bottom right

            game.add.sprite(0, 210, 'wallH', 0, this.walls); // Middle left
            game.add.sprite(500, 210, 'wallH', 0, this.walls); // Middle right

            var middleTop = game.add.sprite(150, 150, 'wallH', 0, this.walls);
            middleTop.scale.setTo(1.5, 1);
            var middleBottom = game.add.sprite(150, 300, 'wallH', 0, this.walls);
            middleBottom.scale.setTo(1.5, 1);

            // Set walls to be immovable
            this.walls.setAll('body.immovable', true);
        }
    };

    // Add the game state defined above. Start it onload.
    game.state.add('main', mainState);
    game.state.start('main');
};