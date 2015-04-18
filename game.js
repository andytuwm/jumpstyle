window.onload = function () {
    "use strict";
    // Load 800 x 600 game window, auto rendering method, append to body
    var game = new Phaser.Game(800, 600, Phaser.AUTO, "");

    var socketId, kScoreText, dScoreText;

    // Player stats constants
    var stats = {
        moveVelocity: 300,
        gravityAcceleration: 1500,
        jumpVelocity: 500,
        jumpLimit: 1,
        dashTime: 80,
        dashResetTime: 500,
        shotDelay: 300
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

            // Position k/d score interface
            game.add.sprite(680, 15, 'kill', 0, this.interface);
            game.add.sprite(725, 15, 'death', 0, this.interface);
            kScoreText = game.add.text(700, 15, kScore + "", {
                fontSize: '14px'
            });
            dScoreText = game.add.text(749, 15, dScore + "", {
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

            //Initialize player
            this.players = game.add.group();
            this.playerStats = new Player('selfPlayer', game, 'player', game.world.centerX, game.world.centerY, stats);
            this.player = this.playerStats.sprite;

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

        jump: function () {
            if (this.player.body.touching.down) {
                this.player.body.velocity.y = -this.playerStats.jumpVelocity;
                //socket.emit('jump');
            }
            if (!this.player.body.touching.down && jumpCount < this.playerStats.jumpLimit) {
                this.player.body.velocity.y = -this.playerStats.jumpVelocity;
                //socket.emit('jump');
                jumpCount++;
            }
        },

        dashTimer: function () {
            dashing = true;
            this.dResetTimer.add(this.playerStats.dashTime, function () {
                dashing = false;
                // Stop acceleration after completing dash.
                this.player.body.acceleration.x = 0;

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
        },

        shootProjectile: function (dir, pos, id) {
            if (canShoot) {
                var bullet;
                if (pos === undefined) {
                    if (!bulletPool.length) {
                        bullet = game.add.sprite(this.player.body.x, this.player.body.y, 'bullet', 0, this.projectiles);
                        socket.emit('shoot', dir, {
                            x: this.player.body.x,
                            y: this.player.body.y
                        });

                        bullet.checkWorldBounds = true;
                        bullet.events.onOutOfBounds.add(this.destroyOwnBullet, this);
                    } else {
                        bullet = bulletPool.pop();
                        bullet.reset(this.player.body.x, this.player.body.y);
                        socket.emit('shoot', dir, {
                            x: this.player.body.x,
                            y: this.player.body.y
                        });
                    }
                } else {
                    if (!enemyBulletPool.length) {
                        bullet = game.add.sprite(pos.x, pos.y, 'bullet', 0, this.enemyProjectiles);
                        bullet.checkWorldBounds = true;
                        bullet.events.onOutOfBounds.add(this.destroyEnemyBullet, this);
                    } else {
                        bullet = enemyBulletPool.pop();
                        bullet.reset(pos.x, pos.y);
                    }
                    bullet.fromId = id;
                    //console.log('enemy fire from ' + bullet.fromId);
                }

                if (dir === 'right') {
                    bullet.body.velocity.x = bulletSpeed;
                } else if (dir === 'left') {
                    bullet.body.velocity.x = -bulletSpeed;
                } else if (dir === 'up') {
                    bullet.body.velocity.y = -bulletSpeed;
                } else if (dir === 'down') {
                    bullet.body.velocity.y = bulletSpeed;
                }
                canShoot = false;
                this.shotTimer.add(this.playerStats.shotDelay, function () {
                    canShoot = true;
                }, this);
                this.shotTimer.start();
            }
        },

        destroyOwnBullet: function (bullet) {
            bulletPool.push(bullet.kill());
        },

        destroyEnemyBullet: function (bullet) {
            enemyBulletPool.push(bullet.kill());
        },

        hitPlayer: function (bullet) {
            enemyBulletPool.push(bullet.kill());
            console.log('shot by ' + bullet.fromId);
            // Player respawn.
            this.player.reset(game.world.centerX, game.world.centerY - 100);
            dScore += 1;
            dScoreText.text = dScore;
            // Emit player death
            socket.emit('died', bullet.fromId);
        },

        drawCurrentPlayersOnServer: function () {
            socket.emit('get players');
            socket.on('return players', function (sockets, id) {
                //console.log(sockets);
                socketId = id;
                for (var i = 0; i < sockets.length; i++) {
                    // TODO Add sprite at latest updated correct position
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
            socket.on('position updates', function (id, pos) {
                var player = findPlayerById(id);
                if (player) {
                    player.sprite.x = pos.x;
                    player.sprite.y = pos.y;
                }
            });

            // Shoot bullet in the direction and from the position that enemy shot at
            socket.on('shoot', function (dir, pos, id) {
                game.state.states.main.shootProjectile(dir, pos, id);
            });

            socket.on('got kill', function () {
                kScore += 1;
                kScoreText.text = kScore;
            });

            /*socket.on('jump', function (id) {
                var player = findPlayerById(id);
                if (player) {
                    if (player.sprite.body.touching.down) {
                        player.sprite.body.velocity.y = -player.jumpVelocity;
                    }
                    if (!player.sprite.body.touching.down && player.status.jumpCount < player.jumpLimit) {
                        player.sprite.body.velocity.y = -player.jumpVelocity;
                        player.status.jumpCount++;
                    }
                }
            });*/
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