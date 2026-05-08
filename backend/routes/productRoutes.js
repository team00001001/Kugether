const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', (req, res) => {
    const sql = 'SELECT * FROM products ORDER BY id DESC';

    db.query(sql, (err, results) => {
        if (err) {
            console.log(err);
            return res.status(500).json({ error: '상품 조회 실패' });
        }

        res.json(results);
    });
});

module.exports = router;