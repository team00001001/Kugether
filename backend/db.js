const mysql = require('mysql2');

const db = mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: 'uichan1125',
    database: 'campus_gonggu'
});

db.connect((err) => {
    if (err) {
        console.log(err);
    } else {
        console.log('MySQL 연결 성공!');
    }
});

module.exports = db;