//copied from http://www.tysoncadenhead.com/blog/exporting-canvas-animation-to-mov/
var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    fs = require('fs');

server.listen(3000);

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});
app.use( express.static( __dirname ));

var date = new Date().toISOString();
var outputfolder = __dirname + '/output_images';
fs.mkdir(outputfolder,0o777,function(){});
var savefoldername = outputfolder + '/'+date;
fs.mkdir(savefoldername);


io.sockets.on('connection', function (socket) {
    socket.on('render-frame', function (data) {
		if(data.frame % 10 == 0){
			console.log("Frame "+data.frame+" recieved!");
		}
        data.file = data.file.split(',')[1]; // Get rid of the data:image/png;base64 at the beginning of the file data
        var buffer = new Buffer(data.file, 'base64');

        fs.writeFile(savefoldername+ '/frame-' + data.frame + '.png', buffer.toString('binary'), 'binary');
    });
});
console.log("Active.")
