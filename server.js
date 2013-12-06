var http = require('http');
var formidable = require('formidable');
var fs = require('fs');
var fsext = require('fs-extra');
var url = require('url');
var mime = require('mime');
var readline = require('readline');
var stream = require('stream');
var querystring = require('querystring');
var csv = require('csv');

function generateRandomString(length) {
  var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";
  var string_length = length;
  var randomstring = '';
  var charCount = 0;
  var numCount = 0;

  for (var i=0; i<string_length; i++) {
    // If random bit is 0, there are less than 3 digits already saved, and there are not already 5 characters saved, generate a numeric value. 
    if((Math.floor(Math.random() * 2) == 0) && numCount < 3 || charCount >= 5) {
      var rnum = Math.floor(Math.random() * 10);
      randomstring += rnum;
      numCount += 1;
    } else {
      // If any of the above criteria fail, go ahead and generate an alpha character from the chars string
      var rnum = Math.floor(Math.random() * chars.length);
      randomstring += chars.substring(rnum,rnum+1);
      charCount += 1;
    }
  } 

  return randomstring;
}

function checkGetMethod(req) {
  if (req.method.toLowerCase() == 'get')
    return true;

  return false;
}

function checkPostMethod(req) {
  if (req.method.toLowerCase() == 'post')
    return true;

  return false;
}

function writeSuccessMessage(res) {
  var status = {"status": "ok"};
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.write(JSON.stringify(status));
  res.end();
}

function writeFailedMessage(res) {
  var status = {"status": "failed"};
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.write(JSON.stringify(status));
  res.end();  
}

function sendRequestFile(res, fn) {
  var fpath = fn;
  if (fpath[0] == '/') {
    fpath = '.' + fpath;
  }

  var filesize = fs.statSync(fpath)['size'];

  fs.readFile(fpath, function (err, d) {
    res.writeHead(200, {
      'Content-Type': mime.lookup(fpath),
      'Content-Length': filesize
    });
    res.end(d);

    console.log('Completed Uploading');
  });
}

function getData(info) {
  var instream = fs.createReadStream(info.realpath);
  var outstream = new stream;
  var rl = readline.createInterface(instream, outstream);

  var nline = 0;

  rl.on('line', function(line) {
    info.readline(line, nline, rl);
    nline += 1;
  });
  rl.on('close', info.close);
}

function processUploadedFile(req, res) {
  console.log("calling processUploadedFile");

  var form = new formidable.IncomingForm();
  
  form.parse(req, function(err, fields, files) {
  });

  form.on('end', function(fields, files) {
    var tempPath = this.openedFiles[0].path;
    var fileName = this.openedFiles[0].name;

    console.log("Temp Path : " + tempPath);
    console.log("File's Name : " + fileName);

    fsext.copy(tempPath, "tmp/" + fileName, function(err) {
      if (err) {
        console.log(err);
      }
      else {
        writeSuccessMessage(res);

        console.log("Successful uploading");
      }
    });
  });
}

// 실제 Path로 바꿉니다.
function getRealPath(fakePath) {
  var realPath = fakePath;
  if (fakePath[0] == '/') {
    realPath = './tmp' + fakePath;
  }
  else {
    realPath = 'tmp/' + fakePath;
  }

  return realPath;
}

function splitAddr(res, fn, field) {
  var data = Array();
  var fdata = Array();

  csv()
    .from.path(getRealPath(fn), {columns: true})
    .on('record', function(row, index) {
      fdata.push(row);
      data.push("'"+encodeURIComponent(row[field])+"'");
    })
    .on('end', function() {
      var divisionName = ['도', '시', '구', '읍', '면', '동', '리', '가', '로', '출장소', '기타'];

      var temp = Array();
      for (var key in fdata[0]) {
        temp.push(key);
      }

      // 이름에 중복은 없다고 가정한다. 있는지 미리 검사
      var titles = temp.concat(divisionName);

      var body = 'format=JSON&multiple=True&query=';
      var dataStr = "["+data.join(',')+"]";
      body += dataStr;

      var options = {
        method: 'POST',
        host: 'lod.datahub.kr',
        path: '/addr',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': body.length
        }
      };

      var request = http.request(options, function(resp) {
        res.writeHead(200, {"Content-Type": "application/json"});
        
        var bodyArr = Array();

        var titleStr = Array();
        for (var i = 0, len = titles.length; i < len; i++) {
          var e = titles[i];
          if (e.indexOf(',') == -1)
            titleStr.push(e);
          else 
            titleStr.push('"' + e + '"');
        }
        bodyArr.push(titleStr.join(','));

        resp.setEncoding('utf8');
        resp.on('data', function(chunk) {
          function setData(d, t, w) {
            if (d[t] == undefined) d[t] = w;
            else d[t] += (" " + w);
          }

          var result = JSON.parse(chunk);
          if (result.status != 'ok') {
            writeFailedMessage();
            return ;
          }

          var odata = result.data;

          for (var ind = 0, nfdata = fdata.length; ind < nfdata; ind++) {
            var item = fdata[ind];

            var data = {};
            for (var i = 0, len = titles.length; i < len; i++)
              data[titles[i]] = undefined;

            for (var key in fdata[ind]) {
              data[key] = fdata[ind][key];
            }

            var d = odata[ind];
            for (var i = 0, len = d.length; i < len; i++) {
              var t = d[i]['type'], w = d[i]['word'];
              if (t == '특별자치도' || t == '도') setData(data, '도', w);
              else if (t == '특별시' || t == '광역시' || t == '특별자치시' || t == '자치시' || t == '시') setData(data, '시', w);
              else if (t == '자치구' || t == '일반구') setData(data, '구', w);
              else {
                setData(data, t, w);
              }
            }

            // write to json
            var ordered = Array();
            for (var i = 0, len = titles.length; i < len; i++) {
              ordered.push(data[titles[i]]);
            }
            bodyArr.push(ordered.join(','));
          }

          res.write(JSON.stringify(bodyArr));
        });
        resp.on('end', function() {
          res.end();

          console.log('Completed Result');
        });
      });

      console.log(body);
      request.write(body);
      request.end();
    });
}

http.createServer(function(req, res) {
  var parseStr = url.parse(req.url, true);
  var path = parseStr.pathname;

  console.log("Request Url Path : " + path);
  console.log("Request Method   : " + req.method);

  if (path == '/favicon.ico') {
    res.writeHead(404, {});
    res.end();
    return ;
  }

  if (checkGetMethod(req)) {
    if (path == '/') {
      sendRequestFile(res, 'index.html');
    }
    else if (path == '/readline') {
      var query = parseStr.query;

      if (query.nline == undefined) {
        query.nline = 9999999;
      }

      console.log("Filename : " + query.filename);
      console.log("Number of Line : " + query.nline);

      var realPath = getRealPath(query.filename);

      var lineStack = Array();

      getData({
        realpath: realPath,
        readline: function(line, nline, rl) {
          // process line here
          lineStack.push('"' + line.replace(/\"/gi, "\\\"") + '"');

          if (nline >= query.nline) {
            rl.close();
          }
        },
        close: function() {
          // do something on finish here
          res.writeHead(200, {"Content-Type": "application/json"});
          res.write('[' + lineStack.join(',') + ']');
          res.end();

          console.log("Completed Sending Text");
        }
      });
    }
    else if (path == '/splitAddress') {
      var query = parseStr.query;

      console.log("Filename : " + query.filename);
      console.log("Fields : " + query.fieldName);

      splitAddr(res, query.filename, query.fieldName);
    }
    else if (path.indexOf('/downloadcsv') == 0) {
      var filename = path.slice('/downloadcsv'.length + 1, path.length);
      sendRequestFile(res, "csv/"+filename+".csv");
    }
    else {
      sendRequestFile(res, path);
    }
  }
  else if (checkPostMethod(req)) {
    if (path == '/upload') {
      processUploadedFile(req, res);
    }
    else if (path == '/generatecsv') {
      var filename = generateRandomString(8);
      var filepath = "csv/" + filename + ".csv";
      var writeStream = fs.createWriteStream(filepath);

      var form = new formidable.IncomingForm();
  
      form.parse(req, function(err, fields, files) {
        var data = JSON.parse(decodeURIComponent(fields.data));
        data.forEach(function(e) {
          var body = Array();
          e.forEach(function(e) {
            if (e.indexOf(',') == -1)
              body.push(e);
            else 
              body.push('"'+e+'"');
          });
          writeStream.write(body.join(',')+'\r\n');
        });
      });

      form.on('end', function(fields, files) {
        writeStream.end();

        res.writeHead(200, {
          'Content-Type': 'application/json',
        });
        
        res.write(JSON.stringify({
          status: "ok",
          filename: filename
        }));

        res.end();
      });
    }
  }
}).listen(3869, function() {
  console.log("Starting Server");
});
