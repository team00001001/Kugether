const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.send('유저 라우터 연결 성공');
});

module.exports = router;