const express = require('express');
const cors = require('cors');

const productRoutes = require('./routes/productRoutes');
const userRoutes = require('./routes/userRoutes');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/products', productRoutes);
app.use('/users', userRoutes);

app.listen(3000, () => {
    console.log('서버 실행 중: http://localhost:3000');
});