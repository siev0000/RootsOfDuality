const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.send('APIルートが動作しています');
});

module.exports = router;
