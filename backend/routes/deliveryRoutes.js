// routes/deliveryRoutes.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../db'); // 💡 DB 연결 객체를 반드시 불러와야 쿼리가 실행됩니다!
require('dotenv').config(); 

const TRACKING_CACHE_TTL = 6 * 60 * 60; // 6시간 (초 단위) — API 하루 10회 제한 대응

// 1. 스마트택배 API 연동 (캐시 적용)
router.get('/tracking', async (req, res) => {
    const { carrierId, trackId, productId } = req.query;

    if (!carrierId || !trackId) {
        return res.status(400).json({ message: '택배사 코드와 송장 번호가 필요합니다.' });
    }

    // productId가 있으면 캐시 우선 확인
    if (productId) {
        try {
            const [rows] = await pool.promise().query(
                `SELECT tracking_result, tracking_cached_at FROM products WHERE id = ?`,
                [productId]
            );
            if (rows.length > 0 && rows[0].tracking_result && rows[0].tracking_cached_at) {
                const cacheAge = Math.floor(Date.now() / 1000) - Number(rows[0].tracking_cached_at);
                if (cacheAge < TRACKING_CACHE_TTL) {
                    const cached = JSON.parse(rows[0].tracking_result);
                    cached._cachedAt = rows[0].tracking_cached_at;
                    return res.json(cached);
                }
            }
        } catch (cacheErr) {
            console.error('캐시 조회 실패 (무시):', cacheErr);
        }
    }

    // 외부 API 호출
    try {
        const apiUrl = 'http://info.sweettracker.co.kr/api/v1/trackingInfo';
        const response = await axios.get(apiUrl, {
            params: {
                t_key: process.env.SWEET_TRACKER_API_KEY,
                t_code: carrierId,
                t_invoice: trackId
            }
        });

        const data = response.data;

        // 유효한 결과면 DB에 캐시 저장
        if (productId && data && data.status !== false && !data.code) {
            const nowSec = Math.floor(Date.now() / 1000);
            try {
                await pool.promise().query(
                    `UPDATE products SET tracking_result = ?, tracking_cached_at = ? WHERE id = ?`,
                    [JSON.stringify(data), nowSec, productId]
                );
            } catch (saveErr) {
                console.error('캐시 저장 실패 (무시):', saveErr);
            }
            data._cachedAt = nowSec;
        }

        res.json(data);
    } catch (error) {
        console.error('배송 API 연동 에러:', error);
        res.status(500).json({ message: '택배사 서버와 통신하는 데 실패했습니다.' });
    }
});

// 2. 방장(판매자)이 특정 공구(상품)의 운송장 번호를 등록/수정하는 API
router.patch('/:productId', async (req, res) => {
    const { productId } = req.params;
    const { carrierId, trackingNumber } = req.body;

    if (!productId || !carrierId || !trackingNumber) {
        return res.status(400).json({ message: '상품 ID, 택배사 코드, 송장 번호가 모두 필요합니다.' });
    }

    try {
        // 💡 참여자 테이블이 아닌 'products(상품)' 테이블을 업데이트합니다.
        await pool.promise().query(
            `
            UPDATE products
            SET carrier_id = ?, tracking_number = ?, tracking_result = NULL, tracking_cached_at = NULL
            WHERE id = ?
            `,
            [carrierId, trackingNumber, productId]
        );
        res.json({ success: true, message: '상품 운송장 정보가 성공적으로 등록되었습니다.' });

    } catch (error) {
        console.error('운송장 등록 실패:', error);
        res.status(500).json({ message: 'DB에 운송장 정보를 저장하는 데 실패했습니다.' });
    }
});

// 3. 참여자 및 방장이 배송 현황을 보기 위해 운송장 번호를 조회하는 API (방장 허용 로직 추가!)
router.get('/info/:productId', async (req, res) => {
    const { productId } = req.params;
    const { userId } = req.query; // 💡 프론트엔드에서 보낸 현재 접속 유저의 ID

    if (!userId) {
        return res.status(401).json({ message: '로그인이 필요합니다.' });
    }

    try {
        // 🚨 1. [방장 검사 및 상품 정보 조회] 
        // products 테이블에서 해당 상품을 만든 사람(user_id)과 배송 정보를 한 번에 가져옵니다.
        const [productInfo] = await pool.promise().query(
            `
            SELECT user_id, carrier_id, tracking_number 
            FROM products 
            WHERE id = ?
            `,
            [productId]
        );

        if (productInfo.length === 0) {
            return res.status(404).json({ message: '해당 공구를 찾을 수 없습니다.' });
        }

        // 현재 접속한 유저(userId)가 이 상품을 만든 사람(productInfo[0].user_id)인지 확인합니다.
        const isHost = (productInfo[0].user_id == userId);

        // 🚨 2. [참여자 검사]
        // 💡 핵심 수정 포인트: status가 'joined'인 사람만 찾는 것이 아니라, 'noshow(노쇼)'가 아닌 사람을 모두 통과시킵니다.
        const [participants] = await pool.promise().query(
            `
            SELECT id 
            FROM product_participants 
            WHERE product_id = ? AND user_id = ? AND status != 'noshow'
            `,
            [productId, userId]
        );

        const isParticipant = (participants.length > 0);

        // 🚨 3. [최종 판단] 방장도 아니고 참여자도 아니라면 쫓아냅니다.
        if (!isHost && !isParticipant) {
            return res.status(403).json({ 
                isParticipant: false, 
                message: '해당 공구의 참여자나 주최자만 배송 조회를 할 수 있습니다.' 
            });
        }

        // 🟢 [통과] 방장이거나 참여자라면 운송장 정보를 프론트엔드로 보냅니다.
        if (productInfo[0].tracking_number) {
            res.json({ isParticipant: true, exists: true, data: productInfo[0] });
        } else {
            res.json({ isParticipant: true, exists: false, message: '아직 등록된 운송장 번호가 없습니다.' });
        }

    } catch (error) {
        console.error('운송장 조회 실패:', error);
        res.status(500).json({ message: 'DB에서 운송장 정보를 불러오는 데 실패했습니다.' });
    }
});

module.exports = router;