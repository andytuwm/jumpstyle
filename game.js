window.onload = function () {
    "use strict";
    // Load 800 x 600 game window, auto rendering method, append to body
    var game = new Phaser.Game(800, 600, Phaser.AUTO, "");

    var socketId, kScoreText, dScoreText, healthText, positionData = new Map();

    // Player stats constants
    var stats = {
        moveVelocity: 300,
        gravityAcceleration: 1500,
        jumpVelocity: 500,
        jumpLimit: 1,
        dashTime: 90,
        dashResetTime: 500,
        shotDelay: 320,
        health: 1000,
        shotDamage: 250
    };

    // World constants
    var bulletSpeed = 1600;

    // Checks for special movements
    var jumpCount = 0,
        doubleTapRight = null,
        doubleTapLeft = null,
        dashing = false,
        canDash = true,
        canResetDash = true,
        canShoot = true,
        kScore = 0,
        dScore = 0,
        bulletPool = [],
        enemyBulletPool = [],
        enemyPlayers = [];

    var mainState = {
        // We define the 3 default Phaser functions

        // This function will be executed at the beginning
        // That's where we load the game's assets
        preload: function () {
            game.stage.backgroundColor = '#B0BEC5';
            game.load.image('player', 'assets/friendlyPlayer.png');
            game.load.image('wallV', 'assets/wallVertical.png');
            game.load.image('wallH', 'assets/wallHorizontal.png');
            game.load.image('bullet', 'assets/bullet.png');
            game.load.image('death', 'assets/skull.png');
            game.load.image('kill', 'assets/knife.png');
            game.load.image('health', 'assets/heart.png');
        },

        // This function is called after the preload function
        // Here we set up the game, display sprites, etc.
        create: function () {

            // Load arcade physics option
            game.physics.startSystem(Phaser.Physics.ARCADE);
            game.input.doubleTapRate = 200;

            // Sprite groups
            this.projectiles = game.add.group();
            this.projectiles.enableBody = true;
            this.enemyProjectiles = game.add.group();
            this.enemyProjectiles.enableBody = true;
            this.interface = game.add.group();
            this.interface.enableBody = true;

            //Initialize player
            this.players = game.add.group();
            this.playerStats = new Player('selfPlayer', game, 'player', game.world.centerX, game.world.centerY, stats);
            this.player = this.playerStats.sprite;
            this.player.checkWorldBounds = true;
            this.player.events.onOutOfBounds.add(function () {
                this.player.reset(game.world.centerX, game.world.centerY - 100);
            }, this);

            // Interface information display
            game.add.sprite(680, 27, 'kill', 0, this.interface);
            game.add.sprite(725, 27, 'death', 0, this.interface);
            game.add.sprite(620, 27, 'health', 0, this.interface);
            kScoreText = game.add.text(700, 27, kScore + "", {
                fontSize: '14px'
            });
            dScoreText = game.add.text(749, 27, dScore + "", {
                fontSize: '14px'
            });
            healthText = game.add.text(640, 27, this.playerStats.health + "", {
                fontSize: '14px'
            });

            // this.cursor will refer to arrow keys input
            this.cursor = game.input.keyboard.createCursorKeys();
            // Jump check event listener
            this.cursor.up.onDown.add(function () {
                this.jump(this.playerStats);
            }, this);
            // Dash check event listener
            this.cursor.right.onDown.add(function () {
                this.dashRight();
            }, this);
            this.cursor.left.onDown.add(function () {
                this.dashLeft();
            }, this);

            // Add a timer for use in dashes
            this.dResetTimer = game.time.create(false);
            this.dCheckResetTimer = game.time.create(false);
            this.shotTimer = game.time.create(false);

            // this.shoot contains keys for the four directions to shoot in
            this.shoot = {
                up: game.input.keyboard.addKey(87),
                down: game.input.keyboard.addKey(83),
                left: game.input.keyboard.addKey(65),
                right: game.input.keyboard.addKey(68)
            };
            this.shoot.right.onDown.add(function () {
                this.shootProjectile('right');
            }, this);
            this.shoot.left.onDown.add(function () {
                this.shootProjectile('left');
            }, this);
            this.shoot.up.onDown.add(function () {
                this.shootProjectile('up');
            }, this);
            this.shoot.down.onDown.add(function () {
                this.shootProjectile('down');
            }, this);

            // Listen to server events
            this.addSocketListeners();
            this.drawCurrentPlayersOnServer();

            // Create map of platformer
            this.createWorld();
        },

        // This function is called 60 times per second 
        update: function () {
            // add collisions between objects
            game.physics.arcade.collide(this.players, this.walls);
            game.physics.arcade.collide(this.projectiles, this.walls, this.destroyOwnBullet, null, this);
            game.physics.arcade.collide(this.projectiles, this.players, this.destroyOwnBullet, null, this);
            game.physics.arcade.collide(this.enemyProjectiles, this.walls, this.destroyEnemyBullet, null, this);
            game.physics.arcade.collide(this.enemyProjectiles, this.players, this.hitPlayer, null, this);

            // function to control player movements
            this.movePlayer();
            this.moveEnemies();
            socket.emit('position update', {
                x: this.player.body.x,
                y: this.player.body.y
            });
        },

        movePlayer: function () {
            // If the left arrow key is pressed
            if (this.cursor.left.isDown) {
                // Move the player to the left
                this.player.body.velocity.x = -this.playerStats.moveVelocity;
            }

            // If the right arrow key is pressed
            else if (this.cursor.right.isDown) {
                // Move the player to the right
                this.player.body.velocity.x = this.playerStats.moveVelocity;
            }

            // If neither the right or left arrow key is pressed
            else {
                // Stop the player
                if (!dashing) {
                    this.player.body.velocity.x = 0;
                }
            }

            // If player is touching floor, double jump count is reset
            if (this.player.body.touching.down) {
                if (jumpCount !== 0) {
                    jumpCount = 0;
                }
                if (canResetDash) {
                    // Allow dashing again only after landing
                    canDash = true;
                }
            }

        },

        moveEnemies: function () {
            if (positionData) {
                positionData.forEach(function (inputs, sprite) {
                    //console.log(inputs);
                    if (inputs.length && sprite.positionCount < sprite.dataLen) {
                        sprite.x = inputs[sprite.positionCount].position.x;
                        sprite.y = inputs[sprite.positionCount].position.y;
                        sprite.positionCount++;
                    }
                });

            }
        },

        jump: function () {
            if (this.player.body.touching.down) {
                this.player.body.velocity.y = -this.playerStats.jumpVelocity;
            }
            if (!this.player.body.touching.down && jumpCount < this.playerStats.jumpLimit) {
                this.player.body.velocity.y = -this.playerStats.jumpVelocity;
                jumpCount++;
            }
        },

        dashTimer: function () {
            dashing = true;
            this.dResetTimer.add(this.playerStats.dashTime, function () {
                dashing = false;
                // Stop acceleration after completing dash.
                this.player.body.acceleration.x = 0;
                this.player.body.velocity.x = 0;
                // Add timer for after how long player can dash again.
                this.dResetTimer.add(this.playerStats.dashResetTime, function () {
                    canResetDash = true;
                });
                this.dResetTimer.start();
            }, this);
            this.dResetTimer.start();

        },

        dashRight: function () {
            if (doubleTapRight === null) {
                doubleTapRight = this.cursor.right.timeDown;
                this.dCheckResetTimer.add(game.input.doubleTapRate, function () {
                    doubleTapRight = null;
                    this.dCheckResetTimer.start();
                }, this);
                this.dCheckResetTimer.start();
            } else {
                if (this.cursor.right.timeDown - doubleTapRight < game.input.doubleTapRate && canDash) {
                    this.dashTimer();
                    this.player.body.acceleration.x = this.playerStats.moveVelocity * 120;
                    canDash = false;
                    canResetDash = false;
                }
                doubleTapRight = null;
            }
        },

        dashLeft: function () {
            if (doubleTapLeft === null) {
                doubleTapLeft = this.cursor.left.timeDown;
                this.dCheckResetTimer.add(game.input.doubleTapRate, function () {
                    doubleTapLeft = null;
                    this.dCheckResetTimer.start();
                }, this);
                this.dCheckResetTimer.start();
            } else {
                if (this.cursor.left.timeDown - doubleTapLeft < game.input.doubleTapRate && canDash) {
                    this.dashTimer();
                    this.player.body.acceleration.x = -this.playerStats.moveVelocity * 120;
                    canDash = false;
                    canResetDash = false;
                }
                doubleTapLeft = null;
            }
        },

        createWorld: function () {
            // Create group for walls
            this.walls = game.add.group();
            this.walls.enableBody = true;

            // Left/Right bounds
            var leftBound = game.add.sprite(0, -50, 'wallV', 0, this.walls);
            var rightBound = game.add.sprite(780, -50, 'wallV', 0, this.walls);
            leftBound.scale.y = 2;
            rightBound.scale.y = 2;

            // Top/Bottom bounds
            var ground = game.add.sprite(0, 580, 'wallH', 0, this.walls);
            ground.scale.x = 4;
            var ceiling = game.add.sprite(0, 0, 'wallH', 0, this.walls);
            ceiling.scale.x = 4;

            // Platforms
            game.add.sprite(100, 50, 'wallH', 0, this.walls); // Top left
            game.add.sprite(400, 50, 'wallH', 0, this.walls); // Top right
            game.add.sprite(100, 370, 'wallH', 0, this.walls); // Bottom left
            game.add.sprite(430, 370, 'wallH', 0, this.walls); // Bottom right
            game.add.sprite(0, 210, 'wallH', 0, this.walls); // Middle left
            game.add.sprite(520, 210, 'wallH', 0, this.walls); // Middle right
            game.add.sprite(250, 475, 'wallH', 0, this.walls);
            game.add.sprite(600, 475, 'wallH', 0, this.walls);
            var middleTop = game.add.sprite(250, 150, 'wallH', 0, this.walls);
            var middleBottom = game.add.sprite(175, 300, 'wallH', 0, this.walls);
            middleBottom.scale.setTo(1.5, 1);

            // Set walls to be immovable
            this.walls.setAll('body.immovable', true);
        },

        shootProjectile: function (dir, pos, id, dmg) {
            var bullet;
            // if pos is undefined, this is a shot made by local player.
            if (pos === undefined) {
                if (canShoot) {
                    if (!bulletPool.length) {
                        // create new bullet sprite
                        bullet = game.add.sprite(this.player.body.x + 13, this.player.body.y + 4, 'bullet', 0, this.projectiles);
                        // emit bullet to server
                        socket.emit('shoot', dir, {
                            x: this.player.body.x,
                            y: this.player.body.y
                        }, this.playerStats.shotDamage + Math.floor((Math.random() * 50) - 50));
                        // kill bullet sprite if it goes out of bounds
                        bullet.checkWorldBounds = true;
                        bullet.events.onOutOfBounds.add(this.destroyOwnBullet, this);
                    } else {
                        // get sprite from bullet pool
                        bullet = bulletPool.pop();
                        // reset bullet sprite back 
                        bullet.reset(this.player.body.x + 13, this.player.body.y + 4);
                        // emit bullet to server
                        socket.emit('shoot', dir, {
                            x: this.player.body.x,
                            y: this.player.body.y
                        }, this.playerStats.shotDamage + Math.floor((Math.random() * 50) - 50));
                    }
                    canShoot = false;
                    this.shotTimer.add(this.playerStats.shotDelay, function () {
                        canShoot = true;
                    }, this);
                    this.shotTimer.start();
                    if (dir === 'right') {
                        bullet.angle = 0;
                        bullet.body.velocity.x = bulletSpeed;
                    } else if (dir === 'left') {
                        bullet.angle = 0;
                        bullet.body.velocity.x = -bulletSpeed;
                    } else if (dir === 'up') {
                        bullet.angle = 90;
                        bullet.body.velocity.y = -bulletSpeed;
                    } else if (dir === 'down') {
                        bullet.angle = 90;
                        bullet.body.velocity.y = bulletSpeed;
                    }
                }
            } else {
                if (!enemyBulletPool.length) {
                    bullet = game.add.sprite(pos.x + 13, pos.y + 4, 'bullet', 0, this.enemyProjectiles);
                    bullet.checkWorldBounds = true;
                    bullet.events.onOutOfBounds.add(this.destroyEnemyBullet, this);
                } else {
                    bullet = enemyBulletPool.pop();
                    bullet.reset(pos.x, pos.y);
                }
                bullet.fromId = id;
                bullet.dmg = dmg;
                if (dir === 'right') {
                    bullet.angle = 0;
                    bullet.body.velocity.x = bulletSpeed;
                } else if (dir === 'left') {
                    bullet.angle = 0;
                    bullet.body.velocity.x = -bulletSpeed;
                } else if (dir === 'up') {
                    bullet.angle = 90;
                    bullet.body.velocity.y = -bulletSpeed;
                } else if (dir === 'down') {
                    bullet.angle = 90;
                    bullet.body.velocity.y = bulletSpeed;
                }
            }
        },

        destroyOwnBullet: function (bullet) {
            bulletPool.push(bullet.kill());
        },

        destroyEnemyBullet: function (bullet) {
            enemyBulletPool.push(bullet.kill());
        },

        hitPlayer: function (bullet) {
            enemyBulletPool.push(bullet.kill()); // remove bullet sprite from view
            console.log('shot by ' + bullet.fromId);

            this.playerStats.health -= bullet.dmg;
            healthText.text = this.playerStats.health; // update health
            if (this.playerStats.health < 0) {
                // Player respawn.
                this.player.reset(game.world.centerX, game.world.centerY - 100);
                // Update stats
                this.playerStats.health = this.playerStats.MAX_HEALTH;
                healthText.text = this.playerStats.health;
                dScore += 1;
                dScoreText.text = dScore;
                // Emit player death
                socket.emit('died', bullet.fromId);
            }
            console.log(this.playerStats.health);
        },

        drawCurrentPlayersOnServer: function () {
            socket.emit('get players');
            socket.on('return players', function (sockets, id) {
                //console.log(sockets);
                socketId = id; // get own player id
                // Iterate through all the players on the server and create a sprite for each
                for (var i = 0; i < sockets.length; i++) {
                    var enemy = new Player(sockets[i], game, 'player', game.world.centerX, game.world.centerY, stats);
                    enemyPlayers.push(enemy);
                }
            });
        },

        addSocketListeners: function () {

            //Add new player at center
            socket.on('new player', function (socket_id) {
                var enemy = new Player(socket_id, game, 'player', game.world.centerX, game.world.centerY, stats);
                enemyPlayers.push(enemy);
                console.log(enemyPlayers);
            });

            // Remove the player sprite that left
            socket.on('player leave', function (socket_id) {
                var playerToRemove = findPlayerById(socket_id);
                enemyPlayers.splice(enemyPlayers.indexOf(playerToRemove), 1);
                playerToRemove.sprite.destroy();
                console.log(enemyPlayers);
            });

            // Set the exact position of a sprite. Used to sync up positions at a lower frequency
            /*socket.on('position updates', function (id, pos) {
                var player = findPlayerById(id);
                if (player) {
                    player.sprite.x = pos.x;
                    player.sprite.y = pos.y;
                }
            });*/

            // Shoot bullet in the direction and from the position that enemy shot at
            socket.on('shoot', function (dir, pos, id, dmg) {
                game.state.states.main.shootProjectile(dir, pos, id, dmg);
            });

            // Update kills score
            socket.on('got kill', function () {
                kScore += 1;
                kScoreText.text = kScore;
            });

            // Set position data for an enemy player on every timestep.
            socket.on('serverTimestamp', function (id, inputs) {
                var sprite = findPlayerById(id).sprite;
                if (sprite) {
                    sprite.positionCount = 0; // counter variable for indexing each sprite's position data
                    sprite.dataLen = inputs.length; // get max length of inputs array
                    positionData.set(sprite, inputs); // set inputs data to corresponding sprite
                }
            });
        }

    };

    // Add the game state defined above. Start it onload.
    game.state.add('main', mainState);
    game.state.start('main');

    /*
        Returns a Player object if found, otherwise false. Checks specifically
        for 'self' player for consistency in getting the player object.
    */
    function findPlayerById(id) {
        if (id === "selfPlayer") {
            return game.state.states.main.playerStats;
        }
        for (var i = 0; i < enemyPlayers.length; i++) {
            if (enemyPlayers[i].id === id) {
                return enemyPlayers[i];
            }
        }
        return false;
    }

};