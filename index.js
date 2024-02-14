const express = require('express')
const app = express()
const port = 8080

require('dotenv').config()

const pg = require('pg');
const cors = require('cors');

app.use(express.json()) 
app.use(cors({ origin: 'http://localhost:3000' })); // Allow access to your frontend


const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL + "?sslmode=require",
})


app.get('/', async (req, res) => {

    try {

        const result = await pool.query('SELECT * FROM todo_list ORDER BY id DESC')
        res.send(result.rows)

    } catch (error) {

        res.send({
            statusCode: '500',
            msg: 'Error in query',
            error: error
        })

    }

})

app.post('/', async (req, res) => {

    try {
        const data = req.body
        await pool.query(`INSERT INTO todo_list (title, due_date, description) VALUES ($1::text, $2::date, $3::text)`, [data.title, data.due_date, data.description])

        res.send({
            statusCode: '200',
            msg: 'success'
        })

    } catch (error) {

        res.send({
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

        res.send({
            statusCode: '200',
            msg: 'success'
        })

    } catch (error) {

        res.send({
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

        res.send({
            statusCode: '200',
            msg: 'success'
        })

    } catch (error) {

        res.send({
            statusCode: '500',
            result: 'Error inserting data',
            error: error
        })
    }
})

app.listen(port, () => {console.log(`App listening on port ${port}`) })