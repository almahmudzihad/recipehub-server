const express = require('express')
const app = express()
const cors = require('cors');
const port = 5000;
require('dotenv').config();
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.get('/', (req, res) => {
  res.send('Hello World! RecipeHub Server is running')
})


const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const database = client.db("recipehub");
    const recipesCollection = database.collection("recipes");


    app.post('/api/recipes', async (req, res) => {
      try {
        const recipe = req.body;
        const result = await recipesCollection.insertOne(recipe);
        
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: 'Failed to create recipe' });
      }
    });
    app.get('/api/recipes', async (req, res) => {
      try {
        const recipes = await recipesCollection.find().toArray();
        res.send(recipes);
      } catch (error) {
        res.status(500).send({ error: 'Failed to fetch recipes' });
      }
    });
    app.get('/api/recipes/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const recipe = await recipesCollection.findOne(query);
        res.send(recipe);
      } catch (error) {
        res.status(500).send({ error: 'Failed to fetch recipe' });
      }
    });



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})