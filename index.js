const express = require('express')
const app = express()
const port = 8080
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken');

require('dotenv').config()

const pg = require('pg');
const cors = require('cors');

app.use(express.json()) 
app.use(cors({ origin: 'http://localhost:3000' })); // Allow access to your frontend

const SECRET_KEY = process.env.SECRET_KEY;

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL + "?sslmode=require",
})

// Protected route middleware
async function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
  
    if (!authHeader || !authHeader.startsWith('Bearer '))
      return res.status(401).json({ message: 'Unauthorized access' });
  
    const token = authHeader.split(' ')[1];

    
  
    try {
    
        const blacklistedToken = await pool.query('SELECT * FROM blacklisted_tokens WHERE token = $1', [token])

        if(blacklistedToken.rows.length > 0)
            return res.status(401).json({ message: 'Invalid token' });

        const decoded = jwt.verify(token, SECRET_KEY);
        req.userId = decoded.userId;
        next();


    } catch (error) {
      return res.status(401).json({ message: 'Invalid token' });
    }
}

app.post('/users', async (req, res) => {

    const {name, email, password} = req.body

    try {

        const hashedPassword = await bcrypt.hash(password, 10)

        const users = await pool.query('SELECT * FROM users WHERE email = $1', [email])

        if(users.rows.length > 0)
            res.status(401).json({ statusCode: '401', msg: "User already exist"})

        const resUser = await pool.query('INSERT INTO users (name, email, password) VALUES ($1, $2, $3) returning id', [name, email, hashedPassword])

        const token = jwt.sign({ userId: resUser.rows[0].id }, SECRET_KEY, { expiresIn: '36h' });

        res.status(200).json({
            statusCode: '200',
            msg: 'User inserted successfully',
            user: {
                name: name,
                email: email,
                token: token
            }
        })

    } catch (error) {
        console.log('Error inserting', error)
    }
    
    
})

app.post('/users/login', async (req, res) => {
  const { email, password } = req.body;

  const userData = await pool.query('SELECT * FROM users WHERE email = $1', [email])

  if (userData.rows.length === 0)
    return res.status(401).json({ message: 'Invalid username or password' });

  // Compare hashed passwords
  const passwordMatch = await bcrypt.compare(password, userData.rows[0].password);

  if (!passwordMatch)
    return res.status(401).json({ message: 'Invalid password' });

  // Generate JWT token
  const token = jwt.sign({ userId: userData.rows[0].id }, SECRET_KEY, { expiresIn: '36h' });

  res.status(200).json({ 
    statusCode: '200',
    email: email,
    msg: 'Logged in successfully',
    token: token
  });

})


app.get('/users/logout', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token)
        return res.status(400).json({ message: 'Invalid token' });

    // Add token to blacklist
    await pool.query('INSERT INTO blacklisted_tokens (token) VALUES ($1)', [token])

    res.json({ message: 'Logged out successfully' });
    
  });

app.get('/', verifyToken, async (req, res) => {

    try {
        const result = await pool.query('SELECT * FROM todo_list WHERE user_id = $1 ORDER BY id DESC', [req.userId])
        res.status(200).json(result.rows)

    } catch (error) {

        res.status(500).json({
            statusCode: '500',
            msg: 'Error in query',
            error: error
        })

    }

})

app.post('/', verifyToken, async (req, res) => {

    try {
        const data = req.body
        await pool.query(`INSERT INTO todo_list (title, due_date, description, user_id) VALUES ($1::text, $2::date, $3::text, $4)`, [data.title, data.due_date, data.description, req.userId])

        res.status(200).json({
            statusCode: '200',
            msg: 'success'
        })

    } catch (error) {

        res.status(500).json({
            statusCode: '500',
            result: 'Error inserting data',
            error: error
        })
    }

})


app.post('/change-task-status', async (req, res) => {

    try {
        const data = req.body, 
              isChecked = data.isChecked;

        let sqlString = 'is_completed = true';

        if(!isChecked)
            sqlString = 'is_completed = false';

        await pool.query(`UPDATE todo_list SET ${sqlString} WHERE id = $1`, [data.id])

        res.status(200).json({
            statusCode: '200',
            msg: 'success'
        })

    } catch (error) {

        res.status(500).json({
            statusCode: '500',
            result: 'Error inserting data',
            error: error
        })
    }

})

app.delete('/remove-task', async (req, res) => {
    try {
        const data = req.body

        await pool.query(`DELETE FROM todo_list WHERE id = $1`, [data.id])

        const result = await pool.query('SELECT * FROM todo_list ORDER BY id DESC')

        res.status(200).json({
            statusCode: '200',
            msg: 'success'
        })

    } catch (error) {

        res.status(500).json({
            statusCode: '500',
            result: 'Error inserting data',
            error: error
        })
    }
})

app.listen(port, () => {console.log(`App listening on port ${port}`) })