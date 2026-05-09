const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/join', async (req, res) => {
    const { productId, userId } = req.body;

    if (!productId || !userId) {
        return res.status(400).json({ message: 'productId 또는 userId가 없습니다.' });
    }

    const conn = await pool.promise().getConnection();

    try {
        await conn.beginTransaction();

        const [products] = await conn.query(
            'SELECT currentCount, targetCount FROM products WHERE id = ? FOR UPDATE',
            [productId]
        );

        if (products.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: '공구방을 찾을 수 없습니다.' });
        }

        const product = products[0];

        if (product.currentCount >= product.targetCount) {
            await conn.rollback();
            return res.status(400).json({ message: '이미 모집이 마감된 공구입니다.' });
        }

        await conn.query(
            `
            INSERT INTO product_participants (product_id, user_id, status)
            VALUES (?, ?, 'joined')
            `,
            [productId, userId]
        );

        await conn.query(
            'UPDATE products SET currentCount = currentCount + 1 WHERE id = ?',
            [productId]
        );

        await conn.commit();

        res.status(201).json({ message: '공구 참여 완료' });

    } catch (error) {
        await conn.rollback();
        console.error(error);

        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: '이미 참여한 공구입니다.' });
        }

        res.status(500).json({ message: '공구 참여 실패' });
    } finally {
        conn.release();
    }
});

module.exports = router;