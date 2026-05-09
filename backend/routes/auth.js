const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// 🚨 주의: routes 폴더 안에 있기 때문에 db.js를 찾으려면 
// '../' 를 써서 상위 폴더로 한 번 나가야 해!
const pool = require('../db'); 

// 🚀 회원가입 API
// server.js에서 '/api' 경로를 기본으로 연결해 줄 거라서, 
// 여기서는 '/signup'만 적어도 최종적으로 '/api/signup'이 돼!
router.post('/signup', async (req, res) => {
    try {
        const { emailId, emailDomain, nickname, password } = req.body;
        const fullEmail = `${emailId}@${emailDomain}`;

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.promise().query(
            'INSERT INTO users (email, nickname, password) VALUES (?, ?, ?)',
            [fullEmail, nickname, hashedPassword]
        );

        res.status(201).json({ message: '회원가입이 완료되었습니다!' });

    } catch (error) {
        console.error('회원가입 에러:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: '이미 가입된 이메일입니다.' });
        }
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});

// 만든 라우터를 밖에서 쓸 수 있게 내보내기
module.exports = router;

// 🚀 로그인 API
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. DB에서 해당 이메일을 가진 사용자 찾기
        const [rows] = await pool.promise().query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        // 2. 사용자가 없으면 (배열 길이가 0이면) 에러 전송
        if (rows.length === 0) {
            return res.status(401).json({ message: '가입되지 않은 이메일입니다.' });
        }

        const user = rows[0]; // 찾은 사용자 정보

        // 3. 비밀번호 확인 (입력한 비밀번호와 DB에 암호화된 비밀번호 비교)
        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (!isPasswordMatch) {
            return res.status(401).json({ message: '비밀번호가 일치하지 않습니다.' });
        }

        // 4. 로그인 성공! 프론트엔드에 성공 메시지와 닉네임 전달
        res.status(200).json({
            message: '로그인 성공!',
            nickname: user.nickname
        });

    } catch (error) {
        console.error('로그인 에러:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다.' });
    }
});