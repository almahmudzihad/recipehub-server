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
    const usersCollection = database.collection("user");
    const paymentsCollection = database.collection("payments");
    //Dashbaord

    // admin dashboard
    app.get("/admin-stats", async (req, res) => {
      try {
        

        const users = await usersCollection.countDocuments();
        const recipes = await recipesCollection.countDocuments();
        const premiumUsers = await usersCollection.countDocuments({
          isPremium: true,
        });
        const reports = await reportsCollection.countDocuments();

        res.send({
          users,
          recipes,
          premiumUsers,
          reports,
        });
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });
    app.get("/admin/dashboard", async (req, res) => {
      try {
        const totalUsers = await usersCollection.countDocuments();
        const totalRecipes = await recipesCollection.countDocuments();
        const totalPremium = await usersCollection.countDocuments({
          isPremium: true,
        });
        const totalReports = await reportsCollection.countDocuments();

        res.send({
          totalUsers,
          totalRecipes,
          totalPremium,
          totalReports,
        });
      } catch (error) {
        res.status(500).send({ message: "Server error" });
      }
    });
    app.get("/admin/users", async (req, res) => {
      const users = await usersCollection.find().toArray();
      res.send(users);
    });
    app.get("/admin/recipes/:id", async (req, res) => {
      try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid recipe id" });
        }

        const recipe = await recipesCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!recipe) {
          return res.status(404).send({ message: "Recipe not found" });
        }

        res.send(recipe);
      } catch (error) {
        res.status(500).send({
          message: "Server error",
          error: error.message,
        });
      }
    });
    app.patch("/admin/users/:id/block", async (req, res) => {
      const id = req.params.id;

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isBlocked: true } }
      );

      res.send(result);
    });

    app.patch("/admin/users/:id/unblock", async (req, res) => {
      const id = req.params.id;

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isBlocked: false } }
      );

      res.send(result);
    });
    app.get("/admin/recipes", async (req, res) => {
      const recipes = await recipesCollection.find().toArray();
      res.send(recipes);
    });
    app.delete("/admin/recipes/:id", async (req, res) => {
      const id = req.params.id;

      const result = await recipesCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });
    app.patch("/admin/recipes/:id/feature", async (req, res) => {
      const id = req.params.id;

      const result = await recipesCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { isFeatured: true } }
      );

      res.send(result);
    });
    app.get("/recipes/featured", async (req, res) => {
      const featured = await recipesCollection
        .find({ isFeatured: true })
        .limit(6)
        .toArray();

      res.send(featured);
    });
    app.get("/admin/reports", async (req, res) => {
      const reports = await reportsCollection.find().toArray();
      res.send(reports);
    });
    app.delete("/admin/reports/:id/remove-recipe", async (req, res) => {
      const reportId = req.params.id;

      const report = await reportsCollection.findOne({
        _id: new ObjectId(reportId),
      });

      if (!report) return res.status(404).send({ message: "Not found" });

      await recipesCollection.deleteOne({
        _id: new ObjectId(report.recipeId),
      });

      await reportsCollection.deleteOne({
        _id: new ObjectId(reportId),
      });

      res.send({ success: true });
    });
    app.delete("/admin/reports/:id", async (req, res) => {
      const id = req.params.id;

      const result = await reportsCollection.deleteOne({
        _id: new ObjectId(id),
      });

      res.send(result);
    });                                           

    app.get("/dashboard-stats/:email", async (req, res) => {
      const email = req.params.email;

      const totalRecipes = await recipesCollection.countDocuments({
        userEmail: email,
      });

      const totalFavorites = await favoritesCollection.countDocuments({
        userEmail: email,
      });

      const totalPurchased = await paymentsCollection.countDocuments({
        userEmail: email,
      });

      const recipes = await recipesCollection
        .find({ userEmail: email })
        .toArray();

      const totalLikes = recipes.reduce(
        (sum, recipe) => sum + (recipe.likes || 0),
        0
      );

      const user = await usersCollection.findOne({
        email,
      });

      res.send({
        totalRecipes,
        totalFavorites,
        totalPurchased,
        totalLikes,
        isPremium: user?.isPremium || false,
      });
    });
    app.patch("/users/premium", async (req, res) => {
      const { email } = req.body;

      console.log("EMAIL FROM STRIPE:", req.body);

      if (!email) {
        return res.status(400).send({ message: "Email is required" });
      }

      // 👈 Regex use korun jeno Case-Insensitive (i) vabe match kore
      // Ebong email-er shurute/sheshe space thakle trim korar jonno ^ ebong $ anchor
      const emailRegex = new RegExp(`^${email.trim()}$`, "i");

      const user = await usersCollection.findOne({ email: emailRegex });
      console.log("USER FOUND IN DB:", user);

      if (!user) {
        // User na paile update e jabe na, direct raw response dibe
        return res.send({ acknowledged: true, modifiedCount: 0, matchedCount: 0, message: "User not found in DB" });
      }

      // User paile update hobe
      const result = await usersCollection.updateOne(
        { email: emailRegex }, // 👈 Ekhaneও regex filter use korun
        { $set: { isPremium: true } }
      );

      res.send(result);
    });
    app.patch("/users/:email", async (req, res) => {
      const email = req.params.email;
      const { name, image } = req.body;

      const result = await usersCollection.updateOne(
        { email },
        {
          $set: {
            name,
            image,
            updatedAt: new Date(),
          },
        }
      );

      res.send(result);
    });
    app.post("/api/recipes", async (req, res) => {
      try {
        const recipe = req.body;

        const user = await usersCollection.findOne({
          email: recipe.userEmail,
        });

        const recipeCount =
          await recipesCollection.countDocuments({
            userEmail: recipe.userEmail,
          });

        // Free user limit
        if (!user?.isPremium && recipeCount >= 2) {
          return res.status(403).send({
            success: false,
            message:
              "Free users can only add 2 recipes. Upgrade to Premium.",
          });
        }

        const result = await recipesCollection.insertOne(
          recipe
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to create recipe",
        });
      }
    });
    app.get("/api/recipes", async (req, res) => {
      try {
        const { page = 1, limit = 6, search, category, cuisine } = req.query;

        let query = {};

        if (search) {
          query.title = { $regex: search, $options: "i" };
        }

        if (category) {
          query.category = category;
        }

        if (cuisine) {
          query.cuisine = cuisine;
        }

        const skip = (Number(page) - 1) * Number(limit);

        const recipes = await recipesCollection
          .find(query)
          .skip(skip)
          .limit(Number(limit))
          .toArray();

        const total = await recipesCollection.countDocuments(query);

        res.send({
          recipes,
          total,
          totalPages: Math.ceil(total / limit),
          currentPage: Number(page),
        });
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch recipes" });
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
    app.patch("/recipes/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const filter = { _id: new ObjectId(id) };

        const updateDoc = {
          $set: {
            ...req.body,
            updatedAt: new Date(),
          },
        };

        const result = await recipesCollection.updateOne(filter, updateDoc);

        res.send(result);
      } catch (error) {
        console.log("UPDATE ERROR:", error);

        res.status(500).send({
          message: "Internal Server Error",
          error: error.message,
        });
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
    app.get("/favorites/:email", async (req, res) => {
      const email = req.params.email;

      const favorites = await favoritesCollection
        .find({ userEmail: email })
        .toArray();

      const recipeIds = favorites.map(
        (item) => new ObjectId(item.recipeId)
      );

      const recipes = await recipesCollection
        .find({
          _id: { $in: recipeIds },
        })
        .toArray();

      res.send(recipes);
    });
    app.delete("/favorites/:recipeId/:email", async (req, res) => {
      const { recipeId, email } = req.params;

      const result = await favoritesCollection.deleteOne({
        recipeId,
        userEmail: email,
      });

      res.send(result);
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


    //payment
    app.post("/payments", async (req, res) => {
      try {
        const {
          userEmail,
          userId,
          recipeId,
          amount,
          transactionId,
          paymentStatus,
          paymentType,
        } = req.body;

        // basic validation
        if (!userEmail || !transactionId) {
          return res.status(400).send({
            message: "Missing required fields",
          });
        }

        const paymentDoc = {
          userEmail,
          userId: userId || null,
          recipeId: recipeId || null,
          amount: Number(amount) || 0,
          transactionId,
          paymentStatus: paymentStatus || "pending",
          paymentType: paymentType || "recipe", // recipe | membership
          paidAt: new Date(),
        };

        const result = await paymentsCollection.insertOne(paymentDoc);

        res.send({
          success: true,
          insertedId: result.insertedId,
        });

      } catch (error) {
        console.error("PAYMENT ERROR:", error);

        res.status(500).send({
          message: "Payment save failed",
          error: error.message,
        });
      }
    });
    app.get("/payments/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const payments = await paymentsCollection
          .find({ userEmail: email, paymentStatus: "paid" })
          .toArray();

        res.send(payments);
      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch payments",
        });
      }
    });
    app.get("/admin/transactions", async (req, res) => {
      try {
        const transactions = await paymentsCollection
          .find()
          .sort({ paidAt: -1 })
          .toArray();

        res.send(transactions);
      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch transactions",
        });
      }
    });
    
    app.get("/recipes/popular", async (req, res) => {
      try {
        const recipes = await recipesCollection
          .find()
          .sort({ likes: -1 }) // 🔥 most liked first
          .limit(6)
          .toArray();

        res.send(recipes);
      } catch (error) {
        res.status(500).send({ message: "Failed to fetch popular recipes" });
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