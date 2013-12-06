var csv = require('csv');
csv().from.path('tmp/130304100734.real.csv', {columns: true}).on('record', function(row, index) { console.log('#'+index+' '+row["회원이름"]); }).on('end', function(count) {});
