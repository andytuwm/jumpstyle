var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var sockets = [];

// Allow serving static files in same directory as server file (root)
app.use(express.static(__dirname));

// On GET request, serve index.html in response
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

// Event listeners set on opening socket connection
io.on('connection', function (socket) {
    console.log('User Connected', socket.id);
    sockets.push(socket);



    io.emit('new player', socket.id);



    socket.on('disconnect', function () {
        var i = sockets.indexOf(socket);
        sockets.splice(i, 1);
        io.emit('player leave', socket.id);
        console.log('User Disconnected', socket.id);
    });
});

// Start listening for requests.
http.listen(3000, function () {
    console.log('Server started. Listening on *:3000');
});