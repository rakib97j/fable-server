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
  res.send("FABLE Develop By rakib97j");
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

    // ==========================================
    //               DataBase
    // ==========================================

    const db = client.db("fable_db");

    // ==========================================
    //                collection
    // ==========================================
    const eBooksCollection = db.collection("e-books");
    const UserCollection = db.collection("user");
    const bookmarkCollection = db.collection("bookmarks");
    const paymentCollection = db.collection("payment");

    // ==========================================
    //               All APIs
    // ==========================================

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

    // App writer API
    app.get("/api/users/writers", async (req, res) => {
      const result = await UserCollection.find({ role: "writer" }).toArray();
      res.send(result);
    });

    // Only Writers show API
    app.get("/api/users/randomWriters", async (req, res) => {
      const result = await UserCollection.aggregate([
        { $match: { role: "writer" } },
        { $sample: { size: 3 } },
      ]).toArray();

      res.send(result);
    });

    // Writer Details API (Profile + All Books)
    app.get("/api/users/writers/:id", async (req, res) => {
      const id = req.params.id;

      const result = await UserCollection.aggregate([
        {
          $match: { _id: new ObjectId(id), role: "writer" },
        },
        {
          $lookup: {
            from: "e-books",
            localField: "email",
            foreignField: "writerEmail",
            as: "publishedBooks",
          },
        },
      ]).toArray();

      if (result.length === 0) {
        return res.status(404).send({ message: "Writer not found" });
      }

      res.send(result[0]);
    });

    // ==========================================
    //               Admin APIs
    // ==========================================

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

    // ==========================================
    //               Writer APIs
    // ==========================================

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

    // ==========================================
    //               Bookmark APIs
    // ==========================================

    // Add to book mark DB
    app.post("/api/bookmarks", async (req, res) => {
      const { userId, book } = req.body;

      const existingBookmark = await bookmarkCollection.findOne({
        userId: userId,
        bookId: book._id,
      });

      if (existingBookmark) {
        return res.status(400).send({ message: "Already bookmarked!" });
      }

      const newBookmark = {
        userId: userId,
        bookId: book._id,
        title: book.title,
        writerName: book.writerName,
        coverImage: book.coverImage,
        genre: book.genre,
        price: book.price,
        isFree: book.isFree,
        createdAt: new Date().toISOString(),
      };

      const result = await bookmarkCollection.insertOne(newBookmark);
      res.send(result);
    });

    // get api by UserId
    app.get("/api/bookmarks/:userId", async (req, res) => {
      const userId = req.params.userId;
      const result = await bookmarkCollection
        .find({ userId: userId })
        .toArray();
      res.send(result);
    });

    // Bookmark delete api
    app.delete("/api/bookmarks", async (req, res) => {
      const { userId, bookId } = req.body;

      const query = { userId: userId, bookId: bookId };
      const result = await bookmarkCollection.deleteOne(query);

      res.send(result);
    });

    // ==========================================
    //                Payment
    // ==========================================

    // payment details post api
    app.post("/api/payment", async (req, res) => {
      const data = req.body;
      const payInfo = {
        ...data,
        createdAt: new Date(),
      };

      const result = await paymentCollection.insertOne(payInfo);
      res.send(result);
    });


    // Payment history for Admin 
    app.get("/api/admin/payments", async (req, res) => {
      // const email = req.params.email;
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });

    // ==========================================
    //                last
    // ==========================================

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
