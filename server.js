var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var socketIDs = []; // Track how many players there are
var serverTimestep = 100;

// Allow serving static files in same directory as server file (root)
app.use(express.static(__dirname));

// On GET request, serve index.html in response
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

// Event listeners set on opening socket connection
io.on('connection', function (socket) {
    var socketid = socket.id;
    socket.inputs = [];
    console.log('User Connected:', socketid);

    socket.broadcast.emit('new player', socketid);

    socket.on('position update', function (pos) {
        socket.inputs.push({
            position: pos,
            time: Date.now()
        });
        //socket.broadcast.emit('position updates', socketid, pos);
    });

    socket.on('get players', function () {
        io.to(socketid).emit('return players', socketIDs, socketid);
        socketIDs.push(socketid);
    });

    socket.on('died', function (killerID) {
        io.to(killerID).emit('got kill');
    });

    socket.on('shoot', function (dir, pos, dmg) {
        socket.broadcast.emit('shoot', dir, pos, socketid, dmg);
    });
    /*socket.on('jump', function () {
        socket.broadcast.emit('jump', socketid);
        console.log(socketid + 'jumped');
    });*/

    socket.on('disconnect', function () {
        var i = socketIDs.indexOf(socketid);
        socketIDs.splice(i, 1);
        io.emit('player leave', socketid);
        console.log('User Disconnected:', socketid);
    });
});

// Start listening for requests.
http.listen(3000, function () {
    console.log('Server started. Listening on *:3000');
});

setInterval(function () {
    var sockets = io.sockets.sockets;
    for (var i = 0; i < sockets.length; i++) {
        sockets[i].broadcast.emit('serverTimestamp', sockets[i].id, sockets[i].inputs);
        sockets[i].inputs = [];
    }
}, serverTimestep);