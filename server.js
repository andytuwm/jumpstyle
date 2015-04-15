var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var socketIDs = []; // Track how many players there are
var players = []; // Save player data server side

// Allow serving static files in same directory as server file (root)
app.use(express.static(__dirname));

// On GET request, serve index.html in response
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

// Event listeners set on opening socket connection
io.on('connection', function (socket) {
    var socketid = socket.id;
    console.log('User Connected:', socketid);



    socket.broadcast.emit('new player', socket.id);

    socket.on('get players', function () {
        io.to(socketid).emit('return players', socketIDs, socketid);
        socketIDs.push(socketid);
    });

    socket.on('disconnect', function () {
        var i = socketIDs.indexOf(socketid);
        var d = findPlayerById(socketid);
        socketIDs.splice(i, 1);
        if (d)
            players.splice(d, 1);
        io.emit('player leave', socketid);
        console.log('User Disconnected:', socketid);
    });
});

// Start listening for requests.
http.listen(3000, function () {
    console.log('Server started. Listening on *:3000');
});

function findPlayerById(id) {
    for (var i = 0; i < players.length; i++) {
        if (players[i].id === id) {
            return players[i];
        }
    }
    return false;
}