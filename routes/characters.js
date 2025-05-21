const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.json({ message: 'キャラクター関連のルートが動作しています' });
});

module.exports = router;
