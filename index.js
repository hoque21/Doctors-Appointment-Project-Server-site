const express = require('express');
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000
require('dotenv').config()

const app = express();

//Middleware
app.use(cors());
app.use(express.json())


//Mongo db connect
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tfjhyno.mongodb.net/?retryWrites=true&w=majority`;
console.log(uri)
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

function verifyJWT (req, res, next) {
  const authHeader = req.headers.authorization;
  if(!authHeader) {
    return res.status(401).send('Unauthorized Access')
  }

  const token = authHeader.split(' ') [1];

  jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
    if(err){
      return res.status(403).send({message: 'Forbidden Access'})
    }
    req.decoded = decoded;
    next();
  })
}

async function run() {
  try {
    //Use Aggregate to query multiple collection and then merge data
    const appointmentOptionCollection = client.db('doctorPortal').collection('appointmentOptions')
    app.get('/appointmentOptions', async(req, res) => {
      const date = req.query.date;
      const query = {}
      const options = await appointmentOptionCollection.find(query).toArray();

      // Booking Date Selected
      const bookingQuery = {appointmentDate: date}
      const alreadyBooking = await bookingsCollection.find(bookingQuery).toArray()

      options.forEach(option => {
        const optionBooked = alreadyBooking.filter(book => book.treatment === option.name)
        const bookedSlots = optionBooked.map(book => book.slot)
        const remainingSlots = option.slots.filter(slot => !bookedSlots.includes(slot))
        option.slots = remainingSlots
      })
    
      res.send(options)
    })

    // ---------------------------------------------------

    // Bookings Api Create
    app.get('/bookings', verifyJWT, async(req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded.email

      if(email !== decodedEmail){
        return res.status(403).send({message: 'Forbidden Access'})
      }

      const query = {email: email};
      const booking = await bookingsCollection.find(query).toArray()
      res.send(booking)
    })

    const bookingsCollection = client.db('doctorPortal').collection('bookings')
    app.post('/bookings', async(req, res) => {
      const booking = req.body;
      const query = {
        appointmentDate: booking.appointmentDate,
        email: booking.email,
        treatment: booking.treatment
      }

      const alreadyBooked = await bookingsCollection.find(query).toArray()
      if(alreadyBooked.length){
        const message = `You Already Have a booking on ${booking.appointmentDate}`
        return res.send({acknowledged: false, message})
      }
      const result =await bookingsCollection.insertOne(booking)
      res.send(result)
    });

    // JWT TOKEN
    app.get('/jwt', async(req, res) => {
      const email = req.query.email;
      const query = {email: email};
      const user = await usersCollection.findOne(query);
      if(user) {
        const token = jwt.sign({email}, process.env.ACCESS_TOKEN, {expiresIn: '1h'})
        return res.send({accessToken: token})
      }
      res.status(403).send({accessToken: " "})
    })


    // ----------------------------------------------------
    // Users Collextion

    app.get('/users', async(req, res) => {
      const query = {}
      const users = await usersCollection.find(query).toArray()
      res.send(users)
    })

    app.get('/users/admin/:email', async (req, res) => {
      const email = req.params.email
      const query = {email}
      const user = await usersCollection.findOne(query)
      res.send({isAdmin: user?.role === 'admin'})
    })

    const usersCollection = client.db('doctorPortal').collection('users')
    app.post('/users', async(req, res) => {
      const user = req.body
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })

    //Make Admin
    app.put('/users/admin/:id', verifyJWT, async(req, res) => {
      const decodedEmail = req.decoded.email;
      const query = {email: decodedEmail};
      const user = await usersCollection.findOne(query)

      if(user?.role !== 'admin'){
        return res.status(403).send({message: "Forbidden Access"})
      }
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const options = {upsert: true}
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc, options)
      res.send(result)
    })

    // Make a doctor specialty Api
    app.get('/appointmentSpecialty', async (req, res) => {
      const query = {}
      const result = await appointmentOptionCollection.find(query).project({name: 1}).toArray()
      res.send(result)
    })

    // Manage Al doctor Collectin Api
    const doctorsCollection = client.db('doctorPortal').collection('doctors')
    app.post('/doctors', async(req, res) => {
      const doctor = req.body;
      const result = await doctorsCollection.insertOne(doctor);
      res.send(result)
    })
    // Get Doctors Api
    app.get('/doctors', async(req, res) => {
      const query = {}
      const doctors = await doctorsCollection.find(query).toArray()
      res.send(doctors)
    })


  }

  finally{

  }
}

run().catch(console.log);


app.get('/', async(req, res) => {
    res.send('Doctors Portal Server Running')
  })

  app.listen(port, () => {
    console.log(`Doctors Portal Running Port: ${port}`)
  })

