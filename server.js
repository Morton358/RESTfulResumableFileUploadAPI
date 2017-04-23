var app = require('http').createServer(handler)
    , io = require('socket.io').listen(app)
    , fs = require('fs')
    , exec = require('child_process').exec
    , util = require('util')


var mongodb = require('mongodb');
var assert = require('assert');


app.listen(8080);

var Files = {};



function handler (req, res) {
    fs.readFile(__dirname + '/index.html',
        function (err, data) {
            if (err) {
                res.writeHead(500);
                return res.end('Error loading index.html');
            }
            res.writeHead(200);
            res.end(data);
        });
}

io.sockets.on('connection', function (socket) {


    socket.on('Start', function (data) { //data contains the variables that we passed through in the html file
        var Name = data['Name'];
        Files[Name] = {  //Create a new Entry in The Files Variable
            FileSize : data['Size'],
            Data     : "",
            Downloaded : 0
        }
        var Place = 0;
        try{
            var Stat = fs.statSync('Temp/' +  Name);
            if(Stat.isFile())
            {
                Files[Name]['Downloaded'] = Stat.size;
                Place = Stat.size / 524288;
            }
        }
        catch(er){} //It's a New File
        fs.open("Temp/" + Name, "a", 0755, function(err, fd){
            if(err)
            {
                console.log(err);
            }
            else
            {
                Files[Name]['Handler'] = fd; //We store the file handler so we can write to it later
                socket.emit('MoreData', { 'Place' : Place, Percent : 0 });
            }
        });
    /*
 */
    });

    socket.on('Upload', function (data){
        var Name = data['Name'];
        Files[Name]['Downloaded'] += data['Data'].length;
        Files[Name]['Data'] += data['Data'];
        if(Files[Name]['Downloaded'] == Files[Name]['FileSize']) //If File is Fully Uploaded
        {
            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, Writen){
                var input = fs.createReadStream("Temp/" + Name);
                var output = fs.createWriteStream("File/" + Name);

                //util.pump(readableStream, writableStream, [callback])
                //Deprecated: Use readableStream.pipe(writableStream)
                input.pipe(output);
                input.on("end", function() {
                    console.log("end");
                    fs.unlink("Temp/" + Name, function ()
                    { //This Deletes The Temporary File
                        console.log("unlink this file:",Name );

                        //Work with database
                        var uri = 'mongodb://localhost:27017/test';
                        mongodb.MongoClient.connect(uri, function(error, db) {
                            assert.ifError(error);
                            var bucket = new mongodb.GridFSBucket(db);
                            fs.createReadStream('./File/' + Name).
                            pipe(bucket.openUploadStream(Name)).
                            on('error', function(error) {
                                assert.ifError(error);
                            }).
                            on('finish', function() {
                                console.log('done!');
                            //process.exit(0);
                            });
                        });
                        //end of work with database

                        socket.emit('Done', {'Image' : 'File/' + Name + '.jpg'});
                    });
                });
            });
        }
        else if(Files[Name]['Data'].length > 10485760){ //If the Data Buffer reaches 10MB
            fs.write(Files[Name]['Handler'], Files[Name]['Data'], null, 'Binary', function(err, Writen){
                Files[Name]['Data'] = ""; //Reset The Buffer
                var Place = Files[Name]['Downloaded'] / 524288;
                var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
                socket.emit('MoreData', { 'Place' : Place, 'Percent' :  Percent});
            });
        }
        else
        {
            var Place = Files[Name]['Downloaded'] / 524288;
            var Percent = (Files[Name]['Downloaded'] / Files[Name]['FileSize']) * 100;
            socket.emit('MoreData', { 'Place' : Place, 'Percent' :  Percent});
        }
    });


});



                    //var db = new Db('test', new Server('localhost', 27017)); // Establish connection to db

                        /*db.open(function(err, db) {
                            // Our file ID
                            var fileId = new ObjectID();
                            // Open a new file
                            var gridStore = new GridStore(db, fileId, "w", {root:'fs'});
                            //set chunkSize to 512 kilobytes
                            //gridStore.chunkSize = 1024 * 256 * 2;
                            // Read the filesize of file on disk (provide your own)
                            var fileSize = fs.statSync('./File/' + Name).size;
                            // Read the buffered data for comparision reasons
                            var data = fs.readFileSync('./File/' + Name);
                            // Open a file handle for reading the file
                            var fd = fs.openSync('./File/' + Name, 'r', 0666);
                            // Open the new file
                            gridStore.open(function(err, gridStore) {
                                // Write the file to gridFS using the file handle
                                gridStore.writeFile(fd, function(err, doc) {
                                    // Read back all the written content and verify the correctness
                                    GridStore.read(db, fileId, function(err, fileData) {
                                        assert.equal(data.toString('base64'), fileData.toString('base64'));
                                        assert.equal(fileSize, fileData.length);
                                        db.close();
                                    });
                                });
                            });
                        });*/