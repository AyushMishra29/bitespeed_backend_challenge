const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const app = express();
require('dotenv').config();

// Initialize PostgreSQL connection pool
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DATABASE_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

app.use(bodyParser.json());

app.post('/identify', async (req, res) => {
  try {
    const { email, phoneNumber } = req.body;
    // Check if provided email or phoneNumber matches any existing contact
    const matchQuery = {
      text: 'SELECT * FROM Contact WHERE (email = $1 OR phoneNumber = $2) ORDER BY linkprecedence, createdAt',
      values: [email, phoneNumber],
    };
    const matchResult = await pool.query(matchQuery);
    const matchContact = matchResult.rows;

    if (matchContact.length > 0){
      if (matchContact.length == 2 && matchContact[0].linkprecedence == 'primary' && matchContact[1].linkprecedence == 'primary' ) {
        const updateSecondaryContactQuery = {
          text: 'UPDATE Contact SET linkedid = $1, linkprecedence = $2, updatedAt = CURRENT_TIMESTAMP WHERE id = $3',
          values: [ matchContact[0].id ,'secondary' , matchContact[1].id],
        };
        const updateSecondaryContactResult = await pool.query(updateSecondaryContactQuery);
        //console.log(updateSecondaryContactResult);
        return res.status(200).json({
          contact: {
            primaryContactId: matchContact[0].id,
            emails: [matchContact[0].email , matchContact[1].email],
            phoneNumbers: [matchContact[0].phonenumber , matchContact[1].phonenumber],
            secondaryContactIds: [matchContact[1].id],
          }
        });
      } else {
        const newSecondaryContactQuery = {
          text: 'INSERT INTO Contact(email, phoneNumber, linkedid, linkPrecedence) VALUES ($1, $2, $3, $4) RETURNING *',
          values: [email, phoneNumber, matchContact[0].id, 'secondary'],
        };
        const newSecondaryContactResult = await pool.query(newSecondaryContactQuery);
        
        // Fetch all secondary contact IDs linked to the primary contact ID
        const secondaryContactIdsQuery = {
          text: 'SELECT id FROM Contact WHERE linkedid = $1',
          values: [matchContact[0].id],
        };
        const secondaryContactIdsResult = await pool.query(secondaryContactIdsQuery);
        const secondaryIds = secondaryContactIdsResult.rows.map(row => row.id);
        
        if (matchContact[0].email == email){
          return res.status(200).json({
            contact: {
              primaryContactId: matchContact[0].id,
              emails: [email],
              phoneNumbers: [matchContact[0].phonenumber, phoneNumber],
              secondaryContactIds: secondaryIds,
            }
          });
        } else {
          return res.status(200).json({
            contact: {
              primaryContactId: matchContact[0].id,
              emails: [matchContact[0].email, email],
              phoneNumbers: [phoneNumber],
              secondaryContactIds: secondaryIds,
            }  
          });
        }
      }
      
    } else {
      const newPrimaryContactQuery = {
        text: 'INSERT INTO Contact(email, phoneNumber, linkPrecedence) VALUES ($1, $2, $3) RETURNING *',
        values: [email, phoneNumber, 'primary'],
      };
      const newPrimaryContactResult = await pool.query(newPrimaryContactQuery);
      return res.status(200).json({
        contact: {
          primaryContactId: newPrimaryContactResult.rows[0].id,
          emails: [email],
          phoneNumbers: [phoneNumber],
          secondaryContactIds: [],
        },
      });

    }

  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/checkip' , (req , res) => {
  console.log("req.ip=========",req.ip);
  console.log("req.headers======",req.headers['x-forwarded-for'])
  const parseIp = (req) =>
    req.headers['x-forwarded-for']?.split(',').shift()
    || req.socket?.remoteAddress

  console.log("parseIp==========" ,parseIp(req))
  return res.send({message: "success" , data: req.ip})
})

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server is running on PORT: ${port}`);
});
