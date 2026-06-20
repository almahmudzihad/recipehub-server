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
    const favoritesCollection = database.collection("favorites");
    const reportsCollection = database.collection("reports");


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
    app.patch("/recipes/:id/like", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await recipesCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $inc: { likes: 1 },
          }
        );

        res.send({
          success: true,
          message: "Liked successfully",
          result,
        });
      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error" });
      }
    });
    //my recipes
    app.get("/recipes", async (req, res) => {
      try {
        const email = req.query.email;

        if (!email) {
          return res.status(400).send({ message: "Email required" });
        }

        const result = await recipesCollection
          .find({ userEmail: email })
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: "Server error" });
      }
    });
    // delete my recipes
    app.delete("/recipes/:id", async (req, res) => {
      const id = req.params.id;

      const result = await recipesCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });



    app.post("/favorites", async (req, res) => {
      try {
        const { userEmail, recipeId, addedAt } = req.body;
        if (!userEmail || !recipeId) {
          return res.status(400).send({
            message: "Missing required fields",
          });
        }
        const existing = await favoritesCollection.findOne({
          userEmail,
          recipeId,
        });

        if (existing) {
          return res.status(409).send({
            message: "Already in favorites",
          });
        }
          const result = await favoritesCollection.insertOne({
          userEmail,
          recipeId,
          addedAt: addedAt || new Date(),
        });

        res.send({
          success: true,
          insertedId: result.insertedId,
        });

      } catch (error) {
        console.error(error);
        res.status(500).send({
          message: "Server error",
        });
      }
    });

    //reportsCollection
    app.post("/recipes/:id/report", async (req, res) => {
      try {
        const recipeId = req.params.id;
        const { reporterEmail, reason } = req.body;

        if (!recipeId || !reason) {
          return res.status(400).send({ message: "Missing fields" });
        }

        // prevent duplicate report by same user (optional but pro)
        const existing = await reportsCollection.findOne({
          recipeId,
          reporterEmail,
        });

        if (existing) {
          return res.status(409).send({
            message: "You already reported this recipe",
          });
        }

        const report = {
          recipeId,
          reporterEmail: reporterEmail || "anonymous",
          reason,
          status: "pending",
          createdAt: new Date(),
        };

        const result = await reportsCollection.insertOne(report);

        res.send({
          success: true,
          insertedId: result.insertedId,
        });

      } catch (error) {
        console.error(error);
        res.status(500).send({ message: "Server error" });
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