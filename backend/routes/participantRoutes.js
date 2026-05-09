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

        const [existing] = await conn.query(
            `
            SELECT status
            FROM product_participants
            WHERE product_id = ? AND user_id = ?
            FOR UPDATE
            `,
            [productId, userId]
        );

        if (existing.length > 0) {
            const status = existing[0].status;

            if (status === 'joined') {
                await conn.rollback();
                return res.status(409).json({ message: '이미 참여한 공구입니다.' });
            }

            if (status === 'cancelled') {
                await conn.query(
                    `
                    UPDATE product_participants
                    SET status = 'joined',
                        created_at = CURRENT_TIMESTAMP
                    WHERE product_id = ? AND user_id = ?
                    `,
                    [productId, userId]
                );

                await conn.query(
                    'UPDATE products SET currentCount = currentCount + 1 WHERE id = ?',
                    [productId]
                );

                await conn.commit();
                return res.status(200).json({ message: '공구 재참여 완료' });
            }
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
        res.status(500).json({ message: '공구 참여 실패' });
    } finally {
        conn.release();
    }
});

router.patch('/cancel', async (req, res) => {
    const { productId, userId } = req.body;

    if (!productId || !userId) {
        return res.status(400).json({ message: 'productId 또는 userId가 없습니다.' });
    }

    const conn = await pool.promise().getConnection();

    try {
        await conn.beginTransaction();

        const [rows] = await conn.query(
            `
            SELECT *
            FROM product_participants
            WHERE product_id = ?
              AND user_id = ?
              AND status = 'joined'
            `,
            [productId, userId]
        );

        if (rows.length === 0) {
            await conn.rollback();
            return res.status(404).json({ message: '참여 내역이 없습니다.' });
        }

        await conn.query(
            `
            UPDATE product_participants
            SET status = 'cancelled'
            WHERE product_id = ?
              AND user_id = ?
            `,
            [productId, userId]
        );

        await conn.query(
            `
            UPDATE products
            SET currentCount = GREATEST(currentCount - 1, 0)
            WHERE id = ?
            `,
            [productId]
        );

        await conn.commit();

        res.json({ message: '참여 취소 완료' });

    } catch (error) {
        await conn.rollback();
        console.error(error);
        res.status(500).json({ message: '참여 취소 실패' });
    } finally {
        conn.release();
    }
});

module.exports = router;