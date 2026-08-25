const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT || 9090;
const uri = process.env.MONGODB_URI;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

 
    // * // // * //// * //// * //// * //// * //
    ////////////////  DB ///////////////////
    // * // // * //// * //// * //// * //// * //
 
    const db = client.db("fable_db");

    // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //
    ////////////  Collection //////////////
    // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //
    const eBooksCollection = db.collection("e-books");
    const UserCollection = db.collection("user");



    // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //
    ////////////////  Api ///////////////////
    // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //

    // ebook post api
    app.post("/api/e-books", async (req, res) => {
      const eBooks = req.body;
      const newBook = {
        ...eBooks,
        status: eBooks.status || "pending",
      };
      const result = await eBooksCollection.insertOne(newBook);
      res.send(result);
    });

    // all-ebook get api (Public Library - Published & Old Books)
    app.get("/api/e-books", async (req, res) => {
      const query = {
        $or: [{ status: "published" }, { status: { $exists: false } }],
      };
      const result = await eBooksCollection.find(query).toArray();
      res.send(result);
    });

    // show random e-book on home page
    app.get("/api/e-books/random", async (req, res) => {
      const result = await eBooksCollection
        .aggregate([
          {
            $match: {
              $or: [{ status: "published" }, { status: { $exists: false } }],
            },
          },
          { $sample: { size: 4 } },
        ])
        .toArray();

      res.send(result);
    });

    // EBook details Page
    app.get("/api/e-books/:id", async (req, res) => {
      const id = req.params.id;
      const result = await eBooksCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });




   // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //
    ////////////////  Admin Api ///////////////////
    // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //





    // Admin manage e book (All status)
    app.get("/api/admin/e-books", async (req, res) => {
      const result = await eBooksCollection
        .find()
        .sort({ createdAt: -1 })
        .toArray();

      res.send(result);
    });

    //  Admin mange user Api
    app.get("/api/users", async (req, res) => {
      const result = await UserCollection.find({
        role: { $in: ["reader", "writer"] },
      }).toArray();

      res.send(result);
    });

    // User Role Update API
    app.patch("/api/users/:id", async (req, res) => {
      const id = req.params.id;
      const { role } = req.body;

      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: role,
          updatedAt: new Date().toISOString(),
        },
      };

      const result = await UserCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // 2. User Delete API (DELETE)
    app.delete("/api/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const result = await UserCollection.deleteOne(query);
      res.send(result);
    });





   
    
  // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //
    ////////////////  Writer ///////////////////
    // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //
  

    // for writer manage ebook
    app.get("/api/e-books/writer/:writerId", async (req, res) => {
      const writerId = req.params.writerId;
      const query = { writerId: writerId };
      const result = await eBooksCollection.find(query).toArray();
      res.send(result);
    });

    // Book Details & Status Edit API (Universal Patch)
    app.patch("/api/e-books/:id", async (req, res) => {
      const id = req.params.id;
      const updateData = req.body;

      delete updateData._id;

      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: updateData,
      };

      const result = await eBooksCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Delete Book API
    app.delete("/api/e-books/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await eBooksCollection.deleteOne(query);
      res.send(result);
    });



    // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //
    // * // // * //// * //// * //// * //// * //




    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
