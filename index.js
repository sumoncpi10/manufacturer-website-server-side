const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);



const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.o83fx.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send({ message: 'UnAuthorized access' });
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden access' })
        }
        req.decoded = decoded;
        next();
    });
}
async function run() {
    try {
        await client.connect();
        const userCollection = client.db('atztoolsmanufacturing').collection('users');
        const productCollection = client.db('atztoolsmanufacturing').collection('products');
        const OrderCollection = client.db('atztoolsmanufacturing').collection('orders');
        const paymentCollection = client.db('atztoolsmanufacturing').collection('payments');
        const reviewCollection = client.db('atztoolsmanufacturing').collection('reviews');

        app.get('/', (req, res) => {
            res.send('Hello Form ATZ!')
        });






        // get product 
        app.get('/product/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const product = await productCollection.findOne(query);
            res.send(product);
        })

        // get single user 
        app.get('/user/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const product = await userCollection.findOne(query);
            res.send(product);
        })
        // get Users
        app.get('/user', verifyJWT, async (req, res) => {
            const query = {};
            const cursor = userCollection.find(query);
            const users = await cursor.toArray();
            res.send(users);
        })

        // app.get('/user', verifyJWT, async (req, res) => {
        //     const users = await userCollection.find().toArray();
        //     res.send(users);
        // });

        // update user 
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            console.log(user);
            const filter = { email: email };
            const options = { upsert: true };
            const updateDoc = {
                $set: user,
            }
            const result = await userCollection.updateOne(filter, updateDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5h' });
            res.send({ result, token });
        });


        // get admin 
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user?.role === 'admin';
            res.send({ admin: isAdmin })
        })
        // make admin 

        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            // const user = req.body;
            const filter = { email: email };

            const updateDoc = {
                $set: { role: 'admin' },
            }
            const result = await userCollection.updateOne(filter, updateDoc);
            // const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send(result);
        });

        // Delete User 
        app.delete('/user/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        // add product 
        app.post('/productAdd', async (req, res) => {
            const newProduct = req.body;
            console.log('adding new Product', newProduct);
            const result = await productCollection.insertOne(newProduct);
            res.send(result);
        });
        // get product 
        app.get('/products', async (req, res) => {
            const query = {};
            const cursor = productCollection.find(query);
            const products = await cursor.toArray();
            res.send(products)
        });
        // add Order 
        app.post('/addorder', async (req, res) => {
            const newOrder = req.body;
            console.log('adding new order', newOrder);
            const result = await OrderCollection.insertOne(newOrder);
            res.send(result);
        });

        // get all order 

        app.get('/orders', async (req, res) => {
            const query = {};
            const cursor = OrderCollection.find(query);
            const orders = await cursor.toArray();
            res.send(orders)
        });
        // get order by email 
        app.get('/order', async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const bookings = await OrderCollection.find(query).toArray();
            res.send(bookings);
        });
        // get Order 
        app.get('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const product = await OrderCollection.findOne(query);
            res.send(product);
        })
        // delivered 
        app.patch('/delivered/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    delivered: true,
                    // transactionId: payment.transactionId
                }
            }

            // const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await OrderCollection.updateOne(filter, updatedDoc);
            res.send(updatedOrder);
        })
        // Delete Order 
        app.delete('/order/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await OrderCollection.deleteOne(query);
            res.send(result);
        })
        // Payment
        app.post('/create-payment-intent', verifyJWT, async (req, res) => {
            const service = req.body;
            const price = service.price;
            // const amount = price;
            // console.log(price);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: price,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({ clientSecret: paymentIntent?.client_secret })
        });
        // paid 
        app.patch('/order/:id', verifyJWT, async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { _id: ObjectId(id) };
            const updatedDoc = {
                $set: {
                    paid: true,
                    transactionId: payment.transactionId
                }
            }

            const result = await paymentCollection.insertOne(payment);
            const updatedOrder = await OrderCollection.updateOne(filter, updatedDoc);
            res.send(updatedOrder);
        });
        // add Order 
        app.post('/reviewAdd', async (req, res) => {
            const newReview = req.body;
            console.log('adding new Review', newReview);
            const result = await reviewCollection.insertOne(newReview);
            res.send(result);
        });
        // get all Review 

        app.get('/reviewsall', async (req, res) => {
            const query = {};
            const cursor = reviewCollection.find(query);
            const reviews = await cursor.toArray();
            res.send(reviews)
        });
        // get 3 Review 

        app.get('/reviews', async (req, res) => {
            const query = {};
            const cursor = reviewCollection.find(query);
            const reviews = await cursor.limit(3).toArray();
            res.send(reviews)
        });
    }
    finally {

    }
}
run().catch(console.dir);



app.listen(port, () => {
    console.log(`ATZ app listening on port ${port}`)
})